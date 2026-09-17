import React, { useState, useEffect } from 'react';
import { Tile } from './Tile.jsx';
import { RuleValidator } from '../../game/RuleValidator.js';
import { sound } from '../../utils/soundEffects.js';
import { Sparkles, CheckCircle, ArrowDownCircle, Trophy, Split, Layers, PlayCircle } from 'lucide-react';

export const TileRack = ({
  hand = [],
  okeyInfo,
  isMyTurn,
  hasDrawn,
  gameType,
  hasOpened = false,
  justDrawnFromDiscard = false,
  onReturnDiscardTile,
  minRequiredPoints = 101,
  totalHandPoints = 0,
  bestPersPoints = 0,
  onDiscard,
  onFinishClassic,
  onOpenRuns101,
  onOpenPairs101,
  onSelectForProcess,
  selectedTileForProcess,
  remainingTiles = 0,
  indicator = null,
  onDrawDeck
}) => {
  // 30-slot authentic Okey rack (15 top, 15 bottom)
  const [slots, setSlots] = useState(() => {
    const initialSlots = Array(30).fill(null);
    hand.forEach((t, i) => {
      if (i < 30) initialSlots[i] = t;
    });
    return initialSlots;
  });

  const [selectedSlotIndex, setSelectedSlotIndex] = useState(null);
  const [selectedFor101Ids, setSelectedFor101Ids] = useState([]);
  const [draggedSlot, setDraggedSlot] = useState(null);

  // Global drag-end safety listener: Prevents any tile from getting stuck in gray/dragging state
  useEffect(() => {
    const handleGlobalDragEnd = () => {
      setDraggedSlot(null);
    };
    window.addEventListener('dragend', handleGlobalDragEnd);
    window.addEventListener('mouseup', handleGlobalDragEnd);
    return () => {
      window.removeEventListener('dragend', handleGlobalDragEnd);
      window.removeEventListener('mouseup', handleGlobalDragEnd);
    };
  }, []);

  // Track hand contents via sorted ID string so any addition or removal triggers update guaranteed
  const handKey = (hand || []).map(t => t.id).sort().join(',');

  // Sync with incoming hand changes (draws, discards, opens) while keeping user layout
  useEffect(() => {
    setSlots(prevSlots => {
      const currentHandIds = new Set((hand || []).map(t => t.id));
      const handMap = new Map((hand || []).map(t => [t.id, t]));
      const newSlots = prevSlots.map(t => (t && currentHandIds.has(t.id) ? handMap.get(t.id) : null));

      // Find tiles in hand not yet placed in any slot
      const placedIds = new Set(newSlots.filter(Boolean).map(t => t.id));
      const unplacedTiles = (hand || []).filter(t => !placedIds.has(t.id));

      let unplacedIdx = 0;
      for (let i = 0; i < 30 && unplacedIdx < unplacedTiles.length; i++) {
        if (!newSlots[i]) {
          newSlots[i] = unplacedTiles[unplacedIdx++];
        }
      }

      return newSlots;
    });
  }, [handKey]);

  // DRAG & DROP HANDLERS
  const handleDragStart = (e, slotIdx) => {
    if (!slots[slotIdx]) return;
    setDraggedSlot(slotIdx);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', slotIdx.toString());
    e.dataTransfer.setData('application/tile-id', slots[slotIdx].id);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, targetSlotIdx) => {
    e.preventDefault();
    e.stopPropagation();

    const dataSlotStr = e.dataTransfer.getData('text/plain');
    const parsedSlot = dataSlotStr !== '' ? parseInt(dataSlotStr, 10) : null;
    const sourceSlot = draggedSlot !== null ? draggedSlot : (!isNaN(parsedSlot) ? parsedSlot : null);

    if (sourceSlot === null || sourceSlot === targetSlotIdx) {
      setDraggedSlot(null);
      return;
    }

    sound.playTileClick();
    setSlots(prev => {
      const copy = [...prev];
      const temp = copy[sourceSlot];
      copy[sourceSlot] = copy[targetSlotIdx];
      copy[targetSlotIdx] = temp;
      return copy;
    });

    setDraggedSlot(null);
    setSelectedSlotIndex(null);
  };

  // Dropping anywhere on a row - accurately calculates column 0 to 14
  const handleRowDrop = (e, rowIndex) => {
    e.preventDefault();
    e.stopPropagation();

    const dataSlotStr = e.dataTransfer.getData('text/plain');
    const parsedSlot = dataSlotStr !== '' ? parseInt(dataSlotStr, 10) : null;
    const sourceSlot = draggedSlot !== null ? draggedSlot : (!isNaN(parsedSlot) ? parsedSlot : null);

    if (sourceSlot === null) {
      setDraggedSlot(null);
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const scrollLeft = e.currentTarget.scrollLeft || 0;
    const relativeX = (e.clientX - rect.left) + scrollLeft;
    const slotWidth = rect.width / 15;
    const slotCol = Math.max(0, Math.min(14, Math.floor(relativeX / slotWidth)));
    const targetIdx = rowIndex * 15 + slotCol;

    if (targetIdx === sourceSlot) {
      setDraggedSlot(null);
      return;
    }

    sound.playTileClick();
    setSlots(prev => {
      const copy = [...prev];
      const temp = copy[sourceSlot];
      copy[sourceSlot] = copy[targetIdx];
      copy[targetIdx] = temp;
      return copy;
    });

    setDraggedSlot(null);
    setSelectedSlotIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedSlot(null);
  };

  // CLICK & SWAP / SELECTION HANDLER
  const handleSlotClick = (slotIdx) => {
    const tile = slots[slotIdx];

    // If an empty slot is clicked: Move the currently selected tile there!
    if (!tile) {
      if (selectedSlotIndex !== null && slots[selectedSlotIndex]) {
        sound.playTileClick();
        setSlots(prev => {
          const copy = [...prev];
          copy[slotIdx] = copy[selectedSlotIndex];
          copy[selectedSlotIndex] = null;
          return copy;
        });
        setSelectedSlotIndex(null);
        setSelectedFor101Ids([]);
        return;
      }
      if (gameType === '101' && selectedFor101Ids.length === 1) {
        const sourceIdx = slots.findIndex(t => t && t.id === selectedFor101Ids[0]);
        if (sourceIdx !== -1) {
          sound.playTileClick();
          setSlots(prev => {
            const copy = [...prev];
            copy[slotIdx] = copy[sourceIdx];
            copy[sourceIdx] = null;
            return copy;
          });
          setSelectedFor101Ids([]);
          setSelectedSlotIndex(null);
          return;
        }
      }
      return;
    }

    // If a tile is clicked in 101:
    if (gameType === '101') {
      sound.playTileClick();
      setSelectedSlotIndex(slotIdx);
      if (selectedFor101Ids.includes(tile.id)) {
        setSelectedFor101Ids(selectedFor101Ids.filter(id => id !== tile.id));
      } else {
        setSelectedFor101Ids([...selectedFor101Ids, tile.id]);
      }
      if (onSelectForProcess) onSelectForProcess(tile);
      return;
    }

    // Classic Okey: Click-to-Move or Select for Discard
    if (selectedSlotIndex === null) {
      sound.playTileClick();
      setSelectedSlotIndex(slotIdx);
    } else {
      if (selectedSlotIndex === slotIdx) {
        setSelectedSlotIndex(null);
      } else {
        sound.playTileClick();
        setSlots(prev => {
          const copy = [...prev];
          const temp = copy[selectedSlotIndex];
          copy[selectedSlotIndex] = copy[slotIdx];
          copy[slotIdx] = temp;
          return copy;
        });
        setSelectedSlotIndex(null);
      }
    }
  };

  // Discard action
  const handleDiscardAction = (tileId) => {
    sound.playTileClick();
    onDiscard(tileId);
    setSelectedSlotIndex(null);
    setSelectedFor101Ids([]);
  };

  // Fast-discard on double click (Classic Okey only)
  const handleDoubleClick = (slotIdx) => {
    const tile = slots[slotIdx];
    if (!tile) return;
    if (gameType === 'classic' && isMyTurn && hasDrawn) {
      handleDiscardAction(tile.id);
    }
  };

  // AUTO ARRANGE: RUNS (Seri Diz)
  const handleAutoArrangeRuns = () => {
    sound.playTileClick();
    const arranged = RuleValidator.autoArrangeRuns(hand, okeyInfo);
    setSlots(arranged);
    setSelectedSlotIndex(null);
    setSelectedFor101Ids([]);
  };

  // AUTO ARRANGE: PAIRS (Çift Diz)
  const handleAutoArrangePairs = () => {
    sound.playTileClick();
    const arranged = RuleValidator.autoArrangePairs(hand, okeyInfo);
    setSlots(arranged);
    setSelectedSlotIndex(null);
    setSelectedFor101Ids([]);
  };

  // 101 AUTO OPEN RUNS (Entire Hand Scan)
  const handleAutoOpen101Runs = () => {
    if (!isMyTurn || !hasDrawn) {
      alert('Önce ortadan veya yandan taş çekmelisiniz!');
      return;
    }

    const { pers, totalPoints } = RuleValidator.findBest101Pers(hand, okeyInfo);

    if (pers.length === 0) {
      alert('Elinizde geçerli bir seri veya grup bulunmuyor.');
      return;
    }

    const minRequired = hasOpened ? 0 : minRequiredPoints;
    if (totalPoints < minRequired) {
      alert(
        `Elinizdeki geçerli perlerin toplamı ${totalPoints} puan ediyor.\n` +
        `101 barajı için en az ${minRequired} puan gereklidir (${minRequired - totalPoints} puan eksik).`
      );
      return;
    }

    sound.playTileClick();
    onOpenRuns101(pers);
    setSelectedFor101Ids([]);
    setSelectedSlotIndex(null);
  };

  // 101 OPEN SELECTED TILES
  const handleOpenSelected101 = () => {
    if (!isMyTurn || !hasDrawn) {
      alert('Önce taş çekmelisiniz!');
      return;
    }

    const selectedTiles = hand.filter(t => selectedFor101Ids.includes(t.id));
    if (selectedTiles.length < 3) {
      alert('Açmak istediğiniz en az 3 taşı ıstakadan seçiniz.');
      return;
    }

    // Evaluate selected tiles
    const { pers, totalPoints } = RuleValidator.findBest101Pers(selectedTiles, okeyInfo);

    if (pers.length === 0) {
      alert('Seçtiğiniz taşlar geçerli bir seri (aynı renk ardışık en az 3 taş) veya grup (aynı sayı farklı renk en az 3 taş) oluşturmuyor!');
      return;
    }

    if (hasOpened) {
      // Already opened earlier: can open any valid per!
      sound.playTileClick();
      onOpenRuns101(pers);
      setSelectedFor101Ids([]);
      setSelectedSlotIndex(null);
      return;
    }

    // Has NOT opened yet: must reach 101 threshold
    if (totalPoints >= minRequiredPoints) {
      sound.playTileClick();
      onOpenRuns101(pers);
      setSelectedFor101Ids([]);
      setSelectedSlotIndex(null);
      return;
    }

    // Selected tiles < 101: Check if whole hand reaches 101
    const handScan = RuleValidator.findBest101Pers(hand, okeyInfo);
    if (handScan.totalPoints >= minRequiredPoints) {
      const confirmOpenAll = window.confirm(
        `Seçtiğiniz perler ${totalPoints} puan ediyor. İlk açılışta en az ${minRequiredPoints} puan açılmalıdır.\n\n` +
        `Elinizdeki diğer perlerle birlikte toplam ${handScan.totalPoints} puan ile 101 barajını geçebilirsiniz.\n\n` +
        `Tüm geçerli perleriniz masaya açılsın mı?`
      );
      if (confirmOpenAll) {
        sound.playTileClick();
        onOpenRuns101(handScan.pers);
        setSelectedFor101Ids([]);
        setSelectedSlotIndex(null);
      }
    } else {
      alert(
        `Seçtiğiniz taşlar ${totalPoints} puan ediyor.\n` +
        `101 barajı için en az ${minRequiredPoints} puan gereklidir (${minRequiredPoints - totalPoints} puan eksik).\n\n` +
        `Elinizdeki tüm perler bile şu an ${handScan.totalPoints} puan etmektedir. Henüz el açamazsınız.`
      );
    }
  };

  // 101 OPEN PAIRS ACTION
  const handleOpen101PairsClick = () => {
    if (!isMyTurn || !hasDrawn) {
      alert('Önce taş çekmelisiniz!');
      return;
    }

    const tilesToScan = selectedFor101Ids.length >= 2
      ? hand.filter(t => selectedFor101Ids.includes(t.id))
      : hand;

    const { pairs, pairCount } = RuleValidator.find101Pairs(tilesToScan, okeyInfo);

    if (hasOpened) {
      if (pairs.length === 0) {
        alert('Seçtiğiniz taşlar arasında çift bulunamadı.');
        return;
      }
      sound.playTileClick();
      onOpenPairs101([pairs[0]]);
      setSelectedFor101Ids([]);
      setSelectedSlotIndex(null);
      return;
    }

    if (pairCount < 5) {
      alert(`Çift açmak için en az 5 çift (10 taş) gereklidir. Şu an elinizde ${pairCount} çift var.`);
      return;
    }

    sound.playTileClick();
    onOpenPairs101(pairs.slice(0, 5));
    setSelectedFor101Ids([]);
    setSelectedSlotIndex(null);
  };

  // Live selected tiles details for 101
  const selected101Tiles = hand.filter(t => selectedFor101Ids.includes(t.id));
  const selected101Points = selected101Tiles.reduce((acc, t) => acc + (t.value || 0), 0);

  // Selected tile for discard
  const selectedTileToDiscard = selectedSlotIndex !== null
    ? slots[selectedSlotIndex]
    : (selectedFor101Ids.length === 1 ? hand.find(t => t.id === selectedFor101Ids[0]) : null);

  return (
    <div className="user-game-rack-area">
      {/* Rack Action Bar */}
      <div className="rack-control-bar">
        {/* Auto Arrange buttons */}
        <div className="rack-actions-group">
          <button
            className="btn-secondary"
            onClick={handleAutoArrangeRuns}
            title="Taşları serilerine ve gruplarına göre ıstakaya diz"
          >
            <Sparkles size={15} style={{ marginRight: 4 }} />
            Seri Diz
          </button>

          <button
            className="btn-secondary"
            onClick={handleAutoArrangePairs}
            title="Taşları çiftlerine göre ıstakaya diz"
          >
            <Split size={15} style={{ marginRight: 4 }} />
            Çift Diz
          </button>
        </div>

        {/* 101 Action controls */}
        {gameType === '101' && (
          <div className="rack-actions-group">
            {/* Live Point Indicator in Bar */}
            <div className="rack-live-stats-pill">
              <span>Elde: <strong>{totalHandPoints} Puan</strong></span>
              <span style={{ margin: '0 4px', opacity: 0.5 }}>|</span>
              <span>Açılabilir: <strong style={{ color: bestPersPoints >= minRequiredPoints ? '#38ef7d' : '#f87171' }}>{bestPersPoints}/{minRequiredPoints}</strong></span>
            </div>

            {selected101Tiles.length > 0 && (
              <button
                className="btn-primary"
                disabled={!isMyTurn || !hasDrawn}
                style={{ background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)', borderColor: '#34d399' }}
                onClick={handleOpenSelected101}
                title="Seçtiğiniz taşları masaya açın"
              >
                <CheckCircle size={15} style={{ marginRight: 4 }} />
                Seçilenleri Aç ({selected101Points} Puan)
              </button>
            )}

            <button
              className="btn-primary"
              disabled={!isMyTurn || !hasDrawn}
              style={{ opacity: (!isMyTurn || !hasDrawn) ? 0.5 : 1 }}
              onClick={handleAutoOpen101Runs}
              title={hasOpened ? 'Elinizdeki yeni perleri masaya aç' : 'Tüm elinizdeki perleri masaya aç (101 barajı)'}
            >
              <PlayCircle size={15} style={{ marginRight: 4 }} />
              {hasOpened ? 'Yeni Per Aç' : 'Otomatik Seri Aç (101)'}
            </button>

            <button
              className="btn-secondary"
              disabled={!isMyTurn || !hasDrawn}
              style={{ opacity: (!isMyTurn || !hasDrawn) ? 0.5 : 1, borderColor: '#38ef7d', color: '#38ef7d' }}
              onClick={handleOpen101PairsClick}
              title={hasOpened ? 'Çift aç' : 'En az 5 çift aç'}
            >
              <Layers size={15} style={{ marginRight: 4 }} />
              {hasOpened ? 'Çift Aç' : 'Çift Aç (5 Çift)'}
            </button>
          </div>
        )}

        {/* Turn Action Buttons */}
        <div className="rack-actions-group">
          {/* 101 Return Discard Tile Button */}
          {gameType === '101' && isMyTurn && hasDrawn && justDrawnFromDiscard && !hasOpened && onReturnDiscardTile && (
            <button
              className="btn-secondary"
              style={{
                borderColor: '#f59e0b',
                color: '#f59e0b',
                fontWeight: 700,
                background: 'rgba(245, 158, 11, 0.15)'
              }}
              onClick={onReturnDiscardTile}
              title="Yandan aldığınız taşı geri bırakıp ortadan çekebilirsiniz"
            >
              ↩️ Taşı Yere Geri Bırak
            </button>
          )}

          {isMyTurn && hasDrawn && selectedTileToDiscard && (
            <>
              <button
                className="btn-secondary"
                style={{ borderColor: '#ef4444', color: '#f87171', fontWeight: 700 }}
                onClick={() => handleDiscardAction(selectedTileToDiscard.id)}
              >
                <ArrowDownCircle size={15} style={{ marginRight: 4 }} />
                Taşı At
              </button>

              {gameType === 'classic' && (
                <button
                  className="btn-primary"
                  onClick={() => {
                    onFinishClassic(selectedTileToDiscard.id);
                    setSelectedSlotIndex(null);
                  }}
                >
                  <Trophy size={16} style={{ marginRight: 4 }} />
                  Bitiş Yap (Okey Bit)
                </button>
              )}
            </>
          )}

          {isMyTurn && !hasDrawn && (
            <span style={{ color: '#38ef7d', fontWeight: 800, fontSize: '0.9rem', animation: 'bannerPulse 1.2s infinite' }}>
              👉 Ortadan veya Yandan Taş Çekiniz!
            </span>
          )}

          {isMyTurn && hasDrawn && !selectedTileToDiscard && (
            <span style={{ color: '#e5b94c', fontWeight: 700, fontSize: '0.85rem' }}>
              Atacağınız taşa tıklayın veya masaya sürükleyin
            </span>
          )}
        </div>
      </div>

      {/* Rack and Deck Container: Deck on the LEFT, Wood Istaka on the RIGHT */}
      <div className="rack-and-dock-container">
        {/* LEFT DOCK: DRAW DECK & GÖSTERGE */}
        <div className={`istaka-left-deck-dock ${isMyTurn && !hasDrawn ? 'can-draw-pulse' : ''}`}>
          {/* OKEY Draw Deck Stack */}
          <div
            className="deck-clickable-area"
            onClick={() => isMyTurn && !hasDrawn && onDrawDeck && onDrawDeck()}
            title={isMyTurn && !hasDrawn ? 'Ortadaki Desteden Taş Çekmek İçin Tıklayın' : 'Kalan Taş Destesi'}
          >
            <div className="draw-deck-stack">
              <div className="deck-layer" style={{ top: 0, left: 0 }}></div>
              <div className="deck-layer" style={{ top: -3, left: -2 }}></div>
              <div className="deck-layer" style={{ top: -6, left: -4 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                  <span style={{ fontSize: '0.8rem', color: '#a39879', fontWeight: 900 }}>OKEY</span>
                </div>
              </div>
            </div>
            <span className="deck-count-badge">{remainingTiles} Taş</span>
            {isMyTurn && !hasDrawn && (
              <span className="deck-pulse-prompt">
                👆 TAŞ ÇEK
              </span>
            )}
          </div>

          {/* Gösterge Tile */}
          <div className="dock-gosterge-wrap">
            <span className="dock-gosterge-label">GÖSTERGE</span>
            <Tile tile={indicator} okeyInfo={null} mini />
          </div>
        </div>

        {/* Realistic 2-Row Wooden Istaka (Slot-Based, 15 slots per row) */}
        <div
          className="wood-istaka"
          onDragOver={handleDragOver}
          onDrop={(e) => {
            e.preventDefault();
            const rect = e.currentTarget.getBoundingClientRect();
            const relativeY = e.clientY - rect.top;
            const rowIndex = relativeY < rect.height / 2 ? 0 : 1;
            handleRowDrop(e, rowIndex);
          }}
        >
          {/* Row 1 (Slots 0 to 14) */}
          <div
            className="istaka-row"
            onDragOver={handleDragOver}
            onDrop={(e) => handleRowDrop(e, 0)}
          >
            {slots.slice(0, 15).map((tile, i) => {
              const slotIdx = i;
              const isSelected =
                gameType === '101'
                  ? tile && selectedFor101Ids.includes(tile.id)
                  : selectedSlotIndex === slotIdx;

              return (
                <div
                  key={slotIdx}
                  className={`rack-slot ${tile ? 'has-tile' : 'empty-slot'} ${draggedSlot === slotIdx ? 'dragging' : ''}`}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, slotIdx)}
                  onClick={() => handleSlotClick(slotIdx)}
                  onDoubleClick={() => handleDoubleClick(slotIdx)}
                >
                  {tile && (
                    <Tile
                      tile={tile}
                      okeyInfo={okeyInfo}
                      selected={isSelected}
                      draggable={true}
                      onDragStart={(e) => handleDragStart(e, slotIdx)}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, slotIdx)}
                      onDragEnd={handleDragEnd}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Row 2 (Slots 15 to 29) */}
          <div
            className="istaka-row"
            onDragOver={handleDragOver}
            onDrop={(e) => handleRowDrop(e, 1)}
          >
            {slots.slice(15, 30).map((tile, i) => {
              const slotIdx = 15 + i;
              const isSelected =
                gameType === '101'
                  ? tile && selectedFor101Ids.includes(tile.id)
                  : selectedSlotIndex === slotIdx;

              return (
                <div
                  key={slotIdx}
                  className={`rack-slot ${tile ? 'has-tile' : 'empty-slot'} ${draggedSlot === slotIdx ? 'dragging' : ''}`}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, slotIdx)}
                  onClick={() => handleSlotClick(slotIdx)}
                  onDoubleClick={() => handleDoubleClick(slotIdx)}
                >
                  {tile && (
                    <Tile
                      tile={tile}
                      okeyInfo={okeyInfo}
                      selected={isSelected}
                      draggable={true}
                      onDragStart={(e) => handleDragStart(e, slotIdx)}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, slotIdx)}
                      onDragEnd={handleDragEnd}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
