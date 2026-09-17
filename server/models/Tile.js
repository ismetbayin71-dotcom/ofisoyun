export const COLORS = ['red', 'blue', 'black', 'yellow'];

export class Tile {
  constructor(id, color, value, isFakeJoker = false) {
    this.id = id; // Unique string e.g. 'red-7-1'
    this.color = color; // 'red' | 'blue' | 'black' | 'yellow' | 'none'
    this.value = value; // 1 to 13, or 0 for fake joker before resolve
    this.isFakeJoker = isFakeJoker; // true for the 2 fake jokers
  }

  // Clones the tile with exact properties
  clone() {
    return new Tile(this.id, this.color, this.value, this.isFakeJoker);
  }
}
