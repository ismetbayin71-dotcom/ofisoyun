import { RuleValidator } from './RuleValidator.js';

export class BotAI {
  static playTurn(game, botPlayer, onUpdate) {
    if (!game || game.status !== 'playing') return;

    const pIdx = game.getPlayerIndex(botPlayer.id);
    if (pIdx !== game.turnIndex) return;

    setTimeout(() => {
      if (game.status !== 'playing' || game.turnIndex !== pIdx) return;

      // STEP 1: DRAW TILE
      if (!game.hasDrawn) {
        let shouldDrawDiscard = false;

        if (game.gameType === '101') {
          // In 101 Okey, only draw from discard if allowed and beneficial
          if (game.canDrawFromDiscard) {
            const check = game.canDrawFromDiscard(botPlayer.id);
            if (check && check.allowed) {
              shouldDrawDiscard = true;
            }
          }
        } else {
          // Classic Okey: draw if wildcard or pairs/connects with hand
          const leftPlayerIdx = (pIdx + 3) % 4;
          const leftPile = game.discardPiles[leftPlayerIdx];
          const topDiscard = leftPile && leftPile.length > 0 ? leftPile[leftPile.length - 1] : null;

          if (topDiscard && game.okeyInfo) {
            const isWild = RuleValidator.isWildOkey(topDiscard, game.okeyInfo);
            const hasPair = botPlayer.hand.some(t => RuleValidator.isPair(t, topDiscard, game.okeyInfo));
            const hasRunConnector = botPlayer.hand.some(t =>
              !RuleValidator.isWildOkey(t, game.okeyInfo) &&
              t.color === topDiscard.color &&
              Math.abs(t.value - topDiscard.value) === 1
            );

            if (isWild || hasPair || hasRunConnector) {
              shouldDrawDiscard = true;
            }
          }
        }

        const drawRes = game.drawTile(botPlayer.id, shouldDrawDiscard);
        if (!drawRes.success && shouldDrawDiscard) {
          game.drawTile(botPlayer.id, false);
        }

        if (onUpdate) onUpdate();
      }

      // STEP 2: OPEN HAND, PROCESS TILES, AND DISCARD
      setTimeout(() => {
        if (game.status !== 'playing' || game.turnIndex !== pIdx) return;

        if (game.gameType === 'classic') {
          // Classic Okey: Check if hand can win with any discarded tile
          for (let i = 0; i < botPlayer.hand.length; i++) {
            const candidateTile = botPlayer.hand[i];
            const testHand = botPlayer.hand.filter((_, idx) => idx !== i);
            const winCheck = RuleValidator.checkClassicWin(testHand, game.okeyInfo);
            if (winCheck.win) {
              game.discardTile(botPlayer.id, candidateTile.id, true);
              if (onUpdate) onUpdate();
              return;
            }
          }
        } else if (game.gameType === '101') {
          // 101 Okey: 1. Try to open hand or open new pers/pairs
          this.tryOpenHand101(game, botPlayer);

          // 101 Okey: 2. If opened, try to process tiles onto table pers
          if (game.openedHands && game.openedHands[pIdx]) {
            this.tryProcessTiles101(game, botPlayer);
          }
        }

        // STEP 3: DISCARD TILE
        const discardTile = this.chooseTileToDiscard(botPlayer.hand, game.okeyInfo, game);
        if (discardTile) {
          game.discardTile(botPlayer.id, discardTile.id, false);
        } else if (botPlayer.hand.length > 0) {
          game.discardTile(botPlayer.id, botPlayer.hand[0].id, false);
        } else {
          // Safety fallback: if bot somehow reached 0 tiles, ensure round ends so game never hangs
          if (game.endRoundWinner) {
            game.endRoundWinner(pIdx, null);
          }
        }

        if (onUpdate) onUpdate();
      }, 700);
    }, 600);
  }

  /**
   * Intelligently evaluates and opens pers or pairs in 101 Okey
   */
  static tryOpenHand101(game, botPlayer) {
    const pIdx = game.getPlayerIndex(botPlayer.id);
    if (pIdx === -1) return;

    const hasOpened = !!(game.openedHands && game.openedHands[pIdx]);
    const openerType = hasOpened ? game.openedHands[pIdx].type : null;
    const minRequired = hasOpened ? 0 : (game.options.folded ? game.highestOpenedPoints : 101);

    // CASE 1: Open Runs/Groups (or add more pers if already opened with runs)
    if (!hasOpened || openerType === 'runs') {
      const { pers, totalPoints } = RuleValidator.findBest101Pers(botPlayer.hand, game.okeyInfo);

      if (pers.length > 0) {
        if (!hasOpened) {
          const totalTiles = pers.reduce((sum, p) => sum + p.length, 0);
          // 101 Rule: Must keep at least 1 tile in hand for discard
          if (totalPoints >= minRequired && botPlayer.hand.length - totalTiles >= 1) {
            const res = game.openRunsHand(botPlayer.id, pers);
            if (res.success) return true;
          }
        } else {
          // Already opened earlier: open any new complete per, but MUST keep at least 1 tile to discard
          // (e.g. if hand has 3 tiles, cannot open 3 tiles because 3 - 3 = 0; if hand has 4 tiles, can open 3 and discard 1 to finish)
          const validPersToOpen = [];
          let openedTilesCount = 0;
          for (const per of pers) {
            if (botPlayer.hand.length - (openedTilesCount + per.length) >= 1) {
              validPersToOpen.push(per);
              openedTilesCount += per.length;
            }
          }
          if (validPersToOpen.length > 0) {
            const res = game.openRunsHand(botPlayer.id, validPersToOpen);
            if (res.success) return true;
          }
        }
      }
    }

    // CASE 2: Open Pairs (if not opened with runs)
    if (!hasOpened || openerType === 'pairs') {
      const { pairs, pairCount } = RuleValidator.find101Pairs(botPlayer.hand, game.okeyInfo);

      if (!hasOpened && pairCount >= 5) {
        const selectedPairs = pairs.slice(0, 5);
        const totalTiles = selectedPairs.length * 2;
        if (botPlayer.hand.length - totalTiles >= 1) {
          const res = game.openPairsHand(botPlayer.id, selectedPairs);
          if (res.success) return true;
        }
      } else if (hasOpened && openerType === 'pairs' && pairs.length > 0) {
        const validPairs = [];
        let count = 0;
        for (const pair of pairs) {
          if (botPlayer.hand.length - (count + 2) >= 1) {
            validPairs.push(pair);
            count += 2;
          }
        }
        if (validPairs.length > 0) {
          const res = game.openPairsHand(botPlayer.id, validPairs);
          if (res.success) return true;
        }
      }
    }

    // CASE 3: Process pairs if opened with runs and table has a pair opener
    const pairOpenerIdx = (game.openedHands || []).findIndex(h => h && h.type === 'pairs');
    if (hasOpened && openerType === 'runs' && pairOpenerIdx !== -1) {
      const { pairs } = RuleValidator.find101Pairs(botPlayer.hand, game.okeyInfo);
      if (pairs.length > 0) {
        const validPairs = [];
        let count = 0;
        for (const pair of pairs) {
          if (botPlayer.hand.length - (count + 2) >= 1) {
            validPairs.push(pair);
            count += 2;
          }
        }
        if (validPairs.length > 0) {
          const res = game.processPairs(botPlayer.id, validPairs, pairOpenerIdx);
          if (res.success) return true;
        }
      }
    }

    return false;
  }

  /**
   * Processes tiles from bot hand onto table pers adhering to 101 rules
   */
  static tryProcessTiles101(game, botPlayer) {
    const pIdx = game.getPlayerIndex(botPlayer.id);
    if (pIdx === -1 || !game.openedHands || !game.openedHands[pIdx]) return false;
    if (!game.tablePers || game.tablePers.length === 0) return false;

    const openerType = game.openedHands[pIdx].type;
    let anyProcessed = false;

    // Loop repeatedly while tiles can still be processed and bot keeps at least 1 tile for discard
    let keepSearching = true;
    while (keepSearching && botPlayer.hand.length > 1) {
      keepSearching = false;

      for (const per of game.tablePers) {
        // Single tiles cannot be processed onto pairs
        if (per.isPair) continue;

        for (let i = 0; i < botPlayer.hand.length; i++) {
          const tile = botPlayer.hand[i];
          // Do not process wildcards carelessly
          if (RuleValidator.isWildOkey(tile, game.okeyInfo)) continue;

          const can = RuleValidator.canProcessTile(tile, per.tiles, game.okeyInfo);
          if (can) {
            const res = game.processTile(botPlayer.id, tile.id, per.id);
            if (res.success) {
              anyProcessed = true;
              keepSearching = true;
              break;
            }
          }
        }
        if (keepSearching) break;
      }
    }

    return anyProcessed;
  }

  /**
   * Intelligently selects the least valuable/isolated tile to discard
   */
  static chooseTileToDiscard(hand, okeyInfo, game = null) {
    if (!hand || hand.length === 0) return null;

    // Never discard Okey (wildcard) if there are other tiles
    const nonWild = hand.filter(t => !RuleValidator.isWildOkey(t, okeyInfo));
    if (nonWild.length === 0) return hand[0];
    if (nonWild.length === 1) return nonWild[0];

    // Find tiles that are part of complete pairs or near-pers
    let lowestScore = Infinity;
    let worstTile = nonWild[0];

    for (const t of nonWild) {
      let score = 0;

      for (const other of nonWild) {
        if (t.id === other.id) continue;

        // Same color adjacency
        if (t.color === other.color) {
          const diff = Math.abs(t.value - other.value);
          if (diff === 1) score += 5; // Direct neighbor (e.g. 5-6)
          else if (diff === 2) score += 3; // Gap neighbor (e.g. 5-7)
        }

        // Same value different color (group potential)
        if (t.value === other.value && t.color !== other.color) {
          score += 4;
        }

        // Exact duplicate (pair potential)
        if (t.value === other.value && t.color === other.color) {
          score += 6;
        }
      }

      // Check if tile is in a valid per with rest of hand
      const otherTiles = nonWild.filter(o => o.id !== t.id);
      const testPers = RuleValidator.findBest101Pers(nonWild, okeyInfo).pers;
      const inPer = testPers.some(per => per.some(tile => tile.id === t.id));
      if (inPer) {
        score += 15; // Strongly protect tiles that form valid pers!
      }

      if (score < lowestScore) {
        lowestScore = score;
        worstTile = t;
      }
    }

    return worstTile;
  }
}
