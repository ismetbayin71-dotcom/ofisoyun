export const COLORS = ['red', 'blue', 'black', 'yellow'];

export class Tile {
  constructor(id, color, value, isFakeJoker = false) {
    this.id = id;
    this.color = color; // 'red' | 'blue' | 'black' | 'yellow' | 'none'
    this.value = value; // 1 to 13
    this.isFakeJoker = isFakeJoker;
  }

  clone() {
    return new Tile(this.id, this.color, this.value, this.isFakeJoker);
  }
}
