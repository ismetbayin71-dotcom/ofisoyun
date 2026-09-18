import React, { useState, useRef } from 'react';
import { authService, AVAILABLE_AVATARS } from '../../utils/authService.js';
import { processAvatarImage } from '../../utils/mediaUtils.js';
import { LogIn, UserPlus, X, Lock, User, Sparkles, CheckCircle2, ShieldAlert, Camera, Upload } from 'lucide-react';

export const AuthModal = ({ isOpen, onClose, onAuthSuccess }) => {
  const [activeTab, setActiveTab] = useState('login'); // 'login' | 'register'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(AVAILABLE_AVATARS[0].id);
  const [customAvatar, setCustomAvatar] = useState(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleCustomImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setUploadingAvatar(true);
    try {
      const dataUrl = await processAvatarImage(file, 120);
      setCustomAvatar(dataUrl);
      setSelectedAvatar(dataUrl);
    } catch (err) {
      setError(err.message || 'Resim yüklenirken bir hata oluştu.');
    } finally {
      setUploadingAvatar(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (activeTab === 'login') {
        const res = authService.login(username, password);
        if (res.success) {
          if (onAuthSuccess) onAuthSuccess(res.user);
          onClose();
        } else {
          setError(res.message || 'Giriş yapılamadı.');
        }
      } else {
        const res = authService.register(username, password, selectedAvatar);
        if (res.success) {
          if (onAuthSuccess) onAuthSuccess(res.user);
          onClose();
        } else {
          setError(res.message || 'Kayıt oluşturulamadı.');
        }
      }
    } catch (err) {
      setError('İşlem sırasında bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content auth-modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Modal Close Button */}
        <button className="modal-close-btn" onClick={onClose} title="Kapat">
          <X size={18} />
        </button>

        {/* Modal Header */}
        <div className="auth-header">
          <div className="auth-icon-badge">
            <Sparkles size={24} color="#e5b94c" />
          </div>
          <h2>{activeTab === 'login' ? 'Okey Hesabına Giriş Yap' : 'Yeni Oyuncu Hesabı Oluştur'}</h2>
          <p>
            {activeTab === 'login'
              ? 'Kullanıcı adı ve şifrenizle giriş yaparak skorlarınızı koruyun.'
              : 'Profil oluşturun, avatarınızı seçin veya kendi fotoğrafınızı yükleyin!'}
          </p>
        </div>

        {/* Tabs Switcher */}
        <div className="auth-tabs">
          <button
            type="button"
            className={`auth-tab-btn ${activeTab === 'login' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('login');
              setError('');
            }}
          >
            <LogIn size={15} style={{ marginRight: 6 }} />
            Giriş Yap
          </button>
          <button
            type="button"
            className={`auth-tab-btn ${activeTab === 'register' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('register');
              setError('');
            }}
          >
            <UserPlus size={15} style={{ marginRight: 6 }} />
            Kayıt Ol
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="auth-error-alert">
            <ShieldAlert size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Auth Form */}
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="auth-field">
            <label>Kullanıcı Adı</label>
            <div className="auth-input-wrapper">
              <User size={16} className="auth-input-icon" />
              <input
                type="text"
                placeholder="Örn: İsmet, Okeyci34"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
              />
            </div>
          </div>

          <div className="auth-field">
            <label>Şifre</label>
            <div className="auth-input-wrapper">
              <Lock size={16} className="auth-input-icon" />
              <input
                type="password"
                placeholder="En az 4 karakter"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Avatar Selector (Only for Register) */}
          {activeTab === 'register' && (
            <div className="auth-field">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label style={{ margin: 0 }}>Profil Avatarınızı Seçin</label>
                <button
                  type="button"
                  className="avatar-upload-trigger-link"
                  onClick={() => fileInputRef.current?.click()}
                  title="PNG veya JPEG resim yükleyin"
                  disabled={uploadingAvatar}
                >
                  <Camera size={13} style={{ marginRight: 4 }} />
                  {uploadingAvatar ? 'Yükleniyor...' : (customAvatar ? 'Resmi Değiştir' : 'Fotoğraf Yükle')}
                </button>
              </div>

              {/* Hidden file input for PNG/JPEG */}
              <input
                type="file"
                ref={fileInputRef}
                accept="image/png,image/jpeg,image/jpg,image/webp"
                style={{ display: 'none' }}
                onChange={handleCustomImageUpload}
              />

              <div className="avatar-selection-grid">
                {/* Uploaded Custom Avatar Option */}
                {customAvatar && (
                  <button
                    type="button"
                    className={`avatar-choice-btn custom-avatar-choice ${selectedAvatar === customAvatar ? 'selected' : ''}`}
                    onClick={() => setSelectedAvatar(customAvatar)}
                    title="Kendi Yüklediğiniz Fotoğraf"
                  >
                    <div className="avatar-custom-thumb-wrap">
                      <img src={customAvatar} alt="Özel Avatar" className="avatar-preview-img" />
                    </div>
                    <span className="avatar-choice-label">Fotoğrafım</span>
                    {selectedAvatar === customAvatar && (
                      <CheckCircle2 size={12} color="#38ef7d" className="avatar-check-icon" />
                    )}
                  </button>
                )}

                {/* Standard Preset Avatars */}
                {AVAILABLE_AVATARS.map((av) => (
                  <button
                    key={av.id}
                    type="button"
                    className={`avatar-choice-btn ${selectedAvatar === av.id ? 'selected' : ''}`}
                    onClick={() => setSelectedAvatar(av.id)}
                    title={av.label}
                  >
                    <span className="avatar-choice-emoji">{av.icon}</span>
                    <span className="avatar-choice-label">{av.label}</span>
                    {selectedAvatar === av.id && (
                      <CheckCircle2 size={12} color="#38ef7d" className="avatar-check-icon" />
                    )}
                  </button>
                ))}

                {/* Upload Action Button inside Grid (if not uploaded yet) */}
                {!customAvatar && (
                  <button
                    type="button"
                    className="avatar-choice-btn upload-placeholder-choice"
                    onClick={() => fileInputRef.current?.click()}
                    title="Kendi PNG veya JPEG resminizi yükleyin"
                    disabled={uploadingAvatar}
                  >
                    <div className="upload-choice-icon-wrap">
                      <Upload size={18} color="#e5b94c" />
                    </div>
                    <span className="avatar-choice-label">PNG / JPEG</span>
                  </button>
                )}
              </div>
            </div>
          )}

          <button
            type="submit"
            className="btn-primary auth-submit-btn"
            disabled={loading}
          >
            {activeTab === 'login' ? (
              <>
                <LogIn size={16} style={{ marginRight: 6 }} />
                Giriş Yap
              </>
            ) : (
              <>
                <UserPlus size={16} style={{ marginRight: 6 }} />
                Hesabı Oluştur & Başla
              </>
            )}
          </button>
        </form>

        {/* Guest Continue Footer */}
        <div className="auth-guest-footer">
          <button type="button" className="auth-guest-link" onClick={onClose}>
            Giriş yapmadan misafir olarak oyna →
          </button>
        </div>
      </div>
    </div>
  );
};
