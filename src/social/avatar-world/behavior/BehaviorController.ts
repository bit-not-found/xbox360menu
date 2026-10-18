import * as THREE from 'three'
import type { Avatar } from '../avatar/Avatar'
import type { ExpressionName } from '../avatar/Expressions'
import type { ClipDef } from '../avatar/AnimationLibrary'
import { AnimationLibrary, pushHistory } from '../avatar/AnimationLibrary'
import { loadRetargetedBvhClip } from '../avatar/BvhMotion'

const IDLE_ROTATE_MIN = 10
const IDLE_ROTATE_MAX = 18
const FIDGET_MIN = 12
const FIDGET_MAX = 20
const BORED_FIDGET_MIN = 26
const BORED_FIDGET_MAX = 40
const SACCADE_MIN = 4
const SACCADE_MAX = 9
const SACCADE_HOLD_MIN = 0.3
const SACCADE_HOLD_MAX = 1
const GLANCE_DURATION = 2.6
const GREET_COOLDOWN = 8
const EXCITE_COOLDOWN = 6
const SWAY_AMPLITUDE = 0.011

export interface BehaviorOptions {
  avatar: Avatar
  library: AnimationLibrary
  isMain: boolean
  reducedMotion: () => boolean
  isBored: () => boolean
  /** World-space point the avatar auto-gazes toward (camera or cursor). */
  gazePoint: () => THREE.Vector3
}

/**
 * Per-avatar "brain": keeps an idle base playing, schedules staggered random
 * fidgets, reacts to greetings/excitement, wanders its eyes with saccades,
 * and droops into a bored state when the stage reports AFK.
 */
export class BehaviorController {
  private readonly avatar: Avatar
  private readonly library: AnimationLibrary
  private readonly isMainAvatar: boolean
  private readonly reducedMotion: () => boolean
  private readonly isBored: () => boolean
  private readonly gazeProvider: () => THREE.Vector3

  private readonly history: string[] = []
  private currentIdleName: string | null = null
  private idleRotateCountdown: number
  private fidgetCountdown: number
  private saccadeCountdown: number
  private saccadeHold = 0
  private saccadePoint: THREE.Vector3 | null = null
  private glancePoint: THREE.Vector3 | null = null
  private glanceCountdown = 0
  private greetCooldown = 0
  private exciteCooldown = 0
  private generation = 0
  private boredPrev = false
  private flashClock = 0
  private flashes: { name: ExpressionName; until: number }[] = []
  private swayPhase = Math.random() * Math.PI * 2
  private readonly swaySpeed = 0.9 + Math.random() * 0.5
  private disposed = false

  constructor(options: BehaviorOptions) {
    this.avatar = options.avatar
    this.library = options.library
    this.isMainAvatar = options.isMain
    this.reducedMotion = options.reducedMotion
    this.isBored = options.isBored
    this.gazeProvider = options.gazePoint
    this.idleRotateCountdown = IDLE_ROTATE_MIN + Math.random() * (IDLE_ROTATE_MAX - IDLE_ROTATE_MIN)
    this.fidgetCountdown = 6 + Math.random() * 10
    this.saccadeCountdown = 2 + Math.random() * 6
  }

  get main(): boolean {
    return this.isMainAvatar
  }

  /** Load and start the first idle-pool clip; the avatar never falls back to a T-pose. */
  async start(): Promise<void> {
    const clip = await this.library.pickAndLoad('idle', this.ensureClip, { history: [] })
    if (clip && !this.disposed) {
      this.currentIdleName = clip.name
      this.avatar.animator.play(clip.name, { fade: 0 })
      pushHistory(this.history, clip.name)
      return
    }
    if (this.disposed) return
    // Emergency last resort: the legacy idle clip, so an empty mixer never shows a T-pose.
    const fallback = this.library.clipsFor('idle-fallback')[0]
    if (fallback && (await this.ensureClip(fallback))) {
      this.currentIdleName = fallback.name
      this.avatar.animator.play(fallback.name, { fade: 0 })
    }
  }

  update(delta: number): void {
    if (this.disposed) return
    const reduced = this.reducedMotion()
    const bored = this.isBored()

    if (bored !== this.boredPrev) {
      this.boredPrev = bored
      this.avatar.expressions.setExpression('relaxed', bored ? 0.4 : 0)
      if (!bored) this.flashExpression('happy', 0.3, 1.2)
    }

    this.updateFlashes(delta)
    this.updateGaze(delta, reduced, bored)
    this.updateSway(delta, reduced)

    this.greetCooldown = Math.max(0, this.greetCooldown - delta)
    this.exciteCooldown = Math.max(0, this.exciteCooldown - delta)

    const onIdle = this.currentIdleName !== null && this.avatar.animator.currentName === this.currentIdleName

    this.idleRotateCountdown -= delta
    if (this.idleRotateCountdown <= 0) {
      this.idleRotateCountdown = IDLE_ROTATE_MIN + Math.random() * (IDLE_ROTATE_MAX - IDLE_ROTATE_MIN)
      if (!reduced && !this.glancePoint && onIdle) {
        void this.rotateIdle()
      }
    }

    this.fidgetCountdown -= delta
    if (this.fidgetCountdown <= 0) {
      this.fidgetCountdown = bored
        ? BORED_FIDGET_MIN + Math.random() * (BORED_FIDGET_MAX - BORED_FIDGET_MIN)
        : FIDGET_MIN + Math.random() * (FIDGET_MAX - FIDGET_MIN)
      if (!reduced && !this.glancePoint && onIdle) {
        void this.playFrom('fidget', 0.35)
      }
    }
  }

  /** Wave + happy; only the main avatar is meant to call this. */
  greet(): void {
    if (this.disposed || this.greetCooldown > 0) return
    this.greetCooldown = GREET_COOLDOWN
    this.generation += 1
    this.flashExpression('happy', 0.75, 2.4)
    void this.playFrom('greeting', 0.25)
  }

  /** Big celebrate reaction (dance/spin) with a surprised → happy beat. */
  excited(): void {
    if (this.disposed || this.exciteCooldown > 0) return
    this.exciteCooldown = EXCITE_COOLDOWN
    this.generation += 1
    this.flashExpression('surprised', 0.7, 0.9)
    this.flashExpression('happy', 0.6, 3)
    void this.playFrom('excited', 0.25)
  }

  /** Small happy blip for friends reacting to a click. */
  cheerBrief(): void {
    if (this.disposed) return
    this.flashExpression('happy', 0.5, 1.6)
  }

  /** Steal the gaze for a while (tile focus); null hands control back to auto-gaze. */
  glanceAt(point: THREE.Vector3 | null): void {
    if (this.disposed) return
    if (point) {
      this.glancePoint = point.clone()
      this.glanceCountdown = GLANCE_DURATION
      this.saccadePoint = null
      this.saccadeHold = 0
    } else {
      this.glancePoint = null
      this.glanceCountdown = 0
    }
  }

  /** Background-load this avatar's clip pools so first plays are instant. */
  async warm(): Promise<void> {
    for (const category of ['idle', 'greeting', 'excited', 'fidget'] as const) {
      if (this.disposed) return
      await this.library.warm(category, this.ensureClip, () => !this.disposed)
    }
  }

  dispose(): void {
    this.disposed = true
    this.flashes = []
    this.glancePoint = null
    this.saccadePoint = null
  }

  private readonly ensureClip = async (clip: ClipDef): Promise<boolean> => {
    if (this.avatar.animator.has(clip.name)) return true
    if (clip.url.endsWith('.bvh')) {
      const motion = await loadRetargetedBvhClip(clip.url, this.avatar.vrm)
      if (!motion) return false
      return this.avatar.animator.addClip(clip.name, motion)
    }
    return this.avatar.animator.load(clip.name, clip.url)
  }

  /** Seamless crossfade to another idle-pool clip (never the T-pose fallback). */
  private async rotateIdle(): Promise<void> {
    const generation = this.generation
    const clip = await this.library.pickAndLoad('idle', this.ensureClip, {
      exclude: new Set([this.currentIdleName ?? '']),
      history: [],
    })
    if (!clip || this.disposed || generation !== this.generation) return
    this.currentIdleName = clip.name
    this.avatar.animator.play(clip.name, { fade: 0.8 })
  }

  private async playFrom(category: string, fade: number): Promise<void> {
    const generation = this.generation
    const clip = await this.library.pickAndLoad(category, this.ensureClip, {
      exclude: new Set([this.avatar.animator.currentName ?? '']),
      history: this.history,
    })
    if (!clip || this.disposed || generation !== this.generation) return
    pushHistory(this.history, clip.name)
    this.avatar.animator.playOnce(clip.name, {
      fade,
      onFinished: () => {
        if (!this.disposed && generation === this.generation) this.returnToIdle()
      },
    })
  }

  private returnToIdle(): void {
    if (!this.currentIdleName) return
    this.avatar.animator.play(this.currentIdleName, { fade: 0.4 })
  }

  private updateGaze(delta: number, reduced: boolean, bored: boolean): void {
    if (this.glanceCountdown > 0) {
      this.glanceCountdown -= delta
      if (this.glanceCountdown <= 0) this.glancePoint = null
    }

    const look = this.avatar.lookAt
    if (this.glancePoint) {
      look.lookAtWorld(this.glancePoint, 9)
      return
    }
    if (!reduced && this.saccadePoint && this.saccadeHold > 0) {
      look.lookAtWorld(this.saccadePoint, 14)
      return
    }

    const point = this.gazeProvider()
    if (bored) {
      const droop = point.clone()
      droop.y -= 0.55
      look.lookAtWorld(droop, 3.5)
    } else {
      look.lookAtWorld(point, 5)
    }

    if (reduced) return
    this.saccadeCountdown -= delta
    if (this.saccadeHold > 0) {
      this.saccadeHold -= delta
      if (this.saccadeHold <= 0) this.saccadePoint = null
    } else if (this.saccadeCountdown <= 0) {
      this.saccadeCountdown = SACCADE_MIN + Math.random() * (SACCADE_MAX - SACCADE_MIN)
      this.saccadeHold = SACCADE_HOLD_MIN + Math.random() * (SACCADE_HOLD_MAX - SACCADE_HOLD_MIN)
      this.saccadePoint = pickSaccadePoint()
    }
  }

  private updateSway(delta: number, reduced: boolean): void {
    if (reduced) {
      this.avatar.root.rotation.z = 0
      return
    }
    this.swayPhase += delta * this.swaySpeed
    const amplitude = SWAY_AMPLITUDE * (this.boredPrev ? 0.55 : 1)
    this.avatar.root.rotation.z = Math.sin(this.swayPhase) * amplitude
  }

  private flashExpression(name: ExpressionName, weight: number, duration: number): void {
    this.flashes = this.flashes.filter((flash) => flash.name !== name)
    this.avatar.expressions.setExpression(name, weight)
    this.flashes.push({ name, until: this.flashClock + duration })
  }

  private updateFlashes(delta: number): void {
    this.flashClock += delta
    if (this.flashes.length === 0) return
    const expired = this.flashes.filter((flash) => flash.until <= this.flashClock)
    this.flashes = this.flashes.filter((flash) => flash.until > this.flashClock)
    for (const flash of expired) {
      this.avatar.expressions.setExpression(flash.name, 0)
    }
  }
}

function pickSaccadePoint(): THREE.Vector3 {
  const towardTiles = Math.random() < 0.45
  const x = towardTiles ? -1.5 + Math.random() * 0.9 : -0.6 + Math.random() * 2
  const y = 1 + Math.random() * 0.6
  return new THREE.Vector3(x, y, 1.6)
}
