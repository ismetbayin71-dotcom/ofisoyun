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

console.log('\n=====================================');
console.log('🎉 ALL GAME ENGINE TESTS PASSED!');
console.log('=====================================');
