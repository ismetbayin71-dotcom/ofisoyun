import { Deck } from './Deck.js';
import { RuleValidator } from './RuleValidator.js';

export class Okey101Game {
  constructor(roomId, options = {}) {
    this.roomId = roomId;
    this.gameType = '101';
    this.options = {
      folded: options.folded !== undefined ? options.folded : false,
      targetScore: options.targetScore || 501,
      ...options
    };

    this.players = [];
    this.status = 'waiting';
    this.currentRound = 0;
    this.dealerIndex = 0;
    this.turnIndex = 0;
    this.hasDrawn = false;
    this.justDrawnFromDiscard = false;
    this.lastDrawnDiscardTile = null;

    this.deck = null;
    this.indicator = null;
    this.okeyInfo = null;
    this.discardPiles = [[], [], [], []];
    this.scores = [0, 0, 0, 0];

    this.openedHands = [null, null, null, null];
    this.tablePers = [];
    this.highestOpenedPoints = 101;
    this.lastAction = null;
    this.winner = null;
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
    this.lastDrawnDiscardTile = null;
    this.lastAction = {
      type: 'ROUND_STARTED',
      message: `${this.players[firstPlayerIndex]?.name || 'Oyuncu'} 22 taş ile 101 elini başlattı.`
    };
  }

  canDrawFromDiscard(playerId) {
    const pIdx = this.getPlayerIndex(playerId);
    if (pIdx !== this.turnIndex || this.hasDrawn) {
      return { allowed: false, message: 'Sıra sizde değil veya zaten taş çektiniz.' };
    }

    const leftPlayerIdx = (pIdx + 3) % 4;
    const leftPile = this.discardPiles[leftPlayerIdx];
    if (!leftPile || leftPile.length === 0) {
      return { allowed: false, message: 'Yandan alınacak taş yok.' };
    }

    const candidateTile = leftPile[leftPile.length - 1];
    const player = this.players[pIdx];
    const candidateHand = [...player.hand, candidateTile];
    const hasOpened = !!this.openedHands[pIdx];

    if (!hasOpened) {
      const minRequired = this.options.folded ? this.highestOpenedPoints : 101;
      const { totalPoints } = RuleValidator.findBest101Pers(candidateHand, this.okeyInfo);
      const { pairCount } = RuleValidator.find101Pairs(candidateHand, this.okeyInfo);

      if (totalPoints < minRequired && pairCount < 5) {
        return {
          allowed: false,
          message:
            `101 Okey Kuralı:\n\n` +
            `Yandan taş alabilmek için bu taşla birlikte elinizi açabiliyor olmalısınız!\n\n` +
            `• Bu taşla elinizdeki perlerin toplamı: ${totalPoints} puan (Baraj: ${minRequired})\n` +
            `• Çift sayısı: ${pairCount} çift (Gereken: 5 çift)\n\n` +
            `Eliniz el açmaya yetmediği için yandan taş alamazsınız. Lütfen ortadaki desteden taş çekiniz.`
        };
      }
    } else {
      // Player already opened earlier
      const openerType = this.openedHands[pIdx].type;
      if (openerType === 'runs') {
        const canProcess = this.tablePers.some(
          p => !p.isPair && RuleValidator.canProcessTile(candidateTile, p.tiles, this.okeyInfo)
        );
        const { pers } = RuleValidator.findBest101Pers(candidateHand, this.okeyInfo);
        const formsNewPer = pers.some(per => per.some(t => t.id === candidateTile.id));
        if (!canProcess && !formsNewPer) {
          return {
            allowed: false,
            message:
              `101 Okey Kuralı:\n\n` +
              `Elini açmış bir oyuncu, yandan taşı sadece masadaki bir pere işleyebiliyorsa veya yeni bir per açabiliyorsa alabilir.`
          };
        }
      } else if (openerType === 'pairs') {
        const { pairs } = RuleValidator.find101Pairs(candidateHand, this.okeyInfo);
        const formsNewPair = pairs.some(pair => pair.some(t => t.id === candidateTile.id));
        if (!formsNewPair) {
          return {
            allowed: false,
            message:
              `101 Okey Kuralı:\n\n` +
              `Çift açmış bir oyuncu, yandan taşı sadece elindeki bir taşla yeni bir çift oluşturabiliyorsa alabilir.`
          };
        }
      }
    }

    return { allowed: true, tile: candidateTile };
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
      const check = this.canDrawFromDiscard(playerId);
      if (!check.allowed) {
        return { success: false, message: check.message };
      }
      const leftPlayerIdx = (pIdx + 3) % 4;
      const leftPile = this.discardPiles[leftPlayerIdx];
      drawnTile = leftPile.pop();
      this.justDrawnFromDiscard = true;
      this.lastDrawnDiscardTile = drawnTile;
    } else {
      drawnTile = this.deck.draw();
      this.justDrawnFromDiscard = false;
      this.lastDrawnDiscardTile = null;
      if (!drawnTile) {
        this.endRoundNoTiles();
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

  returnDiscardTile(playerId) {
    const pIdx = this.getPlayerIndex(playerId);
    if (pIdx !== this.turnIndex || !this.hasDrawn || !this.justDrawnFromDiscard || !this.lastDrawnDiscardTile) {
      return { success: false, message: 'Geri bırakılacak taş yok.' };
    }

    const player = this.players[pIdx];
    const tileIdx = player.hand.findIndex(t => t.id === this.lastDrawnDiscardTile.id);
    if (tileIdx === -1) {
      return { success: false, message: 'Yandan alınan taş elinizde bulunamadı.' };
    }

    const returnedTile = player.hand[tileIdx];
    player.hand = player.hand.filter((_, i) => i !== tileIdx);

    const leftPlayerIdx = (pIdx + 3) % 4;
    this.discardPiles[leftPlayerIdx].push(returnedTile);
    this.hasDrawn = false;
    this.justDrawnFromDiscard = false;
    this.lastDrawnDiscardTile = null;

    this.lastAction = {
      type: 'RETURN_TILE',
      message: `${player.name} yandan aldığı taşı geri bıraktı.`
    };

    return { success: true };
  }

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

    const player = this.players[pIdx];
    const requestedTileIds = pers.flat().map(t => t.id);
    const handMap = new Map(player.hand.map(t => [t.id, t]));

    for (const id of requestedTileIds) {
      if (!handMap.has(id)) {
        return { success: false, message: 'Seçilen taşlardan bazıları elinizde yok!' };
      }
    }

    player.hand = player.hand.filter(t => !requestedTileIds.includes(t.id));

    for (const per of pers) {
      const perEntry = {
        id: `per-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        playerId,
        playerIndex: pIdx,
        tiles: per
      };
      this.tablePers.push(perEntry);
    }

    if (!alreadyOpened) {
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
    } else {
      this.lastAction = {
        type: 'PER_OPENED',
        message: `${player.name} masaya yeni per açtı.`
      };
    }

    return { success: true, points: validation.points };
  }

  openPairsHand(playerId, pairs) {
    const pIdx = this.getPlayerIndex(playerId);
    if (pIdx !== this.turnIndex || !this.hasDrawn) {
      return { success: false, message: 'Sıra sizde değil veya taş çekilmedi.' };
    }

    const alreadyOpened = !!this.openedHands[pIdx];
    const minPairs = alreadyOpened ? 1 : 5;
    if (!pairs || pairs.length < minPairs) {
      return { success: false, message: alreadyOpened ? 'En az 1 çift seçmelisiniz.' : 'Çift açmak için en az 5 çift gereklidir.' };
    }
    for (const pair of pairs) {
      if (pair.length !== 2 || !RuleValidator.isPair(pair[0], pair[1], this.okeyInfo)) {
        return { success: false, message: 'Geçersiz çift bulundu.' };
      }
    }

    const player = this.players[pIdx];
    const requestedTileIds = pairs.flat().map(t => t.id);
    const handMap = new Map(player.hand.map(t => [t.id, t]));

    for (const id of requestedTileIds) {
      if (!handMap.has(id)) {
        return { success: false, message: 'Seçilen taşlar elinizde bulunamadı!' };
      }
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

    if (!alreadyOpened) {
      this.openedHands[pIdx] = {
        type: 'pairs',
        pairCount: pairs.length
      };

      this.lastAction = {
        type: 'PAIRS_OPENED',
        message: `${player.name} 5 çift ile el açtı!`
      };
    } else {
      if (this.openedHands[pIdx]) {
        this.openedHands[pIdx].pairCount = (this.openedHands[pIdx].pairCount || 0) + pairs.length;
      }
      this.lastAction = {
        type: 'PAIR_OPENED',
        message: `${player.name} masaya yeni çift açtı.`
      };
    }

    return { success: true };
  }

  processTile(playerId, tileId, targetPerId) {
    const pIdx = this.getPlayerIndex(playerId);
    if (pIdx !== this.turnIndex || !this.hasDrawn) {
      return { success: false, message: 'Sıra sizde değil veya taş çekilmedi.' };
    }

    if (!this.openedHands[pIdx]) {
      return { success: false, message: 'Taş işlemek için önce elinizi açmış olmalısınız.' };
    }

    const player = this.players[pIdx];
    const tileIndex = player.hand.findIndex(t => t.id === tileId);
    if (tileIndex === -1) {
      return { success: false, message: 'İşlenecek taş elinizde bulunamadı.' };
    }

    const targetPer = this.tablePers.find(p => p.id === targetPerId);
    if (!targetPer) {
      return { success: false, message: 'Hedef per masada bulunamadı.' };
    }

    // 101 Rule: A player who opened pairs CANNOT process onto runs/groups!
    if (this.openedHands[pIdx].type === 'pairs') {
      return {
        success: false,
        message: '101 Kuralı: Çift açan oyuncular serilere taş işleyemez! Sadece açılmış çiftlere işleme yapabilirsiniz.'
      };
    }

    // 101 Rule: A player who opened runs CANNOT process onto pairs!
    if (this.openedHands[pIdx].type === 'runs' && targetPer.isPair) {
      return {
        success: false,
        message: '101 Kuralı: Seri açan oyuncular çiftlere taş işleyemez!'
      };
    }

    const tile = player.hand[tileIndex];
    const canProcess = RuleValidator.canProcessTile(tile, targetPer.tiles, this.okeyInfo);

    if (!canProcess) {
      return { success: false, message: 'Bu taş bu pere işlenemez.' };
    }

    targetPer.tiles = canProcess.newPer;
    player.hand = player.hand.filter((_, idx) => idx !== tileIndex);

    this.lastAction = {
      type: 'TILE_PROCESSED',
      message: `${player.name} masadaki pere taş işledi.`
    };

    return { success: true, updatedPer: targetPer };
  }

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

    if (this.justDrawnFromDiscard && !this.openedHands[pIdx]) {
      return {
        success: false,
        message: '101 Kuralı: Yandan taş aldıysanız aynı turda elinizi açmak (en az 101 barajı) veya masaya işlemek zorundasınız!'
      };
    }

    const discardedTile = player.hand[tileIndex];
    player.hand = player.hand.filter((_, idx) => idx !== tileIndex);
    this.discardPiles[pIdx].push(discardedTile);
    this.hasDrawn = false;
    this.justDrawnFromDiscard = false;
    this.lastDrawnDiscardTile = null;

    if (player.hand.length === 0) {
      this.endRoundWinner(pIdx, discardedTile);
      return { success: true, finished: true };
    }

    this.lastAction = {
      type: 'DISCARD_TILE',
      message: `${player.name} bir taş attı.`
    };

    this.turnIndex = (this.turnIndex + 1) % 4;
    return { success: true, discardedTile };
  }

  endRoundWinner(winnerIdx, finalDiscardTile) {
    this.status = 'round_ended';
    const isOkeyDiscard = RuleValidator.isWildOkey(finalDiscardTile, this.okeyInfo);
    const winnerOpenedPairs = this.openedHands[winnerIdx]?.type === 'pairs';

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
        roundPenalties[i] = 101 * multiplier;
      } else {
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

  endRoundNoTiles() {
    this.status = 'round_ended';
    const roundPenalties = [0, 0, 0, 0];

    for (let i = 0; i < 4; i++) {
      const p = this.players[i];
      if (!p) continue;
      if (!this.openedHands[i]) {
        roundPenalties[i] = 101;
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
      message: 'Deste bitti! Kalan taşlara göre cezalar hesaplandı.'
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
          hand: (isViewer || this.status === 'round_ended') ? [...p.hand] : null
        };
      })
    };
  }
}
