import React, { useState } from 'react';
import { authService, AVAILABLE_AVATARS } from '../../utils/authService.js';
import { User, LogIn, LogOut, Trophy, Award, Check, ChevronDown, Sparkles } from 'lucide-react';

export const UserProfileCard = ({ user, onOpenAuth, onLogout }) => {
  const [showPopover, setShowPopover] = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);

  // If user is guest / not logged in
  if (!user) {
    return (
      <div className="user-profile-badge guest" onClick={onOpenAuth} title="Hesap oluşturun veya giriş yapın">
        <div className="user-avatar-circle guest">
          <User size={16} />
        </div>
        <span className="user-profile-name">Giriş Yap / Kayıt Ol</span>
      </div>
    );
  }

  const avatarInfo = AVAILABLE_AVATARS.find(a => a.id === user.avatar) || AVAILABLE_AVATARS[0];
  const { stats = { totalGames: 0, wins: 0, losses: 0, winRate: 0 } } = user;

  const handleSelectNewAvatar = (avatarId) => {
    authService.updateAvatar(avatarId);
    setShowAvatarPicker(false);
  };

  return (
    <div className="user-profile-container">
      {/* Profile Bar Button */}
      <div
        className="user-profile-badge authenticated"
        onClick={() => setShowPopover(!showPopover)}
        title="Profili ve İstatistikleri Görüntüle"
      >
        <div className="user-avatar-circle" style={{ borderColor: avatarInfo.color }}>
          <span style={{ fontSize: '1.1rem' }}>{avatarInfo.icon}</span>
        </div>
        <div className="user-profile-info">
          <strong className="user-profile-name">{user.username}</strong>
          <span className="user-profile-wins">
            <Trophy size={11} color="#e5b94c" style={{ marginRight: 3, display: 'inline' }} />
            {stats.wins} Galibiyet
          </span>
        </div>
        <ChevronDown size={14} className={`profile-arrow-icon ${showPopover ? 'rotated' : ''}`} />
      </div>

      {/* Popover Dropdown */}
      {showPopover && (
        <>
          <div className="profile-popover-backdrop" onClick={() => setShowPopover(false)} />
          <div className="profile-popover-card">
            {/* Popover Header */}
            <div className="profile-popover-header">
              <div className="popover-avatar-wrapper" onClick={() => setShowAvatarPicker(!showAvatarPicker)} title="Avatarı Değiştir">
                <span className="popover-avatar-icon">{avatarInfo.icon}</span>
                <span className="popover-avatar-change-hint">Değiştir</span>
              </div>
              <div>
                <h4 className="popover-username">{user.username}</h4>
                <div className="popover-rank-tag">
                  <Award size={12} color="#e5b94c" />
                  <span>{stats.wins >= 10 ? 'Usta Oyuncu' : stats.wins >= 3 ? 'Kıdemli Oyuncu' : 'Çaylak'}</span>
                </div>
              </div>
            </div>

            {/* Avatar Picker Expandable */}
            {showAvatarPicker && (
              <div className="popover-avatar-picker">
                <div className="picker-title">Yeni Avatar Seç:</div>
                <div className="picker-grid">
                  {AVAILABLE_AVATARS.map(av => (
                    <button
                      key={av.id}
                      className={`picker-avatar-btn ${user.avatar === av.id ? 'active' : ''}`}
                      onClick={() => handleSelectNewAvatar(av.id)}
                      title={av.label}
                    >
                      <span>{av.icon}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Stats Grid */}
            <div className="profile-stats-grid">
              <div className="stat-box">
                <div className="stat-val">{stats.totalGames}</div>
                <div className="stat-lbl">Toplam Oyun</div>
              </div>
              <div className="stat-box win">
                <div className="stat-val">{stats.wins}</div>
                <div className="stat-lbl">Galibiyet</div>
              </div>
              <div className="stat-box loss">
                <div className="stat-val">{stats.losses}</div>
                <div className="stat-lbl">Mağlubiyet</div>
              </div>
              <div className="stat-box rate">
                <div className="stat-val">%{stats.winRate}</div>
                <div className="stat-lbl">Kazanma Oranı</div>
              </div>
            </div>

            {/* Logout Action */}
            <button
              className="popover-logout-btn"
              onClick={() => {
                setShowPopover(false);
                if (onLogout) onLogout();
              }}
            >
              <LogOut size={14} style={{ marginRight: 6 }} />
              Çıkış Yap
            </button>
          </div>
        </>
      )}
    </div>
  );
};
