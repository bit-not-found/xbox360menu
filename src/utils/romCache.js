const DB_NAME = 'WinX360ROMs'
const DB_VERSION = 1
const STORE_NAME = 'roms'

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
    request.onupgradeneeded = (event) => {
      const db = event.target.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'name' })
      }
    }
  })
}

export async function saveRomFile(name, file) {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put({ name, file })
  } catch (e) {
    console.warn('Failed to cache ROM in IndexedDB:', e)
  }
}

export async function loadAllRomFiles() {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readonly')
    const request = tx.objectStore(STORE_NAME).getAll()
    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const map = new Map()
        for (const entry of request.result) {
          map.set(entry.name, entry.file)
        }
        resolve(map)
      }
      request.onerror = () => reject(request.error)
    })
  } catch (e) {
    console.warn('Failed to load ROM cache from IndexedDB:', e)
    return new Map()
  }
}

export async function clearRomFiles() {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).clear()
  } catch (e) {
    console.warn('Failed to clear ROM cache:', e)
  }
}
