import { playHoverSound, blockHoverSound } from './hoverSound'

const REPEAT_DELAY = 300
const REPEAT_RATE = 110
const STICK_DEADZONE_DEFAULT = 0.35
const STICK_DEADZONE_FLOOR = 0.25
const STICK_DEADZONE_CEIL = 0.6
const STICK_RELEASE_RATIO = 0.6
const ROW_TOLERANCE = 28

const BTN = {
  A: 0, B: 1, X: 2, Y: 3,
  LB: 4, RB: 5,
  BACK: 8, START: 9,
  DPAD_UP: 12, DPAD_DOWN: 13, DPAD_LEFT: 14, DPAD_RIGHT: 15,
  GUIDE: 16,
}

const OVERLAY_SCOPES = [
  '.modal-overlay',
  '.g360-overlay',
  '.controller-overlay',
  '.collection-overlay',
  '.visualizer-overlay',
  '.fs-player',
]

const FOCUSABLE_SELECTOR = [
  '[data-nav]',
  '.tile:not(.tile-disabled)',
  '.nav-item',
  '.taskbar-app',
  '.taskbar-app-close',
  '.g360-list-item',
  '.g360-tab',
  '.g360-item-close',
  '.collection-chip',
  '.collection-card',
  '.collection-card-fav',
  '.collection-card-delete',
  '.collection-card-pin',
  '.collection-close',
  '.collection-dropdown',
  '.modal-btn',
  '.game-type-btn',
  '.modal-content input[type="text"]',
  '.controller-close',
  '.controller-assignment-btn',
  '.controller-remap-btn',
  '.controller-remap-reset',
  '.controller-preset-btn',
  '.controller-rumble-btn',
  '.controller-remap-modal-cancel',
  '.fs-nav-item',
  '.fs-settings-item',
  '.fs-close-btn',
  '.fs-collapse-btn',
  '.fs-settings-close',
  '.fs-sidebar-expand',
  '.fs-ctrl-btn',
  '.visualizer-ctrl-btn',
  '.visualizer-preset-item',
  '.video-player-close',
  '.media-nav-btn',
  '.music-btn',
  '.music-track-row',
  '.music-artist-card',
  '.music-album-card',
  '.music-genre-card',
  '.music-playlist-card',
  '.music-playlist-create-card',
  '.music-back-btn',
  '.music-action-btn',
].join(',')

const backHandlers = new Map()
const bumperStack = []
let explicitPause = false
let started = false
let rafId = null
let keyListenersBound = false

let focusedEl = null
let lastScopeKey = ''
let pendingInitialFocus = true
let forceInitialFocus = false

const prevButtonsByIndex = new Map()
const repeatState = new Map()
const stickEngaged = new Set()
const heldKeys = new Set()
let stickDeadzone = STICK_DEADZONE_DEFAULT
let lastMouse = null
let lastControllerNavAt = 0

function isVisible(el) {
  if (!el || !el.isConnected) return false
  const style = window.getComputedStyle(el)
  if (style.display === 'none' || style.visibility === 'hidden' || style.pointerEvents === 'none') return false
  const rect = el.getBoundingClientRect()
  return rect.width > 0 && rect.height > 0
}

function isTypingTarget(target) {
  if (!target || !(target instanceof Element)) return false
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  return target.isContentEditable === true
}

function isRemapOpen() {
  return !!document.querySelector('.controller-remap-modal')
}

function hasFocusedAppOverlay() {
  return !!document.querySelector(
    '.app-window-overlay:not(.minimized):not(.closing), .emulator-toolbar:not(.minimized):not(.closing)'
  )
}

function isIntroVisible() {
  return !!document.querySelector('.intro-overlay, .intro-video')
}

function isSliding() {
  return !!document.querySelector('.dashboard.sliding')
}

function getTopOverlayRoot() {
  for (const sel of OVERLAY_SCOPES) {
    const nodes = Array.from(document.querySelectorAll(sel)).filter(isVisible)
    if (nodes.length > 0) return nodes[nodes.length - 1]
  }
  return null
}

function getScopeRoots() {
  const overlay = getTopOverlayRoot()
  if (overlay) return [overlay]
  const roots = []
  const header = document.querySelector('.nav-menu')
  if (header) roots.push(header)
  const page = document.querySelector('.page:not(.inactive)')
  if (page) roots.push(page)
  const taskbar = document.querySelector('.taskbar')
  if (taskbar) roots.push(taskbar)
  return roots
}

function getScopeKey(roots) {
  return roots.map((r) => {
    if (r.classList.contains('page')) {
      const pages = Array.from(document.querySelectorAll('.page'))
      return `page:${pages.indexOf(r)}`
    }
    if (r.classList.contains('g360-overlay')) return 'guide'
    if (r.classList.contains('modal-overlay')) return `modal:${r.className}`
    return r.className || r.tagName
  }).join('|')
}

function collectFocusables(roots) {
  const out = []
  const seen = new Set()
  for (const root of roots) {
    let list
    try {
      list = root.querySelectorAll(FOCUSABLE_SELECTOR)
    } catch {
      continue
    }
    for (const el of list) {
      if (seen.has(el)) continue
      if (el.disabled) continue
      if (el.closest('.tile-disabled')) continue
      if (el.closest('[data-nav-ignore]')) continue
      if (el.closest('.page.inactive')) continue
      if (el.closest('[data-nav-skip]')) continue
      if (!isVisible(el)) continue
      seen.add(el)
      out.push(el)
    }
  }
  return out
}

function clearFocusClass(el) {
  if (!el) return
  if (el.isConnected) {
    el.classList.remove('nav-focused')
    el.removeAttribute('data-nav-focused')
  }
}

function setFocused(el, { silent = false, scroll = true } = {}) {
  if (focusedEl === el) {
    if (el && scroll) scrollIntoViewSafe(el)
    return
  }
  clearFocusClass(focusedEl)
  focusedEl = el
  if (el) {
    pendingInitialFocus = false
    el.classList.add('nav-focused')
    el.setAttribute('data-nav-focused', 'true')
    if (!silent) {
      playHoverSound()
      blockHoverSound(200)
    }
    if (scroll) scrollIntoViewSafe(el)
  }
}

function scrollIntoViewSafe(el) {
  try {
    el.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  } catch {
    /* noop */
  }
}

function isValidFocus(items) {
  return !!(focusedEl && focusedEl.isConnected && items.includes(focusedEl) && isVisible(focusedEl))
}

function pickTopLeft(items) {
  if (!items.length) return null
  let best = items[0]
  let bestTop = Infinity
  let bestLeft = Infinity
  for (const el of items) {
    const r = el.getBoundingClientRect()
    const top = r.top
    const left = r.left
    if (top < bestTop - ROW_TOLERANCE) {
      bestTop = top
      bestLeft = left
      best = el
    } else if (Math.abs(top - bestTop) <= ROW_TOLERANCE && left < bestLeft) {
      bestLeft = left
      best = el
    }
  }
  return best
}

function pickInitialFocus(items) {
  if (!items.length) return null
  const tiles = items.filter((el) => el.classList.contains('tile'))
  if (tiles.length) return pickTopLeft(tiles)
  return pickTopLeft(items)
}

function rectCenter(el) {
  const r = el.getBoundingClientRect()
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, r }
}

function findDirectionalTarget(items, current, dir) {
  if (!current || !items.includes(current)) return pickInitialFocus(items)
  const { x: cx, y: cy, r: cr } = rectCenter(current)
  const horizontal = dir === 'left' || dir === 'right'
  const sign = dir === 'left' || dir === 'up' ? -1 : 1

  let best = null
  let bestScore = Infinity
  let fallback = null
  let fallbackScore = Infinity

  for (const el of items) {
    if (el === current) continue
    const { x, y, r } = rectCenter(el)
    const dx = x - cx
    const dy = y - cy

    const primary = horizontal ? dx * sign : dy * sign
    if (primary <= 2) continue

    const lateral = horizontal ? Math.abs(dy) : Math.abs(dx)
    const maxLateral = horizontal ? cr.height * 2.5 : cr.width * 2.5
    if (lateral > maxLateral) continue

    const cross = horizontal
      ? Math.min(cr.bottom, r.bottom) - Math.max(cr.top, r.top)
      : Math.min(cr.right, r.right) - Math.max(cr.left, r.left)
    const crossSize = horizontal ? Math.min(cr.height, r.height) : Math.min(cr.width, r.width)
    const inBand = cross > crossSize * 0.3

    const bandPenalty = inBand ? 0 : Math.min(lateral, maxLateral)
    const score = primary + bandPenalty * 2

    if (fallback === null || score < fallbackScore) {
      fallback = el
      fallbackScore = score
    }
    if (inBand && score < bestScore) {
      best = el
      bestScore = score
    }
  }

  return best || fallback
}

function pageIdOfScopeKey(key) {
  const m = key.match(/page:\d+/)
  return m ? m[0] : null
}

function ensureScopeFocus() {
  const roots = getScopeRoots()
  const key = getScopeKey(roots)
  if (key !== lastScopeKey) {
    const prevKey = lastScopeKey
    lastScopeKey = key
    const inScope = !!(focusedEl && focusedEl.isConnected && roots.some((r) => r.contains(focusedEl)))
    const prevPage = pageIdOfScopeKey(prevKey)
    const nextPage = pageIdOfScopeKey(key)
    const pageChanged = prevPage !== null && nextPage !== null && prevPage !== nextPage
    if (pageChanged) forceInitialFocus = true
    if (!inScope || pageChanged) pendingInitialFocus = true
  }

  if (!focusedEl || !focusedEl.isConnected) pendingInitialFocus = true

  if (!pendingInitialFocus) return roots

  if (shouldPauseForContext() || !uiModeAllowsNav()) return roots

  const items = collectFocusables(roots)
  if (!items.length) return roots
  if (forceInitialFocus || !isValidFocus(items)) {
    setFocused(pickInitialFocus(items))
  }
  forceInitialFocus = false
  pendingInitialFocus = false
  return roots
}

function moveFocus(dir) {
  lastControllerNavAt = performance.now()
  pendingInitialFocus = false

  const roots = getScopeRoots()
  const items = collectFocusables(roots)
  if (!items.length) {
    setFocused(null, { silent: true })
    return
  }

  if (!isValidFocus(items)) {
    setFocused(pickInitialFocus(items))
    return
  }

  const next = findDirectionalTarget(items, focusedEl, dir)
  if (next && next !== focusedEl) setFocused(next)
}

function pollHeldDirection(source, dir, now) {
  if (!dir) {
    repeatState.delete(source)
    return
  }
  const state = repeatState.get(source)
  if (!state || state.dir !== dir) {
    repeatState.set(source, { dir, nextAt: now + REPEAT_DELAY })
    moveFocus(dir)
    return
  }
  if (now >= state.nextAt) {
    state.nextAt = now + REPEAT_RATE
    moveFocus(dir)
  }
}

function resetHeldDirections() {
  repeatState.clear()
  stickEngaged.clear()
  heldKeys.clear()
}

function activateFocused() {
  lastControllerNavAt = performance.now()
  pendingInitialFocus = false
  const roots = getScopeRoots()
  const items = collectFocusables(roots)
  if (!items.length) return

  if (!isValidFocus(items)) {
    const hovered = findHoveredFocusable(items)
    setFocused(hovered || pickInitialFocus(items), { silent: true, scroll: false })
  }

  const el = focusedEl
  if (!el) return
  const tag = el.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
    el.focus()
    return
  }
  if (typeof el.click === 'function') {
    el.click()
  }
}

function findHoveredFocusable(items) {
  for (let i = items.length - 1; i >= 0; i--) {
    if (items[i].matches(':hover')) return items[i]
  }
  return null
}

function goBack() {
  const overlay = getTopOverlayRoot()
  if (overlay) {
    const fn = backHandlers.get(overlay)
    if (fn) {
      fn()
      return true
    }
    const closeBtn = overlay.querySelector(
      '.modal-btn.cancel, .collection-close, .controller-close, .video-player-close, .controller-remap-modal-cancel'
    )
    if (closeBtn) {
      closeBtn.click()
      return true
    }
    if (overlay.classList.contains('modal-overlay') || overlay.classList.contains('g360-overlay') ||
        overlay.classList.contains('collection-overlay') || overlay.classList.contains('controller-overlay') ||
        overlay.classList.contains('visualizer-overlay') || overlay.classList.contains('fs-player')) {
      overlay.click()
      return true
    }
    return false
  }
  const base = backHandlers.get(null)
  if (base) {
    base()
    return true
  }
  return false
}

function handleBumper(delta) {
  if (bumperStack.length > 0) {
    bumperStack[bumperStack.length - 1](delta)
    return true
  }
  return false
}

function handleGuideToggle() {
  window.dispatchEvent(new CustomEvent('nav-guide-toggle'))
}

function handleCloseFocusedApp() {
  window.dispatchEvent(new CustomEvent('nav-close-focused-app'))
}

function handleCloseAllApps() {
  window.dispatchEvent(new CustomEvent('nav-close-all-apps'))
}

function dirFromDpad(buttons) {
  if (!buttons) return null
  if (buttons[BTN.DPAD_UP]) return 'up'
  if (buttons[BTN.DPAD_DOWN]) return 'down'
  if (buttons[BTN.DPAD_LEFT]) return 'left'
  if (buttons[BTN.DPAD_RIGHT]) return 'right'
  return null
}

function dirFromAxes(axes, index) {
  if (!axes || axes.length < 2) return null
  const x = axes[0] || 0
  const y = axes[1] || 0
  const mag = Math.hypot(x, y)
  const releaseAt = stickDeadzone * STICK_RELEASE_RATIO

  if (stickEngaged.has(index)) {
    if (mag < releaseAt) {
      stickEngaged.delete(index)
      return null
    }
  } else {
    if (mag < stickDeadzone) return null
    stickEngaged.add(index)
  }

  const ax = Math.abs(x)
  const ay = Math.abs(y)
  if (ax >= ay) {
    if (ax < releaseAt) return null
    return x < 0 ? 'left' : 'right'
  }
  if (ay < releaseAt) return null
  return y < 0 ? 'up' : 'down'
}

function shouldPauseForContext() {
  if (explicitPause) return true
  if (isRemapOpen()) return true
  if (isIntroVisible()) return true
  if (isSliding()) return true
  return false
}

function uiModeAllowsNav() {
  const overlay = getTopOverlayRoot()
  if (overlay) return true
  if (hasFocusedAppOverlay()) return false
  return true
}

function pollGamepads(now) {
  const raw = navigator.getGamepads ? navigator.getGamepads() : []
  const pause = shouldPauseForContext()
  const uiMode = uiModeAllowsNav()

  for (let i = 0; i < raw.length; i++) {
    const gp = raw[i]
    if (!gp || !gp.connected) continue

    const buttons = gp.buttons.map((b) => b.pressed)
    const prev = prevButtonsByIndex.get(i)
    const prevArr = prev || buttons.map(() => false)
    const rose = (idx) => buttons[idx] && !prevArr[idx]

    if (!pause) {
      if (rose(BTN.GUIDE)) {
        handleGuideToggle()
      } else if (uiMode) {
        if (rose(BTN.A)) activateFocused()
        else if (rose(BTN.B)) goBack()
        else if (rose(BTN.X) && document.querySelector('.g360-overlay')) handleCloseFocusedApp()
        else if (rose(BTN.Y) && document.querySelector('.g360-overlay')) handleCloseAllApps()
        else if (rose(BTN.LB)) handleBumper(-1)
        else if (rose(BTN.RB)) handleBumper(1)
      }
    }

    if (!pause && uiMode) {
      const dpadDir = dirFromDpad(buttons)
      const stickDir = dpadDir ? null : dirFromAxes(gp.axes, i)
      pollHeldDirection(`dpad:${i}`, dpadDir, now)
      pollHeldDirection(`stick:${i}`, stickDir, now)
    } else {
      repeatState.delete(`dpad:${i}`)
      repeatState.delete(`stick:${i}`)
      if (dirFromDpad(buttons)) stickEngaged.delete(i)
    }

    prevButtonsByIndex.set(i, buttons)
  }

  for (const key of Array.from(prevButtonsByIndex.keys())) {
    if (!raw[key]) prevButtonsByIndex.delete(key)
  }
}

const DIR_KEYS = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
}

function onKeyUp(e) {
  if (!DIR_KEYS[e.key]) return
  heldKeys.delete(e.code)
}

function onWindowBlur() {
  heldKeys.clear()
}

function pollKeyboardRepeat(now) {
  if (!heldKeys.size) return
  if (shouldPauseForContext() || !uiModeAllowsNav()) return
  for (const code of heldKeys) {
    const dir = DIR_KEYS[code]
    if (dir) pollHeldDirection(`key:${code}`, dir, now)
  }
}

function onKeyDown(e) {
  if (isTypingTarget(e.target)) return
  if (isRemapOpen()) return
  if (isIntroVisible()) return
  if (isSliding()) return
  if (e.ctrlKey || e.metaKey || e.altKey) return

  if (e.key === 'Escape') {
    const overlay = getTopOverlayRoot()
    if (overlay && !overlay.classList.contains('g360-overlay')) {
      e.preventDefault()
      e.stopImmediatePropagation()
      goBack()
    }
    return
  }

  if (!uiModeAllowsNav()) return

  const dir = DIR_KEYS[e.key]
  if (dir) {
    e.preventDefault()
    if (!e.repeat) {
      const now = performance.now()
      heldKeys.add(e.code)
      repeatState.set(`key:${e.code}`, { dir, nextAt: now + REPEAT_DELAY })
      moveFocus(dir)
    }
    return
  }

  if (e.key === 'Enter' || e.key === ' ') {
    if (e.repeat) return
    e.preventDefault()
    activateFocused()
    return
  }

  if (e.key === 'PageUp') {
    e.preventDefault()
    handleBumper(-1)
    return
  }
  if (e.key === 'PageDown') {
    e.preventDefault()
    handleBumper(1)
  }
}

function onMouseMove(e) {
  if (performance.now() - lastControllerNavAt < 300) return

  const x = e.clientX
  const y = e.clientY
  if (lastMouse) {
    const dx = x - lastMouse.x
    const dy = y - lastMouse.y
    if (dx * dx + dy * dy < 36) return
  }
  lastMouse = { x, y }

  const target = e.target instanceof Element ? e.target.closest(FOCUSABLE_SELECTOR) : null
  if (target && isVisible(target) && !target.closest('[data-nav-ignore]') && !target.closest('[data-nav-skip]')) {
    pendingInitialFocus = false
    if (target !== focusedEl) {
      setFocused(target, { silent: true, scroll: false })
    }
  }
  // Keep controller/keyboard focus when the mouse sits on empty chrome.
}

function loop(now) {
  ensureScopeFocus()
  pollGamepads(now)
  pollKeyboardRepeat(now)
  rafId = requestAnimationFrame(loop)
}

function bindKeyListeners() {
  if (keyListenersBound) return
  window.addEventListener('keydown', onKeyDown, true)
  window.addEventListener('keyup', onKeyUp, true)
  window.addEventListener('blur', onWindowBlur)
  window.addEventListener('mousemove', onMouseMove, { passive: true })
  keyListenersBound = true
}

function unbindKeyListeners() {
  if (!keyListenersBound) return
  window.removeEventListener('keydown', onKeyDown, true)
  window.removeEventListener('keyup', onKeyUp, true)
  window.removeEventListener('blur', onWindowBlur)
  window.removeEventListener('mousemove', onMouseMove)
  keyListenersBound = false
}

export function startNavEngine() {
  if (started) return
  started = true
  lastScopeKey = ''
  pendingInitialFocus = true
  forceInitialFocus = false
  resetHeldDirections()
  bindKeyListeners()
  rafId = requestAnimationFrame(loop)
}

export function stopNavEngine() {
  if (!started) return
  started = false
  unbindKeyListeners()
  if (rafId) cancelAnimationFrame(rafId)
  rafId = null
  setFocused(null, { silent: true })
  prevButtonsByIndex.clear()
  resetHeldDirections()
  lastMouse = null
  lastControllerNavAt = 0
  lastScopeKey = ''
  pendingInitialFocus = true
  forceInitialFocus = false
}

export function registerBackHandler(elementOrFn, maybeFn) {
  let el
  let fn
  if (typeof elementOrFn === 'function') {
    el = null
    fn = elementOrFn
  } else {
    el = elementOrFn
    fn = maybeFn
  }
  backHandlers.set(el, fn)
  return () => {
    if (backHandlers.get(el) === fn) backHandlers.delete(el)
  }
}

export function registerBumperHandler(fn) {
  bumperStack.push(fn)
  return () => {
    const i = bumperStack.lastIndexOf(fn)
    if (i >= 0) bumperStack.splice(i, 1)
  }
}

export function setNavPaused(paused) {
  explicitPause = !!paused
}

export function setNavStickDeadzone(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return
  stickDeadzone = Math.min(STICK_DEADZONE_CEIL, Math.max(STICK_DEADZONE_FLOOR, n))
}

export function clearNavFocus() {
  setFocused(null, { silent: true })
  pendingInitialFocus = true
}

export function getNavFocused() {
  return focusedEl
}
