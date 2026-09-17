import React, { useState } from 'react';
import { Tile } from './Tile.jsx';
import { sound } from '../../utils/soundEffects.js';
import { Layers, Sparkles, CheckCircle, ArrowDownCircle, Trophy } from 'lucide-react';

export const TileRack = ({
  hand = [],
  okeyInfo,
  isMyTurn,
  hasDrawn,
  gameType,
  onDiscard,
  onFinishClassic,
  onOpenRuns101,
  onOpenPairs101,
  onSelectForProcess,
  selectedTileForProcess
}) => {
  // We keep rack tiles in state for local reordering (2 rows: row 0 and row 1)
  const [selectedIds, setSelectedIds] = useState([]);
  const [draggedIndex, setDraggedIndex] = useState(null);

  // Handle tile click
  const handleTileClick = (tile, index) => {
    sound.playTileClick();

    if (gameType === '101') {
      // Toggle selection for forming pers or processing
      if (selectedIds.includes(tile.id)) {
        setSelectedIds(selectedIds.filter(id => id !== tile.id));
      } else {
        setSelectedIds([...selectedIds, tile.id]);
      }
    } else {
      // In classic mode, select single tile for discard or finish
      if (selectedIds.includes(tile.id)) {
        setSelectedIds([]);
      } else {
        setSelectedIds([tile.id]);
      }
    }

    if (onSelectForProcess) {
      onSelectForProcess(tile);
    }
  };

  // Double click to fast-discard if it's player's turn and has drawn
  const handleTileDoubleClick = (tile) => {
    if (isMyTurn && hasDrawn) {
      sound.playTileClick();
      onDiscard(tile.id);
      setSelectedIds([]);
    }
  };

  // Auto arrange: Runs
  const handleAutoArrangeRuns = () => {
    sound.playTileClick();
    if (!hand) return;
    const sorted = [...hand].sort((a, b) => {
      if (a.color === b.color) return a.value - b.value;
      return a.color.localeCompare(b.color);
    });
    // Trigger callback or reorder
    setSelectedIds([]);
  };

  // Selected tiles details for 101
  const selectedTiles = hand.filter(t => selectedIds.includes(t.id));
  const selectedPoints = selectedTiles.reduce((acc, t) => acc + (t.value || 0), 0);

  // Split tiles into two rows (top and bottom row of the wood rack)
  const half = Math.ceil(hand.length / 2);
  const row1 = hand.slice(0, half);
  const row2 = hand.slice(half);

  return (
    <div className="user-game-rack-area">
      {/* Rack Action Bar */}
      <div className="rack-control-bar">
        <div className="rack-actions-group">
          <button
            className="btn-secondary"
            onClick={handleAutoArrangeRuns}
            title="Taşları renklere ve serilere göre düzenle"
          >
            <Sparkles size={14} style={{ marginRight: 4 }} />
            Seri Diz
          </button>
        </div>

        {/* 101 Okey Action Buttons */}
        {gameType === '101' && (
          <div className="rack-actions-group">
            {selectedTiles.length > 0 && (
              <span style={{ fontSize: '0.85rem', color: '#e5b94c', alignSelf: 'center', fontWeight: 600 }}>
                Seçilen: {selectedTiles.length} Taş ({selectedPoints} Puan)
              </span>
            )}
            <button
              className="btn-primary"
              disabled={!isMyTurn || !hasDrawn || selectedTiles.length < 3}
              style={{ opacity: (!isMyTurn || !hasDrawn || selectedTiles.length < 3) ? 0.5 : 1 }}
              onClick={() => {
                if (onOpenRuns101) {
                  onOpenRuns101([selectedTiles]);
                  setSelectedIds([]);
                }
              }}
            >
              <CheckCircle size={15} style={{ marginRight: 4 }} />
              Per Aç ({selectedPoints} Puan)
            </button>
          </div>
        )}

        {/* Turn & Discard Actions */}
        <div className="rack-actions-group">
          {isMyTurn && hasDrawn && selectedIds.length === 1 && (
            <>
              <button
                className="btn-secondary"
                style={{ borderColor: '#ef4444', color: '#f87171' }}
                onClick={() => {
                  onDiscard(selectedIds[0]);
                  setSelectedIds([]);
                }}
              >
                <ArrowDownCircle size={15} style={{ marginRight: 4 }} />
                Taşı At
              </button>

              {gameType === 'classic' && (
                <button
                  className="btn-primary"
                  onClick={() => {
                    onFinishClassic(selectedIds[0]);
                    setSelectedIds([]);
                  }}
                >
                  <Trophy size={15} style={{ marginRight: 4 }} />
                  Bitiş Yap (Okey Bit)
                </button>
              )}
            </>
          )}

          {isMyTurn && !hasDrawn && (
            <span style={{ color: '#38ef7d', fontWeight: 700, fontSize: '0.9rem', animation: 'pulseAura 1.5s infinite' }}>
              👉 Ortadan veya Yandan Taş Çekiniz!
            </span>
          )}
        </div>
      </div>

      {/* Wooden Istaka Container */}
      <div className="wood-istaka">
        {/* Top Row */}
        <div className="istaka-row">
          {row1.map((tile, idx) => (
            <Tile
              key={tile.id || idx}
              tile={tile}
              okeyInfo={okeyInfo}
              selected={selectedIds.includes(tile.id)}
              onClick={() => handleTileClick(tile, idx)}
              onDoubleClick={() => handleTileDoubleClick(tile)}
            />
          ))}
        </div>

        {/* Bottom Row */}
        <div className="istaka-row">
          {row2.map((tile, idx) => (
            <Tile
              key={tile.id || (half + idx)}
              tile={tile}
              okeyInfo={okeyInfo}
              selected={selectedIds.includes(tile.id)}
              onClick={() => handleTileClick(tile, half + idx)}
              onDoubleClick={() => handleTileDoubleClick(tile)}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
