import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { RoomManager } from './lobby/RoomManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const roomManager = new RoomManager();

// Helper to get local IPv4 address for easy office LAN sharing
function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

const localIp = getLocalIp();
const PORT = process.env.PORT || 3001;

// API Endpoints
app.get('/api/info', (req, res) => {
  res.json({
    status: 'online',
    localIp,
    port: PORT,
    roomsCount: roomManager.rooms.size,
    publicUrl: `http://${localIp}:3000`
  });
});

app.get('/api/rooms', (req, res) => {
  res.json(roomManager.listRooms());
});

// Serve frontend if built
const distPath = path.join(__dirname, '../dist');
app.use(express.static(distPath));

// Broadcast Game State to all players in a room (tailored per player)
function broadcastGameState(room) {
  if (!room || !room.game) return;

  for (const seat of room.seats) {
    if (seat && !seat.isBot) {
      const clientState = room.game.getClientState(seat.id);
      io.to(seat.id).emit('game:state', clientState);
    }
  }
}

// Broadcast Lobby State
function broadcastLobbyState(room) {
  if (!room) return;
  io.to(`room-${room.id}`).emit('room:state', room.getLobbyState());
}

// Socket IO Event Handling
io.on('connection', (socket) => {
  console.log(`[Socket Connected] ID: ${socket.id}`);

  // Create Room
  socket.on('lobby:create', ({ name, gameType, options, playerName }, callback) => {
    try {
      const room = roomManager.createRoom(
        name,
        gameType,
        options,
        { id: socket.id, name: playerName || 'Oyuncu 1' }
      );
      socket.join(`room-${room.id}`);

      broadcastLobbyState(room);
      if (callback) callback({ success: true, roomId: room.id });
    } catch (err) {
      console.error('Error creating room:', err);
      if (callback) callback({ success: false, message: 'Oda oluşturulamadı.' });
    }
  });

  // Join Room
  socket.on('lobby:join', ({ roomId, playerName, seatIndex }, callback) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) {
        if (callback) callback({ success: false, message: 'Oda bulunamadı.' });
        return;
      }

      if (room.status === 'playing') {
        if (callback) callback({ success: false, message: 'Bu odada oyun şu an devam ediyor.' });
        return;
      }

      const joinRes = room.join(socket.id, playerName, seatIndex);
      if (!joinRes.success) {
        if (callback) callback(joinRes);
        return;
      }

      socket.join(`room-${room.id}`);
      broadcastLobbyState(room);

      if (callback) callback({ success: true, seatIndex: joinRes.seatIndex });
    } catch (err) {
      console.error('Error joining room:', err);
      if (callback) callback({ success: false, message: 'Odaya katılırken hata oluştu.' });
    }
  });

  // Toggle Ready
  socket.on('lobby:setReady', ({ roomId, isReady }) => {
    const room = roomManager.getRoom(roomId);
    if (!room) return;
    room.setReady(socket.id, isReady);
    broadcastLobbyState(room);
  });

  // Add Bot
  socket.on('lobby:addBot', ({ roomId, seatIndex, botName }) => {
    const room = roomManager.getRoom(roomId);
    if (!room || room.hostId !== socket.id) return;
    room.addBot(seatIndex, botName);
    broadcastLobbyState(room);
  });

  // Remove Bot
  socket.on('lobby:removeBot', ({ roomId, seatIndex }) => {
    const room = roomManager.getRoom(roomId);
    if (!room || room.hostId !== socket.id) return;
    room.removeBot(seatIndex);
    broadcastLobbyState(room);
  });

  // Start Game
  socket.on('lobby:startGame', ({ roomId }, callback) => {
    const room = roomManager.getRoom(roomId);
    if (!room || room.hostId !== socket.id) {
      if (callback) callback({ success: false, message: 'Sadece oda kurucusu oyunu başlatabilir.' });
      return;
    }

    const startRes = room.startGame();
    if (!startRes.success) {
      if (callback) callback(startRes);
      return;
    }

    broadcastLobbyState(room);
    broadcastGameState(room);

    // If first player is a bot, trigger turn
    room.checkBotTurn(() => {
      broadcastGameState(room);
    });

    if (callback) callback({ success: true });
  });

  // Draw Tile
  socket.on('game:drawTile', ({ roomId, fromDiscard }, callback) => {
    const room = roomManager.getRoom(roomId);
    if (!room || !room.game) return;

    const res = room.game.drawTile(socket.id, fromDiscard);
    broadcastGameState(room);
    if (callback) callback(res);
  });

  // Discard Tile
  socket.on('game:discardTile', ({ roomId, tileId, isFinishing }, callback) => {
    const room = roomManager.getRoom(roomId);
    if (!room || !room.game) return;

    const res = room.game.discardTile(socket.id, tileId, isFinishing);
    broadcastGameState(room);
    if (callback) callback(res);

    // If next player is a bot, trigger their turn
    room.checkBotTurn(() => {
      broadcastGameState(room);
    });
  });

  // Claim Gösterge (Classic Okey)
  socket.on('game:claimGosterge', ({ roomId }, callback) => {
    const room = roomManager.getRoom(roomId);
    if (!room || !room.game || room.game.gameType !== 'classic') return;

    const res = room.game.claimGosterge(socket.id);
    broadcastGameState(room);
    if (callback) callback(res);
  });

  // Open Hand with Runs (101 Okey)
  socket.on('game:openRuns', ({ roomId, pers }, callback) => {
    const room = roomManager.getRoom(roomId);
    if (!room || !room.game || room.game.gameType !== '101') return;

    const res = room.game.openRunsHand(socket.id, pers);
    broadcastGameState(room);
    if (callback) callback(res);
  });

  // Open Hand with Pairs (101 Okey)
  socket.on('game:openPairs', ({ roomId, pairs }, callback) => {
    const room = roomManager.getRoom(roomId);
    if (!room || !room.game || room.game.gameType !== '101') return;

    const res = room.game.openPairsHand(socket.id, pairs);
    broadcastGameState(room);
    if (callback) callback(res);
  });

  // Process Tile onto Table (101 Okey)
  socket.on('game:processTile', ({ roomId, tileId, targetPerId }, callback) => {
    const room = roomManager.getRoom(roomId);
    if (!room || !room.game || room.game.gameType !== '101') return;

    const res = room.game.processTile(socket.id, tileId, targetPerId);
    broadcastGameState(room);
    if (callback) callback(res);
  });

  // Process Pair onto Table (101 Okey)
  socket.on('game:processPair', ({ roomId, tileId1, tileId2, targetSeatIndex }, callback) => {
    const room = roomManager.getRoom(roomId);
    if (!room || !room.game || room.game.gameType !== '101') return;

    const res = room.game.processPair(socket.id, tileId1, tileId2, targetSeatIndex);
    broadcastGameState(room);
    if (callback) callback(res);
  });

  // Advance Round
  socket.on('game:nextRound', ({ roomId }) => {
    const room = roomManager.getRoom(roomId);
    if (!room || !room.game || room.hostId !== socket.id) return;

    room.game.advanceRound();
    broadcastGameState(room);

    room.checkBotTurn(() => {
      broadcastGameState(room);
    });
  });

  // Send Chat
  socket.on('chat:send', ({ roomId, text, senderName }) => {
    const room = roomManager.getRoom(roomId);
    if (!room || !text.trim()) return;

    const msg = room.addChatMessage(senderName, text.trim(), false);
    io.to(`room-${roomId}`).emit('chat:message', msg);
  });

  // Disconnect
  socket.on('disconnect', () => {
    console.log(`[Socket Disconnected] ID: ${socket.id}`);
    const room = roomManager.findRoomBySocketId(socket.id);
    if (room) {
      room.leave(socket.id);
      roomManager.cleanRoomIfEmpty(room.id);
      broadcastLobbyState(room);
      if (room.game) {
        broadcastGameState(room);
        room.checkBotTurn(() => {
          broadcastGameState(room);
        });
      }
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`=========================================`);
  console.log(`🎮 Okey & 101 Okey Sunucusu Başlatıldı!`);
  console.log(`📡 Yerel Port: http://localhost:${PORT}`);
  console.log(`🌐 Ofis Ağı (LAN): http://${localIp}:${PORT}`);
  console.log(`=========================================`);
});
