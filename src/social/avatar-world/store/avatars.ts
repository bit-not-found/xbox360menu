import { db, type AvatarRecord } from './db'
import { getActiveAvatarId, setActiveAvatarId } from './settings'

export interface SaveAvatarInput {
  name: string
  blob: Blob
  thumbnail?: Blob
  profile?: string
}

export interface SaveAvatarResult {
  record: AvatarRecord
  deduped: boolean
}

export async function hashBlob(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer()
  const digest = await crypto.subtle.digest('SHA-256', buffer)
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export async function listAvatars(): Promise<AvatarRecord[]> {
  return db.avatars.orderBy('createdAt').reverse().toArray()
}

export async function getAvatar(id: number): Promise<AvatarRecord | undefined> {
  return db.avatars.get(id)
}

export async function findAvatarByHash(hash: string): Promise<AvatarRecord | undefined> {
  return db.avatars.where('hash').equals(hash).first()
}

export async function saveAvatar(input: SaveAvatarInput): Promise<SaveAvatarResult> {
  const hash = await hashBlob(input.blob)
  const existing = await findAvatarByHash(hash)
  if (existing) {
    if (input.name && input.name !== existing.name) {
      await db.avatars.update(existing.id, { name: input.name })
      existing.name = input.name
    }
    return { record: existing, deduped: true }
  }

  const id = await db.avatars.add({
    name: input.name || 'My Avatar',
    hash,
    size: input.blob.size,
    createdAt: Date.now(),
    profile: input.profile ?? 'full',
    blob: input.blob,
    thumbnail: input.thumbnail,
  })
  const record = await db.avatars.get(id)
  if (!record) throw new Error('Failed to save avatar.')
  return { record, deduped: false }
}

export async function renameAvatar(id: number, name: string): Promise<void> {
  await db.avatars.update(id, { name })
}

export async function deleteAvatar(id: number): Promise<void> {
  await db.avatars.delete(id)
  const active = await getActiveAvatarId()
  if (active === id) await setActiveAvatarId(null)
}

export async function setActiveAvatar(id: number | null): Promise<void> {
  await setActiveAvatarId(id)
}

export async function getActiveAvatar(): Promise<AvatarRecord | undefined> {
  const id = await getActiveAvatarId()
  if (id === null) return undefined
  const record = await db.avatars.get(id)
  if (!record) {
    await setActiveAvatarId(null)
    return undefined
  }
  return record
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  return `${value.toFixed(value >= 10 || unit <= 1 ? 0 : 1)} ${units[unit]}`
}
