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
  onDragEnd,
  isUseful = false,
}) => {
  if (!tile) return null;

  const isWildOkey =
    okeyInfo &&
    !tile.isFakeJoker &&
    tile.color === okeyInfo.color &&
    tile.value === okeyInfo.value;

  const colorClass = tile.isFakeJoker ? 'tile-none' : `tile-${tile.color || 'none'}`;

  return (
    <div
      className={`tile-item ${colorClass} ${selected ? 'selected' : ''} ${mini ? 'mini' : ''} ${isUseful ? 'is-useful' : ''} ${isWildOkey ? 'is-wild-okey' : ''} ${className}`}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      title={tile.isFakeJoker ? 'Sahte Okey (Joker ★)' : isWildOkey ? 'Okey (Joker)' : `${tile.color} ${tile.value}`}
    >
      {/* Wildcard Okey Badge */}
      {isWildOkey && <span className="okey-wildcard-badge" style={{ pointerEvents: 'none' }}>OKEY</span>}

      {/* Sahte Okey: Yıldız göster */}
      {tile.isFakeJoker ? (
        <div style={{ textAlign: 'center', pointerEvents: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <span className="fake-joker-star">★</span>
          <span className="fake-joker-label">SAHTE</span>
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
