import React, { useState, useEffect, useMemo } from 'react';
import { network } from '../../utils/network.js';
import { sound } from '../../utils/soundEffects.js';
import { RuleValidator } from '../../game/RuleValidator.js';
import { Tile } from './Tile.jsx';
import { TileRack } from './TileRack.jsx';
import { ScoreModal } from '../UI/ScoreModal.jsx';
import { ChatDrawer } from '../UI/ChatDrawer.jsx';
import { Volume2, VolumeX, LogOut, HelpCircle, Bot, Sparkles, Layers } from 'lucide-react';

export const GameBoard = ({ gameState, currentSocketId, chatMessages = [], onLeaveRoom }) => {
  const [muted, setMuted] = useState(false);
  const [selectedProcessTile, setSelectedProcessTile] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [showRulesModal, setShowRulesModal] = useState(false);

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
    highestOpenedPoints = 101,
    options = {}
  } = gameState;

  // Find viewer's seat index
  const viewerSeatIdx = players.findIndex(p => p && p.id === currentSocketId);
  const viewer = viewerSeatIdx !== -1 ? players[viewerSeatIdx] : null;
  const isMyTurn = turnIndex === viewerSeatIdx;
  const activePlayerName = players[turnIndex]?.name || 'Oyuncu';

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

  // Relative player seats
  const getRelativePlayer = (offset) => {
    if (viewerSeatIdx === -1) return { player: players[offset], seatIndex: offset };
    const targetIdx = (viewerSeatIdx + offset) % 4;
    return { player: players[targetIdx], seatIndex: targetIdx };
  };

  const leftOpponent = getRelativePlayer(3);  // Left player
  const topOpponent = getRelativePlayer(2);   // Opposite player
  const rightOpponent = getRelativePlayer(1); // Right player

  // Calculate live hand stats for the persistent HUD corner widget
  const handStats = useMemo(() => {
    const hand = viewer?.hand || [];
    const totalPoints = hand.reduce((acc, t) => acc + (t.value || 0), 0);

    let bestPersPoints = 0;
    let bestPers = [];
    let pairCount = 0;

    if (gameType === '101') {
      const perScan = RuleValidator.findBest101Pers(hand, okeyInfo);
      bestPersPoints = perScan.totalPoints;
      bestPers = perScan.pers;

      const pairScan = RuleValidator.find101Pairs(hand, okeyInfo);
      pairCount = pairScan.pairCount;
    }

    return {
      tileCount: hand.length,
      totalPoints,
      bestPersPoints,
      bestPers,
      pairCount
    };
  }, [viewer?.hand, okeyInfo, gameType]);

  const minRequiredPoints = options.folded ? highestOpenedPoints : 101;
  const canOpenRuns = handStats.bestPersPoints >= minRequiredPoints;
  const canOpenPairs = handStats.pairCount >= 5;

  // Draw tile action
  const handleDrawTile = (fromDiscard = false) => {
    if (!isMyTurn || hasDrawn) return;

    if (fromDiscard && gameType === '101' && !isLeftDiscardLegal) {
      alert(
        '101 Okey Kuralı:\n\n' +
        'Yandan taş alabilmek için bu taşla birlikte elinizi açabiliyor olmalısınız (En az 101 puan veya 5 çift)!\n\n' +
        'Eliniz açmaya yetmediği için yandan taş alamazsınız. Lütfen ortadaki desteden çekiniz.'
      );
      return;
    }

    sound.playDraw();
    network.emit('game:drawTile', { roomId: gameState.roomId, fromDiscard }, (res) => {
      if (!res.success) {
        alert(res.message || 'Taş çekilemedi.');
      }
    });
  };

  // Return discard tile in 101
  const handleReturnDiscardTile = () => {
    if (!isMyTurn || !hasDrawn || !gameState.justDrawnFromDiscard) return;
    sound.playTileClick();
    network.emit('game:returnDiscardTile', { roomId: gameState.roomId }, (res) => {
      if (!res.success) {
        alert(res.message || 'Taş geri bırakılamadı.');
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
        alert(
          'Eliniz henüz bitmeye uygun değil!\n\n' +
          'Klasik Okey kurallarına göre:\n' +
          '• Elinizdeki 14 taşın TAMAMI geçerli serilerden (aynı renk ardışık en az 3 taş) veya gruplardan (farklı renk aynı sayı) oluşmalıdır.\n' +
          '• VEYA 7 çift taştan oluşmalıdır.\n' +
          '• Boşta kalan tek bir taşınız bile varsa oyunu bitiremezsiniz.'
        );
      }
    });
  };

  // Open 101 Runs
  const handleOpenRuns101 = (pers) => {
    network.emit('game:openRuns', { roomId: gameState.roomId, pers }, (res) => {
      if (!res.success) {
        alert(res.message || 'Per açılamadı! Toplam puanın barajı geçtiğinden emin olun.');
      }
    });
  };

  // Open 101 Pairs
  const handleOpenPairs101 = (pairs) => {
    network.emit('game:openPairs', { roomId: gameState.roomId, pairs }, (res) => {
      if (!res.success) {
        alert(res.message || 'Çift açılamadı!');
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
        alert(res.message || 'Bu taş bu pere işlenemez.');
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

  const getDiscardForSeat = (seatIdx) => {
    return discardPiles[seatIdx]?.topTile || null;
  };

  const leftDiscardTile = getDiscardForSeat(leftOpponent.seatIndex);
  const isLeftDiscardLegal = useMemo(() => {
    if (!isMyTurn || hasDrawn || !leftDiscardTile) return false;
    if (gameType === 'classic') return true;

    // 101 rules:
    const candidateHand = [...(viewer?.hand || []), leftDiscardTile];
    if (!viewer?.hasOpened) {
      const { totalPoints } = RuleValidator.findBest101Pers(candidateHand, okeyInfo);
      const { pairCount } = RuleValidator.find101Pairs(candidateHand, okeyInfo);
      return totalPoints >= minRequiredPoints || pairCount >= 5;
    } else {
      const canProcess = tablePers.some(
        p => !p.isPair && RuleValidator.canProcessTile(leftDiscardTile, p.tiles, okeyInfo)
      );
      const { pers } = RuleValidator.findBest101Pers(candidateHand, okeyInfo);
      const formsNewPer = pers.some(per => per.some(t => t.id === leftDiscardTile.id));
      return canProcess || formsNewPer;
    }
  }, [isMyTurn, hasDrawn, leftDiscardTile, gameType, viewer?.hand, viewer?.hasOpened, okeyInfo, minRequiredPoints, tablePers]);

  const messagesList = gameState.chatMessages || chatMessages || [];

  return (
    <div className="game-screen">
      {/* Top Header Bar */}
      <header className="game-top-bar">
        <div className="top-bar-info">
          <strong style={{ color: '#e5b94c', fontSize: '1.15rem' }}>
            {gameType === '101' ? '101 Yüzbir Okey' : 'Klasik Düz Okey'}
            {options.folded ? ' (Katlamalı)' : ''}
          </strong>

          <div className="round-info-pill">
            Tur: <strong>#{gameState.currentRound}</strong>
          </div>

          {okeyInfo && (
            <div className="round-info-pill" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>Okey:</span>
              <span className={`tile-number tile-${okeyInfo.color}`} style={{ fontSize: '1.25rem', fontWeight: 800 }}>
                {okeyInfo.value} {okeyInfo.color.toUpperCase()} ★
              </span>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            className="btn-secondary"
            style={{ padding: '6px 12px', fontSize: '0.85rem' }}
            onClick={() => setShowRulesModal(true)}
            title="Kurallar & Nasıl Oynanır"
          >
            <HelpCircle size={15} style={{ marginRight: 4 }} />
            Kurallar
          </button>

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

      {/* PROMINENT TURN STATUS BANNER */}
      <div className="turn-banner-container" style={{ marginTop: 6 }}>
        {isMyTurn ? (
          <div className="turn-banner my-turn" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: '1.5rem' }}>🎯</span>
              <div>
                <strong>SIRA SİZDE!</strong>{' '}
                <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                  {!hasDrawn
                    ? 'Ortadaki desteden veya solunuzdaki oyuncudan taş çekiniz.'
                    : (gameType === '101' && gameState.justDrawnFromDiscard && !viewer?.hasOpened)
                      ? '⚠️ Yandan taş aldınız: Taş atmak için elinizi açmalısınız (101 barajı).'
                      : 'Taşınızı çektiniz. İşe yaramayan bir taşı atın veya per açın/bitin.'}
                </span>
              </div>
            </div>

            {gameType === '101' && hasDrawn && gameState.justDrawnFromDiscard && !viewer?.hasOpened && (
              <button
                className="btn-secondary"
                style={{
                  borderColor: '#f59e0b',
                  color: '#f59e0b',
                  fontWeight: 800,
                  fontSize: '0.85rem',
                  background: 'rgba(0, 0, 0, 0.45)',
                  padding: '6px 14px',
                  borderRadius: 8,
                  whiteSpace: 'nowrap'
                }}
                onClick={handleReturnDiscardTile}
                title="Yandan aldığınız taşı geri bırakıp ortadan taş çekebilirsiniz"
              >
                ↩️ Taşı Yere Geri Bırak
              </button>
            )}
          </div>
        ) : (
          <div className="turn-banner other-turn">
            <span style={{ fontSize: '1.2rem' }}>⏳</span>
            <span>
              Sıra <strong>{activePlayerName}</strong> oyuncusunda... Hamlesi bekleniyor.
            </span>
          </div>
        )}
      </div>

      {/* Main Board Arena */}
      <div
        className="game-board-arena"
        onDragOver={(e) => {
          if (isMyTurn && hasDrawn) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
          }
        }}
        onDrop={(e) => {
          const tileId = e.dataTransfer.getData('application/tile-id');
          if (tileId && isMyTurn && hasDrawn) {
            e.preventDefault();
            handleDiscardTile(tileId);
          }
        }}
      >
        {/* TOP OPPONENT */}
        <div className="opponent-top">
          {topOpponent.player && (
            <div className={`opponent-tag ${turnIndex === topOpponent.seatIndex ? 'active-turn' : ''}`}>
              <div className="seat-avatar" style={{ width: 36, height: 36, fontSize: '1rem', margin: 0 }}>
                {topOpponent.player.isBot ? <Bot size={18} /> : topOpponent.player.name.charAt(0)}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <strong style={{ fontSize: '0.95rem' }}>{topOpponent.player.name}</strong>
                  {turnIndex === topOpponent.seatIndex && (
                    <span className="turn-tag-badge">SIRA ONDA</span>
                  )}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                  {topOpponent.player.tileCount} Taş • Skor: {scores[topOpponent.seatIndex] || 0}
                </div>
              </div>
            </div>
          )}
          <div className="discard-slot" style={{ marginTop: 6 }}>
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
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <strong style={{ fontSize: '0.95rem' }}>{leftOpponent.player.name}</strong>
                  {turnIndex === leftOpponent.seatIndex && (
                    <span className="turn-tag-badge">SIRA ONDA</span>
                  )}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                  {leftOpponent.player.tileCount} Taş • Skor: {scores[leftOpponent.seatIndex] || 0}
                </div>
              </div>
            </div>
          )}

          {/* Left player discard pile */}
          <div
            className={`discard-slot ${isLeftDiscardLegal ? 'can-draw' : ''}`}
            style={{ marginTop: 10 }}
            onClick={() => {
              if (isMyTurn && !hasDrawn && leftDiscardTile) {
                handleDrawTile(true);
              }
            }}
            title={
              isLeftDiscardLegal
                ? 'Yandan Taş Çek'
                : (isMyTurn && !hasDrawn && leftDiscardTile && gameType === '101')
                  ? 'Eliniz bu taşla birlikte açmaya yetmediği için yandan alamazsınız'
                  : ''
            }
          >
            {leftDiscardTile ? (
              <Tile tile={leftDiscardTile} okeyInfo={okeyInfo} />
            ) : (
              <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Boş</span>
            )}
          </div>
          {isLeftDiscardLegal && (
            <span style={{ fontSize: '0.75rem', color: '#38ef7d', fontWeight: 800, marginTop: 4, animation: 'bannerPulse 1.2s infinite' }}>
              👆 YANDAN AL
            </span>
          )}
        </div>

        {/* CENTER TABLE ARENA */}
        <div className={`table-center ${gameType === '101' ? 'mode-101' : ''}`}>
          {/* Deck and Indicator Dock */}
          <div className="deck-dock-bar">
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
                    <span style={{ fontSize: '0.85rem', color: '#a39879', fontWeight: 800 }}>OKEY</span>
                  </div>
                </div>
              </div>
              <span className="deck-count-badge">{remainingTiles} Taş</span>
              {isMyTurn && !hasDrawn && (
                <span style={{ fontSize: '0.72rem', color: '#38ef7d', fontWeight: 800, marginTop: 2, animation: 'bannerPulse 1.2s infinite' }}>
                  👆 ÇEK
                </span>
              )}
            </div>

            {/* Gösterge Tile */}
            <div style={{ display: 'flex', alignItems: 'center', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.7rem', color: '#94a3b8', marginBottom: 2, textTransform: 'uppercase', fontWeight: 700 }}>
                Gösterge
              </span>
              <Tile tile={indicator} okeyInfo={null} mini />
            </div>
            {gameType === '101' && selectedProcessTile && (
              <div className="process-guide-pill">
                👉 Seçilen: <strong>{selectedProcessTile.color} {selectedProcessTile.value}</strong> (İşlemek için masadaki pere tıklayın veya sürükleyin)
              </div>
            )}
          </div>

          {/* 101 Table Opened Pers Area: Spacious Central Felt */}
          {gameType === '101' && (
            <div className="table-felt-zone">
              {tablePers.length === 0 ? (
                <div className="felt-empty-open-table">
                  <div className="felt-center-watermark">
                    <span className="watermark-title">101 OKEY MASASI</span>
                    <span className="watermark-sub">Açılan seriler ve çiftler masanın bu alanına yerleşecektir</span>
                  </div>
                </div>
              ) : (
                <div className="table-pers-grid">
                  {tablePers.map((per) => {
                    const openerName = players[per.playerIndex]?.name || 'Oyuncu';
                    return (
                      <div
                        key={per.id}
                        className={`open-per-group ${selectedProcessTile ? 'process-target' : ''}`}
                        onClick={() => handleProcessTileClick(per)}
                        onDragOver={(e) => {
                          if (isMyTurn && hasDrawn) {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = 'copy';
                          }
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const tileId = e.dataTransfer.getData('application/tile-id');
                          if (tileId && isMyTurn && hasDrawn) {
                            network.emit('game:processTile', {
                              roomId: gameState.roomId,
                              tileId,
                              targetPerId: per.id
                            }, (res) => {
                              if (!res.success) {
                                alert(res.message || 'Bu taş bu pere işlenemez.');
                              }
                            });
                          }
                        }}
                        title={selectedProcessTile ? 'Seçtiğiniz taşı bu pere işleyin' : 'Taşı bu pere sürükleyip işleyebilirsiniz'}
                      >
                        <span className="per-opener-label">{openerName}</span>
                        <div style={{ display: 'flex', gap: 2 }}>
                          {per.tiles.map((t, tidx) => (
                            <Tile key={t.id || tidx} tile={t} okeyInfo={okeyInfo} mini />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
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
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <strong style={{ fontSize: '0.95rem' }}>{rightOpponent.player.name}</strong>
                  {turnIndex === rightOpponent.seatIndex && (
                    <span className="turn-tag-badge">SIRA ONDA</span>
                  )}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                  {rightOpponent.player.tileCount} Taş • Skor: {scores[rightOpponent.seatIndex] || 0}
                </div>
              </div>
            </div>
          )}

          <div className="discard-slot" style={{ marginTop: 10 }}>
            {getDiscardForSeat(rightOpponent.seatIndex) && (
              <Tile tile={getDiscardForSeat(rightOpponent.seatIndex)} okeyInfo={okeyInfo} />
            )}
          </div>
        </div>

        {/* VIEWER'S OWN DISCARD PILE (Bottom-Right: The tile thrown by viewer) */}
        <div className="viewer-discard-container">
          <span className="viewer-discard-label">Attığınız Taş</span>
          <div
            className={`discard-slot viewer-discard-slot ${isMyTurn && hasDrawn ? 'can-drop-discard' : ''}`}
            onDragOver={(e) => {
              if (isMyTurn && hasDrawn) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
              }
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const tileId = e.dataTransfer.getData('application/tile-id');
              if (tileId && isMyTurn && hasDrawn) {
                handleDiscardTile(tileId);
              }
            }}
            onClick={() => {
              if (selectedProcessTile && isMyTurn && hasDrawn) {
                handleDiscardTile(selectedProcessTile.id);
                setSelectedProcessTile(null);
              }
            }}
            title={
              isMyTurn && hasDrawn
                ? 'Taş atmak için buraya sürükleyip bırakabilirsiniz'
                : 'Attığınız son taş (Sağınızdaki oyuncu alabilir)'
            }
          >
            {getDiscardForSeat(viewerSeatIdx) ? (
              <Tile tile={getDiscardForSeat(viewerSeatIdx)} okeyInfo={okeyInfo} />
            ) : (
              <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Boş</span>
            )}
          </div>
          {isMyTurn && hasDrawn && (
            <span style={{ fontSize: '0.72rem', color: '#e5b94c', fontWeight: 700, marginTop: 2 }}>
              Taş Atma Yeri
            </span>
          )}
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
          hasOpened={!!viewer?.hasOpened}
          justDrawnFromDiscard={gameState.justDrawnFromDiscard}
          onReturnDiscardTile={handleReturnDiscardTile}
          minRequiredPoints={minRequiredPoints}
          totalHandPoints={handStats.totalPoints}
          bestPersPoints={handStats.bestPersPoints}
          onDiscard={handleDiscardTile}
          onFinishClassic={handleFinishClassic}
          onOpenRuns101={handleOpenRuns101}
          onOpenPairs101={handleOpenPairs101}
          onSelectForProcess={(tile) => setSelectedProcessTile(tile)}
          selectedTileForProcess={selectedProcessTile}
        />
      )}

      {/* PERSISTENT SCORE & HAND STATUS CORNER HUD */}
      {viewer && (
        <div className="hud-corner-card">
          <div className="hud-corner-title">👑 EL DURUMU & PUAN</div>
          <div className="hud-corner-row">
            <span>Eldeki Taş:</span>
            <strong>{handStats.tileCount} adet</strong>
          </div>
          <div className="hud-corner-row">
            <span>Toplam Taş Puanı:</span>
            <strong style={{ fontSize: '1rem', color: '#e5b94c' }}>{handStats.totalPoints} puan</strong>
          </div>

          {gameType === '101' && (
            <>
              <div className="hud-corner-row">
                <span>Açılabilir Seri:</span>
                <strong style={{ color: canOpenRuns ? '#38ef7d' : '#f87171', fontWeight: 800 }}>
                  {handStats.bestPersPoints} / {minRequiredPoints}
                </strong>
              </div>
              <div className="hud-corner-row">
                <span>Açılabilir Çift:</span>
                <strong style={{ color: canOpenPairs ? '#38ef7d' : '#f87171', fontWeight: 800 }}>
                  {handStats.pairCount} / 5 çift
                </strong>
              </div>

              <div style={{ marginTop: 8 }}>
                {viewer?.hasOpened ? (
                  <span className="hud-badge-ready">🟢 Masaya Açtınız (İşleme Yapabilirsiniz)</span>
                ) : canOpenRuns ? (
                  <span className="hud-badge-ready">🟢 101 Barajı Aşıldı ({handStats.bestPersPoints} Puan - Açabilirsiniz!)</span>
                ) : canOpenPairs ? (
                  <span className="hud-badge-ready">🟢 5 Çift Hazır ({handStats.pairCount} Çift - Açabilirsiniz!)</span>
                ) : (
                  <span className="hud-badge-wait">🔴 101 İçin {minRequiredPoints - handStats.bestPersPoints} Puan Eksik</span>
                )}
              </div>
            </>
          )}

          {gameType === 'classic' && (
            <div style={{ marginTop: 6 }}>
              <span className="hud-badge-ready" style={{ fontSize: '0.72rem' }}>
                {RuleValidator.checkClassicWin(viewer?.hand || [], okeyInfo).win
                  ? '🟢 BİTİŞE UYGUN (Okey Bit Yapabilirsiniz)'
                  : 'Serilerinizi veya Çiftlerinizi tamamlayınız'}
              </span>
            </div>
          )}
        </div>
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
        messages={messagesList}
        onSendMessage={handleSendMessage}
        playerName={viewer?.name || 'Oyuncu'}
      />

      {/* Rules Modal */}
      {showRulesModal && (
        <div className="modal-overlay" onClick={() => setShowRulesModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ textAlign: 'left', maxWidth: 620 }}>
            <h2 style={{ textAlign: 'center', marginBottom: 16 }}>Okey Kuralları ve Bitiş Rehberi</h2>

            <div style={{ maxHeight: 380, overflowY: 'auto', fontSize: '0.9rem', lineHeight: 1.6, color: '#e2e8f0', paddingRight: 8 }}>
              <h3 style={{ color: '#e5b94c', marginBottom: 4 }}>1. Klasik Düz Okey Bitiş Şartları</h3>
              <p>• 14 taşınızın <strong>TAMAMI</strong> geçerli serilerden (aynı renk ardışık 3+ taş) veya gruplardan (farklı renk aynı sayı) veya 7 çiftten oluşmalıdır.</p>
              <p>• <strong>Okey Atarak Bitiş:</strong> Elinizi bitirirken son taş olarak yere Okey atarsanız kazanılan puan ikiye katlanır.</p>
              <p>• <strong>Çifte Bitiş:</strong> Elinizi 7 çiftle bitirirseniz ceza katlanır.</p>

              <h3 style={{ color: '#e5b94c', marginTop: 14, marginBottom: 4 }}>2. 101 Yüzbir Okey Kuralları</h3>
              <p>• <strong>El Açma:</strong> Elinizdeki perlerin toplamı <strong>en az 101 puan</strong> olmalıdır (veya en az 5 çift açılmalıdır).</p>
              <p>• <strong>Seri Aç Butonu:</strong> Otomatik olarak elinizdeki en yüksek puanlı geçerli perleri hesaplar ve 101'i geçiyorsa masaya açar.</p>
              <p>• <strong>Taş İşleme:</strong> Elini açmış oyuncular masadaki perlere taş işleyebilir.</p>

              <h3 style={{ color: '#e5b94c', marginTop: 14, marginBottom: 4 }}>3. Istaka ve Sürükle-Bırak</h3>
              <p>• Taşları farenizle (veya parmağınızla) sürükleyip istediğiniz boş yuvaya bırakabilirsiniz.</p>
              <p>• <strong>Seri Diz:</strong> Perlerinizi oluşturur ve aralarında boşluk bırakır.</p>
              <p>• <strong>Çift Diz:</strong> Çiftlerinizi yan yana dizer.</p>
            </div>

            <button className="btn-primary" style={{ width: '100%', marginTop: 20 }} onClick={() => setShowRulesModal(false)}>
              Kapat
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
