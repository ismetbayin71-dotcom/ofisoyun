import { Tile, COLORS } from './Tile.js';

export class Deck {
  constructor() {
    this.tiles = [];
    this.indicator = null; // Gösterge taşı
    this.okeyTileInfo = null; // { color, value }
    this.drawPile = [];
  }

  // Generates 106 tiles
  generate() {
    const tiles = [];
    // 4 colors, 1-13, 2 sets of each
    for (let copy = 1; copy <= 2; copy++) {
      for (const color of COLORS) {
        for (let val = 1; val <= 13; val++) {
          tiles.push(new Tile(`${color}-${val}-${copy}`, color, val, false));
        }
      }
    }
    // 2 Fake Jokers (Sahte Okey)
    tiles.push(new Tile('fake-1', 'none', 0, true));
    tiles.push(new Tile('fake-2', 'none', 0, true));

    this.tiles = tiles;
  }

  // Shuffles using Fisher-Yates
  shuffle() {
    for (let i = this.tiles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.tiles[i], this.tiles[j]] = [this.tiles[j], this.tiles[i]];
    }
  }

  // Sets up indicator and resolves Okey
  setupIndicatorAndOkey() {
    // Find an indicator tile that is NOT a fake joker
    let indicatorIndex = -1;
    for (let i = 0; i < this.tiles.length; i++) {
      if (!this.tiles[i].isFakeJoker) {
        indicatorIndex = i;
        break;
      }
    }

    // Remove indicator tile from deck to be placed face-up
    this.indicator = this.tiles.splice(indicatorIndex, 1)[0];

    // Okey is the tile with the same color, +1 value (13 wraps to 1)
    const okeyColor = this.indicator.color;
    const okeyValue = this.indicator.value === 13 ? 1 : this.indicator.value + 1;

    this.okeyTileInfo = {
      color: okeyColor,
      value: okeyValue
    };

    // The Fake Jokers assume the role/identity of the original Okey tile
    for (const tile of this.tiles) {
      if (tile.isFakeJoker) {
        tile.color = okeyColor;
        tile.value = okeyValue;
      }
    }

    this.drawPile = [...this.tiles];
  }

  // Deals hands for 4 players
  // is101: boolean (true for 21/22 tiles, false for 14/15 tiles)
  // firstPlayerIndex: 0..3 (gets 1 extra tile to discard first)
  dealHands(is101 = false, firstPlayerIndex = 0) {
    const baseCount = is101 ? 21 : 14;
    const hands = [[], [], [], []];

    for (let p = 0; p < 4; p++) {
      const count = (p === firstPlayerIndex) ? baseCount + 1 : baseCount;
      hands[p] = this.drawPile.splice(0, count);
    }

    return hands;
  }

  // Draw one tile from center
  draw() {
    if (this.drawPile.length === 0) return null;
    return this.drawPile.shift();
  }

  // Remaining count
  remainingCount() {
    return this.drawPile.length;
  }
}
