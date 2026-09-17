import React from 'react';

export const Tile = ({
  tile,
  okeyInfo,
  selected = false,
  onClick,
  onDoubleClick,
  mini = false,
  className = '',
  draggable = false,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd
}) => {
  if (!tile) return null;

  const isWildOkey =
    okeyInfo &&
    !tile.isFakeJoker &&
    tile.color === okeyInfo.color &&
    tile.value === okeyInfo.value;

  const colorClass = `tile-${tile.color || 'none'}`;

  return (
    <div
      className={`tile-item ${colorClass} ${selected ? 'selected' : ''} ${mini ? 'mini' : ''} ${className}`}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      title={isWildOkey ? 'Okey (Joker)' : `${tile.color} ${tile.value}`}
    >
      {/* Wildcard Okey Star Badge */}
      {isWildOkey && <span className="okey-wildcard-star" style={{ pointerEvents: 'none' }}>★</span>}

      {/* Sahte Okey Badge */}
      {tile.isFakeJoker ? (
        <div className="fake-joker-container" style={{ textAlign: 'center', pointerEvents: 'none' }}>
          <div className="tile-number">{tile.value}</div>
          <div style={{ fontSize: mini ? '7px' : '9px', fontWeight: 700, color: 'inherit', opacity: 0.85 }}>
            SAHTE
          </div>
        </div>
      ) : (
        <div style={{ pointerEvents: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <span className="tile-number">{tile.value}</span>
          <span className="tile-dot"></span>
        </div>
      )}
    </div>
  );
};
