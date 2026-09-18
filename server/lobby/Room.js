import { OkeyGame } from '../game/OkeyGame.js';
import { Okey101Game } from '../game/Okey101Game.js';
import { BotAI } from '../game/BotAI.js';

export class Room {
  constructor(id, name, gameType = 'classic', options = {}, host) {
    this.id = id;
    this.name = name || `Oda #${id}`;
    this.gameType = gameType; // 'classic' | '101'
    this.options = options;
    this.hostId = host.id;
    this.seats = [null, null, null, null]; // 4 seats
    this.chatMessages = [];
    this.game = null;
    this.status = 'lobby'; // 'lobby' | 'playing'
    this.mediaState = {
      currentTrack: null,
      queue: [],
      isPlaying: true
    };

    // Add host to seat 0
    this.seats[0] = {
      id: host.id,
      name: host.name || 'Ev Sahibi',
      isBot: false,
      isReady: true,
      isHost: true
    };

    this.addSystemMessage(`${this.seats[0].name} odayı oluşturdu.`);
  }

  // Join a player to an empty seat
  join(socketId, playerName, preferredSeat = -1) {
    // Check if player already in room
    const existingIdx = this.seats.findIndex(s => s && s.id === socketId);
    if (existingIdx !== -1) {
      return { success: true, seatIndex: existingIdx };
    }

    let seatIdx = preferredSeat;
    if (seatIdx < 0 || seatIdx > 3 || this.seats[seatIdx] !== null) {
      seatIdx = this.seats.findIndex(s => s === null);
    }

    if (seatIdx === -1) {
      return { success: false, message: 'Oda dolu (Maksimum 4 kişi).' };
    }

    this.seats[seatIdx] = {
      id: socketId,
      name: playerName || `Oyuncu ${seatIdx + 1}`,
      isBot: false,
      isReady: false,
      isHost: false
    };

    this.addSystemMessage(`${this.seats[seatIdx].name} odaya katıldı.`);
    return { success: true, seatIndex: seatIdx };
  }

  // Leave room
  leave(socketId) {
    const idx = this.seats.findIndex(s => s && s.id === socketId);
    if (idx === -1) return false;

    const departingPlayer = this.seats[idx];
    this.seats[idx] = null;
    this.addSystemMessage(`${departingPlayer.name} odadan ayrıldı.`);

    // If host leaves, assign host to first human
    if (departingPlayer.isHost) {
      const nextHost = this.seats.find(s => s && !s.isBot);
      if (nextHost) {
        nextHost.isHost = true;
        this.hostId = nextHost.id;
        this.addSystemMessage(`${nextHost.name} yeni oda yöneticisi oldu.`);
      }
    }

    // If game was playing and someone leaves, pause or replace with bot
    if (this.game && this.status === 'playing') {
      // Auto-replace with bot
      this.seats[idx] = {
        id: `bot-${Date.now()}-${idx}`,
        name: `Bot (${departingPlayer.name})`,
        isBot: true,
        isReady: true,
        isHost: false
      };
      if (this.game.players[idx]) {
        this.game.players[idx].id = this.seats[idx].id;
        this.game.players[idx].name = this.seats[idx].name;
        this.game.players[idx].isBot = true;
      }
      this.addSystemMessage(`${departingPlayer.name} yerine Bot atandı.`);
    }

    return true;
  }

  // Add bot to a specific empty seat
  addBot(seatIdx, botName) {
    if (seatIdx < 0 || seatIdx > 3 || this.seats[seatIdx] !== null) {
      return { success: false, message: 'Koltuk boş değil.' };
    }

    const defaultNames = ['Ahmet (Bot)', 'Zeynep (Bot)', 'Can (Bot)', 'Elif (Bot)'];
    const name = botName || defaultNames[seatIdx];

    this.seats[seatIdx] = {
      id: `bot-${Date.now()}-${seatIdx}`,
      name,
      isBot: true,
      isReady: true,
      isHost: false
    };

    this.addSystemMessage(`${name} masaya oturdu.`);
    return { success: true, seatIndex: seatIdx };
  }

  // Remove bot
  removeBot(seatIdx) {
    if (this.seats[seatIdx] && this.seats[seatIdx].isBot) {
      const name = this.seats[seatIdx].name;
      this.seats[seatIdx] = null;
      this.addSystemMessage(`${name} masadan kalktı.`);
      return true;
    }
    return false;
  }

  // Set ready status
  setReady(socketId, isReady) {
    const player = this.seats.find(s => s && s.id === socketId);
    if (player) {
      player.isReady = isReady;
      return true;
    }
    return false;
  }

  updatePlayerAvatar(socketId, avatar) {
    if (!avatar) return false;
    const seat = this.seats.find(s => s && s.id === socketId);
    if (seat) {
      seat.avatar = avatar;
    }
    if (this.game && this.game.players) {
      const player = this.game.players.find(p => p && p.id === socketId);
      if (player) {
        player.avatar = avatar;
      }
    }
    return true;
  }

  // Start the game
  startGame() {
    // Must have all 4 seats occupied
    const activeSeats = this.seats.filter(s => s !== null);
    if (activeSeats.length !== 4) {
      return { success: false, message: 'Oyuna başlamak için masada 4 oyuncu (veya bot) olmalıdır.' };
    }

    if (this.gameType === '101') {
      this.game = new Okey101Game(this.id, this.options);
    } else {
      this.game = new OkeyGame(this.id, this.options);
    }

    // Populate game players
    this.game.players = this.seats.map((s, idx) => ({
      id: s.id,
      name: s.name,
      isBot: s.isBot,
      seat: idx,
      hand: [],
      score: 0
    }));

    this.status = 'playing';
    this.game.startNewRound();
    this.addSystemMessage(`Oyun başladı! İyi şanslar.`);

    return { success: true };
  }

  // Process Bot Turn triggers
  checkBotTurn(broadcastCallback) {
    if (this.status !== 'playing' || !this.game) return;
    const activeTurnIdx = this.game.turnIndex;
    const activePlayer = this.game.players[activeTurnIdx];

    if (activePlayer && activePlayer.isBot) {
      BotAI.playTurn(this.game, activePlayer, () => {
        if (broadcastCallback) broadcastCallback();
        // Check next turn if next player is also a bot
        setTimeout(() => this.checkBotTurn(broadcastCallback), 400);
      });
    }
  }

  // Chat message
  addChatMessage(sender, text, isSystem = false) {
    const msg = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      sender,
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isSystem
    };
    this.chatMessages.push(msg);
    if (this.chatMessages.length > 60) this.chatMessages.shift();
    return msg;
  }

  addSystemMessage(text) {
    return this.addChatMessage('Sistem', text, true);
  }

  addMediaTrack(track) {
    if (!this.mediaState.currentTrack) {
      this.mediaState.currentTrack = track;
      this.mediaState.isPlaying = true;
    } else {
      this.mediaState.queue.push(track);
    }
    return this.getMediaState();
  }

  skipMediaTrack() {
    if (this.mediaState.queue.length > 0) {
      this.mediaState.currentTrack = this.mediaState.queue.shift();
      this.mediaState.isPlaying = true;
    } else {
      this.mediaState.currentTrack = null;
      this.mediaState.isPlaying = false;
    }
    return this.getMediaState();
  }

  removeMediaTrack(trackId) {
    this.mediaState.queue = this.mediaState.queue.filter(t => t.id !== trackId);
    return this.getMediaState();
  }

  toggleMediaPlay(isPlaying) {
    if (isPlaying !== undefined) {
      this.mediaState.isPlaying = isPlaying;
    } else {
      this.mediaState.isPlaying = !this.mediaState.isPlaying;
    }
    return this.getMediaState();
  }

  getMediaState() {
    return {
      currentTrack: this.mediaState.currentTrack ? { ...this.mediaState.currentTrack } : null,
      queue: [...this.mediaState.queue],
      isPlaying: this.mediaState.isPlaying
    };
  }

  // Public lobby info
  getLobbyState() {
    return {
      id: this.id,
      name: this.name,
      gameType: this.gameType,
      options: this.options,
      hostId: this.hostId,
      seats: this.seats,
      status: this.status,
      playerCount: this.seats.filter(s => s !== null).length,
      chatMessages: [...this.chatMessages],
      mediaState: this.getMediaState()
    };
  }
}
