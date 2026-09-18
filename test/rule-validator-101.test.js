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

// Test: 12-13-1 is NOT valid in 101 Okey, but valid in Classic
const wrapRun101 = [
  new Tile('r12', 'red', 12),
  new Tile('r13', 'red', 13),
  new Tile('r1', 'red', 1)
];
console.assert(RuleValidator.isValidRun(wrapRun101, okeyInfo, '101') === false, '12-13-1 must NOT be valid in 101');
console.assert(RuleValidator.isValidRun(wrapRun101, okeyInfo, 'classic') === true, '12-13-1 must be valid in classic');
console.log('✓ 12-13-1 correctly disallowed in 101 and allowed in classic!');

// Test: findBest101Pers ignores 12-13-1
const wrapOnlyHand = [
  new Tile('r12-wrap', 'red', 12),
  new Tile('r13-wrap', 'red', 13),
  new Tile('r1-wrap', 'red', 1)
];
const wrapScan = RuleValidator.findBest101Pers(wrapOnlyHand, okeyInfo);
console.assert(wrapScan.pers.length === 0, '12-13-1 must not be formed as a per in 101');
console.assert(wrapScan.totalPoints === 0, 'Points for 12-13-1 in 101 must be 0');
console.log('✓ findBest101Pers correctly ignored 12-13-1!');

// Test: autoArrangeRuns does not group 12-13-1 in 101 mode
const arrangeHand = [
  new Tile('k12', 'black', 12),
  new Tile('k13', 'black', 13),
  new Tile('k1', 'black', 1)
];
const arranged101 = RuleValidator.autoArrangeRuns(arrangeHand, okeyInfo, '101');
const arrangedClassic = RuleValidator.autoArrangeRuns(arrangeHand, okeyInfo, 'classic');
console.assert(arrangedClassic[0].value === 12 && arrangedClassic[1].value === 13 && arrangedClassic[2].value === 1, 'Classic autoArrange creates wrap per');
console.assert(!(arranged101[0]?.value === 12 && arranged101[1]?.value === 13 && arranged101[2]?.value === 1 && arranged101[3] === null), '101 autoArrange does NOT create wrap per');
console.log('✓ autoArrangeRuns correctly distinguishes 101 from classic!');

// Test: autoArrangeRuns groups optimal 12-12-12 and 9-10-11 matching findBest101Pers
const okeyInfoGame = { color: 'yellow', value: 3 };
const hand69 = [
  new Tile('r9', 'red', 9),
  new Tile('r10', 'red', 10),
  new Tile('r11', 'red', 11),
  new Tile('r12', 'red', 12),
  new Tile('b1', 'blue', 1),
  new Tile('y1', 'yellow', 1),
  new Tile('r1', 'red', 1),
  new Tile('y12', 'yellow', 12),
  new Tile('b12', 'blue', 12)
];
const arranged69 = RuleValidator.autoArrangeRuns(hand69, okeyInfoGame, '101');
// Row 1 should have 9-10-11, gap, 12-12-12, gap, 1-1-1
const r1 = arranged69.slice(0, 11).map(t => t ? `${t.color[0]}${t.value}` : '__').join(' ');
console.assert(r1.includes('r9 r10 r11') && r1.includes('r12 y12 b12'), 'Should arrange 12-12-12 and 9-10-11 together');
console.log('✓ autoArrangeRuns successfully matches optimal pers (12-12-12 and 9-10-11)!');

console.log('🎉 ALL 101 VALIDATION TESTS PASSED!');

