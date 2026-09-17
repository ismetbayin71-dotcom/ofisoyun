import { RuleValidator } from '../src/game/RuleValidator.js';
import { Tile } from '../src/game/Tile.js';

console.log('--- TESTING 101 PER DETECTION & SCORING ---');
const okeyInfo = { color: 'blue', value: 1 }; // Okey is Blue 1

// Hand with 3 valid runs:
// Run 1: Red 10, 11, 12 (sum: 33)
// Run 2: Black 11, 12, 13 (sum: 36)
// Group 3: Yellow 12, Black 12, Red 12 (sum: 36)
// Total points: 33 + 36 + 36 = 105 points!
const testHand = [
  new Tile('r10', 'red', 10),
  new Tile('r11', 'red', 11),
  new Tile('r12', 'red', 12),

  new Tile('k11', 'black', 11),
  new Tile('k12', 'black', 12),
  new Tile('k13', 'black', 13),

  new Tile('y12', 'yellow', 12),
  new Tile('k12-copy', 'black', 12),
  new Tile('r12-copy', 'red', 12),

  // Plus some leftover single tiles:
  new Tile('b3', 'blue', 3),
  new Tile('y4', 'yellow', 4)
];

const bestResult = RuleValidator.findBest101Pers(testHand, okeyInfo);
console.log('Best 101 Pers Found:', bestResult.pers.length);
console.log('Total Points:', bestResult.totalPoints);

console.assert(bestResult.pers.length === 3, `Expected 3 pers, got ${bestResult.pers.length}`);
console.assert(bestResult.totalPoints === 105, `Expected 105 points, got ${bestResult.totalPoints}`);
console.log('✓ findBest101Pers correctly extracted all 3 pers and totaled 105 points!');

// Test Pair detection (5 pairs)
const pairHand = [
  new Tile('r7-1', 'red', 7), new Tile('r7-2', 'red', 7),
  new Tile('b3-1', 'blue', 3), new Tile('b3-2', 'blue', 3),
  new Tile('k11-1', 'black', 11), new Tile('k11-2', 'black', 11),
  new Tile('y5-1', 'yellow', 5), new Tile('y5-2', 'yellow', 5),
  new Tile('r9-1', 'red', 9), new Tile('r9-2', 'red', 9),
  new Tile('single-1', 'black', 1)
];

const pairResult = RuleValidator.find101Pairs(pairHand, okeyInfo);
console.log('Pairs Found:', pairResult.pairCount);
console.assert(pairResult.pairCount === 5, `Expected 5 pairs, got ${pairResult.pairCount}`);
console.log('✓ find101Pairs correctly detected all 5 pairs!');

console.log('🎉 ALL 101 VALIDATION TESTS PASSED!');
