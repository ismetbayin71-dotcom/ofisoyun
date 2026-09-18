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

  const getSeatRelation = (idx) => {
    if (mySeatIdx === -1) {
      switch (idx) {
        case 0: return { label: '1. Koltuk (Alt)', badgeClass: 'badge-neutral', icon: '🪑' };
        case 1: return { label: '2. Koltuk (Sağ)', badgeClass: 'badge-neutral', icon: '🪑' };
        case 2: return { label: '3. Koltuk (Üst)', badgeClass: 'badge-neutral', icon: '🪑' };
        case 3: return { label: '4. Koltuk (Sol)', badgeClass: 'badge-neutral', icon: '🪑' };
        default: return { label: `${idx + 1}. Koltuk`, badgeClass: 'badge-neutral', icon: '🪑' };
      }
    }
    if (idx === mySeatIdx) {
      return { label: 'Siz', badgeClass: 'badge-me', icon: '👤' };
    }
    const offset = (idx - mySeatIdx + 4) % 4;
    switch (offset) {
      case 1:
        return { label: 'Sağınız (Taş Atacağınız)', badgeClass: 'badge-right', icon: '➡️' };
      case 2:
        return { label: 'Karşınız', badgeClass: 'badge-opposite', icon: '🎯' };
      case 3:
        return { label: 'Solunuz (Taş Alacağınız)', badgeClass: 'badge-left', icon: '⬅️' };
      default:
        return { label: `${idx + 1}. Koltuk`, badgeClass: 'badge-neutral', icon: '🪑' };
    }
  };

  const renderSeatCard = (seatIdx, posClass) => {
    const seat = roomState.seats[seatIdx];
    const relation = getSeatRelation(seatIdx);
    const isMe = seat && seat.id === currentSocketId;

    return (
      <div className={`seat-card ${posClass} ${seat ? 'occupied' : 'empty'} ${isMe ? 'is-my-seat' : ''}`}>
        <div className={`seat-position-badge ${relation.badgeClass}`}>
          {relation.icon} {relation.label}
        </div>

        {seat ? (
          <>
            <PlayerAvatar
              avatar={seat.avatar}
              isBot={seat.isBot}
              name={seat.name}
              size={58}
              className={`seat-avatar ${seat.isBot ? 'bot' : ''}`}
            />
            <div className="seat-name">
              {seat.name}
              {seat.isHost && <Shield size={13} color="#e5b94c" style={{ marginLeft: 4, display: 'inline' }} title="Masa Kurucusu" />}
            </div>
            <div className="seat-role">
              {seat.isBot ? '🤖 Yapay Zeka' : (isMe ? '👑 Siz' : '👤 Oyuncu')}
            </div>

            <div style={{ marginTop: 6, marginBottom: 6 }}>
              {seat.isReady ? (
                <span className="ready-badge">🟢 Hazır</span>
              ) : (
                <span className="waiting-badge">🟡 Bekliyor</span>
              )}
            </div>

            {!isMe && (
              <button
                className="btn-seat-switch"
                onClick={() => handleSwitchSeat(seatIdx)}
                title="Bu koltuğa geç veya yer değiştir"
              >
                🔄 {seat.isBot ? 'Botla Yer Değiş' : 'Yer Değiştir'}
              </button>
            )}

            {isHost && seat.isBot && (
              <button
                className="btn-danger-sm"
                onClick={() => handleRemoveBot(seatIdx)}
                style={{ marginTop: 6 }}
              >
                Botu Kaldır
              </button>
            )}
          </>
        ) : (
          <>
            <div style={{ color: '#64748b', marginBottom: 6, marginTop: 4 }}>
              <UserPlus size={32} />
            </div>
            <div style={{ color: '#94a3b8', fontWeight: 600, fontSize: '0.85rem', marginBottom: 8 }}>
              Boş Koltuk
            </div>

            <button
              className="btn-seat-sit-primary"
              onClick={() => handleSwitchSeat(seatIdx)}
              title="Bu koltuğa otur"
            >
              🪑 Masaya Otur
            </button>

            {isHost && (
              <button
                className="btn-secondary-sm"
                onClick={() => handleAddBot(seatIdx)}
                style={{ marginTop: 6, width: '100%' }}
              >
                <Bot size={13} style={{ marginRight: 4 }} />
                Bot Ekle
              </button>
            )}
          </>
        )}
      </div>
    );
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

        {/* KARE OKEY MASASI DÜZENİ */}
        <div className="lobby-square-table-container">
          <div className="lobby-square-arena">
            {/* ÜST KOLTUK (Seat 2 - Karşı) */}
            {renderSeatCard(2, 'seat-pos-top')}

            {/* SOL KOLTUK (Seat 3 - Sol) */}
            {renderSeatCard(3, 'seat-pos-left')}

            {/* MASA ORTASI (Yeşil Çuha) */}
            <div className="lobby-table-felt">
              <div className="table-felt-emblem">🀄</div>
              <div className="table-felt-title">OKEY MASASI</div>
              <div className="table-felt-mode">
                {roomState.gameType === '101' ? '101 Yüzbir Okey' : 'Klasik Düz Okey'}
                {roomState.options?.folded ? ' (Katlamalı)' : ''}
              </div>
              <div className="table-felt-players-badge">
                👥 {totalOccupied} / 4 Masada
              </div>
              <div className="table-felt-direction">
                ↻ Taş Atış: Sağınızdaki Oyuncuya
              </div>
              <div className="table-felt-hint">
                Boş koltuklara tıklayarak yerinizi seçebilirsiniz
              </div>
            </div>

            {/* SAĞ KOLTUK (Seat 1 - Sağ) */}
            {renderSeatCard(1, 'seat-pos-right')}

            {/* ALT KOLTUK (Seat 0 - Alt / Ön) */}
            {renderSeatCard(0, 'seat-pos-bottom')}
          </div>
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
