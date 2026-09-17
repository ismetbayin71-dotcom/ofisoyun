import { RuleValidator } from './RuleValidator.js';

export class BotAI {
  static playTurn(game, botPlayer, onUpdate) {
    if (!game || game.status !== 'playing') return;

    const pIdx = game.getPlayerIndex(botPlayer.id);
    if (pIdx !== game.turnIndex) return;

    setTimeout(() => {
      if (game.status !== 'playing' || game.turnIndex !== pIdx) return;

      if (!game.hasDrawn) {
        const leftPlayerIdx = (pIdx + 3) % 4;
        const leftPile = game.discardPiles[leftPlayerIdx];
        const topDiscard = leftPile && leftPile.length > 0 ? leftPile[leftPile.length - 1] : null;

        let shouldDrawDiscard = false;
        if (topDiscard && game.okeyInfo) {
          const isWild = RuleValidator.isWildOkey(topDiscard, game.okeyInfo);
          const hasPair = botPlayer.hand.some(t => RuleValidator.isPair(t, topDiscard, game.okeyInfo));

          if (isWild || hasPair) {
            if (game.gameType === '101') {
              if (game.openedHands[pIdx]) shouldDrawDiscard = true;
            } else {
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

      setTimeout(() => {
        if (game.status !== 'playing' || game.turnIndex !== pIdx) return;

        if (game.gameType === 'classic') {
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
          if (!game.openedHands[pIdx]) {
            this.tryOpenHand101(game, botPlayer);
          }
          if (game.openedHands[pIdx]) {
            this.tryProcessTiles101(game, botPlayer);
          }
        }

        const discardTile = this.chooseTileToDiscard(botPlayer.hand, game.okeyInfo);
        if (discardTile) {
          game.discardTile(botPlayer.id, discardTile.id, false);
          if (onUpdate) onUpdate();
        }
      }, 700);
    }, 600);
  }

  static tryOpenHand101(game, botPlayer) {
    const hand = botPlayer.hand;
    const okeyInfo = game.okeyInfo;

    const byColor = { red: [], blue: [], black: [], yellow: [] };
    for (const t of hand) {
      if (!RuleValidator.isWildOkey(t, okeyInfo) && byColor[t.color]) {
        byColor[t.color].push(t);
      }
    }

    const foundPers = [];
    const usedTileIds = new Set();

    for (const color in byColor) {
      const sorted = [...byColor[color]].sort((a, b) => a.value - b.value);
      for (let i = 0; i <= sorted.length - 3; i++) {
        const c1 = sorted[i];
        const c2 = sorted[i + 1];
        const c3 = sorted[i + 2];
        if (
          c2.value === c1.value + 1 &&
          c3.value === c2.value + 1 &&
          !usedTileIds.has(c1.id) &&
          !usedTileIds.has(c2.id) &&
          !usedTileIds.has(c3.id)
        ) {
          foundPers.push([c1, c2, c3]);
          usedTileIds.add(c1.id);
          usedTileIds.add(c2.id);
          usedTileIds.add(c3.id);
        }
      }
    }

    if (foundPers.length > 0) {
      const minRequired = game.options.folded ? game.highestOpenedPoints : 101;
      const validation = RuleValidator.validate101Opening(foundPers, okeyInfo, minRequired);
      if (validation.valid) {
        game.openRunsHand(botPlayer.id, foundPers);
      }
    }
  }

  static tryProcessTiles101(game, botPlayer) {
    if (!game.tablePers || game.tablePers.length === 0) return;

    for (const per of game.tablePers) {
      for (let i = 0; i < botPlayer.hand.length; i++) {
        const tile = botPlayer.hand[i];
        if (RuleValidator.isWildOkey(tile, game.okeyInfo)) continue;

        const can = RuleValidator.canProcessTile(tile, per.tiles, game.okeyInfo);
        if (can) {
          const res = game.processTile(botPlayer.id, tile.id, per.id);
          if (res.success) return;
        }
      }
    }
  }

  static chooseTileToDiscard(hand, okeyInfo) {
    if (!hand || hand.length === 0) return null;

    const nonWild = hand.filter(t => !RuleValidator.isWildOkey(t, okeyInfo));
    if (nonWild.length === 0) return hand[0];

    let lowestScore = Infinity;
    let worstTile = nonWild[0];

    for (const t of nonWild) {
      let score = 0;
      for (const other of nonWild) {
        if (t.id === other.id) continue;
        if (t.color === other.color) {
          const diff = Math.abs(t.value - other.value);
          if (diff === 1) score += 4;
          else if (diff === 2) score += 2;
        }
        if (t.value === other.value && t.color !== other.color) {
          score += 3;
        }
        if (t.value === other.value && t.color === other.color) {
          score += 5;
        }
      }

      if (score < lowestScore) {
        lowestScore = score;
        worstTile = t;
      }
    }

    return worstTile;
  }
}
