import { useSyncExternalStore } from 'react'

const STORAGE_KEY = 'winx360_recents'
const MAX_ENTRIES = 20

function readEntries() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    if (!Array.isArray(raw)) return []
    return raw
      .map(entry => {
        if (entry && typeof entry.id === 'string' && typeof entry.kind === 'string') {
          return { id: entry.id, kind: entry.kind, at: entry.at || 0 }
        }
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

function subscribeRecents(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getRecentsSnapshot() {
  return snapshot
}

export function useRecents() {
  return useSyncExternalStore(subscribeRecents, getRecentsSnapshot, getRecentsSnapshot)
}

// Record an item as just opened: newest first, deduped by kind + id.
export function pushRecent(id, kind) {
  if (!id || !kind) return
  entries = [{ id, kind, at: Date.now() }, ...entries.filter(e => !(e.id === id && e.kind === kind))]
  if (entries.length > MAX_ENTRIES) entries = entries.slice(0, MAX_ENTRIES)
  write()
  emit()
}
