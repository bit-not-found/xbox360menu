import * as THREE from 'three'
import { VRMUtils } from '@pixiv/three-vrm'
import { Engine } from './social/avatar-world/engine/Engine'
import { loadVRM } from './social/avatar-world/avatar/VrmLoader'
import { Avatar } from './social/avatar-world/avatar/Avatar'
import { AnimationLibrary } from './social/avatar-world/avatar/AnimationLibrary'
import { BehaviorController } from './social/avatar-world/behavior/BehaviorController'

const BASE = import.meta.env.BASE_URL || '/'
const PLACEHOLDER_URL = `${BASE}assets/avatar/placeholder.vrm`

const CAMERA_FOV = 25
const CAMERA_EYE_Y = 1.05
const CAMERA_LOOK_Y = 0.88
const FRAME_HEIGHT = 2.15
const MAX_PIXEL_RATIO = 1.5
const SLOT_SPACING = 0.82
const SLOT_START_X = -0.78
const LOOK_PLANE_Z = 1.6
const CURSOR_LIFETIME_MS = 5000
const AFK_TIMEOUT_MS = 45000
const EXIT_PAUSE_DELAY_MS = 540

function buildSlots(count) {
  const slots = []
  for (let i = 0; i < count; i++) {
    slots.push({
      x: SLOT_START_X + i * SLOT_SPACING,
      z: i === 0 ? 0 : -Math.min(0.16 * i, 0.48),
      rotationY: i === 0 ? 0 : i % 2 === 1 ? -0.3 : 0.34,
      phase: i * 1.7,
    })
  }
  return slots
}

function createContactShadowTexture() {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0.4)')
    gradient.addColorStop(0.5, 'rgba(0, 0, 0, 0.18)')
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, size, size)
  }
  return new THREE.CanvasTexture(canvas)
}

function tuneLighting(scene) {
  scene.traverse((object) => {
    if (object.isHemisphereLight) {
      object.intensity = 1.2
    } else if (object.isDirectionalLight && object.color.getHex() === 0xffffff) {
      object.intensity = 1.15
      object.position.set(2.4, 3.6, 2.6)
    } else if (object.isDirectionalLight) {
      object.intensity = 0.55
    }
  })
  const rim = new THREE.DirectionalLight(0xfff1dd, 0.4)
  rim.position.set(3, 2.2, -3.5)
  scene.add(rim)
}

/** Unproject a client point onto a fixed z-plane in front of the avatars. */
function unprojectToPlane(clientX, clientY, camera, canvas, planeZ = LOOK_PLANE_Z) {
  const rect = canvas.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return null
  const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1
  const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1
  const origin = camera.position
  const direction = new THREE.Vector3(ndcX, ndcY, 0.5).unproject(camera).sub(origin).normalize()
  const t = (planeZ - origin.z) / direction.z
  if (!Number.isFinite(t) || t <= 0) return null
  return origin.clone().addScaledVector(direction, t)
}

function elementCenterPoint(el, camera, canvas) {
  if (!el || !el.isConnected) return null
  const rect = el.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return null
  return unprojectToPlane(rect.left + rect.width / 2, rect.top + rect.height / 2, camera, canvas)
}

export async function mountSocialStage(container, options = {}) {
  const {
    mainSource,
    friendCount = 2,
    isActive = true,
    quality,
    onStatus,
    onError,
  } = options

  const engine = new Engine(container, { autoStart: false, quality })
  const canvas = engine.renderer.domElement
  canvas.id = 'vrm-canvas'
  canvas.style.pointerEvents = 'none'

  const halfFovRad = THREE.MathUtils.degToRad(CAMERA_FOV / 2)
  const cameraDistance = FRAME_HEIGHT / 2 / Math.tan(halfFovRad)
  engine.camera.fov = CAMERA_FOV
  engine.camera.position.set(0, CAMERA_EYE_Y, cameraDistance)
  engine.camera.lookAt(0, CAMERA_LOOK_Y, 0)
  engine.camera.updateProjectionMatrix()

  engine.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO))

  tuneLighting(engine.scene)

  const library = new AnimationLibrary()
  const entries = []
  const shadowTexture = createContactShadowTexture()
  const cameraGaze = new THREE.Vector3(0, CAMERA_EYE_Y, cameraDistance)
  const motionQuery =
    typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)')
      : null
  const reducedMotion = () => motionQuery?.matches === true

  let disposed = false
  let bored = false
  let lastInputAt = performance.now()
  let exitTimer = null
  const cursor = { x: 0, y: 0, at: 0 }

  function noteInput() {
    lastInputAt = performance.now()
    bored = false
  }

  function gazePoint() {
    if (performance.now() - cursor.at < CURSOR_LIFETIME_MS) {
      const point = unprojectToPlane(cursor.x, cursor.y, engine.camera, canvas)
      if (point) return point
    }
    return cameraGaze
  }

  const removeUpdatable = engine.addUpdatable((delta) => {
    if (!bored && performance.now() - lastInputAt > AFK_TIMEOUT_MS) bored = true
    for (const entry of entries) {
      entry.controller.update(delta)
      entry.avatar.update(delta)
    }
  })

  const onPointerMove = (event) => {
    cursor.x = event.clientX
    cursor.y = event.clientY
    cursor.at = performance.now()
    noteInput()
  }
  const onPointerDown = () => noteInput()
  const onKeyDown = () => noteInput()
  document.addEventListener('pointermove', onPointerMove, { passive: true })
  document.addEventListener('pointerdown', onPointerDown, { passive: true })
  document.addEventListener('keydown', onKeyDown)

  function report(status, detail) {
    onStatus?.(status, detail)
  }

  async function addAvatar(source, slot, isMain) {
    const vrm = await loadVRM(source)
    if (disposed) {
      VRMUtils.deepDispose(vrm.scene)
      return null
    }

    const avatar = new Avatar(vrm, engine.scene)
    engine.scene.add(avatar.root)
    avatar.root.position.set(slot.x, 0, slot.z)
    avatar.root.rotation.y = slot.rotationY

    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1.15, 1.05),
      new THREE.MeshBasicMaterial({
        map: shadowTexture,
        transparent: true,
        depthWrite: false,
        opacity: 0.85,
      }),
    )
    shadow.rotation.x = -Math.PI / 2
    shadow.position.set(slot.x, 0.01, slot.z)
    shadow.renderOrder = -1
    engine.scene.add(shadow)

    const controller = new BehaviorController({
      avatar,
      library,
      isMain,
      reducedMotion,
      isBored: () => bored,
      gazePoint,
    })
    await controller.start()
    if (disposed) {
      engine.scene.remove(shadow)
      shadow.geometry.dispose()
      shadow.material.dispose()
      controller.dispose()
      avatar.dispose()
      return null
    }
    avatar.mixer.setTime(slot.phase)

    const entry = { avatar, shadow, controller, isMain }
    entries.push(entry)
    return entry
  }

  async function loadCrowd() {
    const slots = buildSlots(1 + Math.max(0, friendCount))

    try {
      await addAvatar(mainSource || PLACEHOLDER_URL, slots[0], true)
    } catch (error) {
      if (!mainSource) throw error
      try {
        await addAvatar(PLACEHOLDER_URL, slots[0], true)
      } catch {
        throw error
      }
    }
    if (disposed) return

    await Promise.all(
      slots.slice(1).map(async (slot) => {
        try {
          await addAvatar(PLACEHOLDER_URL, slot, false)
        } catch {
          /* friend avatars are best-effort */
        }
      }),
    )
  }

  async function warmAnimations() {
    for (const entry of entries) {
      if (disposed) return
      await entry.controller.warm()
    }
  }

  engine.start()
  if (!isActive) engine.loop.pause()

  const crowd = loadCrowd()
    .then(() => {
      if (disposed) return
      report('ready')
      void warmAnimations()
    })
    .catch((error) => {
      if (disposed) return
      report('error', error instanceof Error ? error.message : 'Failed to load avatars.')
      onError?.(error)
    })

  const mainEntry = () => entries.find((entry) => entry.isMain) ?? null

  return {
    engine,
    ready: crowd,
    pause: () => engine.loop.pause(),
    resume: () => engine.loop.resume(),

    /** Syncs the render loop with the tab's blade slide: resume now, pause after the exit fade. */
    setActive(active) {
      if (disposed) return
      if (exitTimer) {
        clearTimeout(exitTimer)
        exitTimer = null
      }
      if (active) {
        engine.loop.resume()
        noteInput()
      } else {
        exitTimer = setTimeout(() => {
          exitTimer = null
          engine.loop.pause()
        }, EXIT_PAUSE_DELAY_MS)
      }
    },

    /** Tiles gained focus (mouse hover or gamepad/keyboard): glance toward it; avatar tile waves. */
    notifyTileFocus(tileId, el) {
      if (disposed) return
      noteInput()
      const point = elementCenterPoint(el, engine.camera, canvas)
      if (!point) return
      for (const entry of entries) entry.controller.glanceAt(point)
      if (tileId === 'avatar') mainEntry()?.controller.greet()
    },

    notifyTileBlur() {
      if (disposed) return
      for (const entry of entries) entry.controller.glanceAt(null)
    },

    /** Clicking the avatar tile fires the big celebrate reaction. */
    notifyTileClick(tileId) {
      if (disposed) return
      noteInput()
      if (tileId !== 'avatar') return
      const main = mainEntry()
      if (!main) return
      main.controller.excited()
      for (const entry of entries) {
        if (entry !== main) entry.controller.cheerBrief()
      }
    },

    getAvatarCount: () => entries.length,

    dispose: () => {
      if (disposed) return
      disposed = true
      if (exitTimer) {
        clearTimeout(exitTimer)
        exitTimer = null
      }
      removeUpdatable()
      document.removeEventListener('pointermove', onPointerMove)
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
      for (const entry of entries) {
        engine.scene.remove(entry.shadow)
        entry.shadow.geometry.dispose()
        entry.shadow.material.dispose()
        entry.controller.dispose()
        entry.avatar.dispose()
      }
      entries.length = 0
      shadowTexture.dispose()
      engine.dispose()
    },
  }
}
