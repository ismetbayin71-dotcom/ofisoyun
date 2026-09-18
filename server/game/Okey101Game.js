import { Deck } from '../models/Deck.js';
import { RuleValidator } from '../models/RuleValidator.js';

export class Okey101Game {
  constructor(roomId, options = {}) {
    this.roomId = roomId;
    this.gameType = '101';
    this.options = {
      folded: options.folded !== undefined ? options.folded : false, // Katlamalı
      targetScore: options.targetScore || 501, // 501 or 1001 points limit
      ...options
    };

    this.players = []; // 4 players
    this.status = 'waiting'; // 'waiting', 'playing', 'round_ended', 'game_ended'
    this.currentRound = 0;
    this.dealerIndex = 0;
    this.turnIndex = 0;
    this.hasDrawn = false;
    this.justDrawnFromDiscard = false; // Tracks if drawn from discard

    this.deck = null;
    this.indicator = null;
    this.okeyInfo = null;
    this.discardPiles = [[], [], [], []];
    this.scores = [0, 0, 0, 0]; // Penalty scores (lowest score wins in 101)

    // 101 specific state:
    // openedHands[playerIndex] = { type: 'runs' | 'pairs', pers: [...], points: number }
    this.openedHands = [null, null, null, null];
    this.tablePers = []; // All open pers on the table: [{ id, playerId, tiles: [...] }]
    this.highestOpenedPoints = 101;
    this.lastAction = null;
    this.winner = null;
  }

  // Starts a new round
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
    this.hasDrawn = true; // First player has 22 tiles

    const hands = this.deck.dealHands(true, firstPlayerIndex);
    for (let i = 0; i < 4; i++) {
      if (this.players[i]) {
        this.players[i].hand = hands[i];
      }
    }

    this.discardPiles = [[], [], [], []];
    this.openedHands = [null, null, null, null];
    this.tablePers = [];
    this.highestOpenedPoints = 101;
    this.status = 'playing';
    this.winner = null;
    this.justDrawnFromDiscard = false;
    this.lastAction = {
      type: 'ROUND_STARTED',
      message: `${this.players[firstPlayerIndex]?.name || 'Oyuncu'} 22 taş ile 101 elini başlattı.`
    };
  }

  // Draw tile
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
      // Note: in 101, drawing from discard is only valid if opening or processing this turn.
      drawnTile = leftPile.pop();
      this.justDrawnFromDiscard = true;
    } else {
      drawnTile = this.deck.draw();
      this.justDrawnFromDiscard = false;
      if (!drawnTile) {
        this.endRoundNoTiles();
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

  // Open Hand with Pers (Runs / Sets)
  openRunsHand(playerId, pers) {
    const pIdx = this.getPlayerIndex(playerId);
    if (pIdx !== this.turnIndex || !this.hasDrawn) {
      return { success: false, message: 'Sıra sizde değil veya taş çekilmedi.' };
    }

    const alreadyOpened = !!this.openedHands[pIdx];
    const minRequired = alreadyOpened ? 0 : (this.options.folded ? this.highestOpenedPoints : 101);
    const validation = RuleValidator.validate101Opening(pers, this.okeyInfo, minRequired);

    if (!validation.valid) {
      return { success: false, message: validation.reason };
    }

    // Verify player actually has all these tiles in hand
    const player = this.players[pIdx];
    const requestedTileIds = pers.flat().map(t => t.id);
    const handMap = new Map(player.hand.map(t => [t.id, t]));

    for (const id of requestedTileIds) {
      if (!handMap.has(id)) {
        return { success: false, message: 'Seçtiğiniz taşlardan bazıları elinizde yok!' };
      }
    }

    // 101 Rule: Must keep at least 1 tile in hand to discard at end of turn
    if (player.hand.length - requestedTileIds.length < 1) {
      return {
        success: false,
        message: '101 Kuralı: Per açtıktan sonra yere taş atmak için elinizde en az 1 taş kalmalıdır! Bitiş için en az 4 taşınız olup 3 tanesini açıp 1 tanesini yere atarak bitmelisiniz.'
      };
    }

    // Remove opened tiles from player hand
    player.hand = player.hand.filter(t => !requestedTileIds.includes(t.id));

    // Register opened pers on table
    const createdPers = [];
    for (const per of pers) {
      const perEntry = {
        id: `per-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        playerId,
        playerIndex: pIdx,
        tiles: per
      };
      this.tablePers.push(perEntry);
      createdPers.push(perEntry);
    }

    this.openedHands[pIdx] = {
      type: 'runs',
      points: validation.points
    };

    if (this.options.folded && validation.points > this.highestOpenedPoints) {
      this.highestOpenedPoints = validation.points + 1;
    }

    this.lastAction = {
      type: 'HAND_OPENED',
      message: `${player.name} ${validation.points} puanla el açtı!`
    };

    return { success: true, points: validation.points };
  }

  // Open Hand with 5 Pairs (Çift Açma)
  openPairsHand(playerId, pairs) {
    const pIdx = this.getPlayerIndex(playerId);
    if (pIdx !== this.turnIndex || !this.hasDrawn) {
      return { success: false, message: 'Sıra sizde değil veya taş çekilmedi.' };
    }

    const validation = RuleValidator.validate101Pairs(pairs, this.okeyInfo);
    if (!validation.valid) {
      return { success: false, message: validation.reason };
    }

    const player = this.players[pIdx];
    const requestedTileIds = pairs.flat().map(t => t.id);
    const handMap = new Map(player.hand.map(t => [t.id, t]));

    for (const id of requestedTileIds) {
      if (!handMap.has(id)) {
        return { success: false, message: 'Seçtiğiniz çift taşlar elinizde bulunamadı!' };
      }
    }

    // 101 Rule: Must keep at least 1 tile in hand to discard at end of turn
    if (player.hand.length - requestedTileIds.length < 1) {
      return {
        success: false,
        message: '101 Kuralı: Çift açtıktan sonra yere taş atmak için elinizde en az 1 taş kalmalıdır!'
      };
    }

    player.hand = player.hand.filter(t => !requestedTileIds.includes(t.id));

    for (const pair of pairs) {
      this.tablePers.push({
        id: `pair-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        playerId,
        playerIndex: pIdx,
        tiles: pair,
        isPair: true
      });
    }

    this.openedHands[pIdx] = {
      type: 'pairs',
      pairCount: pairs.length
    };

    this.lastAction = {
      type: 'PAIRS_OPENED',
      message: `${player.name} 5 çift ile el açtı!`
    };

    return { success: true };
  }

  // Process a tile onto an open table per (İşleme)
  processTile(playerId, tileId, targetPerId) {
    const pIdx = this.getPlayerIndex(playerId);
    if (pIdx !== this.turnIndex || !this.hasDrawn) {
      return { success: false, message: 'Sıra sizde değil veya taş çekilmedi.' };
    }

    // Player must have opened their hand to process tiles
    if (!this.openedHands[pIdx]) {
      return { success: false, message: 'Taş işlemek için önce elinizi açmış olmalısınız.' };
    }

    const player = this.players[pIdx];
    const tileIndex = player.hand.findIndex(t => t.id === tileId);
    if (tileIndex === -1) {
      return { success: false, message: 'İşlenecek taş elinizde bulunamadı.' };
    }

    // 101 Rule: Must keep at least 1 tile in hand to discard at end of turn
    if (player.hand.length <= 1) {
      return {
        success: false,
        message: '101 Kuralı: Yere taş atmak için elinizde en az 1 taş kalmalıdır! Son kalan taşınızı işleyemezsiniz, yere atarak bitmelisiniz.'
      };
    }

    const targetPer = this.tablePers.find(p => p.id === targetPerId);
    if (!targetPer) {
      return { success: false, message: 'Hedef per masada bulunamadı.' };
    }

    const tile = player.hand[tileIndex];
    const canProcess = RuleValidator.canProcessTile(tile, targetPer.tiles, this.okeyInfo);

    if (!canProcess) {
      return { success: false, message: 'Bu taş bu pere işlenemez.' };
    }

    // Apply change
    targetPer.tiles = canProcess.newPer;
    player.hand.splice(tileIndex, 1);

    let message = `${player.name} masadaki pere taş işledi.`;
    if (canProcess.takenOkey) {
      player.hand.push(canProcess.takenOkey);
      message = `🌟 ${player.name} perdeki OKEY'in yerine taş işleyip OKEY'i eline aldı!`;
    }

    this.lastAction = {
      type: 'TILE_PROCESSED',
      message,
      takenOkey: !!canProcess.takenOkey
    };

    return { success: true, updatedPer: targetPer, takenOkey: canProcess.takenOkey };
  }

  // Discard tile and end turn
  discardTile(playerId, tileId) {
    const pIdx = this.getPlayerIndex(playerId);
    if (pIdx !== this.turnIndex || !this.hasDrawn) {
      return { success: false, message: 'Sıra sizde değil veya taş çekilmedi.' };
    }

    const player = this.players[pIdx];
    const tileIndex = player.hand.findIndex(t => t.id === tileId);
    if (tileIndex === -1) {
      return { success: false, message: 'Atılacak taş elinizde yok.' };
    }

    // In 101: if player drew from discard, they MUST have opened or processed
    if (this.justDrawnFromDiscard && !this.openedHands[pIdx]) {
      return {
        success: false,
        message: 'Yandan taş aldıysanız elinizi açmak veya masaya işlemek zorundasınız!'
      };
    }

    const [discardedTile] = player.hand.splice(tileIndex, 1);
    this.discardPiles[pIdx].push(discardedTile);
    this.hasDrawn = false;
    this.justDrawnFromDiscard = false;

    // Check if player emptied their hand (Finish!)
    if (player.hand.length === 0) {
      this.endRoundWinner(pIdx, discardedTile);
      return { success: true, finished: true };
    }

    // 101 Rule Check: Discarding a playable tile on the table incurs +101 penalty
    const isPlayableTile = this.tablePers.some(
      p => !p.isPair && RuleValidator.canProcessTile(discardedTile, p.tiles, this.okeyInfo)
    );

    let penaltyApplied = false;
    if (isPlayableTile) {
      this.scores[pIdx] += 101;
      penaltyApplied = true;
    }

    this.lastAction = {
      type: 'DISCARD_TILE',
      message: penaltyApplied
        ? `⚠️ ${player.name} masadaki pere işlenebilecek taşı (işler taş) yere attığı için +101 CEZA puanı aldı!`
        : `${player.name} bir taş attı.`,
      isPlayablePenalty: penaltyApplied,
      penaltyPlayer: player.name
    };

    this.turnIndex = (this.turnIndex + 1) % 4;
    return { success: true, discardedTile, penaltyApplied };
  }

  // End round when someone wins by finishing all tiles
  endRoundWinner(winnerIdx, finalDiscardTile) {
    this.status = 'round_ended';
    const isOkeyDiscard = RuleValidator.isWildOkey(finalDiscardTile, this.okeyInfo);
    const winnerOpenedPairs = this.openedHands[winnerIdx]?.type === 'pairs';

    // In 101, winner gets -101 bonus (or -202 if finished with Okey or Pairs)
    let winnerBonus = -101;
    let multiplier = 1;

    if (isOkeyDiscard) {
      winnerBonus = -202;
      multiplier = 2;
    }
    if (winnerOpenedPairs) {
      multiplier *= 2;
    }

    const roundPenalties = [0, 0, 0, 0];
    roundPenalties[winnerIdx] = winnerBonus;

    for (let i = 0; i < 4; i++) {
      if (i === winnerIdx) continue;
      const p = this.players[i];
      if (!p) continue;

      if (!this.openedHands[i]) {
        // Did not open: 202 points base penalty * multiplier
        roundPenalties[i] = 202 * multiplier;
      } else {
        // Opened: sum of remaining tiles in hand * multiplier
        const handSum = p.hand.reduce((acc, t) => acc + RuleValidator.getTileScore(t), 0);
        roundPenalties[i] = handSum * multiplier;
      }
      this.scores[i] += roundPenalties[i];
    }
    this.scores[winnerIdx] += winnerBonus;

    this.winner = {
      playerIndex: winnerIdx,
      name: this.players[winnerIdx].name,
      finalDiscardTile,
      isOkeyDiscard,
      roundPenalties,
      totalScores: [...this.scores]
    };

    this.lastAction = {
      type: 'ROUND_WON_101',
      message: `${this.players[winnerIdx].name} elini bitirdi! (${winnerBonus} Puan)`
    };
  }

  // End round when draw pile runs out
  endRoundNoTiles() {
    this.status = 'round_ended';
    const roundPenalties = [0, 0, 0, 0];

    for (let i = 0; i < 4; i++) {
      const p = this.players[i];
      if (!p) continue;
      if (!this.openedHands[i]) {
        roundPenalties[i] = 202;
      } else {
        roundPenalties[i] = p.hand.reduce((acc, t) => acc + RuleValidator.getTileScore(t), 0);
      }
      this.scores[i] += roundPenalties[i];
    }

    this.winner = {
      noTiles: true,
      roundPenalties,
      totalScores: [...this.scores]
    };

    this.lastAction = {
      type: 'ROUND_DRAW_101',
      message: 'Deste bitti! Kalan taşlara göre ceza puanları dağıtıldı.'
    };
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
      options: this.options,
      currentRound: this.currentRound,
      dealerIndex: this.dealerIndex,
      turnIndex: this.turnIndex,
      hasDrawn: this.hasDrawn,
      justDrawnFromDiscard: this.justDrawnFromDiscard,
      indicator: this.indicator,
      okeyInfo: this.okeyInfo,
      remainingTiles: this.deck ? this.deck.remainingCount() : 0,
      scores: this.scores,
      winner: this.winner,
      lastAction: this.lastAction,
      highestOpenedPoints: this.highestOpenedPoints,
      openedHands: this.openedHands,
      tablePers: this.tablePers,
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
          hasOpened: !!this.openedHands[idx],
          tileCount: p.hand ? p.hand.length : 0,
          hand: (isViewer || this.status === 'round_ended') ? p.hand : null
        };
      })
    };
  }
}
