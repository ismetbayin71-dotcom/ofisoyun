import React, { useState } from 'react';
import { network } from '../../utils/network.js';
import { Copy, Check, Bot, Play, UserPlus, LogOut, Shield } from 'lucide-react';
import { ChatDrawer } from '../UI/ChatDrawer.jsx';
import { PlayerAvatar } from '../UI/PlayerAvatar.jsx';

export const WaitingRoom = ({ roomState, currentSocketId, onLeave }) => {
  const [copied, setCopied] = useState(false);

  if (!roomState) return null;

  const isHost = roomState.hostId === currentSocketId;
  const mySeat = roomState.seats.find(s => s && s.id === currentSocketId);
  const mySeatIdx = roomState.seats.findIndex(s => s && s.id === currentSocketId);
  const isReady = mySeat ? mySeat.isReady : false;
  const totalOccupied = roomState.seats.filter(s => s !== null).length;
  const canStart = totalOccupied === 4;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomState.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggleReady = () => {
    network.emit('lobby:setReady', { roomId: roomState.id, isReady: !isReady });
  };

  const handleSwitchSeat = (seatIdx) => {
    network.emit('lobby:switchSeat', { roomId: roomState.id, targetSeatIndex: seatIdx });
  };

  const handleAddBot = (seatIdx) => {
    network.emit('lobby:addBot', { roomId: roomState.id, seatIndex: seatIdx });
  };

  const handleRemoveBot = (seatIdx) => {
    network.emit('lobby:removeBot', { roomId: roomState.id, seatIndex: seatIdx });
  };

  const handleStartGame = () => {
    network.emit('lobby:startGame', { roomId: roomState.id }, (res) => {
      if (!res.success) {
        alert(res.message || 'Oyun başlatılamadı.');
      }
    });
  };

  const handleSendMessage = (text) => {
    network.emit('chat:send', {
      roomId: roomState.id,
      text,
      senderName: mySeat ? mySeat.name : 'Oyuncu'
    });
  };

  // Relative seating positions based on current player
  const oppositeSeatIdx = mySeatIdx !== -1 ? (mySeatIdx + 2) % 4 : 2;
  const leftSeatIdx = mySeatIdx !== -1 ? (mySeatIdx + 3) % 4 : 3;
  const rightSeatIdx = mySeatIdx !== -1 ? (mySeatIdx + 1) % 4 : 1;

  const oppositePlayer = roomState.seats[oppositeSeatIdx];
  const leftPlayer = roomState.seats[leftSeatIdx];
  const rightPlayer = roomState.seats[rightSeatIdx];

  const getSeatRelation = (idx) => {
    if (mySeatIdx === -1) {
      return { label: `Koltuk ${idx + 1}`, badgeClass: 'badge-neutral', icon: '🪑' };
    }
    const offset = (idx - mySeatIdx + 4) % 4;
    switch (offset) {
      case 0:
        return { label: 'Siz (Güney)', badgeClass: 'badge-me', icon: '👤' };
      case 1:
        return { label: 'Sağınız (Doğu)', badgeClass: 'badge-right', icon: '➡️' };
      case 2:
        return { label: 'Tam Karşınız (Kuzey)', badgeClass: 'badge-opposite', icon: '🎯' };
      case 3:
        return { label: 'Solunuz (Batı)', badgeClass: 'badge-left', icon: '⬅️' };
      default:
        return { label: `Koltuk ${idx + 1}`, badgeClass: 'badge-neutral', icon: '🪑' };
    }
  };

  return (
    <div className="lobby-container" style={{ justifyContent: 'center' }}>
      <div className="waiting-room">
        {/* Header */}
        <div className="room-header">
          <div>
            <h2 style={{ fontSize: '1.6rem', color: '#fff' }}>{roomState.name}</h2>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
              {roomState.gameType === '101' ? '101 Yüzbir Okey' : 'Klasik Düz Okey'}
              {roomState.options?.folded ? ' (Katlamalı)' : ''}
            </p>
          </div>

          <div className="room-code-badge" onClick={handleCopyCode} style={{ cursor: 'pointer' }} title="Kodu Kopyala">
            <span>Oda Kodu:</span>
            <strong>{roomState.id}</strong>
            {copied ? <Check size={18} color="#38ef7d" /> : <Copy size={18} color="#e5b94c" />}
          </div>
        </div>

        {/* Table Perspective & Seating Arrangement */}
        <div className="table-perspective-container">
          <div className="table-perspective-header">
            <span className="perspective-header-title">📍 Masadaki Yeriniz & Karşınızdaki Rakipler</span>
            <span className="perspective-header-hint">
              {mySeatIdx !== -1 ? `Şu an ${mySeatIdx + 1}. koltuktadısınız. Koltuklardaki butona tıklayarak yer değiştirebilirsiniz.` : 'Bir koltuk seçiniz.'}
            </span>
          </div>
          <div className="table-perspective-grid">
            <div className="perspective-card perspective-card-opp">
              <div className="perspective-badge">🎯 TAM KARŞINIZ</div>
              <strong className="perspective-name">
                {oppositePlayer ? oppositePlayer.name : 'Boş Koltuk'}
              </strong>
              <span className="perspective-sub">
                {oppositePlayer ? (oppositePlayer.isBot ? '🤖 Yapay Zeka' : '👤 Rakip Oyuncu') : 'Henüz kimse oturmadı'}
              </span>
            </div>

            <div className="perspective-card perspective-card-left">
              <div className="perspective-badge">⬅️ SOLUNUZDAKİ (Taş Çekeceğiniz)</div>
              <strong className="perspective-name">
                {leftPlayer ? leftPlayer.name : 'Boş Koltuk'}
              </strong>
              <span className="perspective-sub">
                {leftPlayer ? (leftPlayer.isBot ? '🤖 Yapay Zeka' : '👤 Rakip Oyuncu') : 'Henüz kimse oturmadı'}
              </span>
            </div>

            <div className="perspective-card perspective-card-right">
              <div className="perspective-badge">➡️ SAĞINIZDAKİ (Taş Atacağınız)</div>
              <strong className="perspective-name">
                {rightPlayer ? rightPlayer.name : 'Boş Koltuk'}
              </strong>
              <span className="perspective-sub">
                {rightPlayer ? (rightPlayer.isBot ? '🤖 Yapay Zeka' : '👤 Rakip Oyuncu') : 'Henüz kimse oturmadı'}
              </span>
            </div>
          </div>
        </div>

        {/* 4 Seats */}
        <div className="seats-grid">
          {roomState.seats.map((seat, idx) => {
            const relation = getSeatRelation(idx);
            const isMe = seat && seat.id === currentSocketId;
            return (
              <div key={idx} className={`seat-card ${seat ? 'occupied' : ''} ${isMe ? 'is-my-seat' : ''}`}>
                <div className={`seat-position-badge ${relation.badgeClass}`}>
                  {relation.icon} {relation.label}
                </div>

                {seat ? (
                  <>
                    <PlayerAvatar
                      avatar={seat.avatar}
                      isBot={seat.isBot}
                      name={seat.name}
                      size={64}
                      className={`seat-avatar ${seat.isBot ? 'bot' : ''}`}
                    />
                    <div className="seat-name">
                      {seat.name}
                      {seat.isHost && <Shield size={13} color="#e5b94c" style={{ marginLeft: 4, display: 'inline' }} />}
                    </div>
                    <div className="seat-role">
                      {seat.isBot ? 'Yapay Zeka' : (isMe ? 'Siz' : 'Oyuncu')}
                    </div>

                    <div style={{ marginTop: 6, marginBottom: 6 }}>
                      {seat.isReady ? (
                        <span className="ready-badge">Hazır</span>
                      ) : (
                        <span className="waiting-badge">Bekliyor</span>
                      )}
                    </div>

                    {!isMe && (
                      <button
                        className="btn-seat-switch"
                        onClick={() => handleSwitchSeat(idx)}
                        title="Bu koltuğa geç"
                      >
                        🔄 {seat.isBot ? 'Botla Yer Değiş' : 'Yer Değiştir'}
                      </button>
                    )}

                    {isHost && seat.isBot && (
                      <button
                        className="btn-danger-sm"
                        onClick={() => handleRemoveBot(idx)}
                      >
                        Botu Kaldır
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <div style={{ color: '#64748b', marginBottom: 8, marginTop: 8 }}>
                      <UserPlus size={36} />
                    </div>
                    <div style={{ color: '#94a3b8', fontWeight: 600, marginBottom: 12 }}>Boş Koltuk</div>

                    <button
                      className="btn-seat-switch btn-seat-sit"
                      onClick={() => handleSwitchSeat(idx)}
                    >
                      🪑 Buraya Otur
                    </button>

                    {isHost && (
                      <button
                        className="btn-secondary-sm"
                        onClick={() => handleAddBot(idx)}
                      >
                        <Bot size={13} style={{ marginRight: 4 }} />
                        Bot Ekle
                      </button>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* Controls Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 20 }}>
          <button className="btn-secondary" onClick={onLeave}>
            <LogOut size={16} style={{ marginRight: 6 }} />
            Odadan Ayrıl
          </button>

          <div style={{ display: 'flex', gap: 12 }}>
            <button
              className="btn-secondary"
              onClick={handleToggleReady}
              style={{ borderColor: isReady ? '#10b981' : 'rgba(255,255,255,0.2)', color: isReady ? '#38ef7d' : '#fff' }}
            >
              <Check size={16} style={{ marginRight: 6 }} />
              {isReady ? 'Hazırsınız' : 'Hazırım Yap'}
            </button>

            {isHost && (
              <button
                className="btn-primary"
                disabled={!canStart}
                style={{ opacity: canStart ? 1 : 0.5, cursor: canStart ? 'pointer' : 'not-allowed' }}
                onClick={handleStartGame}
              >
                <Play size={18} />
                {canStart ? 'Oyunu Başlat' : `4 Oyuncu Bekleniyor (${totalOccupied}/4)`}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Chat Component */}
      <ChatDrawer
        messages={roomState.chatMessages || []}
        onSendMessage={handleSendMessage}
        playerName={mySeat?.name || 'Oyuncu'}
      />
    </div>
  );
};
