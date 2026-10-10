import { db } from './db'

export const SETTING_KEYS = {
  activeAvatarId: 'activeAvatarId',
  qualityProfile: 'qualityProfile',
} as const

export type SettingKey = (typeof SETTING_KEYS)[keyof typeof SETTING_KEYS]

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const record = await db.settings.get(key)
  return record ? (record.value as T) : fallback
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await db.settings.put({ key, value })
}

export async function getActiveAvatarId(): Promise<number | null> {
  const value = await getSetting<number | null>(SETTING_KEYS.activeAvatarId, null)
  return typeof value === 'number' ? value : null
}

export async function setActiveAvatarId(id: number | null): Promise<void> {
  await setSetting(SETTING_KEYS.activeAvatarId, id)
}

export async function getQualityProfile(): Promise<'full' | 'lite' | null> {
  const value = await getSetting<'full' | 'lite' | null>(SETTING_KEYS.qualityProfile, null)
  return value === 'full' || value === 'lite' ? value : null
}

export async function setQualityProfile(profile: 'full' | 'lite'): Promise<void> {
  await setSetting(SETTING_KEYS.qualityProfile, profile)
}

export interface StorageUsage {
  usage: number
  quota: number
  persisted: boolean
}

export async function getStorageUsage(): Promise<StorageUsage | null> {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return null
  const estimate = await navigator.storage.estimate()
  const persisted = navigator.storage.persisted ? await navigator.storage.persisted() : false
  return {
    usage: estimate.usage ?? 0,
    quota: estimate.quota ?? 0,
    persisted,
  }
}

export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) return false
  try {
    return await navigator.storage.persist()
  } catch {
    return false
  }
}
