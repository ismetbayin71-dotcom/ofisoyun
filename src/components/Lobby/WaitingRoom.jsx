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

        {/* 4 Seats */}
        <div className="seats-grid">
          {roomState.seats.map((seat, idx) => {
            const seatTitles = ['Güney (Siz)', 'Batı', 'Kuzey', 'Doğu'];
            return (
              <div key={idx} className={`seat-card ${seat ? 'occupied' : ''}`}>
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
                      {seat.isBot ? 'Yapay Zeka' : (seat.id === currentSocketId ? 'Siz' : 'Oyuncu')}
                    </div>

                    <div style={{ marginTop: 'auto' }}>
                      {seat.isReady ? (
                        <span className="ready-badge">Hazır</span>
                      ) : (
                        <span className="waiting-badge">Bekliyor</span>
                      )}
                    </div>

                    {isHost && seat.isBot && (
                      <button
                        className="btn-danger"
                        style={{ marginTop: 8 }}
                        onClick={() => handleRemoveBot(idx)}
                      >
                        Botu Kaldır
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <div style={{ color: '#64748b', marginBottom: 12 }}>
                      <UserPlus size={36} />
                    </div>
                    <div style={{ color: '#94a3b8', fontWeight: 600, marginBottom: 12 }}>Boş Koltuk</div>

                    {isHost && (
                      <button
                        className="btn-secondary"
                        style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                        onClick={() => handleAddBot(idx)}
                      >
                        <Bot size={14} style={{ marginRight: 4 }} />
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
