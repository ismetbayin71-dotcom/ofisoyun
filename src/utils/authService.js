/**
 * Authentication and Player Profile Service
 * Manages player registration, login, avatar selection, session persistence,
 * and game statistics (wins, losses, games played).
 */

const STORAGE_USERS_KEY = 'okey_users_db_v1';
const STORAGE_SESSION_KEY = 'okey_current_session_v1';

// Predefined Okey thematic avatars
export const AVAILABLE_AVATARS = [
  { id: 'crown', label: 'Şampiyon', icon: '👑', color: '#e5b94c' },
  { id: 'fire', label: 'Ateşli', icon: '🔥', color: '#f97316' },
  { id: 'dice', label: 'Şanslı', icon: '🎲', color: '#38ef7d' },
  { id: 'star', label: 'Yıldız', icon: '⭐', color: '#eab308' },
  { id: 'trophy', label: 'Usta', icon: '🏆', color: '#f59e0b' },
  { id: 'shield', label: 'Muhafız', icon: '🛡️', color: '#60a5fa' },
  { id: 'zap', label: 'Hızlı', icon: '⚡', color: '#a855f7' },
  { id: 'coffee', label: 'Keyifçi', icon: '☕', color: '#d97706' },
];

class AuthService {
  constructor() {
    this.listeners = [];
  }

  // Helper to read all users from storage
  _getUsersDb() {
    try {
      const data = localStorage.getItem(STORAGE_USERS_KEY);
      return data ? JSON.parse(data) : {};
    } catch (e) {
      return {};
    }
  }

  // Helper to save all users to storage
  _saveUsersDb(db) {
    try {
      localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(db));
    } catch (e) {
      console.error('Failed to save users database:', e);
    }
  }

  // Simple string hash for password verification
  _hashPassword(password) {
    let hash = 0;
    const str = `okey_salt_${password}`;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }

  /**
   * Register a new user account
   */
  register(username, password, avatarId = 'crown') {
    if (!username || username.trim().length < 3) {
      return { success: false, message: 'Kullanıcı adı en az 3 karakter olmalıdır.' };
    }
    if (!password || password.length < 4) {
      return { success: false, message: 'Şifre en az 4 karakter olmalıdır.' };
    }

    const cleanUsername = username.trim();
    const normalize = (s) => (s || '').toLocaleLowerCase('tr-TR');
    const db = this._getUsersDb();

    // Case-insensitive duplicate check (handles Turkish characters like İ/i, I/ı)
    const existing = Object.values(db).find(
      u => normalize(u.username) === normalize(cleanUsername)
    );
    if (existing) {
      return { success: false, message: 'Bu kullanıcı adı zaten alınmış!' };
    }

    const userId = `usr-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    const newUser = {
      id: userId,
      username: cleanUsername,
      passwordHash: this._hashPassword(password),
      avatar: avatarId,
      stats: {
        totalGames: 0,
        wins: 0,
        losses: 0,
        totalScore: 0
      },
      createdAt: Date.now()
    };

    db[userId] = newUser;
    this._saveUsersDb(db);

    // Auto-login after registration
    this._setSession(newUser);
    return { success: true, user: this.sanitizeUser(newUser) };
  }

  /**
   * Login with username and password
   */
  login(username, password) {
    if (!username || !password) {
      return { success: false, message: 'Kullanıcı adı ve şifre gereklidir.' };
    }

    const cleanUsername = username.trim();
    const normalize = (s) => (s || '').toLocaleLowerCase('tr-TR');
    const db = this._getUsersDb();

    const user = Object.values(db).find(
      u => normalize(u.username) === normalize(cleanUsername)
    );

    if (!user) {
      return { success: false, message: 'Kullanıcı bulunamadı.' };
    }

    if (user.passwordHash !== this._hashPassword(password)) {
      return { success: false, message: 'Şifre hatalı!' };
    }

    this._setSession(user);
    return { success: true, user: this.sanitizeUser(user) };
  }

  /**
   * Logout current session
   */
  logout() {
    localStorage.removeItem(STORAGE_SESSION_KEY);
    this._notifyListeners(null);
    return { success: true };
  }

  /**
   * Get currently logged-in user
   */
  getCurrentUser() {
    try {
      const data = localStorage.getItem(STORAGE_SESSION_KEY);
      if (!data) return null;
      const session = JSON.parse(data);

      // Re-fetch latest from database to ensure fresh stats
      const db = this._getUsersDb();
      const freshUser = db[session.id];
      if (freshUser) {
        return this.sanitizeUser(freshUser);
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Update game statistics for logged-in user
   */
  recordGameResult(isWinner, score = 0) {
    const current = this.getCurrentUser();
    if (!current) return;

    const db = this._getUsersDb();
    const user = db[current.id];
    if (!user) return;

    user.stats = user.stats || { totalGames: 0, wins: 0, losses: 0, totalScore: 0 };
    user.stats.totalGames = (user.stats.totalGames || 0) + 1;
    if (isWinner) {
      user.stats.wins = (user.stats.wins || 0) + 1;
    } else {
      user.stats.losses = (user.stats.losses || 0) + 1;
    }
    user.stats.totalScore = (user.stats.totalScore || 0) + score;

    this._saveUsersDb(db);
    this._setSession(user);
  }

  /**
   * Update user avatar
   */
  updateAvatar(newAvatarId) {
    const current = this.getCurrentUser();
    if (!current) return { success: false };

    const db = this._getUsersDb();
    const user = db[current.id];
    if (!user) return { success: false };

    user.avatar = newAvatarId;
    this._saveUsersDb(db);
    this._setSession(user);
    return { success: true, user: this.sanitizeUser(user) };
  }

  // Set current active session
  _setSession(user) {
    const clean = this.sanitizeUser(user);
    localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(clean));
    // Also sync player name in legacy key
    localStorage.setItem('okey_player_name', clean.username);
    this._notifyListeners(clean);
  }

  // Remove sensitive hash from user object
  sanitizeUser(user) {
    if (!user) return null;
    const { passwordHash, ...safeUser } = user;
    const stats = safeUser.stats || { totalGames: 0, wins: 0, losses: 0, totalScore: 0 };
    const winRate = stats.totalGames > 0 ? Math.round((stats.wins / stats.totalGames) * 100) : 0;
    return {
      ...safeUser,
      stats: {
        ...stats,
        winRate
      }
    };
  }

  // Event listener for auth changes
  onAuthChange(callback) {
    this.listeners.push(callback);
    callback(this.getCurrentUser());
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  _notifyListeners(user) {
    this.listeners.forEach(cb => {
      try {
        cb(user);
      } catch (e) {}
    });
  }
}

export const authService = new AuthService();
