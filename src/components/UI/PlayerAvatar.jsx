import React from 'react';
import { AVAILABLE_AVATARS } from '../../utils/authService.js';
import { Bot } from 'lucide-react';

export const PlayerAvatar = ({
  avatar,
  isBot = false,
  name = 'Oyuncu',
  size = 36,
  className = '',
  style = {}
}) => {
  // Check if avatar is custom base64 image or URL
  const isImageAvatar = typeof avatar === 'string' && (
    avatar.startsWith('data:image/') ||
    avatar.startsWith('http://') ||
    avatar.startsWith('https://') ||
    avatar.startsWith('blob:')
  );

  const containerStyle = {
    width: size,
    height: size,
    minWidth: size,
    minHeight: size,
    fontSize: `${Math.max(12, Math.round(size * 0.42))}px`,
    ...style
  };

  if (isImageAvatar) {
    return (
      <div className={`player-avatar-wrapper is-image ${className}`} style={containerStyle}>
        <img
          src={avatar}
          alt={name}
          className="avatar-img-round"
          loading="lazy"
        />
      </div>
    );
  }

  if (isBot) {
    return (
      <div className={`player-avatar-wrapper is-bot ${className}`} style={containerStyle}>
        <Bot size={Math.max(14, Math.round(size * 0.52))} />
      </div>
    );
  }

  // Check if it's one of the predefined IDs (e.g. 'crown', 'fire', 'dice')
  const preset = AVAILABLE_AVATARS.find(a => a.id === avatar);
  if (preset) {
    return (
      <div
        className={`player-avatar-wrapper is-preset ${className}`}
        style={{ ...containerStyle, borderColor: preset.color || 'var(--gold-accent)' }}
        title={preset.label}
      >
        <span className="avatar-emoji-text">{preset.icon}</span>
      </div>
    );
  }

  // If avatar is directly an emoji character or fallback to first letter
  const isDirectEmoji = typeof avatar === 'string' && avatar.length <= 4 && /\p{Extended_Pictographic}/u.test(avatar);
  const displayText = isDirectEmoji ? avatar : (name ? name.charAt(0).toUpperCase() : '?');

  return (
    <div className={`player-avatar-wrapper is-fallback ${className}`} style={containerStyle}>
      <span className={isDirectEmoji ? 'avatar-emoji-text' : 'avatar-initial-text'}>
        {displayText}
      </span>
    </div>
  );
};
