export const PLACEHOLDER_ART = './assets/imgs/260x195-PLACEHOLDER.png'

// Swaps in the local placeholder once so broken artwork never leaves an empty tile.
export function handleArtworkError(e) {
  const el = e.currentTarget
  if (el.dataset.fallback) return
  el.dataset.fallback = '1'
  el.src = PLACEHOLDER_ART
}