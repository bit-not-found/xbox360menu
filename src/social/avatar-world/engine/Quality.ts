export type QualityProfile = 'full' | 'lite'
export type QualityTier = 'high' | 'low'

export interface QualitySettings {
  profile: QualityProfile
  tier: QualityTier
  pixelRatio: number
  shadows: boolean
  antialias: boolean
  maxTextureSize: number
}

interface NavigatorWithMemory extends Navigator {
  deviceMemory?: number
}

function prefersReducedTier(): boolean {
  if (typeof navigator === 'undefined') return false
  const nav = navigator as NavigatorWithMemory
  const ua = nav.userAgent || ''
  const isMobile = /android|iphone|ipad|ipod|mobile|silk/i.test(ua)
  const cores = nav.hardwareConcurrency ?? 8
  const memory = nav.deviceMemory ?? 8
  return isMobile || cores <= 4 || memory <= 4
}

export function resolveQuality(profile?: QualityProfile): QualitySettings {
  const tier: QualityTier = profile === 'lite' || prefersReducedTier() ? 'low' : 'high'
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1

  if (tier === 'low' || profile === 'lite') {
    return {
      profile: 'lite',
      tier: 'low',
      pixelRatio: Math.min(dpr, 1.5),
      shadows: false,
      antialias: false,
      maxTextureSize: 1024,
    }
  }

  return {
    profile: 'full',
    tier: 'high',
    pixelRatio: Math.min(dpr, 2),
    shadows: true,
    antialias: true,
    maxTextureSize: 2048,
  }
}
