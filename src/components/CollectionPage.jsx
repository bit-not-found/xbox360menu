import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'

const hoverAudio = new Audio('./assets/audio/hover.mp3')
const backAudio = new Audio('./assets/audio/Back.mp3')
const selectAudio = new Audio('./assets/audio/Select.mp3')

const playHover = () => { hoverAudio.currentTime = 0; hoverAudio.play().catch(() => {}) }
const playBack = () => { backAudio.currentTime = 0; backAudio.play().catch(() => {}) }
const playSelect = () => { selectAudio.currentTime = 0; selectAudio.play().catch(() => {}) }

export default function CollectionPage({
  title,
  items = [],
  onClose,
  onItemAction,
  showPinButton = false,
  onPin,
  filters,
  emptyMessage = 'No items to show here.',
  renderItem,
  isActive = true,
}) {
  const [isClosing, setIsClosing] = useState(false)
  const [filterIndex, setFilterIndex] = useState(0)
  const [sortIndex, setSortIndex] = useState(0)

  const filterOptions = filters?.map(f => f.label) || ['all']
  const sortOptions = ['titles', 'recent', 'a-z']

  // Close when parent page becomes inactive (Guide navigation)
  useEffect(() => {
    if (!isActive && !isClosing) {
      setIsClosing(true)
      const t = setTimeout(() => onClose(), 300)
      return () => clearTimeout(t)
    }
  }, [isActive])

  const handleClose = () => {
    playBack()
    setIsClosing(true)
    setTimeout(() => onClose(), 300)
  }

  const handleItemAction = (item) => {
    playSelect()
    if (onItemAction) onItemAction(item)
  }

  const handlePin = (item, e) => {
    e.stopPropagation()
    playSelect()
    if (onPin) onPin(item)
  }

  return createPortal(
    <div className={`collection-overlay ${isClosing ? 'closing' : ''}`} onClick={handleClose}>
      <div className="collection-container" onClick={e => e.stopPropagation()}>
        {/* Top bar */}
        <div className="collection-topbar">
          <div className="collection-filters">
            {filterOptions.map((opt, i) => (
              <div key={i} className="collection-filter">
                <span className="collection-filter-arrow">▾</span>
                <select
                  className="collection-filter-select"
                  value={i === 0 ? filterIndex : sortIndex}
                  onChange={(e) => i === 0 ? setFilterIndex(Number(e.target.value)) : setSortIndex(Number(e.target.value))}
                >
                  <option value={i}>{opt}</option>
                </select>
              </div>
            ))}
            <div className="collection-filter">
              <span className="collection-filter-arrow">▾</span>
              <select
                className="collection-filter-select"
                value={sortIndex}
                onChange={(e) => setSortIndex(Number(e.target.value))}
              >
                {sortOptions.map((opt, i) => (
                  <option key={i} value={i}>{opt}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="collection-title-area">
            <h2 className="collection-title">{title}</h2>
            <span className="collection-count">{items.length} of {items.length}</span>
          </div>
          <button className="collection-close" onClick={handleClose}>✕</button>
        </div>

        {/* Card row */}
        <div className="collection-cards-row">
          {items.length === 0 ? (
            <div className="collection-empty">{emptyMessage}</div>
          ) : (
            items.map((item, i) => (
              <div
                key={item.id || item.name || i}
                className="collection-card"
                onMouseEnter={playHover}
                onClick={() => handleItemAction(item)}
              >
                <div className="collection-card-img">
                  {renderItem ? renderItem(item) : (
                    item.icon ? <img src={item.icon} alt={item.name} /> : <div className="collection-card-placeholder" />
                  )}
                </div>
                <div className="collection-card-bottom">
                  <span className="collection-card-name">{item.name || ''}</span>
                  {showPinButton && (
                    <button
                      className="collection-card-pin"
                      onClick={(e) => handlePin(item, e)}
                      title={item.isPinned ? 'Unpin' : 'Pin'}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
