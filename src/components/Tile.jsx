import { playHoverSound } from '../navigation/hoverSound';

const selectAudio = new Audio('./assets/audio/Select.mp3');

export default function Tile({ size, icon, label, className = '', style, children, onClick, onContextMenu, onMouseEnter, onMouseLeave, disabled = false }) {
  const handleMouseEnter = (e) => {
    if (disabled) return;
    playHoverSound();
    if (onMouseEnter) onMouseEnter(e);
  };

  const handleMouseLeave = (e) => {
    if (disabled) return;
    if (onMouseLeave) onMouseLeave(e);
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
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      onContextMenu={onContextMenu}
    >
      {icon && <div className="tile-icon">{icon}</div>}
      {label && <div className="tile-label">{label}</div>}
      {children}
    </div>
  )
}


