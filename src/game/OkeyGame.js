import { Deck } from './Deck.js';
import { RuleValidator } from './RuleValidator.js';

export class OkeyGame {
  constructor(roomId, options = {}) {
    this.roomId = roomId;
    this.gameType = 'classic';
    this.options = {
      targetScore: options.targetScore || 20,
      ...options
    };

    this.players = [];
    this.status = 'waiting';
    this.currentRound = 0;
    this.dealerIndex = 0;
    this.turnIndex = 0;
    this.hasDrawn = false;

    this.deck = null;
    this.indicator = null;
    this.okeyInfo = null;
    this.discardPiles = [[], [], [], []];
    this.gostergeClaimed = false;
    this.lastAction = null;
    this.winner = null;
    this.scores = [0, 0, 0, 0];
    this.roundHistory = [];
  }

  startNewRound() {
    this.currentRound++;
    this.deck = new Deck();
    this.deck.generate();
    this.deck.shuffle();
    this.deck.setupIndicatorAndOkey();

    this.indicator = this.deck.indicator;
    this.okeyInfo = this.deck.okeyTileInfo;

    const firstPlayerIndex = (this.dealerIndex + 1) % 4;
    this.turnIndex = firstPlayerIndex;
    this.hasDrawn = true;

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
      message: `${this.players[firstPlayerIndex]?.name || 'Oyuncu'} 15 taş ile oyuna başladı.`
    };
  }

  claimGosterge(playerId) {
    const playerIndex = this.getPlayerIndex(playerId);
    if (playerIndex === -1 || this.gostergeClaimed || this.status !== 'playing') {
      return { success: false, message: 'Gösterge yapılamaz.' };
    }

    const player = this.players[playerIndex];
    const hasTile = player.hand.some(
      t => !t.isFakeJoker && t.color === this.indicator.color && t.value === this.indicator.value
    );

    if (!hasTile) {
      return { success: false, message: 'Elinizde gösterge taşı yok.' };
    }

    this.gostergeClaimed = true;
    this.scores[playerIndex] += 1;
    this.lastAction = {
      type: 'GOSTERGE_CLAIMED',
      message: `${player.name} gösterge yaptı! (+1 Puan)`
    };

    return { success: true, message: 'Gösterge başarıyla yapıldı!' };
  }

  drawTile(playerId, fromDiscard = false) {
    const pIdx = this.getPlayerIndex(playerId);
    if (pIdx !== this.turnIndex) {
      return { success: false, message: 'Sıra sizde değil.' };
    }
    if (this.hasDrawn) {
      return { success: false, message: 'Zaten taş çektiniz.' };
    }

    let drawnTile = null;
    if (fromDiscard) {
      const leftPlayerIdx = (pIdx + 3) % 4;
      const leftPile = this.discardPiles[leftPlayerIdx];
      if (!leftPile || leftPile.length === 0) {
        return { success: false, message: 'Yandan alınacak taş yok.' };
      }
      drawnTile = leftPile.pop();
    } else {
      drawnTile = this.deck.draw();
      if (!drawnTile) {
        this.status = 'round_ended';
        this.lastAction = { type: 'DRAW', message: 'Deste bitti! Tur berabere bitti.' };
        return { success: true, message: 'Deste bitti!' };
      }
    }

    this.players[pIdx].hand = [...this.players[pIdx].hand, drawnTile];
    this.hasDrawn = true;
    this.lastAction = {
      type: 'DRAW_TILE',
      message: `${this.players[pIdx].name} ${fromDiscard ? 'yandan' : 'ortadan'} taş çekti.`
    };

    return { success: true, drawnTile };
  }

  discardTile(playerId, tileId, isFinishing = false) {
    const pIdx = this.getPlayerIndex(playerId);
    if (pIdx !== this.turnIndex) {
      return { success: false, message: 'Sıra sizde değil.' };
    }
    if (!this.hasDrawn) {
      return { success: false, message: 'Önce taş çekmelisiniz.' };
    }

    const player = this.players[pIdx];
    const tileIndex = player.hand.findIndex(t => t.id === tileId);
    if (tileIndex === -1) {
      return { success: false, message: 'Taş elinizde bulunamadı.' };
    }

    const discardedTile = player.hand[tileIndex];
    player.hand = player.hand.filter((_, idx) => idx !== tileIndex);

    if (isFinishing) {
      const remainingHand = player.hand;
      const winCheck = RuleValidator.checkClassicWin(remainingHand, this.okeyInfo);

      if (winCheck.win) {
        const isOkeyDiscard = RuleValidator.isWildOkey(discardedTile, this.okeyInfo);
        const isPairsWin = winCheck.type === 'pairs';

        let winPoints = 2;
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
        const roundPenalties = this.players.map((_, idx) => (idx === pIdx ? `+${winPoints}` : '0'));
        this.winner = {
          playerIndex: pIdx,
          name: player.name,
          points: winPoints,
          finishType,
          roundPenalties,
          discardedTile,
          hand: remainingHand,
          totalScores: [...this.scores]
        };

        this.roundHistory.push({
          round: this.currentRound,
          winnerIdx: pIdx,
          winnerName: player.name,
          finishType,
          points: winPoints,
          penalties: roundPenalties,
          scores: [...this.scores]
        });

        this.lastAction = {
          type: 'GAME_WON',
          message: `${player.name} ${finishType} (+${winPoints} Puan)`
        };

        return { success: true, win: true, winner: this.winner };
      } else {
        player.hand.push(discardedTile);
        return { success: false, message: 'Eliniz henüz bitmeye uygun değil!' };
      }
    }

    this.discardPiles[pIdx].push(discardedTile);
    this.hasDrawn = false;
    this.lastAction = {
      type: 'DISCARD_TILE',
      message: `${player.name} bir taş attı.`
    };

    this.turnIndex = (this.turnIndex + 1) % 4;
    return { success: true, discardedTile };
  }

  advanceRound() {
    this.dealerIndex = (this.dealerIndex + 1) % 4;
    this.startNewRound();
  }

  getPlayerIndex(playerId) {
    return this.players.findIndex(p => p && p.id === playerId);
  }

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
      roundHistory: this.roundHistory,
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
          hand: (isViewer || this.status === 'round_ended') ? [...p.hand] : null
        };
      })
    };
  }
}
