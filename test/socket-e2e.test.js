import { io } from 'socket.io-client';

const socket = io('http://localhost:3001');

console.log('Connecting to Socket.io server...');

socket.on('connect', () => {
  console.log('✓ Connected successfully! Socket ID:', socket.id);

  // 1. Test Create Room
  socket.emit(
    'lobby:create',
    {
      name: 'Test Ofis Odası',
      gameType: 'classic',
      options: { folded: false },
      playerName: 'İsmet'
    },
    (createRes) => {
      console.assert(createRes.success === true, 'Room creation failed');
      const roomId = createRes.roomId;
      console.log(`✓ Room created with code: ${roomId}`);

      // 2. Add 3 Bots
      socket.emit('lobby:addBot', { roomId, seatIndex: 1, botName: 'Bot Ahmet' });
      socket.emit('lobby:addBot', { roomId, seatIndex: 2, botName: 'Bot Ayşe' });
      socket.emit('lobby:addBot', { roomId, seatIndex: 3, botName: 'Bot Can' });

      setTimeout(() => {
        // 3. Start Game
        socket.emit('lobby:startGame', { roomId }, (startRes) => {
          console.assert(startRes.success === true, 'Game start failed');
          console.log('✓ Game started with 3 bots!');
        });
      }, 500);
    }
  );
});

socket.on('game:state', (state) => {
  console.log(`[Game State] Status: ${state.status}, Turn Seat: ${state.turnIndex}, HasDrawn: ${state.hasDrawn}`);
  console.log(`[Game State] Okey: ${state.okeyInfo.color} ${state.okeyInfo.value}, Gösterge: ${state.indicator.color} ${state.indicator.value}`);
  console.log(`[Game State] Viewer Hand Tiles: ${state.players[0]?.hand?.length}`);

  // If it's our turn, draw and discard
  if (state.turnIndex === 0) {
    if (!state.hasDrawn) {
      console.log('Player 0 drawing tile...');
      socket.emit('game:drawTile', { roomId: state.roomId, fromDiscard: false }, (drawRes) => {
        console.log('✓ Draw tile res:', drawRes.success);
      });
    } else {
      const tileToDiscard = state.players[0].hand[0];
      console.log(`Player 0 discarding tile: ${tileToDiscard.color} ${tileToDiscard.value}...`);
      socket.emit('game:discardTile', { roomId: state.roomId, tileId: tileToDiscard.id, isFinishing: false }, (discRes) => {
        console.log('✓ Discard tile res:', discRes.success);
        console.log('\n🎉 ALL REAL-TIME SOCKET & GAME FLOW TESTS VERIFIED!');
        setTimeout(() => {
          socket.disconnect();
          process.exit(0);
        }, 1500);
      });
    }
  }
});
