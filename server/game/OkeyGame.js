import { Deck } from '../models/Deck.js';
import { RuleValidator } from '../models/RuleValidator.js';

export class OkeyGame {
  constructor(roomId, options = {}) {
    this.roomId = roomId;
    this.gameType = 'classic';
    this.options = {
      targetScore: options.targetScore || 20, // Points to play up to
      ...options
    };

    this.players = []; // Array of 4 player objects
    this.status = 'waiting'; // 'waiting', 'playing', 'round_ended', 'game_ended'
    this.currentRound = 0;
    this.dealerIndex = 0;
    this.turnIndex = 0;
    this.hasDrawn = false; // Whether active player has drawn a tile this turn

    this.deck = null;
    this.indicator = null;
    this.okeyInfo = null;
    this.discardPiles = [[], [], [], []]; // Discard piles for seats 0, 1, 2, 3
    this.gostergeClaimed = false;
    this.lastAction = null;
    this.winner = null;
    this.scores = [0, 0, 0, 0];
  }

  // Initialize a new round
  startNewRound() {
    this.currentRound++;
    this.deck = new Deck();
    this.deck.generate();
    this.deck.shuffle();
    this.deck.setupIndicatorAndOkey();

    this.indicator = this.deck.indicator;
    this.okeyInfo = this.deck.okeyTileInfo;

    // First player who gets 15 tiles is the one right after dealer
    const firstPlayerIndex = (this.dealerIndex + 1) % 4;
    this.turnIndex = firstPlayerIndex;
    this.hasDrawn = true; // First player already has 15 tiles, needs to discard directly!

    const hands = this.deck.dealHands(false, firstPlayerIndex);
    for (let i = 0; i < 4; i++) {
      if (this.players[i]) {
        this.players[i].hand = hands[i];
      }
    }

    this.discardPiles = [[], [], [], []];
    this.gostergeClaimed = false;
    this.status = 'playing';
    this.winner = null;
    this.lastAction = {
      type: 'ROUND_STARTED',
      message: `${this.players[firstPlayerIndex]?.name || 'Oyuncu'} 15 taş ile oyuna başlıyor.`
    };
  }

  // Claim Gösterge at the start
  claimGosterge(playerId) {
    const playerIndex = this.getPlayerIndex(playerId);
    if (playerIndex === -1 || this.gostergeClaimed || this.status !== 'playing') {
      return { success: false, message: 'Gösterge yapılamaz.' };
    }

    const player = this.players[playerIndex];
    // Check if player has the indicator tile (exact same color & value, not fake joker)
    const hasTile = player.hand.some(
      t => !t.isFakeJoker && t.color === this.indicator.color && t.value === this.indicator.value
    );

    if (!hasTile) {
      return { success: false, message: 'Elinizde gösterge taşı bulunmuyor.' };
    }

    this.gostergeClaimed = true;
    // Gösterge gives 1 point bonus or penalizes others
    this.scores[playerIndex] += 1;
    this.lastAction = {
      type: 'GOSTERGE_CLAIMED',
      message: `${player.name} gösterge yaptı! (+1 Puan)`
    };

    return { success: true, message: 'Gösterge başarıyla yapıldı!' };
  }

  // Draw tile from deck or discard pile
  drawTile(playerId, fromDiscard = false) {
    const pIdx = this.getPlayerIndex(playerId);
    if (pIdx !== this.turnIndex) {
      return { success: false, message: 'Sıra sizde değil.' };
    }
    if (this.hasDrawn) {
      return { success: false, message: 'Zaten taş çektiniz, bir taş atmalısınız.' };
    }

    let drawnTile = null;
    if (fromDiscard) {
      // Draw from previous player's discard pile (left player: (pIdx + 3) % 4)
      const leftPlayerIdx = (pIdx + 3) % 4;
      const leftPile = this.discardPiles[leftPlayerIdx];
      if (!leftPile || leftPile.length === 0) {
        return { success: false, message: 'Yandan alınacak taş yok.' };
      }
      drawnTile = leftPile.pop();
    } else {
      // Draw from center deck
      drawnTile = this.deck.draw();
      if (!drawnTile) {
        // Deck is empty, round ends in draw
        this.status = 'round_ended';
        this.lastAction = { type: 'DRAW', message: 'Deste bitti! Tur berabere tamamlandı.' };
        return { success: true, message: 'Deste bitti!' };
      }
    }

    this.players[pIdx].hand.push(drawnTile);
    this.hasDrawn = true;
    this.lastAction = {
      type: 'DRAW_TILE',
      message: `${this.players[pIdx].name} ${fromDiscard ? 'yandan' : 'ortadan'} taş çekti.`
    };

    return { success: true, drawnTile };
  }

  // Discard tile to the right pile or onto center to finish
  discardTile(playerId, tileId, isFinishing = false) {
    const pIdx = this.getPlayerIndex(playerId);
    if (pIdx !== this.turnIndex) {
      return { success: false, message: 'Sıra sizde değil.' };
    }
    if (!this.hasDrawn) {
      return { success: false, message: 'Önce bir taş çekmelisiniz.' };
    }

    const player = this.players[pIdx];
    const tileIndex = player.hand.findIndex(t => t.id === tileId);
    if (tileIndex === -1) {
      return { success: false, message: 'Atılacak taş elinizde bulunamadı.' };
    }

    const [discardedTile] = player.hand.splice(tileIndex, 1);

    // If player declared to finish
    if (isFinishing) {
      const remainingHand = player.hand;
      const winCheck = RuleValidator.checkClassicWin(remainingHand, this.okeyInfo);

      if (winCheck.win) {
        const isOkeyDiscard = RuleValidator.isWildOkey(discardedTile, this.okeyInfo);
        const isPairsWin = winCheck.type === 'pairs';

        let winPoints = 2; // Standard finish points
        let finishType = 'Normal Bitiş';

        if (isOkeyDiscard && isPairsWin) {
          winPoints = 8;
          finishType = 'Çifte Okey Atarak Bitiş!';
        } else if (isOkeyDiscard) {
          winPoints = 4;
          finishType = 'Okey Atarak Bitiş!';
        } else if (isPairsWin) {
          winPoints = 4;
          finishType = 'Çifte Bitiş!';
        }

        this.scores[pIdx] += winPoints;
        this.status = 'round_ended';
        this.winner = {
          playerIndex: pIdx,
          name: player.name,
          points: winPoints,
          finishType,
          discardedTile,
          hand: remainingHand
        };

        this.lastAction = {
          type: 'GAME_WON',
          message: `${player.name} ${finishType} (+${winPoints} Puan)`
        };

        return { success: true, win: true, winner: this.winner };
      } else {
        // Hand is not winning! Put tile back and return error
        player.hand.push(discardedTile);
        return { success: false, message: 'Eliniz henüz bitmeye uygun değil!' };
      }
    }

    // Normal discard to player's discard pile
    this.discardPiles[pIdx].push(discardedTile);
    this.hasDrawn = false;
    this.lastAction = {
      type: 'DISCARD_TILE',
      message: `${player.name} bir taş attı.`
    };

    // Advance turn to next player (counter-clockwise / seat 0 -> 1 -> 2 -> 3)
    this.turnIndex = (this.turnIndex + 1) % 4;

    return { success: true, discardedTile };
  }

  // Next round preparation
  advanceRound() {
    this.dealerIndex = (this.dealerIndex + 1) % 4;
    this.startNewRound();
  }

  getPlayerIndex(playerId) {
    return this.players.findIndex(p => p && p.id === playerId);
  }

  // Client view scrubbed for security/fairness
  getClientState(playerId) {
    const viewerIdx = this.getPlayerIndex(playerId);

    return {
      roomId: this.roomId,
      gameType: this.gameType,
      status: this.status,
      currentRound: this.currentRound,
      dealerIndex: this.dealerIndex,
      turnIndex: this.turnIndex,
      hasDrawn: this.hasDrawn,
      indicator: this.indicator,
      okeyInfo: this.okeyInfo,
      remainingTiles: this.deck ? this.deck.remainingCount() : 0,
      scores: this.scores,
      winner: this.winner,
      lastAction: this.lastAction,
      discardPiles: this.discardPiles.map(pile => ({
        topTile: pile.length > 0 ? pile[pile.length - 1] : null,
        count: pile.length
      })),
      players: this.players.map((p, idx) => {
        if (!p) return null;
        const isViewer = idx === viewerIdx;
        return {
          id: p.id,
          name: p.name,
          seat: idx,
          isBot: p.isBot,
          tileCount: p.hand ? p.hand.length : 0,
          // Only reveal full hand to the viewer or when round ends
          hand: (isViewer || this.status === 'round_ended') ? p.hand : null
        };
      })
    };
  }
}
