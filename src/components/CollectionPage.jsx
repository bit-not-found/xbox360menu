import { useState, useEffect, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'

const hoverAudio = new Audio('./assets/audio/hover.mp3')
const backAudio = new Audio('./assets/audio/Back.mp3')
const selectAudio = new Audio('./assets/audio/Select.mp3')

const playHover = () => { hoverAudio.currentTime = 0; hoverAudio.play().catch(() => {}) }
const playBack = () => { backAudio.currentTime = 0; backAudio.play().catch(() => {}) }
const playSelect = () => { selectAudio.currentTime = 0; selectAudio.play().catch(() => {}) }

const CATEGORY_CHIPS = [
  { id: 'all', label: 'All' },
  { id: 'clips', label: 'Clips' },
  { id: 'screenshots', label: 'Screenshots' },
  { id: 'favorites', label: 'Favorites' },
  { id: 'local', label: 'Local' },
]

const DATE_RANGES = [
  { id: 'all', label: 'All time' },
  { id: '7d', label: 'Last 7 days' },
  { id: '30d', label: 'Last 30 days' },
  { id: '90d', label: 'Last 90 days' },
]

const SORT_OPTIONS = [
  { id: 'newest', label: 'Newest first' },
  { id: 'oldest', label: 'Oldest first' },
  { id: 'largest', label: 'Largest file' },
  { id: 'name', label: 'Name A-Z' },
]

function loadFavorites() {
  try {
    return JSON.parse(localStorage.getItem('winx360_favorites') || '[]')
  } catch { return [] }
}

function saveFavorites(ids) {
  try { localStorage.setItem('winx360_favorites', JSON.stringify(ids)) } catch { /* noop */ }
}

export default function CollectionPage({
  title,
  items = [],
  onClose,
  onItemAction,
  showPinButton = false,
  onPin,
  emptyMessage = 'No items to show here.',
  renderItem,
  isActive = true,
}) {
  const [isClosing, setIsClosing] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [gameFilter, setGameFilter] = useState('')
  const [dateRange, setDateRange] = useState('all')
  const [sortBy, setSortBy] = useState('newest')
  const [favorites, setFavorites] = useState(() => new Set(loadFavorites()))

  // Persist favorites
  useEffect(() => { saveFavorites([...favorites]) }, [favorites])

  const toggleFavorite = useCallback((itemId, e) => {
    e.stopPropagation()
    playSelect()
    setFavorites(prev => {
      const next = new Set(prev)
      if (next.has(itemId)) next.delete(itemId)
      else next.add(itemId)
      return next
    })
  }, [])

  // Derive unique game names from items
  const games = useMemo(() => {
    const set = new Set()
    items.forEach(item => {
      if (item.game) set.add(item.game)
      else {
        const match = item.name?.match(/^(.+?)(?:\s*[-–]\s*|\s*\(|\s*_|\s*\.)/)
        if (match) set.add(match[1].trim())
      }
    })
    return [...set].sort()
  }, [items])

  // Compute counts for each category
  const counts = useMemo(() => ({
    all: items.length,
    clips: items.filter(i => i.isVideo).length,
    screenshots: items.filter(i => i.isImage).length,
    favorites: items.filter(i => favorites.has(i.id)).length,
    local: items.filter(i => i.source !== 'xbox').length,
  }), [items, favorites])

  // Stable timestamp for date filtering
  const [now] = useState(() => Date.now())

  // Compute date cutoff
  const dateCutoff = dateRange === 'all' ? 0 : now - ({ '7d': 7, '30d': 30, '90d': 90 }[dateRange] || 0) * 86400000

  // Apply all filters
  const filteredItems = useMemo(() => {
    let result = [...items]

    // Category filter
    switch (categoryFilter) {
      case 'clips':
        result = result.filter(i => i.isVideo)
        break
      case 'screenshots':
        result = result.filter(i => i.isImage)
        break
      case 'favorites':
        result = result.filter(i => favorites.has(i.id))
        break
      case 'local':
        result = result.filter(i => i.source !== 'xbox')
        break
    }

    // Game filter
    if (gameFilter) {
      result = result.filter(i => {
        const name = i.game || i.name || ''
        return name.toLowerCase().includes(gameFilter.toLowerCase())
      })
    }

    // Date range filter
    if (dateCutoff) {
      result = result.filter(i => i.mtime && i.mtime >= dateCutoff)
    }

    // Sort
    switch (sortBy) {
      case 'newest':
        result.sort((a, b) => (b.mtime || 0) - (a.mtime || 0))
        break
      case 'oldest':
        result.sort((a, b) => (a.mtime || 0) - (b.mtime || 0))
        break
      case 'largest':
        result.sort((a, b) => (b.size || 0) - (a.size || 0))
        break
      case 'name':
        result.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
        break
    }

    return result
  }, [items, categoryFilter, gameFilter, dateCutoff, sortBy, favorites])

  // Close when parent page becomes inactive
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
            {/* Primary filter chips */}
            <div className="collection-chips">
              {CATEGORY_CHIPS.map(chip => (
                <button
                  key={chip.id}
                  className={`collection-chip ${categoryFilter === chip.id ? 'active' : ''}`}
                  onClick={() => { playSelect(); setCategoryFilter(chip.id) }}
                >
                  {chip.label}
                  <span className="collection-chip-count">{counts[chip.id]}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="collection-title-area">
            <h2 className="collection-title">{title}</h2>
            <span className="collection-count">{filteredItems.length} of {items.length}</span>
          </div>
          <button className="collection-close" onClick={handleClose}>✕</button>
        </div>

        {/* Secondary filters row */}
        <div className="collection-secondary-filters">
          <div className="collection-dropdown-group">
            <label className="collection-dropdown-label">Game</label>
            <select
              className="collection-dropdown"
              value={gameFilter}
              onChange={(e) => setGameFilter(e.target.value)}
            >
              <option value="">All games</option>
              {games.map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>

          <div className="collection-dropdown-group">
            <label className="collection-dropdown-label">Date</label>
            <select
              className="collection-dropdown"
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
            >
              {DATE_RANGES.map(r => (
                <option key={r.id} value={r.id}>{r.label}</option>
              ))}
            </select>
          </div>

          <div className="collection-dropdown-group">
            <label className="collection-dropdown-label">Sort by</label>
            <select
              className="collection-dropdown"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              {SORT_OPTIONS.map(s => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Card row */}
        <div className="collection-cards-row">
          {filteredItems.length === 0 ? (
            <div className="collection-empty">{items.length === 0 ? emptyMessage : 'No items match the current filters.'}</div>
          ) : (
            filteredItems.map((item, i) => (
              <div
                key={item.id || item.name || i}
                className="collection-card"
                onMouseEnter={playHover}
                onClick={() => handleItemAction(item)}
              >
                <div className="collection-card-img">
                  {renderItem ? renderItem(item) : (
                    item.icon ? <img src={item.icon} alt={item.name} decoding="async" loading="lazy" /> : <div className="collection-card-placeholder" />
                  )}
                  <button
                    className={`collection-card-fav ${favorites.has(item.id) ? 'active' : ''}`}
                    onClick={(e) => toggleFavorite(item.id, e)}
                    title={favorites.has(item.id) ? 'Remove from favorites' : 'Add to favorites'}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill={favorites.has(item.id) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                    </svg>
                  </button>
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
