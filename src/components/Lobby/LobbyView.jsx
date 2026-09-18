import React, { useState, useEffect } from 'react';
import { network } from '../../utils/network.js';
import { authService } from '../../utils/authService.js';
import { AuthModal } from '../UI/AuthModal.jsx';
import { UserProfileCard } from '../UI/UserProfileCard.jsx';
import { PlusCircle, LogIn, Globe, Sparkles } from 'lucide-react';

export const LobbyView = ({ onRoomJoined, playerName, setPlayerName }) => {
  const [createName, setCreateName] = useState('Okey Masası');
  const [gameType, setGameType] = useState('classic'); // 'classic' | '101'
  const [folded, setFolded] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [currentUser, setCurrentUser] = useState(() => authService.getCurrentUser());
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Sync auth state
  useEffect(() => {
    const unsub = authService.onAuthChange((user) => {
      setCurrentUser(user);
      if (user && user.username) {
        setPlayerName(user.username);
      }
    });
    return unsub;
  }, [setPlayerName]);

  // Create room handler
  const handleCreateRoom = async (e) => {
    e.preventDefault();
    if (!playerName.trim()) {
      setErrorMessage('Lütfen adınızı girin.');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      const res = await network.createRoom({
        name: createName,
        gameType,
        options: { folded },
        playerName: playerName.trim()
      });

      setLoading(false);
      if (res.success) {
        onRoomJoined(res.roomId);
      } else {
        setErrorMessage(res.message || 'Masa oluşturulamadı.');
      }
    } catch (err) {
      setLoading(false);
      setErrorMessage('Oda başlatılırken hata oluştu: ' + (err.message || ''));
    }
  };

  // Join room handler
  const handleJoinRoom = async (e, codeToJoin) => {
    if (e) e.preventDefault();
    const targetCode = (codeToJoin || joinCode).trim();
    if (!targetCode) {
      setErrorMessage('Lütfen 4 haneli oda kodunu girin.');
      return;
    }
    if (!playerName.trim()) {
      setErrorMessage('Lütfen adınızı girin.');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      const res = await network.joinRoom({
        roomId: targetCode,
        playerName: playerName.trim()
      });

      setLoading(false);
      if (res.success) {
        onRoomJoined(targetCode);
      } else {
        setErrorMessage(res.message || 'Odaya bağlanılamadı. Kodun doğruluğunu veya oda kurucusunun açık olduğunu kontrol edin.');
      }
    } catch (err) {
      setLoading(false);
      setErrorMessage('Bağlantı hatası: ' + (err.message || ''));
    }
  };

  return (
    <div className="lobby-container">
      {/* Header */}
      <header className="lobby-header">
        <div className="brand-title">
          <h1>OKEY SALONU</h1>
          <span className="brand-badge">Çevrimiçi Web</span>
        </div>

        <div className="lobby-header-right">
          <UserProfileCard
            user={currentUser}
            onOpenAuth={() => setShowAuthModal(true)}
            onLogout={() => {
              authService.logout();
            }}
          />

          <div className="network-pill" title="WebRTC Peer-to-Peer">
            <Globe size={16} color="#38ef7d" />
            <span>Bağlantı:</span>
            <strong>P2P WebRTC</strong>
          </div>
        </div>
      </header>

      {errorMessage && (
        <div style={{ maxWidth: 1200, margin: '0 auto 20px', width: '100%', padding: '12px 18px', background: 'rgba(220, 38, 38, 0.2)', border: '1px solid rgba(220, 38, 38, 0.5)', borderRadius: 12, color: '#fca5a5' }}>
          {errorMessage}
        </div>
      )}

      {/* Main Form Grid */}
      <div className="lobby-main-grid">
        {/* Create Room Card */}
        <div className="lobby-card">
          <h2>
            <PlusCircle size={22} color="#e5b94c" />
            Yeni Masa Kur (Oda Aç)
          </h2>

          <form onSubmit={handleCreateRoom}>
            <div className="form-group">
              <label>Adınız / Rumuzunuz</label>
              <input
                type="text"
                className="form-input"
                placeholder="Örn: İsmet, Ahmet, Ayşe..."
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label>Masa Adı</label>
              <input
                type="text"
                className="form-input"
                placeholder="Örn: Dostlar Masası"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label>Oyun Türü</label>
              <div className="mode-selector">
                <button
                  type="button"
                  className={`mode-btn ${gameType === 'classic' ? 'active' : ''}`}
                  onClick={() => setGameType('classic')}
                >
                  <span className="mode-title">Klasik Düz Okey</span>
                  <span className="mode-desc">14 taş, seri ve çift bitişli standart okey</span>
                </button>

                <button
                  type="button"
                  className={`mode-btn ${gameType === '101' ? 'active' : ''}`}
                  onClick={() => setGameType('101')}
                >
                  <span className="mode-title">101 Yüzbir Okey</span>
                  <span className="mode-desc">21 taş, 101 puan barajı, el açma ve işleme</span>
                </button>
              </div>
            </div>

            {gameType === '101' && (
              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input
                  type="checkbox"
                  id="foldedOption"
                  checked={folded}
                  onChange={(e) => setFolded(e.target.checked)}
                  style={{ width: 18, height: 18, accentColor: '#e5b94c' }}
                />
                <label htmlFor="foldedOption" style={{ margin: 0, textTransform: 'none', cursor: 'pointer' }}>
                  <strong>Katlamalı Mod</strong> (Her açan el öncekinden yüksek olmalıdır)
                </label>
              </div>
            )}

            <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: 12 }} disabled={loading}>
              <PlusCircle size={18} />
              {loading ? 'Masa Kuruluyor...' : 'Masayı Oluştur ve Kod Al'}
            </button>
          </form>
        </div>

        {/* Join Room Card */}
        <div className="lobby-card">
          <h2>
            <LogIn size={22} color="#38ef7d" />
            Arkadaşının Masasına Katıl
          </h2>

          <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: 20 }}>
            Arkadaşınız bir masa kurduğunda ekranında 4 haneli bir oda kodu görecektir. O kodu buraya girerek doğrudan masaya oturabilirsiniz.
          </p>

          <form onSubmit={handleJoinRoom}>
            <div className="form-group">
              <label>Adınız / Rumuzunuz</label>
              <input
                type="text"
                className="form-input"
                placeholder="Örn: Mehmet"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label>4 Haneli Masa Kodu</label>
              <input
                type="text"
                className="form-input"
                maxLength={4}
                placeholder="Örn: 4821"
                style={{ fontSize: '1.5rem', letterSpacing: 6, fontFamily: 'monospace', textAlign: 'center' }}
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                required
              />
            </div>

            <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: 12 }} disabled={loading}>
              <LogIn size={18} />
              {loading ? 'Masaya Bağlanılıyor...' : 'Masaya Bağlan ve Otur'}
            </button>
          </form>

          <div style={{ marginTop: 'auto', padding: 16, background: 'rgba(229, 185, 76, 0.08)', borderRadius: 12, border: '1px dashed rgba(229, 185, 76, 0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#e5b94c', fontWeight: 700, fontSize: '0.9rem', marginBottom: 4 }}>
              <Sparkles size={16} />
              GitHub Üzerinde %100 Ücretsiz & Sınırsız
            </div>
            <div style={{ fontSize: '0.8rem', color: '#cbd5e1', lineHeight: 1.4 }}>
              Oyun tarayıcılar arası doğrudan P2P WebRTC üzerinden akar. Hiçbir sunucu kapanması veya uyuma süresi yaşanmaz.
            </div>
          </div>
        </div>
      </div>

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onAuthSuccess={(user) => {
          if (user && user.username) {
            setPlayerName(user.username);
          }
        }}
      />
    </div>
  );
};
