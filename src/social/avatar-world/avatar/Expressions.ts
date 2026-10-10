import type { VRM, VRMExpressionManager } from '@pixiv/three-vrm'

export type ExpressionName = 'happy' | 'sad' | 'angry' | 'surprised' | 'relaxed'
export const EXPRESSION_NAMES: ExpressionName[] = ['happy', 'sad', 'angry', 'surprised', 'relaxed']

const BLINK_DURATION = 0.14
const BLINK_MIN_INTERVAL = 2
const BLINK_MAX_INTERVAL = 6

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value))
}

export class Expressions {
  private readonly manager: VRMExpressionManager | null
  private active = new Map<string, number>()
  private mouthValue = 0
  private blinkTimer = BLINK_MIN_INTERVAL
  private blinkPhase = 0
  private blinkWeight = 0

  constructor(vrm: VRM) {
    this.manager = vrm.expressionManager ?? null
    this.scheduleBlink()
  }

  get available(): boolean {
    return this.manager !== null
  }

  setExpression(name: ExpressionName, weight: number): void {
    const clamped = clamp01(weight)
    if (clamped <= 0) {
      this.active.delete(name)
    } else {
      this.active.set(name, clamped)
    }
  }

  resetExpressions(): void {
    this.active.clear()
  }

  setMouth(value01: number): void {
    this.mouthValue = clamp01(value01)
  }

  update(delta: number): void {
    const manager = this.manager
    if (!manager) return

    this.blinkTimer -= delta
    if (this.blinkTimer <= 0 && this.blinkPhase === 0) {
      this.blinkPhase = BLINK_DURATION
      this.scheduleBlink()
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

    manager.setValue('blink', this.blinkWeight)
    manager.setValue('aa', this.mouthValue)
    for (const [name, weight] of this.active) {
      manager.setValue(name, weight)
    }
  }

  private scheduleBlink(): void {
    this.blinkTimer = BLINK_MIN_INTERVAL + Math.random() * (BLINK_MAX_INTERVAL - BLINK_MIN_INTERVAL)
  }
}
