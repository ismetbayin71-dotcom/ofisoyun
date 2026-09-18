import { Deck } from '../server/models/Deck.js';
import { RuleValidator } from '../server/models/RuleValidator.js';
import { Tile } from '../server/models/Tile.js';
import { OkeyGame } from '../server/game/OkeyGame.js';
import { Okey101Game } from '../server/game/Okey101Game.js';

console.log('--- 1. DECK & OKEY DETERMINATION TEST ---');
const deck = new Deck();
deck.generate();
console.assert(deck.tiles.length === 106, `Expected 106 tiles, got ${deck.tiles.length}`);
deck.shuffle();
deck.setupIndicatorAndOkey();

console.log('Indicator (Gösterge):', deck.indicator.color, deck.indicator.value);
console.log('Wildcard Okey:', deck.okeyTileInfo.color, deck.okeyTileInfo.value);
console.assert(deck.okeyTileInfo !== null, 'Okey must be defined');

const hands = deck.dealHands(false, 0);
console.assert(hands[0].length === 15, `First player should have 15 tiles, got ${hands[0].length}`);
console.assert(hands[1].length === 14, `Second player should have 14 tiles, got ${hands[1].length}`);
console.assert(deck.drawPile.length === 48, `Remaining draw pile should be 48, got ${deck.drawPile.length}`);
console.log('✓ Deck & dealing tests passed!');

console.log('\n--- 2. RULE VALIDATOR TESTS ---');
const okeyInfo = { color: 'blue', value: 5 };

// Valid Run: Red 7, 8, 9
const run1 = [
  new Tile('r7', 'red', 7),
  new Tile('r8', 'red', 8),
  new Tile('r9', 'red', 9)
];
console.assert(RuleValidator.isValidRun(run1, okeyInfo) === true, 'Run 7-8-9 should be valid');

// Valid Run with Okey Joker: Red 7, Blue 5 (Okey), Red 9
const runWithOkey = [
  new Tile('r7', 'red', 7),
  new Tile('b5', 'blue', 5), // Wildcard
  new Tile('r9', 'red', 9)
];
console.assert(RuleValidator.isValidRun(runWithOkey, okeyInfo) === true, 'Run 7-Okey-9 should be valid');

// Valid Wrap Run: Black 11, 12, 13, 1
const wrapRun = [
  new Tile('k11', 'black', 11),
  new Tile('k12', 'black', 12),
  new Tile('k13', 'black', 13),
  new Tile('k1', 'black', 1)
];
console.assert(RuleValidator.isValidRun(wrapRun, okeyInfo) === true, 'Wrap run 11-12-13-1 should be valid');

// Invalid Run: 13-1-2
const invalidWrapRun = [
  new Tile('k13', 'black', 13),
  new Tile('k1', 'black', 1),
  new Tile('k2', 'black', 2)
];
console.assert(RuleValidator.isValidRun(invalidWrapRun, okeyInfo) === false, 'Run 13-1-2 must NOT be valid');

// Valid Group: Red 10, Blue 10, Black 10
const group1 = [
  new Tile('r10', 'red', 10),
  new Tile('b10', 'blue', 10),
  new Tile('k10', 'black', 10)
];
console.assert(RuleValidator.isValidGroup(group1, okeyInfo) === true, 'Group 10-10-10 should be valid');

// Invalid Group: Duplicate color Red 10, Red 10, Black 10
const invalidGroup = [
  new Tile('r10-1', 'red', 10),
  new Tile('r10-2', 'red', 10),
  new Tile('k10', 'black', 10)
];
console.assert(RuleValidator.isValidGroup(invalidGroup, okeyInfo) === false, 'Group with duplicate color must NOT be valid');

// 101 Points Calculation: Run 10-11-12 (33) + Group 10-10-10 (30) + Run 12-13-1 (26) + Group 12-12-12 (36)
const p1 = [new Tile('r10', 'red', 10), new Tile('r11', 'red', 11), new Tile('r12', 'red', 12)]; // 33
const p2 = [new Tile('r9', 'red', 9), new Tile('b9', 'blue', 9), new Tile('k9', 'black', 9)]; // 27
const p3 = [new Tile('y11', 'yellow', 11), new Tile('y12', 'yellow', 12), new Tile('y13', 'yellow', 13)]; // 36
const p4 = [new Tile('k8', 'black', 8), new Tile('k9', 'black', 9), new Tile('k10', 'black', 10)]; // 27
const validation = RuleValidator.validate101Opening([p1, p2, p3, p4], okeyInfo, 101);
console.assert(validation.valid === true, `Expected valid 101 opening, points: ${validation.points}`);
console.log('✓ 101 Points validation passed! Total:', validation.points);

console.log('\n--- 3. OKEY GAME STATE TEST ---');
const game = new OkeyGame('test-room');
game.players = [
  { id: 'p1', name: 'İsmet', isBot: false },
  { id: 'p2', name: 'Bot 1', isBot: true },
  { id: 'p3', name: 'Bot 2', isBot: true },
  { id: 'p4', name: 'Bot 3', isBot: true }
];
game.startNewRound();
console.assert(game.status === 'playing', 'Game status should be playing');
console.assert(game.players[game.turnIndex].hand.length === 15, 'Active first player has 15 tiles');

// First player discards a tile
const firstPlayer = game.players[game.turnIndex];
const tileToDiscard = firstPlayer.hand[0];
const discardRes = game.discardTile(firstPlayer.id, tileToDiscard.id, false);
console.assert(discardRes.success === true, 'First player discard should succeed');
console.assert(firstPlayer.hand.length === 14, 'First player should now have 14 tiles');
console.assert(game.turnIndex === 2, `Turn should advance to next player, got ${game.turnIndex}`);
console.log('✓ OkeyGame turn flow passed!');

console.log('\n--- 4. OKEY 101 REMAINING TILE & FINISH RULES ---');
const g101 = new Okey101Game('test-101', { folded: false });
g101.players = [
  { id: 'p1', name: 'Can (Bot)', hand: [], isBot: true },
  { id: 'p2', name: 'Zeynep', hand: [], isBot: true },
  { id: 'p3', name: 'Ahmet', hand: [], isBot: true },
  { id: 'p4', name: 'Elif', hand: [], isBot: true }
];
g101.status = 'playing';
g101.turnIndex = 0;
g101.hasDrawn = true;
g101.okeyInfo = { color: 'blue', value: 1 };
g101.openedHands[0] = { type: 'runs', points: 105 };

// Subcase A: Bot has 3 tiles left in hand and tries to open a 3-tile per -> MUST FAIL!
const t1 = new Tile('r10', 'red', 10);
const t2 = new Tile('r11', 'red', 11);
const t3 = new Tile('r12', 'red', 12);
g101.players[0].hand = [t1, t2, t3];

const illegalOpen = g101.openRunsHand('p1', [[t1, t2, t3]]);
console.assert(illegalOpen.success === false, 'Cannot open 3 tiles when hand length is 3 (leaves 0 tiles to discard)');
console.assert(g101.players[0].hand.length === 3, 'Hand length must remain 3');
console.log('✓ 101 rule passed: cannot open when remaining hand would be < 1!');

// Subcase B: Bot has 4 tiles in hand (3 to open, 1 to discard and finish!) -> MUST SUCCEED!
const t4 = new Tile('b5', 'black', 5);
g101.players[0].hand = [t1, t2, t3, t4];

const legalOpen = g101.openRunsHand('p1', [[t1, t2, t3]]);
console.assert(legalOpen.success === true, 'Can open 3 tiles when hand length is 4 (leaves 1 tile to discard)');
console.assert(g101.players[0].hand.length === 1, 'Exactly 1 tile must remain for discard');

// Discard the last tile to finish!
const finishRes = g101.discardTile('p1', t4.id);
console.assert(finishRes.success === true && finishRes.finished === true, 'Discarding last tile must finish round');
console.assert(g101.status === 'round_ended', 'Round status should be round_ended');
console.log('✓ 101 rule passed: having 4 tiles, opening 3 and discarding 1 finishes and wins round!');

// Subcase C: Player with 1 tile left tries to process it -> MUST FAIL!
g101.status = 'playing';
g101.hasDrawn = true;
g101.players[0].hand = [t4];
g101.tablePers = [{ id: 'per-test', tiles: [new Tile('b2', 'black', 2), new Tile('b3', 'black', 3), new Tile('b4', 'black', 4)] }];
const illegalProcess = g101.processTile('p1', t4.id, 'per-test');
console.assert(illegalProcess.success === false, 'Cannot process the last remaining tile');
console.log('✓ 101 rule passed: cannot process last remaining tile!');

console.log('\n=====================================');
console.log('🎉 ALL GAME ENGINE TESTS PASSED!');
console.log('=====================================');
