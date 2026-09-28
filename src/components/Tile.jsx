import React from 'react';
import { playHoverSound } from '../navigation/hoverSound';

const selectAudio = new Audio('./assets/audio/Select.mp3');

export default function Tile({ size, icon, label, className = '', style, children, onClick, onContextMenu, disabled = false }) {
  const handleMouseEnter = () => {
    if (disabled) return;
    playHoverSound();
  };

  const handleClick = () => {
    if (disabled) return;
    selectAudio.currentTime = 0;
    selectAudio.play().catch(() => { });
    if (onClick) onClick();
  };

  return (
    <div
      className={`tile ${size || ''} ${className} ${disabled ? 'tile-disabled' : ''}`}
      style={style}
      onMouseEnter={handleMouseEnter}
      onClick={handleClick}
      onContextMenu={onContextMenu}
    >
      {icon && <div className="tile-icon">{icon}</div>}
      {label && <div className="tile-label">{label}</div>}
      {children}
    </div>
  )
}


