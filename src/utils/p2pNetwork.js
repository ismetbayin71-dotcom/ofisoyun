import Peer from 'peerjs';
import { Room } from '../game/Room.js';

class P2PNetwork {
  constructor() {
    this.peer = null;
    this.isHost = false;
    this.roomId = null;
    this.localRoom = null; // Only for host
    this.connections = new Map(); // connId -> conn
    this.hostConn = null; // For guests: connection to host
    this.listeners = new Map(); // eventName -> Array<cb>
    this.myId = null;
    this.playerName = 'Oyuncu';
  }

  // Initialize peer
  initPeer(customId = null) {
    return new Promise((resolve, reject) => {
      if (this.peer && !this.peer.destroyed) {
        this.peer.destroy();
      }

      const peerId = customId || `okey-player-${Math.floor(1000 + Math.random() * 9000)}`;
      this.peer = new Peer(peerId, {
        debug: 1
      });

      this.peer.on('open', (id) => {
        this.myId = id;
        this.emitLocal('connect', id);
        resolve(id);
      });

      this.peer.on('error', (err) => {
        console.error('Peer error:', err);
        reject(err);
      });

      // If incoming connection (host receiving guest connections)
      this.peer.on('connection', (conn) => {
        this.setupHostConnection(conn);
      });
    });
  }

  // HOST: Create Room
  async createRoom({ name, gameType, options, playerName }) {
    this.isHost = true;
    this.playerName = playerName;

    // Generate 4 digit code
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    this.roomId = code;

    await this.initPeer(`okey-room-${code}`);

    this.localRoom = new Room(
      code,
      name,
      gameType,
      options,
      { id: this.myId, name: playerName }
    );

    // Initial broadcast to local UI
    this.emitLocal('room:state', this.localRoom.getLobbyState());
    return { success: true, roomId: code };
  }

  // GUEST: Join Room
  async joinRoom({ roomId, playerName }) {
    this.isHost = false;
    this.playerName = playerName;
    this.roomId = roomId;

    await this.initPeer();

    return new Promise((resolve) => {
      const targetHostId = `okey-room-${roomId}`;
      const conn = this.peer.connect(targetHostId);
      this.hostConn = conn;

      conn.on('open', () => {
        // Send join request to host
        conn.send({
          type: 'lobby:join',
          senderId: this.myId,
          playerName
        });
      });

      conn.on('data', (data) => {
        this.handleGuestReceivedData(data, resolve);
      });

      conn.on('error', (err) => {
        resolve({ success: false, message: 'Odaya bağlanılamadı. Kodun doğruluğunu kontrol edin.' });
      });

      setTimeout(() => {
        if (!this.localRoomStateReceived) {
          resolve({ success: false, message: 'Oda kurucusuna bağlanırken zaman aşımı oluştu.' });
        }
      }, 7000);
    });
  }

  // Host receiving connection from guest
  setupHostConnection(conn) {
    this.connections.set(conn.peer, conn);

    conn.on('data', (data) => {
      this.handleHostReceivedData(conn, data);
    });

    conn.on('close', () => {
      this.connections.delete(conn.peer);
      if (this.localRoom) {
        this.localRoom.leave(conn.peer);
        this.broadcastState();
      }
    });
  }

  // Host handling actions from guests
  handleHostReceivedData(conn, data) {
    if (!this.localRoom) return;

    switch (data.type) {
      case 'lobby:join': {
        const joinRes = this.localRoom.join(conn.peer, data.playerName);
        conn.send({
          type: 'lobby:join_response',
          success: joinRes.success,
          message: joinRes.message,
          seatIndex: joinRes.seatIndex
        });
        this.broadcastState();
        break;
      }

      case 'lobby:setReady': {
        this.localRoom.setReady(conn.peer, data.isReady);
        this.broadcastState();
        break;
      }

      case 'game:drawTile': {
        if (!this.localRoom.game) return;
        const res = this.localRoom.game.drawTile(conn.peer, data.fromDiscard);
        if (!res.success && res.message) {
          conn.send({ type: 'game:action_error', message: res.message });
        }
        this.broadcastState();
        break;
      }

      case 'game:discardTile': {
        if (!this.localRoom.game) return;
        const res = this.localRoom.game.discardTile(conn.peer, data.tileId, data.isFinishing);
        if (!res.success && res.message) {
          conn.send({ type: 'game:action_error', message: res.message });
        }
        this.broadcastState();
        this.localRoom.checkBotTurn(() => this.broadcastState());
        break;
      }

      case 'game:openRuns': {
        if (!this.localRoom.game) return;
        const res = this.localRoom.game.openRunsHand(conn.peer, data.pers);
        if (!res.success && res.message) {
          conn.send({ type: 'game:action_error', message: res.message });
        }
        this.broadcastState();
        break;
      }

      case 'game:openPairs': {
        if (!this.localRoom.game) return;
        const res = this.localRoom.game.openPairsHand(conn.peer, data.pairs);
        if (!res.success && res.message) {
          conn.send({ type: 'game:action_error', message: res.message });
        }
        this.broadcastState();
        break;
      }

      case 'game:processTile': {
        if (!this.localRoom.game) return;
        const res = this.localRoom.game.processTile(conn.peer, data.tileId, data.targetPerId);
        if (!res.success && res.message) {
          conn.send({ type: 'game:action_error', message: res.message });
        }
        this.broadcastState();
        break;
      }

      case 'game:processPair': {
        if (!this.localRoom.game) return;
        const res = this.localRoom.game.processPair(conn.peer, data.tileId1, data.tileId2, data.targetSeatIndex);
        if (!res.success && res.message) {
          conn.send({ type: 'game:action_error', message: res.message });
        }
        this.broadcastState();
        break;
      }

      case 'game:returnDiscardTile': {
        if (!this.localRoom.game || !this.localRoom.game.returnDiscardTile) return;
        const res = this.localRoom.game.returnDiscardTile(conn.peer);
        if (!res.success && res.message) {
          conn.send({ type: 'game:action_error', message: res.message });
        }
        this.broadcastState();
        break;
      }

      case 'chat:send': {
        this.localRoom.addChatMessage(data.senderName, data.text, false);
        this.broadcastState();
        break;
      }
    }
  }

  // Guest receiving data from host
  handleGuestReceivedData(data, joinResolve) {
    if (data.type === 'lobby:join_response') {
      this.localRoomStateReceived = true;
      if (joinResolve) joinResolve({ success: data.success, message: data.message });
    } else if (data.type === 'room:state') {
      this.localRoomStateReceived = true;
      this.emitLocal('room:state', data.state);
    } else if (data.type === 'game:state') {
      this.emitLocal('game:state', data.state);
    } else if (data.type === 'game:action_error') {
      alert(data.message);
    }
  }

  // Host broadcasting state to local UI and all connected peers
  broadcastState() {
    if (!this.localRoom) return;

    const lobbyState = this.localRoom.getLobbyState();
    this.emitLocal('room:state', lobbyState);

    // Send lobby state to all peers
    for (const conn of this.connections.values()) {
      conn.send({ type: 'room:state', state: lobbyState });
    }

    // If game active, broadcast scrubbed game states
    if (this.localRoom.game) {
      // Local host state
      const hostGameState = this.localRoom.game.getClientState(this.myId);
      hostGameState.chatMessages = [...(this.localRoom.chatMessages || [])];
      this.emitLocal('game:state', hostGameState);

      // Tailored client states to each peer
      for (const [peerId, conn] of this.connections.entries()) {
        const guestGameState = this.localRoom.game.getClientState(peerId);
        guestGameState.chatMessages = [...(this.localRoom.chatMessages || [])];
        conn.send({ type: 'game:state', state: guestGameState });
      }
    }
  }

  // UI Action dispatcher
  emit(event, data, callback) {
    if (this.isHost) {
      // Execute directly on host
      this.handleHostDirectAction(event, data, callback);
    } else {
      // Send to host over WebRTC
      if (this.hostConn && this.hostConn.open) {
        this.hostConn.send({ type: event, ...data });
      }
      if (callback) callback({ success: true });
    }
  }

  handleHostDirectAction(event, data, callback) {
    if (!this.localRoom) return;

    if (event === 'lobby:setReady') {
      this.localRoom.setReady(this.myId, data.isReady);
      this.broadcastState();
    } else if (event === 'lobby:addBot') {
      this.localRoom.addBot(data.seatIndex, data.botName);
      this.broadcastState();
    } else if (event === 'lobby:removeBot') {
      this.localRoom.removeBot(data.seatIndex);
      this.broadcastState();
    } else if (event === 'lobby:startGame') {
      const res = this.localRoom.startGame();
      this.broadcastState();
      if (res.success) {
        this.localRoom.checkBotTurn(() => this.broadcastState());
      }
      if (callback) callback(res);
    } else if (event === 'game:drawTile') {
      const res = this.localRoom.game?.drawTile(this.myId, data.fromDiscard);
      this.broadcastState();
      if (callback) callback(res);
    } else if (event === 'game:discardTile') {
      const res = this.localRoom.game?.discardTile(this.myId, data.tileId, data.isFinishing);
      this.broadcastState();
      this.localRoom.checkBotTurn(() => this.broadcastState());
      if (callback) callback(res);
    } else if (event === 'game:openRuns') {
      const res = this.localRoom.game?.openRunsHand(this.myId, data.pers);
      this.broadcastState();
      if (callback) callback(res);
    } else if (event === 'game:openPairs') {
      const res = this.localRoom.game?.openPairsHand(this.myId, data.pairs);
      this.broadcastState();
      if (callback) callback(res);
    } else if (event === 'game:processTile') {
      const res = this.localRoom.game?.processTile(this.myId, data.tileId, data.targetPerId);
      this.broadcastState();
      if (callback) callback(res);
    } else if (event === 'game:processPair') {
      const res = this.localRoom.game?.processPair(this.myId, data.tileId1, data.tileId2, data.targetSeatIndex);
      this.broadcastState();
      if (callback) callback(res);
    } else if (event === 'game:returnDiscardTile') {
      const res = this.localRoom.game?.returnDiscardTile?.(this.myId);
      this.broadcastState();
      if (callback) callback(res);
    } else if (event === 'game:nextRound') {
      this.localRoom.game?.advanceRound();
      this.broadcastState();
      this.localRoom.checkBotTurn(() => this.broadcastState());
    } else if (event === 'chat:send') {
      this.localRoom.addChatMessage(data.senderName, data.text, false);
      this.broadcastState();
    }
  }

  // Local event bus for React UI
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  off(event, callback) {
    if (!this.listeners.has(event)) return;
    this.listeners.set(
      event,
      this.listeners.get(event).filter(cb => cb !== callback)
    );
  }

  emitLocal(event, data) {
    const cbs = this.listeners.get(event);
    if (cbs) {
      cbs.forEach(cb => cb(data));
    }
  }

  leaveRoom() {
    if (this.isHost) {
      for (const conn of this.connections.values()) {
        conn.close();
      }
      this.connections.clear();
      this.localRoom = null;
    } else if (this.hostConn) {
      this.hostConn.close();
      this.hostConn = null;
    }
    this.roomId = null;
    this.isHost = false;
  }
}

export const p2pNetwork = new P2PNetwork();
