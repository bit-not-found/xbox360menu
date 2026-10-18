import type { ClipDef } from './types'

export type { ClipCategory, ClipDef } from './types'

const BASE = import.meta.env.BASE_URL || '/'
/** Clips already shipped with the app. */
const SHIPPED = `${BASE}assets/avatar/animations/`
/** VRM-Assets-Pack-For-Silly-Tavern — portable VRMA conversions (any humanoid VRM). */
const PACK_VRMA = `${SHIPPED}VRM-Assets-Pack-For-Silly-Tavern-main/animation_nitral-fork/`
/** Pack BVH motions on a VRM-humanoid-named rig; retargeted at load by BvhMotion.ts. */
const PACK_BVH = `${SHIPPED}VRM-Assets-Pack-For-Silly-Tavern-main/animation/`

/**
 * Manifest of every known clip. The avatar's resting state cycles the idle
 * pool (never the legacy T-pose idle.vrma — that lives in idle-fallback as an
 * emergency last resort only). Add a line here when new files arrive and the
 * smart picker starts using them with no other changes.
 */
export const CLIP_MANIFEST: readonly ClipDef[] = [
  // Resting rotation — pack poses/motions plus standing BVH idles.
  { name: 'motion-pose', url: `${PACK_VRMA}motion_pose.vrma`, category: 'idle', weight: 1.2 },
  { name: 'model-pose', url: `${SHIPPED}ModelPose.vrma`, category: 'idle', weight: 1.1 },
  { name: 'bvh-neutral', url: `${PACK_BVH}neutral.bvh`, category: 'idle', weight: 1 },
  { name: 'bvh-optimism', url: `${PACK_BVH}optimism.bvh`, category: 'idle', weight: 0.8 },

  // Last resort only (legacy clip — looks like a T-pose; avoid putting in play).
  { name: 'legacy-idle', url: `${SHIPPED}idle.vrma`, category: 'idle-fallback', weight: 1 },

  // Greetings — wave on Avatar-tile focus.
  { name: 'greeting', url: `${SHIPPED}Greeting.vrma`, category: 'greeting', weight: 1 },
  { name: 'hello', url: `${PACK_VRMA}hello.vrma`, category: 'greeting', weight: 1 },
  { name: 'greeting2', url: `${PACK_VRMA}greeting2.vrma`, category: 'greeting', weight: 1 },

  // Celebrate — click on the Avatar tile.
  { name: 'spin', url: `${SHIPPED}Spin.vrma`, category: 'excited', weight: 1 },
  { name: 'bvh-excitement', url: `${PACK_BVH}excitement.bvh`, category: 'excited', weight: 1 },

  // Random fidgets — gestures + standing emotion motions from the pack.
  { name: 'peace', url: `${SHIPPED}PeaceSign.vrma`, category: 'fidget', weight: 1.2 },
  { name: 'shoot', url: `${SHIPPED}Shoot.vrma`, category: 'fidget', weight: 0.9 },
  { name: 'squat', url: `${SHIPPED}Squat.vrma`, category: 'fidget', weight: 0.9 },
  { name: 'show-body', url: `${SHIPPED}ShowFullBody.vrma`, category: 'fidget', weight: 0.8 },
  { name: 'bvh-joy', url: `${PACK_BVH}joy.bvh`, category: 'fidget', weight: 0.9 },
  { name: 'bvh-amusement', url: `${PACK_BVH}amusement.bvh`, category: 'fidget', weight: 0.9 },
  { name: 'bvh-curiosity', url: `${PACK_BVH}curiosity.bvh`, category: 'fidget', weight: 0.8 },
  { name: 'bvh-admiration', url: `${PACK_BVH}admiration.bvh`, category: 'fidget', weight: 0.8 },
  { name: 'bvh-approval', url: `${PACK_BVH}approval.bvh`, category: 'fidget', weight: 0.8 },
  { name: 'bvh-embarrassment', url: `${PACK_BVH}embarrassment.bvh`, category: 'fidget', weight: 0.7 },
  { name: 'bvh-nervousness', url: `${PACK_BVH}nervousness.bvh`, category: 'fidget', weight: 0.7 },
]

const HISTORY_SIZE = 3

/**
 * Clip manifest + availability cache + smart weighted picker.
 * Loads stay per-avatar (each mixer owns its actions); failures are remembered
 * so a missing file is only ever requested once per session.
 */
export class AnimationLibrary {
  private readonly failed = new Set<string>()

  clipsFor(category: string): ClipDef[] {
    return CLIP_MANIFEST.filter((clip) => clip.category === category)
  }

  isFailed(clip: ClipDef): boolean {
    return this.failed.has(clip.url)
  }

  markFailed(clip: ClipDef): void {
    this.failed.add(clip.url)
  }

  /**
   * Weighted-random pick from a category, skipping failed clips and the
   * caller's excluded names; loads it through the provided loader and returns
   * the def, or null when nothing in the pool could be prepared.
   */
  async pickAndLoad(
    category: string,
    ensure: (clip: ClipDef) => Promise<boolean>,
    options: { exclude?: ReadonlySet<string>; history?: readonly string[] } = {},
  ): Promise<ClipDef | null> {
    const exclude = options.exclude ?? new Set<string>()
    const history = options.history ?? []
    let candidates = this.clipsFor(category).filter(
      (clip) => !this.isFailed(clip) && !exclude.has(clip.name) && !history.includes(clip.name),
    )
    if (candidates.length === 0) {
      candidates = this.clipsFor(category).filter(
        (clip) => !this.isFailed(clip) && !exclude.has(clip.name),
      )
    }

    while (candidates.length > 0) {
      const clip = weightedPick(candidates)
      if (!clip) return null
      if (await ensure(clip)) return clip
      this.markFailed(clip)
      candidates = candidates.filter((candidate) => candidate !== clip)
    }
    return null
  }

  /** Load every not-yet-failed clip of a category (used for background warm-up). */
  async warm(
    category: string,
    ensure: (clip: ClipDef) => Promise<boolean>,
    isActive: () => boolean,
  ): Promise<void> {
    for (const clip of this.clipsFor(category)) {
      if (!isActive() || this.isFailed(clip)) continue
      if (await ensure(clip)) continue
      this.markFailed(clip)
    }
  }
}

function weightedPick(clips: readonly ClipDef[]): ClipDef | null {
  const total = clips.reduce((sum, clip) => sum + Math.max(0.01, clip.weight), 0)
  let roll = Math.random() * total
  for (const clip of clips) {
    roll -= Math.max(0.01, clip.weight)
    if (roll <= 0) return clip
  }
  return clips[clips.length - 1] ?? null
}

export function pushHistory(history: string[], name: string): void {
  history.push(name)
  if (history.length > HISTORY_SIZE) history.shift()
}
