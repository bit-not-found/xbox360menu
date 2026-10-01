import { useSyncExternalStore } from 'react'

const STORAGE_KEY = 'winx360_favorites'

function readEntries() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    if (!Array.isArray(raw)) return []
    return raw
      .map(entry => {
        if (typeof entry === 'string') return { id: entry, at: 0 }
        if (entry && typeof entry.id === 'string') return { id: entry.id, at: entry.at || 0 }
        return null
      })
      .filter(Boolean)
  } catch {
    return []
  }
}

let entries = readEntries()
let snapshot = entries
const listeners = new Set()

function write() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(entries)) } catch { /* noop */ }
}

function emit() {
  snapshot = [...entries]
  listeners.forEach(listener => listener())
}

export function subscribeFavorites(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getFavorites() {
  return snapshot
}

export function useFavorites() {
  return useSyncExternalStore(subscribeFavorites, getFavorites, getFavorites)
}

export function isFavorite(id) {
  return entries.some(entry => entry.id === id)
}

export function favoriteTimestamp(id) {
  const found = entries.find(entry => entry.id === id)
  return found ? found.at : 0
}

export function setFavorite(id, favorite) {
  if (!id) return
  const already = isFavorite(id)
  if (favorite === already) return
  entries = favorite ? [...entries, { id, at: Date.now() }] : entries.filter(entry => entry.id !== id)
  write()
  emit()
}

export function toggleFavorite(id) {
  setFavorite(id, !isFavorite(id))
}