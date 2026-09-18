import React, { useState, useEffect, useMemo, useRef } from 'react';
import { network } from '../../utils/network.js';
import { sound } from '../../utils/soundEffects.js';
import { RuleValidator } from '../../game/RuleValidator.js';
import { Tile } from './Tile.jsx';
import { TileRack } from './TileRack.jsx';
import { ScoreModal } from '../UI/ScoreModal.jsx';
import { ChatDrawer } from '../UI/ChatDrawer.jsx';
import { YouTubeTvWidget } from './YouTubeTvWidget.jsx';
import { PlayerAvatar } from '../UI/PlayerAvatar.jsx';
import { Volume2, VolumeX, LogOut, HelpCircle, Bot, Sparkles, Layers } from 'lucide-react';

const isEmojiOnly = (text) => {
  if (!text) return false;
  const trimmed = text.trim();
  const emojiRegex = /^(\p{Extended_Pictographic}|\p{Emoji_Presentation}|\s)+$/u;
  return emojiRegex.test(trimmed) && trimmed.length <= 8;
};

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

  // 4 Player Quadrants for 101 Table Felt Zone
  const openedHands = gameState.openedHands || [];
  const tableQuadrants = useMemo(() => {
    return [
      {
        id: 'left',
        title: 'Sol Oyuncu',
        player: leftOpponent.player,
        seatIndex: leftOpponent.seatIndex,
        isViewer: false,
        isActiveTurn: turnIndex === leftOpponent.seatIndex,
        openedInfo: openedHands[leftOpponent.seatIndex] || null,
        pers: tablePers.filter(p => p.playerIndex === leftOpponent.seatIndex)
      },
      {
        id: 'top',
        title: 'Karşı Oyuncu',
        player: topOpponent.player,
        seatIndex: topOpponent.seatIndex,
        isViewer: false,
        isActiveTurn: turnIndex === topOpponent.seatIndex,
        openedInfo: openedHands[topOpponent.seatIndex] || null,
        pers: tablePers.filter(p => p.playerIndex === topOpponent.seatIndex)
      },
      {
        id: 'bottom',
        title: 'Siz',
        player: viewer,
        seatIndex: viewerSeatIdx,
        isViewer: true,
        isActiveTurn: turnIndex === viewerSeatIdx,
        openedInfo: openedHands[viewerSeatIdx] || null,
        pers: tablePers.filter(p => p.playerIndex === viewerSeatIdx)
      },
      {
        id: 'right',
        title: 'Sağ Oyuncu',
        player: rightOpponent.player,
        seatIndex: rightOpponent.seatIndex,
        isViewer: false,
        isActiveTurn: turnIndex === rightOpponent.seatIndex,
        openedInfo: openedHands[rightOpponent.seatIndex] || null,
        pers: tablePers.filter(p => p.playerIndex === rightOpponent.seatIndex)
      }
    ];
  }, [leftOpponent, topOpponent, rightOpponent, viewer, viewerSeatIdx, turnIndex, openedHands, tablePers]);

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

  // Process Pair onto Table (101 Okey)
  const handleProcessPair = (tile1, tile2, targetSeatIdx = null) => {
    if (!isMyTurn || !hasDrawn) return;
    sound.playTileClick();
    network.emit('game:processPair', {
      roomId: gameState.roomId,
      tileId1: tile1.id,
      tileId2: tile2.id,
      targetSeatIndex: targetSeatIdx
    }, (res) => {
      if (!res.success) {
        alert(res.message || 'Çift işlenemedi.');
      }
    });
  };

  // Next round
  const handleNextRound = () => {
    network.emit('game:nextRound', { roomId: gameState.roomId });
  };

  // Chat message & Emoji sending
  const handleSendMessage = (text) => {
    if (!text) return;
    const cleanText = text.trim();
    if (!cleanText) return;
    const sender = viewer?.name || 'Oyuncu';

    // 1. Immediately activate speech bubble locally (Zero-latency instant display)
    const localId = `local-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    lastProcessedMsgIdRef.current = localId;
    if (bubbleTimersRef.current[sender]) {
      clearTimeout(bubbleTimersRef.current[sender]);
    }
    try {
      sound.playTileClick();
    } catch (e) {}

    setActiveBubbles(prev => ({
      ...prev,
      [sender]: { id: localId, text: cleanText }
    }));

    bubbleTimersRef.current[sender] = setTimeout(() => {
      setActiveBubbles(prev => {
        if (prev[sender]?.id === localId) {
          const next = { ...prev };
          delete next[sender];
          return next;
        }
        return prev;
      });
      delete bubbleTimersRef.current[sender];
    }, 5000);

    // 2. Broadcast via network
    network.emit('chat:send', {
      roomId: gameState.roomId,
      text: cleanText,
      senderName: sender
    });
  };

  // Media Controls (YouTube Player Synchronization)
  const handleAddMediaTrack = (track) => {
    network.emit('media:add', { roomId: gameState.roomId, track });
  };

  const handleSkipMediaTrack = () => {
    network.emit('media:skip', { roomId: gameState.roomId });
  };

  const handleRemoveMediaTrack = (trackId) => {
    network.emit('media:remove', { roomId: gameState.roomId, trackId });
  };

  const handleToggleMediaPlay = (isPlaying) => {
    network.emit('media:togglePlay', { roomId: gameState.roomId, isPlaying });
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
      const hasPairOpener = (gameState.openedHands || []).some(h => h && h.type === 'pairs');
      const formsPair = hasPairOpener && (viewer?.hand || []).some(t =>
        RuleValidator.isPair(t, leftDiscardTile, okeyInfo)
      );

      return canProcess || formsNewPer || formsPair;
    }
  }, [isMyTurn, hasDrawn, leftDiscardTile, gameType, viewer?.hand, viewer?.hasOpened, okeyInfo, minRequiredPoints, tablePers, gameState.openedHands]);

  const messagesList = gameState.chatMessages || chatMessages || [];
  const lastMsg = messagesList.length > 0 ? messagesList[messagesList.length - 1] : null;
  const lastMsgId = lastMsg?.id;

  // Speech bubbles triggered by chat messages & emojis (5s duration)
  const [activeBubbles, setActiveBubbles] = useState({});
  const lastProcessedMsgIdRef = useRef(null);
  const bubbleTimersRef = useRef({});

  useEffect(() => {
    if (!messagesList || messagesList.length === 0) return;
    const latestMsg = messagesList[messagesList.length - 1];
    if (!latestMsg || latestMsg.isSystem) return;

    if (latestMsg.id !== lastProcessedMsgIdRef.current) {
      lastProcessedMsgIdRef.current = latestMsg.id;
      const sender = latestMsg.sender;

      // Clear any prior timer for this sender
      if (bubbleTimersRef.current[sender]) {
        clearTimeout(bubbleTimersRef.current[sender]);
      }

      // Play soft pop sound
      try {
        sound.playTileClick();
      } catch (e) {}

      // Activate bubble for this player
      setActiveBubbles(prev => ({
        ...prev,
        [sender]: { id: latestMsg.id, text: latestMsg.text }
      }));

      // Dismiss after 5 seconds
      bubbleTimersRef.current[sender] = setTimeout(() => {
        setActiveBubbles(prev => {
          if (prev[sender]?.id === latestMsg.id) {
            const next = { ...prev };
            delete next[sender];
            return next;
          }
          return prev;
        });
        delete bubbleTimersRef.current[sender];
      }, 5000);
    }
  }, [messagesList.length, lastMsgId]);

  useEffect(() => {
    return () => {
      Object.values(bubbleTimersRef.current).forEach(t => clearTimeout(t));
    };
  }, []);

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
            <div className={`opponent-tag ${turnIndex === topOpponent.seatIndex ? 'active-turn' : ''}`} style={{ position: 'relative' }}>
              <PlayerAvatar
                avatar={topOpponent.player.avatar}
                isBot={topOpponent.player.isBot}
                name={topOpponent.player.name}
                size={36}
                className="seat-avatar"
                style={{ margin: 0 }}
              />
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

              {activeBubbles[topOpponent.player.name] && (
                <div
                  className={`speech-bubble opponent-speech-bubble bubble-top ${
                    isEmojiOnly(activeBubbles[topOpponent.player.name].text) ? 'emoji-bubble' : ''
                  }`}
                >
                  <span className="speech-bubble-content">
                    {activeBubbles[topOpponent.player.name].text}
                  </span>
                </div>
              )}
            </div>
          )}
          <div className="discard-slot" style={{ marginTop: 6 }}>
            {getDiscardForSeat(topOpponent.seatIndex) && (
              <Tile tile={getDiscardForSeat(topOpponent.seatIndex)} okeyInfo={okeyInfo} mini />
            )}
          </div>
        </div>

        {/* TOP-RIGHT CORNER: SYNCHRONIZED YOUTUBE TV / MUSIC PLAYER */}
        <div className="game-tv-slot">
          <YouTubeTvWidget
            mediaState={gameState.mediaState || { currentTrack: null, queue: [], isPlaying: true }}
            onAddTrack={handleAddMediaTrack}
            onSkipTrack={handleSkipMediaTrack}
            onRemoveTrack={handleRemoveMediaTrack}
            onTogglePlay={handleToggleMediaPlay}
            playerName={viewer?.name || 'Oyuncu'}
          />
        </div>

        {/* LEFT OPPONENT */}
        <div className="opponent-left">
          {leftOpponent.player && (
            <div className={`opponent-tag ${turnIndex === leftOpponent.seatIndex ? 'active-turn' : ''}`} style={{ position: 'relative' }}>
              <PlayerAvatar
                avatar={leftOpponent.player.avatar}
                isBot={leftOpponent.player.isBot}
                name={leftOpponent.player.name}
                size={36}
                className="seat-avatar"
                style={{ margin: 0 }}
              />
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

              {activeBubbles[leftOpponent.player.name] && (
                <div
                  className={`speech-bubble opponent-speech-bubble bubble-left ${
                    isEmojiOnly(activeBubbles[leftOpponent.player.name].text) ? 'emoji-bubble' : ''
                  }`}
                >
                  <span className="speech-bubble-content">
                    {activeBubbles[leftOpponent.player.name].text}
                  </span>
                </div>
              )}
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
          {/* 101 Table Opened Pers Area: Spacious 4-Quadrant Velvet Table */}
          {gameType === '101' && (
            <div className="table-felt-zone">
              {selectedProcessTile && (
                <div className="process-guide-banner">
                  👉 Seçilen Taş: <strong style={{ color: '#fff' }}>{selectedProcessTile.color.toUpperCase()} {selectedProcessTile.value}</strong> — İşlemek istediğiniz pere tıklayın veya taşı o pere sürükleyin!
                </div>
              )}
              <div className="table-4quadrant-grid">
                {tableQuadrants.map(quad => (
                  <div
                    key={quad.id}
                    className={`table-player-quadrant ${quad.isActiveTurn ? 'is-current-turn' : ''}`}
                  >
                    <div className="quadrant-header">
                      <div className="quadrant-player-info" style={{ position: 'relative' }}>
                        <PlayerAvatar
                          avatar={quad.player?.avatar}
                          isBot={quad.player?.isBot}
                          name={quad.player?.name}
                          size={26}
                          className="seat-avatar"
                          style={{ margin: 0 }}
                        />
                        <strong className="quadrant-name">
                          {quad.player?.name || 'Oyuncu'}
                          {quad.isViewer ? ' (Siz)' : ''}
                        </strong>

                        {(() => {
                          const bubble = activeBubbles[quad.player?.name] || (quad.isViewer ? activeBubbles[viewer?.name] : null);
                          if (!bubble) return null;
                          return (
                            <div
                              className={`speech-bubble quadrant-speech-bubble ${
                                isEmojiOnly(bubble.text) ? 'emoji-bubble' : ''
                              }`}
                            >
                              <span className="speech-bubble-content">
                                {bubble.text}
                              </span>
                            </div>
                          );
                        })()}
                      </div>

                      {quad.openedInfo ? (
                        <span className="quadrant-badge opened">
                          {quad.openedInfo.type === 'pairs'
                            ? `🟢 ${quad.openedInfo.pairCount || 5} Çift`
                            : `🟢 ${quad.openedInfo.points} Puan`}
                        </span>
                      ) : (
                        <span className="quadrant-badge waiting">⚪ Açmadı</span>
                      )}
                    </div>

                    <div className="quadrant-pers-container">
                      {quad.pers.length === 0 ? (
                        <div className="quadrant-empty-hint">
                          Henüz per açmadı
                        </div>
                      ) : (
                        quad.pers.map(per => (
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
                                  if (!res.success) alert(res.message || 'Bu taş bu pere işlenemez.');
                                });
                              }
                            }}
                            title={selectedProcessTile ? 'Seçtiğiniz taşı bu pere işleyin' : 'Taşı bu pere sürükleyip işleyebilirsiniz'}
                          >
                            <div style={{ display: 'flex', gap: 2 }}>
                              {per.tiles.map((t, tidx) => (
                                <Tile key={t.id || tidx} tile={t} okeyInfo={okeyInfo} mini />
                              ))}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Classic Okey Felt */}
          {gameType === 'classic' && (
            <div className="table-felt-zone classic-felt">
              <div className="felt-empty-open-table">
                <div className="felt-center-watermark">
                  <span className="watermark-title">OKEY MASASI</span>
                  <span className="watermark-sub">Klasik Düz Okey • Elinizi tamamlayıp bitiş yapınız</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT OPPONENT */}
        <div className="opponent-right">
          {rightOpponent.player && (
            <div className={`opponent-tag ${turnIndex === rightOpponent.seatIndex ? 'active-turn' : ''}`} style={{ position: 'relative' }}>
              <PlayerAvatar
                avatar={rightOpponent.player.avatar}
                isBot={rightOpponent.player.isBot}
                name={rightOpponent.player.name}
                size={36}
                className="seat-avatar"
                style={{ margin: 0 }}
              />
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

              {activeBubbles[rightOpponent.player.name] && (
                <div
                  className={`speech-bubble opponent-speech-bubble bubble-right ${
                    isEmojiOnly(activeBubbles[rightOpponent.player.name].text) ? 'emoji-bubble' : ''
                  }`}
                >
                  <span className="speech-bubble-content">
                    {activeBubbles[rightOpponent.player.name].text}
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="discard-slot" style={{ marginTop: 10 }}>
            {getDiscardForSeat(rightOpponent.seatIndex) && (
              <Tile tile={getDiscardForSeat(rightOpponent.seatIndex)} okeyInfo={okeyInfo} />
            )}
          </div>
        </div>

        {/* VIEWER'S OWN PLAYER TAG (Bottom-Left) */}
        <div className="opponent-bottom">
          {viewer && (
            <div className={`opponent-tag viewer-tag ${isMyTurn ? 'active-turn' : ''}`} style={{ position: 'relative' }}>
              <PlayerAvatar
                avatar={viewer.avatar}
                isBot={false}
                name={viewer.name}
                size={36}
                className="seat-avatar"
                style={{ margin: 0 }}
              />
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <strong style={{ fontSize: '0.95rem' }}>{viewer.name} (Siz)</strong>
                  {isMyTurn && (
                    <span className="turn-tag-badge">SIRA SİZDE</span>
                  )}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                  {viewer.hand?.length || 0} Taş • Skor: {scores[viewerSeatIdx] || 0}
                </div>
              </div>

              {(() => {
                const bubble = activeBubbles[viewer?.name] || activeBubbles['Oyuncu'];
                if (!bubble) return null;
                return (
                  <div
                    className={`speech-bubble opponent-speech-bubble bubble-viewer ${
                      isEmojiOnly(bubble.text) ? 'emoji-bubble' : ''
                    }`}
                  >
                    <span className="speech-bubble-content">
                      {bubble.text}
                    </span>
                  </div>
                );
              })()}
            </div>
          )}
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
          <span
            style={{
              fontSize: '0.72rem',
              color: '#e5b94c',
              fontWeight: 700,
              marginTop: 2,
              minHeight: '16px',
              visibility: (isMyTurn && hasDrawn) ? 'visible' : 'hidden'
            }}
          >
            Taş Atma Yeri
          </span>
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
          onProcessPair={handleProcessPair}
          openedType={viewer?.hasOpened ? gameState.openedHands?.[viewerSeatIdx]?.type : null}
          hasPairOpenerOnTable={(gameState.openedHands || []).some(h => h && h.type === 'pairs')}
          onSelectForProcess={(tile) => setSelectedProcessTile(tile)}
          selectedTileForProcess={selectedProcessTile}
          remainingTiles={remainingTiles}
          indicator={indicator}
          onDrawDeck={() => handleDrawTile(false)}
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
