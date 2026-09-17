import React, { useState, useEffect } from 'react';
import { Tile } from './Tile.jsx';
import { RuleValidator } from '../../game/RuleValidator.js';
import { sound } from '../../utils/soundEffects.js';
import { Sparkles, CheckCircle, ArrowDownCircle, Trophy, Shuffle, Split } from 'lucide-react';

export const TileRack = ({
  hand = [],
  okeyInfo,
  isMyTurn,
  hasDrawn,
  gameType,
  onDiscard,
  onFinishClassic,
  onOpenRuns101,
  onSelectForProcess,
  selectedTileForProcess
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

  // Sync with incoming hand changes (draws, discards) while keeping user layout
  useEffect(() => {
    setSlots(prevSlots => {
      const currentHandIds = new Set(hand.map(t => t.id));
      const handMap = new Map(hand.map(t => [t.id, t]));
      const newSlots = prevSlots.map(t => (t && currentHandIds.has(t.id) ? handMap.get(t.id) : null));

      // Find tiles in hand not yet placed in slots
      const placedIds = new Set(newSlots.filter(Boolean).map(t => t.id));
      const unplacedTiles = hand.filter(t => !placedIds.has(t.id));

      let unplacedIdx = 0;
      for (let i = 0; i < 30 && unplacedIdx < unplacedTiles.length; i++) {
        if (!newSlots[i]) {
          newSlots[i] = unplacedTiles[unplacedIdx++];
        }
      }

      return newSlots;
    });
  }, [hand]);

  // DRAG & DROP HANDLERS
  const handleDragStart = (e, slotIdx) => {
    if (!slots[slotIdx]) return;
    setDraggedSlot(slotIdx);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', slotIdx.toString());
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, targetSlotIdx) => {
    e.preventDefault();
    if (draggedSlot === null || draggedSlot === targetSlotIdx) return;

    sound.playTileClick();
    setSlots(prev => {
      const copy = [...prev];
      const temp = copy[draggedSlot];
      copy[draggedSlot] = copy[targetSlotIdx];
      copy[targetSlotIdx] = temp;
      return copy;
    });

    setDraggedSlot(null);
    setSelectedSlotIndex(null);
  };

  // CLICK & SWAP / SELECTION HANDLER
  const handleSlotClick = (slotIdx) => {
    const tile = slots[slotIdx];

    if (gameType === '101') {
      // 101 multi-select for per opening
      if (tile) {
        sound.playTileClick();
        if (selectedFor101Ids.includes(tile.id)) {
          setSelectedFor101Ids(selectedFor101Ids.filter(id => id !== tile.id));
        } else {
          setSelectedFor101Ids([...selectedFor101Ids, tile.id]);
        }
        if (onSelectForProcess) onSelectForProcess(tile);
      }
      return;
    }

    // Classic Okey: Click-to-Move or Select for Discard
    if (selectedSlotIndex === null) {
      if (tile) {
        sound.playTileClick();
        setSelectedSlotIndex(slotIdx);
      }
    } else {
      if (selectedSlotIndex === slotIdx) {
        setSelectedSlotIndex(null);
      } else {
        // Move or swap to this slot
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

  // Fast-discard on double click
  const handleDoubleClick = (slotIdx) => {
    const tile = slots[slotIdx];
    if (tile && isMyTurn && hasDrawn) {
      sound.playTileClick();
      onDiscard(tile.id);
      setSelectedSlotIndex(null);
      setSelectedFor101Ids([]);
    }
  };

  // AUTO ARRANGE: RUNS (Seri Diz)
  const handleAutoArrangeRuns = () => {
    sound.playTileClick();
    const arranged = RuleValidator.autoArrangeRuns(hand, okeyInfo);
    const newSlots = Array(30).fill(null);
    arranged.forEach((item, idx) => {
      if (idx < 30) newSlots[idx] = item;
    });
    setSlots(newSlots);
    setSelectedSlotIndex(null);
    setSelectedFor101Ids([]);
  };

  // AUTO ARRANGE: PAIRS (Çift Diz)
  const handleAutoArrangePairs = () => {
    sound.playTileClick();
    const arranged = RuleValidator.autoArrangePairs(hand, okeyInfo);
    const newSlots = Array(30).fill(null);
    arranged.forEach((item, idx) => {
      if (idx < 30) newSlots[idx] = item;
    });
    setSlots(newSlots);
    setSelectedSlotIndex(null);
    setSelectedFor101Ids([]);
  };

  // 101 Selected Details
  const selected101Tiles = hand.filter(t => selectedFor101Ids.includes(t.id));
  const selected101Points = selected101Tiles.reduce((acc, t) => acc + (t.value || 0), 0);

  // Selected tile for discard in Classic
  const selectedTileToDiscard = selectedSlotIndex !== null ? slots[selectedSlotIndex] : null;

  return (
    <div className="user-game-rack-area">
      {/* Rack Control Bar */}
      <div className="rack-control-bar">
        {/* Organization buttons */}
        <div className="rack-actions-group">
          <button
            className="btn-secondary"
            onClick={handleAutoArrangeRuns}
            title="Taşları renk serilerine ve gruplarına göre ıstakaya diz"
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
            {selected101Tiles.length > 0 && (
              <span style={{ fontSize: '0.85rem', color: '#e5b94c', alignSelf: 'center', fontWeight: 700 }}>
                Seçilen: {selected101Tiles.length} Taş ({selected101Points} Puan)
              </span>
            )}
            <button
              className="btn-primary"
              disabled={!isMyTurn || !hasDrawn || selected101Tiles.length < 3}
              style={{ opacity: (!isMyTurn || !hasDrawn || selected101Tiles.length < 3) ? 0.4 : 1 }}
              onClick={() => {
                if (onOpenRuns101) {
                  onOpenRuns101([selected101Tiles]);
                  setSelectedFor101Ids([]);
                }
              }}
            >
              <CheckCircle size={15} style={{ marginRight: 4 }} />
              Per Aç ({selected101Points} Puan)
            </button>
          </div>
        )}

        {/* Turn Action Buttons */}
        <div className="rack-actions-group">
          {isMyTurn && hasDrawn && selectedTileToDiscard && (
            <>
              <button
                className="btn-secondary"
                style={{ borderColor: '#ef4444', color: '#f87171', fontWeight: 700 }}
                onClick={() => {
                  onDiscard(selectedTileToDiscard.id);
                  setSelectedSlotIndex(null);
                }}
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
            <span style={{ color: '#38ef7d', fontWeight: 800, fontSize: '0.9rem', animation: 'pulseAura 1.5s infinite' }}>
              👉 Ortadan veya Yandan Taş Çekiniz!
            </span>
          )}

          {isMyTurn && hasDrawn && !selectedTileToDiscard && gameType === 'classic' && (
            <span style={{ color: '#e5b94c', fontWeight: 700, fontSize: '0.85rem' }}>
              Atacağınız veya bitireceğiniz taşa tıklayın
            </span>
          )}
        </div>
      </div>

      {/* Realistic 2-Row Wooden Istaka (Slot-Based) */}
      <div className="wood-istaka">
        {/* Row 1 (Slots 0 to 14) */}
        <div className="istaka-row">
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
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Row 2 (Slots 15 to 29) */}
        <div className="istaka-row">
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
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
