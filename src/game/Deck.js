import { Tile, COLORS } from './Tile.js';

export class Deck {
  constructor() {
    this.tiles = [];
    this.indicator = null;
    this.okeyTileInfo = null;
    this.drawPile = [];
  }

  generate() {
    const tiles = [];
    for (let copy = 1; copy <= 2; copy++) {
      for (const color of COLORS) {
        for (let val = 1; val <= 13; val++) {
          tiles.push(new Tile(`${color}-${val}-${copy}`, color, val, false));
        }
      }
    }
    tiles.push(new Tile('fake-1', 'none', 0, true));
    tiles.push(new Tile('fake-2', 'none', 0, true));
    this.tiles = tiles;
  }

  shuffle() {
    for (let i = this.tiles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.tiles[i], this.tiles[j]] = [this.tiles[j], this.tiles[i]];
    }
  }

  setupIndicatorAndOkey() {
    let indicatorIndex = -1;
    for (let i = 0; i < this.tiles.length; i++) {
      if (!this.tiles[i].isFakeJoker) {
        indicatorIndex = i;
        break;
      }
    }

    this.indicator = this.tiles.splice(indicatorIndex, 1)[0];
    const okeyColor = this.indicator.color;
    const okeyValue = this.indicator.value === 13 ? 1 : this.indicator.value + 1;

    this.okeyTileInfo = {
      color: okeyColor,
      value: okeyValue
    };

    for (const tile of this.tiles) {
      if (tile.isFakeJoker) {
        tile.color = okeyColor;
        tile.value = okeyValue;
      }
    }

    this.drawPile = [...this.tiles];
  }

  dealHands(is101 = false, firstPlayerIndex = 0) {
    const baseCount = is101 ? 21 : 14;
    const hands = [[], [], [], []];

    for (let p = 0; p < 4; p++) {
      const count = (p === firstPlayerIndex) ? baseCount + 1 : baseCount;
      hands[p] = this.drawPile.splice(0, count);
    }

    return hands;
  }

  draw() {
    if (this.drawPile.length === 0) return null;
    return this.drawPile.shift();
  }

  remainingCount() {
    return this.drawPile.length;
  }
}
