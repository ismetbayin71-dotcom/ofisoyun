import React, { useState, useEffect, useRef } from 'react';
import { Tv, Play, Pause, SkipForward, Plus, Trash2, ListMusic, Volume2, VolumeX, Minimize2, Maximize2, Sparkles, ExternalLink, X } from 'lucide-react';

import { extractYouTubeVideoId } from '../../utils/mediaUtils.js';

export { extractYouTubeVideoId };

export const YouTubeTvWidget = ({
  mediaState = { currentTrack: null, queue: [], isPlaying: true },
  onAddTrack,
  onSkipTrack,
  onRemoveTrack,
  onTogglePlay,
  playerName = 'Oyuncu'
}) => {
  const [minimized, setMinimized] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [inputUrl, setInputUrl] = useState('');
  const [inputTitle, setInputTitle] = useState('');
  const [inputError, setInputError] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const iframeRef = useRef(null);

  const { currentTrack, queue = [], isPlaying = true } = mediaState || {};

  // Auto-skip when track ends via YouTube Iframe API postMessage
  useEffect(() => {
    const handleMessage = (e) => {
      try {
        if (!e.data || typeof e.data !== 'string') return;
        const parsed = JSON.parse(e.data);
        // YouTube iframe API onStateChange: 0 = ENDED
        if (parsed.event === 'onStateChange' && parsed.info === 0) {
          if (onSkipTrack) onSkipTrack();
        }
      } catch (err) {
        // Ignore non-JSON messages
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onSkipTrack]);

  // Handle adding new song to queue
  const handleAddSubmit = (e) => {
    e.preventDefault();
    setInputError('');

    const videoId = extractYouTubeVideoId(inputUrl);
    if (!videoId) {
      setInputError('Geçersiz YouTube linki! Örnek: https://youtu.be/...');
      return;
    }

    const title = inputTitle.trim() || `YouTube Şarkı (${videoId.slice(0, 6)}...)`;
    const newTrack = {
      id: `track-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      videoId,
      title,
      url: inputUrl.trim(),
      addedBy: playerName,
      addedAt: Date.now()
    };

    if (onAddTrack) {
      onAddTrack(newTrack);
    }

    setInputUrl('');
    setInputTitle('');
    setShowAddForm(false);
  };

  // Minimized TV Pill View
  if (minimized) {
    return (
      <div className="okey-tv-minimized" onClick={() => setMinimized(false)} title="Okey TV'yi Aç">
        <div className="tv-mini-antenna">
          <div className="antenna-rod left"></div>
          <div className="antenna-rod right"></div>
        </div>
        <div className="tv-mini-body">
          <Tv size={16} color="#e5b94c" />
          <span className="tv-mini-label">OKEY TV</span>
          {currentTrack && <span className="tv-live-dot" />}
          {queue.length > 0 && <span className="tv-queue-badge">{queue.length}</span>}
          <Maximize2 size={13} style={{ marginLeft: 4, opacity: 0.7 }} />
        </div>
      </div>
    );
  }

  return (
    <div className="okey-tv-container">
      {/* Retro TV Antenna */}
      <div className="tv-antenna-wrapper">
        <div className="tv-antenna-rod left"></div>
        <div className="tv-antenna-base"></div>
        <div className="tv-antenna-rod right"></div>
      </div>

      {/* TV Main Cabinet */}
      <div className="tv-cabinet">
        {/* TV Header Bar */}
        <div className="tv-header-bar">
          <div className="tv-branding">
            <Tv size={14} color="#e5b94c" />
            <span className="tv-brand-name">OKEY TV</span>
            <span className={`tv-status-led ${currentTrack ? 'active' : 'idle'}`} title={currentTrack ? 'Yayın Canlı' : 'Yayın Bekleniyor'} />
          </div>

          <div className="tv-header-actions">
            <button
              className="tv-icon-btn"
              onClick={() => setIsMuted(!isMuted)}
              title={isMuted ? 'TV Sesini Aç' : 'TV Sesini Kıs'}
            >
              {isMuted ? <VolumeX size={13} color="#f87171" /> : <Volume2 size={13} color="#38ef7d" />}
            </button>
            <button
              className="tv-icon-btn"
              onClick={() => setMinimized(true)}
              title="TV'yi Küçült"
            >
              <Minimize2 size={13} />
            </button>
          </div>
        </div>

        {/* TV Screen Viewport */}
        <div className="tv-screen-bezel">
          <div className="tv-screen">
            {currentTrack ? (
              <div className="tv-iframe-container">
                <iframe
                  ref={iframeRef}
                  key={currentTrack.videoId}
                  className="tv-iframe"
                  src={`https://www.youtube-nocookie.com/embed/${currentTrack.videoId}?autoplay=1&enablejsapi=1&origin=${encodeURIComponent(window.location.origin || 'http://localhost:3000')}${isMuted ? '&mute=1' : ''}`}
                  title={currentTrack.title}
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
                {/* CRT Screen Scanline Overlay */}
                <div className="tv-scanlines" />
              </div>
            ) : (
              <div className="tv-standby-screen">
                <div className="tv-static-effect" />
                <div className="tv-standby-content">
                  <span style={{ fontSize: '1.4rem' }}>📺</span>
                  <div className="tv-standby-text">Şarkı veya Video Yok</div>
                  <button
                    className="btn-primary tv-add-first-btn"
                    onClick={() => setShowAddForm(true)}
                  >
                    <Plus size={13} style={{ marginRight: 4 }} />
                    Link Ekle
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* TV Status & Track Info Bar */}
        <div className="tv-info-strip">
          {currentTrack ? (
            <div className="tv-track-marquee-wrapper" title={currentTrack.title}>
              <div className="tv-equalizer">
                <span className="eq-bar bar-1"></span>
                <span className="eq-bar bar-2"></span>
                <span className="eq-bar bar-3"></span>
              </div>
              <div className="tv-track-title-scroller">
                <span className="tv-track-title">{currentTrack.title}</span>
                <span className="tv-track-author">• {currentTrack.addedBy} ekledi</span>
              </div>
            </div>
          ) : (
            <div className="tv-idle-text">Müzik açmak için link ekleyin</div>
          )}
        </div>

        {/* TV Control Buttons */}
        <div className="tv-controls-panel">
          <button
            className={`tv-ctrl-btn ${showAddForm ? 'active' : ''}`}
            onClick={() => {
              setShowAddForm(!showAddForm);
              setShowQueue(false);
            }}
            title="Yeni YouTube Şarkı Linki Ekle"
          >
            <Plus size={14} />
            <span>Link Ekle</span>
          </button>

          <button
            className={`tv-ctrl-btn ${showQueue ? 'active' : ''}`}
            onClick={() => {
              setShowQueue(!showQueue);
              setShowAddForm(false);
            }}
            title="Sıradaki Şarkıları Görüntüle"
          >
            <ListMusic size={14} />
            <span>Sıra ({queue.length})</span>
          </button>

          <button
            className="tv-ctrl-btn skip-btn"
            disabled={!currentTrack}
            onClick={() => onSkipTrack && onSkipTrack()}
            title="Sıradaki Şarkıya Geç (Skip)"
          >
            <SkipForward size={14} />
            <span>Sonraki</span>
          </button>
        </div>

        {/* Expandable: Add YouTube Link Drawer */}
        {showAddForm && (
          <form className="tv-add-drawer" onSubmit={handleAddSubmit}>
            <div className="tv-drawer-header">
              <strong>YouTube Linki Ekle</strong>
              <button
                type="button"
                className="tv-close-drawer-btn"
                onClick={() => setShowAddForm(false)}
              >
                <X size={14} />
              </button>
            </div>

            <input
              type="text"
              className="tv-input"
              placeholder="https://youtu.be/... veya video linki"
              value={inputUrl}
              onChange={(e) => {
                setInputUrl(e.target.value);
                setInputError('');
              }}
              autoFocus
            />

            <input
              type="text"
              className="tv-input"
              style={{ marginTop: 6 }}
              placeholder="Şarkı Adı (isteğe bağlı)"
              value={inputTitle}
              onChange={(e) => setInputTitle(e.target.value)}
            />

            {inputError && (
              <div className="tv-error-text">{inputError}</div>
            )}

            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <button type="submit" className="btn-primary" style={{ flex: 1, padding: '6px 10px', fontSize: '0.8rem' }}>
                <Plus size={13} style={{ marginRight: 4 }} />
                {currentTrack ? 'Sıraya Ekle' : 'Şimdi Çal'}
              </button>
              <button
                type="button"
                className="btn-secondary"
                style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                onClick={() => setShowAddForm(false)}
              >
                İptal
              </button>
            </div>
          </form>
        )}

        {/* Expandable: Playlist Queue Drawer */}
        {showQueue && (
          <div className="tv-queue-drawer">
            <div className="tv-drawer-header">
              <strong>Sıradaki Şarkılar ({queue.length})</strong>
              <button
                type="button"
                className="tv-close-drawer-btn"
                onClick={() => setShowQueue(false)}
              >
                <X size={14} />
              </button>
            </div>

            {queue.length === 0 ? (
              <div className="tv-queue-empty">
                Sırada şarkı yok. Yeni link eklediğinizde otomatik sıraya alınır!
              </div>
            ) : (
              <div className="tv-queue-list">
                {queue.map((track, idx) => (
                  <div key={track.id || idx} className="tv-queue-item">
                    <span className="tv-queue-idx">{idx + 1}.</span>
                    <div className="tv-queue-info">
                      <div className="tv-queue-title">{track.title}</div>
                      <div className="tv-queue-meta">{track.addedBy} ekledi</div>
                    </div>
                    <button
                      className="tv-queue-remove-btn"
                      onClick={() => onRemoveTrack && onRemoveTrack(track.id)}
                      title="Sıradan Kaldır"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
