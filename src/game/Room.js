import { OkeyGame } from './OkeyGame.js';
import { Okey101Game } from './Okey101Game.js';
import { BotAI } from './BotAI.js';

export class Room {
  constructor(id, name, gameType = 'classic', options = {}, host) {
    this.id = id;
    this.name = name || `Masa #${id}`;
    this.gameType = gameType;
    this.options = options;
    this.hostId = host.id;
    this.seats = [null, null, null, null];
    this.chatMessages = [];
    this.game = null;
    this.status = 'lobby';

    this.seats[0] = {
      id: host.id,
      name: host.name || 'Ev Sahibi',
      isBot: false,
      isReady: true,
      isHost: true
    };

    this.addSystemMessage(`${this.seats[0].name} masayı oluşturdu.`);
  }

  join(socketId, playerName, preferredSeat = -1) {
    const existingIdx = this.seats.findIndex(s => s && s.id === socketId);
    if (existingIdx !== -1) {
      return { success: true, seatIndex: existingIdx };
    }

    let seatIdx = preferredSeat;
    if (seatIdx < 0 || seatIdx > 3 || this.seats[seatIdx] !== null) {
      seatIdx = this.seats.findIndex(s => s === null);
    }

    if (seatIdx === -1) {
      return { success: false, message: 'Masa dolu.' };
    }

    this.seats[seatIdx] = {
      id: socketId,
      name: playerName || `Oyuncu ${seatIdx + 1}`,
      isBot: false,
      isReady: false,
      isHost: false
    };

    this.addSystemMessage(`${this.seats[seatIdx].name} masaya oturdu.`);
    return { success: true, seatIndex: seatIdx };
  }

  leave(socketId) {
    const idx = this.seats.findIndex(s => s && s.id === socketId);
    if (idx === -1) return false;

    const departingPlayer = this.seats[idx];
    this.seats[idx] = null;
    this.addSystemMessage(`${departingPlayer.name} masadan ayrıldı.`);

    if (departingPlayer.isHost) {
      const nextHost = this.seats.find(s => s && !s.isBot);
      if (nextHost) {
        nextHost.isHost = true;
        this.hostId = nextHost.id;
      }
    }

    if (this.game && this.status === 'playing') {
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
    }

    return true;
  }

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

  removeBot(seatIdx) {
    if (this.seats[seatIdx] && this.seats[seatIdx].isBot) {
      const name = this.seats[seatIdx].name;
      this.seats[seatIdx] = null;
      this.addSystemMessage(`${name} masadan kalktı.`);
      return true;
    }
    return false;
  }

  setReady(socketId, isReady) {
    const player = this.seats.find(s => s && s.id === socketId);
    if (player) {
      player.isReady = isReady;
      return true;
    }
    return false;
  }

  startGame() {
    const activeSeats = this.seats.filter(s => s !== null);
    if (activeSeats.length !== 4) {
      return { success: false, message: 'Oyuna başlamak için masada 4 oyuncu (veya bot) olmalıdır.' };
    }

    if (this.gameType === '101') {
      this.game = new Okey101Game(this.id, this.options);
    } else {
      this.game = new OkeyGame(this.id, this.options);
    }

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
    this.addSystemMessage('Oyun başladı!');

    return { success: true };
  }

  checkBotTurn(broadcastCallback) {
    if (this.status !== 'playing' || !this.game) return;
    const activeTurnIdx = this.game.turnIndex;
    const activePlayer = this.game.players[activeTurnIdx];

    if (activePlayer && activePlayer.isBot) {
      BotAI.playTurn(this.game, activePlayer, () => {
        if (broadcastCallback) broadcastCallback();
        setTimeout(() => this.checkBotTurn(broadcastCallback), 400);
      });
    }
  }

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
      chatMessages: [...this.chatMessages]
    };
  }
}
