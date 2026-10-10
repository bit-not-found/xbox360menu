import Dexie, { type EntityTable } from 'dexie'

export interface AvatarRecord {
  id: number
  name: string
  hash: string
  size: number
  createdAt: number
  profile: string
  blob: Blob
  thumbnail?: Blob
}

export interface SettingRecord {
  key: string
  value: unknown
}

export class AvatarWorldDB extends Dexie {
  avatars!: EntityTable<AvatarRecord, 'id'>
  settings!: EntityTable<SettingRecord, 'key'>

  constructor() {
    super('winx360-avatar-world')
    this.version(1).stores({
      avatars: '++id, name, hash, createdAt',
      settings: 'key',
    })
  }
}

export const db = new AvatarWorldDB()
