import React, { useState, useEffect } from 'react';
import { network } from '../../utils/network.js';
import { sound } from '../../utils/soundEffects.js';
import { Tile } from './Tile.jsx';
import { TileRack } from './TileRack.jsx';
import { ScoreModal } from '../UI/ScoreModal.jsx';
import { ChatDrawer } from '../UI/ChatDrawer.jsx';
import { Volume2, VolumeX, LogOut, Info, Bot, Sparkles } from 'lucide-react';

export const GameBoard = ({ gameState, currentSocketId, onLeaveRoom }) => {
  const [muted, setMuted] = useState(false);
  const [selectedProcessTile, setSelectedProcessTile] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');

  if (!gameState) return null;

  const {
    gameType,
    players = [],
    turnIndex,
    hasDrawn,
    indicator,
    okeyInfo,
    remainingTiles,
    scores,
    winner,
    lastAction,
    tablePers = [],
    discardPiles = [],
    options = {}
  } = gameState;

  // Find viewer's seat index
  const viewerSeatIdx = players.findIndex(p => p && p.id === currentSocketId);
  const viewer = viewerSeatIdx !== -1 ? players[viewerSeatIdx] : null;
  const isMyTurn = turnIndex === viewerSeatIdx;

  // Alert on turn switch to viewer
  useEffect(() => {
    if (isMyTurn) {
      sound.playTurnAlert();
    }
  }, [isMyTurn]);

  // Handle status messages
  useEffect(() => {
    if (lastAction?.message) {
      setStatusMessage(lastAction.message);
    }
  }, [lastAction]);

  // Relative player seats (South = Viewer, West = Right, North = Top, East = Left)
  const getRelativePlayer = (offset) => {
    if (viewerSeatIdx === -1) return players[offset];
    const targetIdx = (viewerSeatIdx + offset) % 4;
    return { player: players[targetIdx], seatIndex: targetIdx };
  };

  const leftOpponent = getRelativePlayer(3);  // Left player (seat - 1)
  const topOpponent = getRelativePlayer(2);   // Opposite player
  const rightOpponent = getRelativePlayer(1); // Right player (seat + 1)

  // Draw tile action
  const handleDrawTile = (fromDiscard = false) => {
    if (!isMyTurn || hasDrawn) return;
    sound.playDraw();
    network.emit('game:drawTile', { roomId: gameState.roomId, fromDiscard }, (res) => {
      if (!res.success) {
        alert(res.message || 'Taş çekilemedi.');
      }
    });
  };

  // Discard tile action
  const handleDiscardTile = (tileId) => {
    if (!isMyTurn || !hasDrawn) return;
    sound.playTileClick();
    network.emit('game:discardTile', { roomId: gameState.roomId, tileId, isFinishing: false }, (res) => {
      if (!res.success) {
        alert(res.message || 'Taş atılamadı.');
      }
    });
  };

  // Finish Classic Okey
  const handleFinishClassic = (tileId) => {
    if (!isMyTurn || !hasDrawn) return;
    network.emit('game:discardTile', { roomId: gameState.roomId, tileId, isFinishing: true }, (res) => {
      if (!res.success) {
        alert(res.message || 'Bitme koşulları sağlanamadı!');
      }
    });
  };

  // Open 101 Runs
  const handleOpenRuns101 = (pers) => {
    network.emit('game:openRuns', { roomId: gameState.roomId, pers }, (res) => {
      if (!res.success) {
        alert(res.message || 'Per açılamadı.');
      }
    });
  };

  // Process tile onto table per
  const handleProcessTileClick = (targetPer) => {
    if (!selectedProcessTile || !isMyTurn || !hasDrawn) return;
    network.emit('game:processTile', {
      roomId: gameState.roomId,
      tileId: selectedProcessTile.id,
      targetPerId: targetPer.id
    }, (res) => {
      if (!res.success) {
        alert(res.message || 'Bu taş buraya işlenemez.');
      } else {
        setSelectedProcessTile(null);
      }
    });
  };

  // Next round
  const handleNextRound = () => {
    network.emit('game:nextRound', { roomId: gameState.roomId });
  };

  // Chat message
  const handleSendMessage = (text) => {
    network.emit('chat:send', {
      roomId: gameState.roomId,
      text,
      senderName: viewer?.name || 'Oyuncu'
    });
  };

  // Discard pile helper
  const getDiscardForSeat = (seatIdx) => {
    return discardPiles[seatIdx]?.topTile || null;
  };

  const isLeftDiscardDrawable = isMyTurn && !hasDrawn && getDiscardForSeat(leftOpponent.seatIndex) !== null;

  return (
    <div className="game-screen">
      {/* Top Header Bar */}
      <header className="game-top-bar">
        <div className="top-bar-info">
          <strong style={{ color: '#e5b94c', fontSize: '1.1rem' }}>
            {gameType === '101' ? '101 Yüzbir Okey' : 'Klasik Düz Okey'}
            {options.folded ? ' (Katlamalı)' : ''}
          </strong>

          <div className="round-info-pill">
            Tur: <strong>#{gameState.currentRound}</strong>
          </div>

          {okeyInfo && (
            <div className="round-info-pill" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>Okey:</span>
              <span className={`tile-number tile-${okeyInfo.color}`} style={{ fontSize: '1.2rem', fontWeight: 800 }}>
                {okeyInfo.value} {okeyInfo.color.toUpperCase()} ★
              </span>
            </div>
          )}
        </div>

        {/* Live Status Ticker */}
        {statusMessage && (
          <div style={{ background: 'rgba(0,0,0,0.4)', padding: '4px 16px', borderRadius: 999, fontSize: '0.85rem', color: '#38ef7d' }}>
            {statusMessage}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            className="btn-secondary"
            style={{ padding: '6px 10px' }}
            onClick={() => setMuted(sound.toggleMute())}
            title={muted ? 'Sesi Aç' : 'Sesi Kapat'}
          >
            {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>

          <button
            className="btn-secondary"
            style={{ padding: '6px 12px', fontSize: '0.8rem' }}
            onClick={onLeaveRoom}
          >
            <LogOut size={14} style={{ marginRight: 4 }} />
            Ayrıl
          </button>
        </div>
      </header>

      {/* Main Board Arena */}
      <div className="game-board-arena">
        {/* TOP OPPONENT */}
        <div className="opponent-top">
          {topOpponent.player && (
            <div className={`opponent-tag ${turnIndex === topOpponent.seatIndex ? 'active-turn' : ''}`}>
              <div className="seat-avatar" style={{ width: 36, height: 36, fontSize: '1rem', margin: 0 }}>
                {topOpponent.player.isBot ? <Bot size={18} /> : topOpponent.player.name.charAt(0)}
              </div>
              <div>
                <strong style={{ fontSize: '0.9rem' }}>{topOpponent.player.name}</strong>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                  {topOpponent.player.tileCount} Taş • Skor: {scores[topOpponent.seatIndex] || 0}
                </div>
              </div>
            </div>
          )}
          {/* Top player's discard slot */}
          <div className="discard-slot" style={{ marginTop: 8 }}>
            {getDiscardForSeat(topOpponent.seatIndex) && (
              <Tile tile={getDiscardForSeat(topOpponent.seatIndex)} okeyInfo={okeyInfo} mini />
            )}
          </div>
        </div>

        {/* LEFT OPPONENT */}
        <div className="opponent-left">
          {leftOpponent.player && (
            <div className={`opponent-tag ${turnIndex === leftOpponent.seatIndex ? 'active-turn' : ''}`}>
              <div className="seat-avatar" style={{ width: 36, height: 36, fontSize: '1rem', margin: 0 }}>
                {leftOpponent.player.isBot ? <Bot size={18} /> : leftOpponent.player.name.charAt(0)}
              </div>
              <div>
                <strong style={{ fontSize: '0.9rem' }}>{leftOpponent.player.name}</strong>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                  {leftOpponent.player.tileCount} Taş • Skor: {scores[leftOpponent.seatIndex] || 0}
                </div>
              </div>
            </div>
          )}

          {/* Left player discard pile (This is what viewer can draw from!) */}
          <div
            className={`discard-slot ${isLeftDiscardDrawable ? 'can-draw' : ''}`}
            style={{ marginTop: 12 }}
            onClick={() => isLeftDiscardDrawable && handleDrawTile(true)}
            title={isLeftDiscardDrawable ? 'Yandan Taş Çek' : ''}
          >
            {getDiscardForSeat(leftOpponent.seatIndex) ? (
              <Tile tile={getDiscardForSeat(leftOpponent.seatIndex)} okeyInfo={okeyInfo} />
            ) : (
              <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Boş</span>
            )}
          </div>
          {isLeftDiscardDrawable && (
            <span style={{ fontSize: '0.75rem', color: '#38ef7d', fontWeight: 700, marginTop: 4 }}>
              Yandan Al
            </span>
          )}
        </div>

        {/* CENTER TABLE ARENA */}
        <div className="table-center">
          <div className="deck-and-indicator-cluster">
            {/* Draw Deck */}
            <div
              className="draw-deck-container"
              onClick={() => isMyTurn && !hasDrawn && handleDrawTile(false)}
              title={isMyTurn && !hasDrawn ? 'Ortadan Taş Çek' : ''}
            >
              <div className="draw-deck-stack">
                <div className="deck-layer" style={{ top: 0, left: 0 }}></div>
                <div className="deck-layer" style={{ top: -3, left: -2 }}></div>
                <div className="deck-layer" style={{ top: -6, left: -4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                    <span style={{ fontSize: '1rem', color: '#a39879', fontWeight: 800 }}>OKEY</span>
                  </div>
                </div>
              </div>
              <span className="deck-count-badge">{remainingTiles} Taş</span>
              {isMyTurn && !hasDrawn && (
                <span style={{ fontSize: '0.75rem', color: '#38ef7d', fontWeight: 700, marginTop: 2 }}>
                  Çek
                </span>
              )}
            </div>

            {/* Gösterge Tile */}
            <div style={{ display: 'flex', flexCollapse: 'column', alignItems: 'center', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: 4, textTransform: 'uppercase', fontWeight: 700 }}>
                Gösterge
              </span>
              <Tile tile={indicator} okeyInfo={null} />
            </div>
          </div>

          {/* 101 Table Open Pers Area */}
          {gameType === '101' && (
            <div className="table-pers-area">
              {tablePers.length === 0 ? (
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem', padding: '12px' }}>
                  Henüz masaya per açan olmadı (101 barajı bekleniyor).
                </div>
              ) : (
                tablePers.map((per) => (
                  <div
                    key={per.id}
                    className={`open-per-group ${selectedProcessTile ? 'process-target' : ''}`}
                    onClick={() => handleProcessTileClick(per)}
                    title={selectedProcessTile ? 'Seçtiğiniz taşı bu pere işleyin' : ''}
                  >
                    {per.tiles.map((t, tidx) => (
                      <Tile key={t.id || tidx} tile={t} okeyInfo={okeyInfo} mini />
                    ))}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* RIGHT OPPONENT */}
        <div className="opponent-right">
          {rightOpponent.player && (
            <div className={`opponent-tag ${turnIndex === rightOpponent.seatIndex ? 'active-turn' : ''}`}>
              <div className="seat-avatar" style={{ width: 36, height: 36, fontSize: '1rem', margin: 0 }}>
                {rightOpponent.player.isBot ? <Bot size={18} /> : rightOpponent.player.name.charAt(0)}
              </div>
              <div>
                <strong style={{ fontSize: '0.9rem' }}>{rightOpponent.player.name}</strong>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                  {rightOpponent.player.tileCount} Taş • Skor: {scores[rightOpponent.seatIndex] || 0}
                </div>
              </div>
            </div>
          )}

          {/* Right player discard pile */}
          <div className="discard-slot" style={{ marginTop: 12 }}>
            {getDiscardForSeat(rightOpponent.seatIndex) && (
              <Tile tile={getDiscardForSeat(rightOpponent.seatIndex)} okeyInfo={okeyInfo} />
            )}
          </div>
        </div>
      </div>

      {/* USER'S MAHOGANY WOOD ISTAKA */}
      {viewer && (
        <TileRack
          hand={viewer.hand || []}
          okeyInfo={okeyInfo}
          isMyTurn={isMyTurn}
          hasDrawn={hasDrawn}
          gameType={gameType}
          onDiscard={handleDiscardTile}
          onFinishClassic={handleFinishClassic}
          onOpenRuns101={handleOpenRuns101}
          onSelectForProcess={(tile) => setSelectedProcessTile(tile)}
          selectedTileForProcess={selectedProcessTile}
        />
      )}

      {/* Score Modal */}
      {gameState.status === 'round_ended' && winner && (
        <ScoreModal
          winner={winner}
          players={players}
          scores={scores}
          gameType={gameType}
          isHost={players[0]?.id === currentSocketId}
          onNextRound={handleNextRound}
        />
      )}

      {/* Chat Drawer */}
      <ChatDrawer
        messages={[]}
        onSendMessage={handleSendMessage}
        playerName={viewer?.name || 'Oyuncu'}
      />
    </div>
  );
};
