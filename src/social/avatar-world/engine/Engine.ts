import * as THREE from 'three'
import { Loop } from './Loop'
import { Disposer, readRendererInfo, type RendererStats } from './Disposer'
import { resolveQuality, type QualityProfile, type QualitySettings } from './Quality'

export interface EngineOptions {
  quality?: QualityProfile
  autoStart?: boolean
  background?: THREE.ColorRepresentation | null
  onContextLost?: () => void
  onContextRestored?: () => void
}

export class Engine {
  readonly scene: THREE.Scene
  readonly camera: THREE.PerspectiveCamera
  readonly renderer: THREE.WebGLRenderer
  readonly disposer: Disposer
  readonly loop: Loop
  readonly container: HTMLElement

  private settings: QualitySettings
  private resizeObserver: ResizeObserver | null = null
  private updatables = new Set<(delta: number) => void>()
  private contextLost = false
  private onContextLostCb?: () => void
  private onContextRestoredCb?: () => void

  constructor(container: HTMLElement, options: EngineOptions = {}) {
    this.container = container
    this.settings = resolveQuality(options.quality)
    this.onContextLostCb = options.onContextLost
    this.onContextRestoredCb = options.onContextRestored
    this.disposer = new Disposer()

    this.renderer = new THREE.WebGLRenderer({
      antialias: this.settings.antialias,
      alpha: true,
      powerPreference: this.settings.tier === 'high' ? 'high-performance' : 'default',
    })
    this.renderer.setPixelRatio(this.settings.pixelRatio)
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.shadowMap.enabled = this.settings.shadows
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    if (options.background) {
      this.renderer.setClearColor(options.background, 1)
    } else {
      this.renderer.setClearColor(0x000000, 0)
    }

    const canvas = this.renderer.domElement
    canvas.style.display = 'block'
    canvas.style.width = '100%'
    canvas.style.height = '100%'
    canvas.style.touchAction = 'none'
    container.appendChild(canvas)

    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100)

    this.setupLighting()

    this.loop = new Loop((delta) => this.update(delta))
    this.loop.setFpsCap(60)

    this.resize()
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.resize())
      this.resizeObserver.observe(container)
    } else {
      window.addEventListener('resize', this.resize)
    }

    canvas.addEventListener('webglcontextlost', this.handleContextLost, false)
    canvas.addEventListener('webglcontextrestored', this.handleContextRestored, false)

    if (options.autoStart !== false) this.loop.start()
  }

  private setupLighting(): void {
    const hemisphere = new THREE.HemisphereLight(0xffffff, 0x444455, 1.1)
    hemisphere.position.set(0, 10, 0)
    this.scene.add(hemisphere)

    const key = new THREE.DirectionalLight(0xffffff, 1.6)
    key.position.set(2, 3, 2)
    key.castShadow = this.settings.shadows
    this.scene.add(key)

    const fill = new THREE.DirectionalLight(0xbbccff, 0.5)
    fill.position.set(-2, 1.5, -2)
    this.scene.add(fill)
  }

  get settingsRef(): QualitySettings {
    return this.settings
  }

  addUpdatable(fn: (delta: number) => void): () => void {
    this.updatables.add(fn)
    return () => {
      this.updatables.delete(fn)
    }
  }

  setQuality(profile: QualityProfile): void {
    this.settings = resolveQuality(profile)
    this.renderer.setPixelRatio(this.settings.pixelRatio)
    this.renderer.shadowMap.enabled = this.settings.shadows
    this.resize()
  }

  getStats(): RendererStats {
    return readRendererInfo(this.renderer)
  }

  render(): void {
    if (this.contextLost) return
    this.renderer.render(this.scene, this.camera)
  }

  start(): void {
    this.loop.start()
  }

  stop(): void {
    this.loop.stop()
  }

  private update(delta: number): void {
    for (const fn of this.updatables) fn(delta)
    this.render()
  }

  private handleContextLost = (event: Event): void => {
    event.preventDefault()
    this.contextLost = true
    this.loop.stop()
    this.onContextLostCb?.()
  }

  private handleContextRestored = (): void => {
    this.contextLost = false
    this.resize()
    this.loop.start()
    this.onContextRestoredCb?.()
  }

  private resize = (): void => {
    const width = this.container.clientWidth || 1
    const height = this.container.clientHeight || 1
    this.renderer.setSize(width, height, false)
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
  }

  async captureThumbnail(width = 256, height = 256): Promise<Blob | null> {
    if (this.contextLost) return null
    const target = new THREE.WebGLRenderTarget(width, height, {
      colorSpace: THREE.SRGBColorSpace,
    })
    try {
      const prev = this.renderer.getRenderTarget()
      this.renderer.setRenderTarget(target)
      this.renderer.render(this.scene, this.camera)
      const pixels = new Uint8Array(width * height * 4)
      this.renderer.readRenderTargetPixels(target, 0, 0, width, height, pixels)
      this.renderer.setRenderTarget(prev)

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) return null
      const image = ctx.createImageData(width, height)
      const rowBytes = width * 4
      for (let y = 0; y < height; y++) {
        const src = (height - 1 - y) * rowBytes
        image.data.set(pixels.subarray(src, src + rowBytes), y * rowBytes)
      }
      ctx.putImageData(image, 0, 0)
      return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.85))
    } finally {
      target.dispose()
    }
  }

  dispose(): void {
    this.loop.dispose()
    this.updatables.clear()

    const canvas = this.renderer.domElement
    canvas.removeEventListener('webglcontextlost', this.handleContextLost)
    canvas.removeEventListener('webglcontextrestored', this.handleContextRestored)

    if (this.resizeObserver) {
      this.resizeObserver.disconnect()
      this.resizeObserver = null
    } else {
      window.removeEventListener('resize', this.resize)
    }

    this.disposer.dispose()
    this.renderer.dispose()
    this.renderer.forceContextLoss()
    if (canvas.parentNode) canvas.parentNode.removeChild(canvas)
  }
}
