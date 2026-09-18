import assert from 'assert';

// Mock localStorage for node environment
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => store.get(k) || null,
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear()
};

const { authService, AVAILABLE_AVATARS } = await import('../src/utils/authService.js');

console.log('--- Testing AuthService Registration & Validation ---');

// 1. Validation checks
const shortNameRes = authService.register('ab', '1234');
assert.strictEqual(shortNameRes.success, false, 'Should reject username < 3 chars');

const shortPassRes = authService.register('ismet', '12');
assert.strictEqual(shortPassRes.success, false, 'Should reject password < 4 chars');

// 2. Successful Registration
const regRes = authService.register('İsmetBayin', 'password123', 'trophy');
assert.strictEqual(regRes.success, true, 'Should register successfully');
assert.strictEqual(regRes.user.username, 'İsmetBayin');
assert.strictEqual(regRes.user.avatar, 'trophy');
assert.strictEqual(regRes.user.stats.wins, 0);
assert.strictEqual(regRes.user.stats.totalGames, 0);

// 3. Duplicate Registration Check
const dupRes = authService.register('ismetbayin', 'otherpass');
assert.strictEqual(dupRes.success, false, 'Should reject duplicate case-insensitive username');

// 4. Session Persistence
const current = authService.getCurrentUser();
assert.strictEqual(current.username, 'İsmetBayin', 'Should auto-login registered user');

// 5. Logout
authService.logout();
assert.strictEqual(authService.getCurrentUser(), null, 'Should be null after logout');

// 6. Login verification
const wrongPass = authService.login('İsmetBayin', 'wrongpassword');
assert.strictEqual(wrongPass.success, false, 'Should reject wrong password');

const correctLogin = authService.login('İsmetBayin', 'password123');
assert.strictEqual(correctLogin.success, true, 'Should login with correct credentials');
assert.strictEqual(correctLogin.user.username, 'İsmetBayin');

// 7. Game Stats Recording
authService.recordGameResult(true, 100); // 1st game: Win
let userAfterWin = authService.getCurrentUser();
assert.strictEqual(userAfterWin.stats.totalGames, 1);
assert.strictEqual(userAfterWin.stats.wins, 1);
assert.strictEqual(userAfterWin.stats.losses, 0);
assert.strictEqual(userAfterWin.stats.winRate, 100);

authService.recordGameResult(false, 50); // 2nd game: Loss
let userAfterLoss = authService.getCurrentUser();
assert.strictEqual(userAfterLoss.stats.totalGames, 2);
assert.strictEqual(userAfterLoss.stats.wins, 1);
assert.strictEqual(userAfterLoss.stats.losses, 1);
assert.strictEqual(userAfterLoss.stats.winRate, 50);

// 8. Avatar Update
authService.updateAvatar('fire');
let userAfterAvatar = authService.getCurrentUser();
assert.strictEqual(userAfterAvatar.avatar, 'fire', 'Should update avatar to fire');

console.log('✓ All AuthService tests passed successfully!');
