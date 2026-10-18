import type { VRM, VRMExpressionManager } from '@pixiv/three-vrm'

export type ExpressionName = 'happy' | 'sad' | 'angry' | 'surprised' | 'relaxed'
export const EXPRESSION_NAMES: ExpressionName[] = ['happy', 'sad', 'angry', 'surprised', 'relaxed']

const BLINK_DURATION = 0.14
const BLINK_MIN_INTERVAL = 2.5
const BLINK_MAX_INTERVAL = 6
const DOUBLE_BLINK_CHANCE = 0.2
const DOUBLE_BLINK_DELAY_MIN = 0.1
const DOUBLE_BLINK_DELAY_MAX = 0.35
const LERP_SHARPNESS = 8

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value))
}

export class Expressions {
  private readonly manager: VRMExpressionManager | null
  private readonly targets = new Map<ExpressionName, number>()
  private readonly currents = new Map<ExpressionName, number>()
  private mouthValue = 0
  private blinkTimer = BLINK_MIN_INTERVAL
  private blinkPhase = 0
  private blinkWeight = 0
  private doubleBlinkPending = false

  constructor(vrm: VRM) {
    this.manager = vrm.expressionManager ?? null
    this.scheduleBlink()
  }

  get available(): boolean {
    return this.manager !== null
  }

  /** Set a target preset weight; the applied value eases toward it every frame. */
  setExpression(name: ExpressionName, weight: number): void {
    const clamped = clamp01(weight)
    if (clamped <= 0) {
      this.targets.delete(name)
    } else {
      this.targets.set(name, clamped)
    }
  }

  resetExpressions(): void {
    this.targets.clear()
  }

  setMouth(value01: number): void {
    this.mouthValue = clamp01(value01)
  }

  update(delta: number): void {
    const manager = this.manager
    if (!manager) return

    this.updateBlink(delta)

    const blend = 1 - Math.exp(-LERP_SHARPNESS * delta)
    const names = new Set<ExpressionName>([...this.targets.keys(), ...this.currents.keys()])
    for (const name of names) {
      const target = this.targets.get(name) ?? 0
      let current = this.currents.get(name) ?? 0
      current += (target - current) * blend
      if (Math.abs(target - current) < 0.003) current = target
      if (current === 0 && target === 0) {
        this.currents.delete(name)
        manager.setValue(name, 0)
      } else {
        this.currents.set(name, current)
        manager.setValue(name, current)
      }
    }

    manager.setValue('blink', this.blinkWeight)
    manager.setValue('aa', this.mouthValue)
  }

  private updateBlink(delta: number): void {
    this.blinkTimer -= delta
    if (this.blinkTimer <= 0 && this.blinkPhase === 0) {
      this.blinkPhase = BLINK_DURATION
      if (this.doubleBlinkPending) {
        this.doubleBlinkPending = false
        this.scheduleBlink()
      } else if (Math.random() < DOUBLE_BLINK_CHANCE) {
        this.doubleBlinkPending = true
        this.blinkTimer =
          DOUBLE_BLINK_DELAY_MIN + Math.random() * (DOUBLE_BLINK_DELAY_MAX - DOUBLE_BLINK_DELAY_MIN)
      } else {
        this.scheduleBlink()
      }
    }

    if (this.blinkPhase > 0) {
      this.blinkPhase -= delta
      const progress = 1 - Math.max(this.blinkPhase, 0) / BLINK_DURATION
      this.blinkWeight = progress < 0.5 ? progress * 2 : (1 - progress) * 2
      if (this.blinkPhase <= 0) {
        this.blinkPhase = 0
        this.blinkWeight = 0
      }
    }
  }

  private scheduleBlink(): void {
    this.blinkTimer = BLINK_MIN_INTERVAL + Math.random() * (BLINK_MAX_INTERVAL - BLINK_MIN_INTERVAL)
  }
}
