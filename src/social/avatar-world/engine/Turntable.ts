import * as THREE from 'three'
import type { PerspectiveCamera } from 'three'

export interface TurntableOptions {
  autoRotateSpeed?: number
  idleDelay?: number
  enableGamepad?: boolean
  onPointer?: (normalizedX: number, normalizedY: number) => void
}

const ORBIT_SPEED = 0.008
const GAMEPAD_DEADZONE = 0.18

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export class Turntable {
  readonly pivot = new THREE.Vector3(0, 1, 0)
  yaw = 0
  pitch = 0.08
  distance = 3
  minDistance = 0.15
  maxDistance = 40
  minPitch = -0.7
  maxPitch = 1.25
  enabled = true

  private readonly camera: PerspectiveCamera
  private readonly element: HTMLElement
  private readonly options: Required<Pick<TurntableOptions, 'autoRotateSpeed' | 'idleDelay' | 'enableGamepad'>>
  private readonly onPointerCallback?: (x: number, y: number) => void
  private readonly pointers = new Map<number, { x: number; y: number }>()
  private readonly basePivot = new THREE.Vector3(0, 1, 0)
  private frameRadius = 1
  private dragging = false
  private panning = false
  private lastX = 0
  private lastY = 0
  private pinchDistance = 0
  private lastMidX = 0
  private lastMidY = 0
  private idleTime = 0
  private detachFns: Array<() => void> = []
  private readonly tmpRight = new THREE.Vector3()
  private readonly tmpUp = new THREE.Vector3()
  private readonly tmpForward = new THREE.Vector3()

  constructor(camera: PerspectiveCamera, element: HTMLElement, options: TurntableOptions = {}) {
    this.camera = camera
    this.element = element
    this.options = {
      autoRotateSpeed: options.autoRotateSpeed ?? 0.15,
      idleDelay: options.idleDelay ?? 2.5,
      enableGamepad: options.enableGamepad ?? true,
    }
    this.onPointerCallback = options.onPointer
    this.bind()
    this.apply()
  }

  private bind(): void {
    const down = (e: PointerEvent) => this.onPointerDown(e)
    const move = (e: PointerEvent) => this.onPointerMove(e)
    const up = (e: PointerEvent) => this.onPointerUp(e)
    const wheel = (e: WheelEvent) => this.onWheel(e)
    const context = (e: Event) => e.preventDefault()

    this.element.addEventListener('pointerdown', down)
    this.element.addEventListener('pointermove', move)
    this.element.addEventListener('pointerup', up)
    this.element.addEventListener('pointercancel', up)
    this.element.addEventListener('pointerleave', up)
    this.element.addEventListener('wheel', wheel, { passive: false })
    this.element.addEventListener('contextmenu', context)

    this.detachFns = [
      () => this.element.removeEventListener('pointerdown', down),
      () => this.element.removeEventListener('pointermove', move),
      () => this.element.removeEventListener('pointerup', up),
      () => this.element.removeEventListener('pointercancel', up),
      () => this.element.removeEventListener('pointerleave', up),
      () => this.element.removeEventListener('wheel', wheel),
      () => this.element.removeEventListener('contextmenu', context),
    ]
  }

  private onPointerDown(e: PointerEvent): void {
    if (!this.enabled) return
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    try {
      this.element.setPointerCapture(e.pointerId)
    } catch {
      /* pointer capture is best effort */
    }
    if (this.pointers.size === 1) {
      this.dragging = true
      this.panning = e.button === 2 || e.shiftKey
      this.lastX = e.clientX
      this.lastY = e.clientY
    } else if (this.pointers.size === 2) {
      this.dragging = false
      this.pinchDistance = this.currentPinchDistance()
      const mid = this.currentMidpoint()
      this.lastMidX = mid.x
      this.lastMidY = mid.y
    }
    this.idleTime = 0
  }

  private onPointerMove(e: PointerEvent): void {
    if (!this.enabled) return
    if (this.pointers.has(e.pointerId)) {
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    }

    this.emitPointer(e)

    if (this.pointers.size >= 2) {
      const next = this.currentPinchDistance()
      if (this.pinchDistance > 0 && next > 0) {
        this.distance = this.clampDistance(this.distance * (this.pinchDistance / next))
      }
      this.pinchDistance = next

      const mid = this.currentMidpoint()
      if (this.lastMidX !== 0 || this.lastMidY !== 0) {
        this.panBy(mid.x - this.lastMidX, mid.y - this.lastMidY)
      }
      this.lastMidX = mid.x
      this.lastMidY = mid.y
      this.idleTime = 0
      return
    }

    if (!this.dragging) return
    const dx = e.clientX - this.lastX
    const dy = e.clientY - this.lastY
    this.lastX = e.clientX
    this.lastY = e.clientY

    if (this.panning) {
      this.panBy(dx, dy)
    } else {
      this.yaw -= dx * ORBIT_SPEED
      this.pitch = clamp(this.pitch + dy * ORBIT_SPEED, this.minPitch, this.maxPitch)
    }
    this.idleTime = 0
  }

  private onPointerUp(e: PointerEvent): void {
    this.pointers.delete(e.pointerId)
    if (this.pointers.size < 2) {
      this.pinchDistance = 0
      this.lastMidX = 0
      this.lastMidY = 0
    }
    if (this.pointers.size === 0) {
      this.dragging = false
      this.panning = false
    }
    try {
      this.element.releasePointerCapture(e.pointerId)
    } catch {
      /* already released */
    }
  }

  private onWheel(e: WheelEvent): void {
    if (!this.enabled) return
    e.preventDefault()
    this.distance = this.clampDistance(this.distance * Math.exp(e.deltaY * 0.0012))
    this.idleTime = 0
  }

  private emitPointer(e: PointerEvent): void {
    if (!this.onPointerCallback) return
    const rect = this.element.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1
    const y = ((e.clientY - rect.top) / rect.height) * 2 - 1
    this.onPointerCallback(clamp(x, -1, 1), clamp(y, -1, 1))
  }

  private currentPinchDistance(): number {
    const [a, b] = Array.from(this.pointers.values())
    if (!a || !b) return 0
    return Math.hypot(a.x - b.x, a.y - b.y)
  }

  private currentMidpoint(): { x: number; y: number } {
    const pts = Array.from(this.pointers.values())
    if (pts.length < 2) return { x: 0, y: 0 }
    let sx = 0
    let sy = 0
    for (const p of pts) {
      sx += p.x
      sy += p.y
    }
    return { x: sx / pts.length, y: sy / pts.length }
  }

  // Move the look-at point in camera space so the user can slide up/down (and
  // side to side) the model to frame details, independent of orbit.
  private panBy(dxScreen: number, dyScreen: number): void {
    const rect = this.element.getBoundingClientRect()
    if (rect.height === 0) return
    const worldPerPixel =
      (2 * this.distance * Math.tan((this.camera.fov * Math.PI) / 360)) / rect.height

    this.camera.updateMatrixWorld()
    this.camera.matrixWorld.extractBasis(this.tmpRight, this.tmpUp, this.tmpForward)

    this.pivot.addScaledVector(this.tmpRight, -dxScreen * worldPerPixel)
    this.pivot.addScaledVector(this.tmpUp, dyScreen * worldPerPixel)
    this.clampPivot()
  }

  private clampPivot(): void {
    const extent = this.frameRadius * 1.25
    this.pivot.x = clamp(this.pivot.x, this.basePivot.x - extent, this.basePivot.x + extent)
    this.pivot.y = clamp(this.pivot.y, this.basePivot.y - extent, this.basePivot.y + extent)
    this.pivot.z = clamp(this.pivot.z, this.basePivot.z - extent, this.basePivot.z + extent)
  }

  private clampDistance(value: number): number {
    return clamp(value, this.minDistance, this.maxDistance)
  }

  frame(object: THREE.Object3D, padding = 1.7): void {
    object.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(object)
    if (box.isEmpty()) return
    box.getCenter(this.pivot)
    this.basePivot.copy(this.pivot)
    const sphere = box.getBoundingSphere(new THREE.Sphere())
    const radius = Math.max(sphere.radius, 0.4)
    this.frameRadius = radius

    const vFov = (this.camera.fov * Math.PI) / 180
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * this.camera.aspect)
    const fit = Math.max(radius / Math.sin(vFov / 2), radius / Math.sin(hFov / 2))

    this.distance = this.clampDistance(fit * padding)
    // Allow getting in very close for detail inspection, but never inside the model.
    this.minDistance = Math.max(radius * 0.1, 0.05)
    this.maxDistance = radius * 8
    this.pitch = 0.08
    this.apply()
  }

  setOrbit(deltaYaw: number, deltaPitch: number): void {
    this.yaw += deltaYaw
    this.pitch = clamp(this.pitch + deltaPitch, this.minPitch, this.maxPitch)
    this.idleTime = 0
  }

  zoomBy(factor: number): void {
    this.distance = this.clampDistance(this.distance * factor)
    this.idleTime = 0
  }

  update(dt: number): void {
    if (this.options.enableGamepad) this.pollGamepad(dt)

    this.idleTime += dt
    if (!this.dragging && this.idleTime > this.options.idleDelay) {
      this.yaw += this.options.autoRotateSpeed * dt
    }
    this.apply()
  }

  private pollGamepad(dt: number): void {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return
    const pads = navigator.getGamepads()
    for (const pad of pads) {
      if (!pad || !pad.connected) continue
      const rx = pad.axes[2] ?? 0
      const ry = pad.axes[3] ?? 0
      if (Math.abs(rx) > GAMEPAD_DEADZONE) {
        this.yaw -= rx * dt * 1.6
        this.idleTime = 0
      }
      if (Math.abs(ry) > GAMEPAD_DEADZONE) {
        this.pitch = clamp(this.pitch + ry * dt * 1.2, this.minPitch, this.maxPitch)
        this.idleTime = 0
      }
      const lt = pad.buttons[6]?.value ?? 0
      const rt = pad.buttons[7]?.value ?? 0
      if (lt > 0.1 || rt > 0.1) {
        this.distance = this.clampDistance(this.distance * (1 + (rt - lt) * dt * 1.5))
        this.idleTime = 0
      }
      break
    }
  }

  private apply(): void {
    const cosPitch = Math.cos(this.pitch)
    const offset = new THREE.Vector3(
      Math.sin(this.yaw) * cosPitch,
      Math.sin(this.pitch),
      Math.cos(this.yaw) * cosPitch,
    ).multiplyScalar(this.distance)
    this.camera.position.copy(this.pivot).add(offset)
    this.camera.lookAt(this.pivot)
  }

  dispose(): void {
    for (const fn of this.detachFns) fn()
    this.detachFns = []
    this.pointers.clear()
  }
}
