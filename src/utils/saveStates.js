const DB_NAME = 'WinX360SaveStates'
const DB_VERSION = 1
const STORE_NAME = 'states'

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
    request.onupgradeneeded = (event) => {
      const db = event.target.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }
  })
}

function toPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

// RetroArch keeps a single implicit state slot per game, so saving overwrites
// the previous state for that ROM - matching F2/F4 quicksave semantics.
export async function saveGameState(id, { label, core, state, thumbnail }) {
  if (!id || !state) return null
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const record = {
      id,
      label: label || '',
      core: core || '',
      state,
      thumbnail: thumbnail || null,
      savedAt: Date.now(),
      size: state.size || 0,
    }
    tx.objectStore(STORE_NAME).put(record)
    await txDone(tx)
    return { savedAt: record.savedAt, size: record.size }
  } catch (e) {
    console.warn('Failed to save game state to IndexedDB:', e)
    return null
  }
}

export async function loadGameState(id) {
  if (!id) return null
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readonly')
    const record = await toPromise(tx.objectStore(STORE_NAME).get(id))
    return record || null
  } catch (e) {
    console.warn('Failed to load game state from IndexedDB:', e)
    return null
  }
}

// Uses getKey so the (potentially large) state blob is never read just to
// decide whether the Load button should be enabled.
export async function hasGameState(id) {
  if (!id) return false
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readonly')
    const key = await toPromise(tx.objectStore(STORE_NAME).getKey(id))
    return key !== undefined
  } catch (e) {
    console.warn('Failed to check game state in IndexedDB:', e)
    return false
  }
}
