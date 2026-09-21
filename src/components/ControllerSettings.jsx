import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useGamepad } from '../hooks/useGamepad'
import { useConfig } from '../context/ConfigContext'

const hoverAudio = new Audio('./assets/audio/hover.mp3')
const backAudio = new Audio('./assets/audio/Back.mp3')
const selectAudio = new Audio('./assets/audio/Select.mp3')

const playHover = () => { hoverAudio.currentTime = 0; hoverAudio.play().catch(() => {}) }
const playBack = () => { backAudio.currentTime = 0; backAudio.play().catch(() => {}) }
const playSelect = () => { selectAudio.currentTime = 0; selectAudio.play().catch(() => {}) }

const GUIDE_BUTTONS = [
  { id: 'a', label: 'A', color: '#107c10' },
  { id: 'b', label: 'B', color: '#e81123' },
  { id: 'x', label: 'X', color: '#0078d7' },
  { id: 'y', label: 'Y', color: '#ffb900' },
  { id: 'lb', label: 'LB' },
  { id: 'rb', label: 'RB' },
  { id: 'lt', label: 'LT' },
  { id: 'rt', label: 'RT' },
  { id: 'start', label: 'Start' },
  { id: 'back', label: 'Back' },
  { id: 'dpad-up', label: 'D-Up', isDpad: true },
  { id: 'dpad-down', label: 'D-Down', isDpad: true },
  { id: 'dpad-left', label: 'D-Left', isDpad: true },
  { id: 'dpad-right', label: 'D-Right', isDpad: true },
  { id: 'ls', label: 'LS Click' },
  { id: 'rs', label: 'RS Click' },
]

const DEFAULT_BINDINGS = {
  a: 'gamepad:a', b: 'gamepad:b', x: 'gamepad:x', y: 'gamepad:y',
  lb: 'gamepad:lb', rb: 'gamepad:rb', lt: 'gamepad:lt', rt: 'gamepad:rt',
  start: 'gamepad:start', back: 'gamepad:back',
  ls: 'gamepad:ls', rs: 'gamepad:rs',
  'dpad-up': 'gamepad:dpad-up', 'dpad-down': 'gamepad:dpad-down',
  'dpad-left': 'gamepad:dpad-left', 'dpad-right': 'gamepad:dpad-right',
}

const PRESETS = {
  standard: {
    label: 'Standard Xbox Layout',
    bindings: { ...DEFAULT_BINDINGS },
  },
  nintendo: {
    label: 'Nintendo Swap',
    bindings: {
      ...DEFAULT_BINDINGS,
      a: 'gamepad:b', b: 'gamepad:a', x: 'gamepad:y', y: 'gamepad:x',
    },
  },
  arcade: {
    label: 'Arcade Stick',
    bindings: {
      ...DEFAULT_BINDINGS,
      a: 'gamepad:rt', b: 'gamepad:rb', x: 'gamepad:lt', y: 'gamepad:lb',
      lb: 'gamepad:a', rb: 'gamepad:b', lt: 'gamepad:x', rt: 'gamepad:y',
    },
  },
  wasd: {
    label: 'WASD Keyboard',
    bindings: {
      a: 'KeyZ', b: 'KeyX', x: 'KeyA', y: 'KeyS',
      lb: 'KeyQ', rb: 'KeyE', lt: 'ShiftLeft', rt: 'ControlLeft',
      start: 'Enter', back: 'Escape',
      ls: 'KeyC', rs: 'KeyV',
      'dpad-up': 'ArrowUp', 'dpad-down': 'ArrowDown',
      'dpad-left': 'ArrowLeft', 'dpad-right': 'ArrowRight',
    },
  },
}

const XBOX_BUTTON_MAP = [
  'a', 'b', 'x', 'y', 'lb', 'rb', 'lt', 'rt',
  'back', 'start', 'ls', 'rs', 'dpad-up', 'dpad-down',
  'dpad-left', 'dpad-right',
]

function getInputLabel(binding) {
  if (!binding) return 'Default'
  if (binding.startsWith('gamepad:')) {
    const btn = binding.replace('gamepad:', '')
    const found = GUIDE_BUTTONS.find(b => b.id === btn)
    return found ? found.label : btn.toUpperCase()
  }
  if (binding.startsWith('Key')) return binding.slice(3)
  if (binding.startsWith('Digit')) return binding.slice(5)
  if (binding === 'Space') return 'Space'
  if (binding === 'ArrowUp') return 'Up'
  if (binding === 'ArrowDown') return 'Down'
  if (binding === 'ArrowLeft') return 'Left'
  if (binding === 'ArrowRight') return 'Right'
  if (binding === 'ShiftLeft') return 'LShift'
  if (binding === 'ShiftRight') return 'RShift'
  if (binding === 'ControlLeft') return 'LCtrl'
  if (binding === 'ControlRight') return 'RCtrl'
  return binding
}

function getDefaultInputLabel(virtualBtn) {
  const def = DEFAULT_BINDINGS[virtualBtn]
  return getInputLabel(def)
}

export default function ControllerSettings({ onClose, isActive }) {
  const { config, updateConfig } = useConfig()
  const { gamepads } = useGamepad()
  const [isClosing, setIsClosing] = useState(false)
  const [remapPlayer, setRemapPlayer] = useState(null)
  const [remapButton, setRemapButton] = useState(null)
  const [waitingForInput, setWaitingForInput] = useState(false)

  const settings = config?.controllerSettings || {
    playerAssignments: [{ type: 'keyboard', index: 0 }, null, null, null],
    bindings: { 0: {}, 1: {}, 2: {}, 3: {} },
    deadzones: { 0: { left: 0.15, right: 0.15 }, 1: { left: 0.15, right: 0.15 }, 2: { left: 0.15, right: 0.15 }, 3: { left: 0.15, right: 0.15 } },
    preset: { 0: 'standard', 1: 'standard', 2: 'standard', 3: 'standard' },
  }

  const handleClose = useCallback(() => {
    playBack()
    setIsClosing(true)
    setTimeout(() => onClose(), 300)
  }, [onClose])

  useEffect(() => {
    if (!isActive) {
      handleClose()
    }
  }, [isActive, handleClose])

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation()
        handleClose()
      }
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [handleClose])

  const updateSetting = useCallback((key, value) => {
    const newSettings = { ...settings, [key]: value }
    updateConfig('controllerSettings', newSettings)
  }, [settings, updateConfig])

  const updateAssignment = useCallback((playerIndex, assignment) => {
    const newAssignments = [...settings.playerAssignments]
    if (assignment?.type === 'gamepad') {
      for (let i = 0; i < newAssignments.length; i++) {
        if (i !== playerIndex && newAssignments[i]?.type === 'gamepad' && newAssignments[i]?.index === assignment.index) {
          newAssignments[i] = null
        }
      }
    }
    newAssignments[playerIndex] = assignment
    updateSetting('playerAssignments', newAssignments)
  }, [settings, updateSetting])

  const updateBinding = useCallback((playerIndex, buttonId, physicalInput) => {
    const newBindings = { ...settings.bindings }
    newBindings[playerIndex] = { ...newBindings[playerIndex], [buttonId]: physicalInput }
    updateSetting('bindings', newBindings)
  }, [settings, updateSetting])

  const clearBinding = useCallback((playerIndex, buttonId) => {
    const newBindings = { ...settings.bindings }
    newBindings[playerIndex] = { ...newBindings[playerIndex] }
    delete newBindings[playerIndex][buttonId]
    updateSetting('bindings', newBindings)
  }, [settings, updateSetting])

  const resetBindings = useCallback((playerIndex) => {
    const newBindings = { ...settings.bindings }
    newBindings[playerIndex] = {}
    updateSetting('bindings', newBindings)
  }, [settings, updateSetting])

  const updateDeadzone = useCallback((playerIndex, stick, value) => {
    const newDeadzones = { ...settings.deadzones }
    newDeadzones[playerIndex] = { ...newDeadzones[playerIndex], [stick]: value }
    updateSetting('deadzones', newDeadzones)
  }, [settings, updateSetting])

  const applyPreset = useCallback((playerIndex, presetId) => {
    const newBindings = { ...settings.bindings }
    newBindings[playerIndex] = { ...PRESETS[presetId].bindings }
    const newPreset = { ...settings.preset, [playerIndex]: presetId }
    updateSetting('bindings', newBindings)
    updateSetting('preset', newPreset)
  }, [settings, updateSetting])

  const testRumble = useCallback((gamepadIndex) => {
    const gp = navigator.getGamepads?.()[gamepadIndex]
    if (gp?.vibrationActuator) {
      gp.vibrationActuator.playEffect('dual-rumble', {
        startDelay: 0,
        duration: 500,
        weakMagnitude: 0.5,
        strongMagnitude: 0.8,
      }).catch(() => {})
    }
  }, [])

  const startRemap = useCallback((playerIndex, buttonId) => {
    setRemapPlayer(playerIndex)
    setRemapButton(buttonId)
    setWaitingForInput(true)
  }, [])

  const remapPlayerRef = useRef(null)
  const remapButtonRef = useRef(null)
  const waitingRef = useRef(false)

  useEffect(() => {
    remapPlayerRef.current = remapPlayer
    remapButtonRef.current = remapButton
    waitingRef.current = waitingForInput
  }, [remapPlayer, remapButton, waitingForInput])

  useEffect(() => {
    if (!waitingForInput || remapPlayer === null || !remapButton) return

    let prevButtons = {}
    const raw = navigator.getGamepads ? navigator.getGamepads() : []
    for (let i = 0; i < raw.length; i++) {
      if (raw[i]) {
        prevButtons[i] = raw[i].buttons.map(b => b.pressed)
      }
    }

    let rafId = null
    const pollGamepad = () => {
      if (!waitingRef.current) return
      const gamepads = navigator.getGamepads ? navigator.getGamepads() : []
      for (let i = 0; i < gamepads.length; i++) {
        const gp = gamepads[i]
        if (!gp) continue
        const prev = prevButtons[i] || []
        for (let b = 0; b < gp.buttons.length; b++) {
          if (gp.buttons[b].pressed && !prev[b]) {
            const btn = XBOX_BUTTON_MAP[b]
            if (btn) {
              updateBinding(remapPlayerRef.current, remapButtonRef.current, `gamepad:${btn}`)
              setWaitingForInput(false)
              setRemapPlayer(null)
              setRemapButton(null)
              playSelect()
              return
            }
          }
        }
        prevButtons[i] = gp.buttons.map(b => b.pressed)
      }
      rafId = requestAnimationFrame(pollGamepad)
    }
    rafId = requestAnimationFrame(pollGamepad)

    const onKeyDown = (e) => {
      e.stopImmediatePropagation()
      e.preventDefault()
      if (e.key === 'Escape') {
        setWaitingForInput(false)
        setRemapPlayer(null)
        setRemapButton(null)
        return
      }
      updateBinding(remapPlayerRef.current, remapButtonRef.current, e.code)
      setWaitingForInput(false)
      setRemapPlayer(null)
      setRemapButton(null)
      playSelect()
    }

    window.addEventListener('keydown', onKeyDown, true)
    return () => {
      if (rafId) cancelAnimationFrame(rafId)
      window.removeEventListener('keydown', onKeyDown, true)
    }
  }, [waitingForInput, remapPlayer, remapButton, updateBinding])

  const getControllerName = (gp) => {
    if (!gp) return 'Unknown Controller'
    const name = gp.id.split('(')[0].trim()
    return name.length > 30 ? name.slice(0, 27) + '...' : name
  }

  const renderGuideCircle = (playerIndex) => {
    const assignment = settings.playerAssignments[playerIndex]
    const isConnected = assignment?.type === 'gamepad' && gamepads.some(g => g.index === assignment.index)

    return (
      <div className={`controller-guide-circle ${isConnected ? 'connected' : ''}`}>
        <div className={`controller-led led-top ${isConnected ? 'on' : ''}`} />
        <div className={`controller-led led-right ${isConnected ? 'on' : ''}`} />
        <div className={`controller-led led-bottom ${isConnected ? 'on' : ''}`} />
        <div className={`controller-led led-left ${isConnected ? 'on' : ''}`} />
        <div className="controller-guide-icon">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
            <circle cx="12" cy="12" r="4"/>
          </svg>
        </div>
      </div>
    )
  }

  return createPortal(
    <div className={`controller-overlay ${isClosing ? 'closing' : ''}`} onClick={handleClose}>
      <div className="controller-container" onClick={e => e.stopPropagation()}>
        <div className="controller-topbar">
          <h2 className="controller-title">Controller Settings</h2>
          <button className="controller-close" onClick={handleClose}>✕</button>
        </div>

        <div className="controller-body">
          <div className="controller-section">
            <h3 className="controller-section-title">Connected Controllers</h3>
            <div className="controller-slots">
              {[0, 1, 2, 3].map(i => {
                const assignment = settings.playerAssignments[i]
                const gp = assignment?.type === 'gamepad' ? gamepads.find(g => g.index === assignment.index) : null

                return (
                  <div key={i} className={`controller-slot ${assignment ? 'active' : ''}`}>
                    {renderGuideCircle(i)}
                    <div className="controller-slot-info">
                      <div className="controller-slot-label">Player {i + 1}</div>
                      {assignment?.type === 'gamepad' && gp ? (
                        <div className="controller-slot-detail">
                          <span className="controller-slot-status connected">Connected</span>
                          <span className="controller-slot-name">{getControllerName(gp)}</span>
                        </div>
                      ) : assignment?.type === 'keyboard' ? (
                        <div className="controller-slot-detail">
                          <span className="controller-slot-status connected">Keyboard</span>
                          <span className="controller-slot-name">Default Input</span>
                        </div>
                      ) : (
                        <div className="controller-slot-detail">
                          <span className="controller-slot-status">No Controller</span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="controller-section">
            <h3 className="controller-section-title">Input Assignment</h3>
            <div className="controller-assignment-matrix">
              {[0, 1, 2, 3].map(i => (
                <div key={i} className="controller-assignment-row">
                  <span className="controller-assignment-label">Player {i + 1}</span>
                  <div className="controller-assignment-options">
                    <button
                      className={`controller-assignment-btn ${settings.playerAssignments[i]?.type === 'keyboard' ? 'active' : ''}`}
                      onClick={() => { playSelect(); updateAssignment(i, { type: 'keyboard', index: 0 }) }}
                    >
                      Keyboard
                    </button>
                    {gamepads.map(gp => (
                      <button
                        key={gp.index}
                        className={`controller-assignment-btn ${settings.playerAssignments[i]?.type === 'gamepad' && settings.playerAssignments[i]?.index === gp.index ? 'active' : ''}`}
                        onClick={() => { playSelect(); updateAssignment(i, { type: 'gamepad', index: gp.index }) }}
                      >
                        Gamepad {gp.index + 1}
                      </button>
                    ))}
                    {settings.playerAssignments[i] && (
                      <button
                        className="controller-assignment-btn unassign"
                        onClick={() => { playSelect(); updateAssignment(i, null) }}
                      >
                        None
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="controller-section">
            <h3 className="controller-section-title">Button Remapping</h3>
            <p className="controller-section-desc">Click a button below, then press the key or controller button you want it mapped to.</p>
            <div className="controller-remap-grid">
              {[0, 1, 2, 3].map(i => (
                <div key={i} className="controller-remap-player">
                  <div className="controller-remap-player-header">
                    <span>Player {i + 1}</span>
                    <button className="controller-remap-reset" onClick={() => { playSelect(); resetBindings(i) }}>
                      Reset All
                    </button>
                  </div>
                  <div className="controller-remap-buttons">
                    {GUIDE_BUTTONS.map(btn => {
                      const currentBinding = settings.bindings[i]?.[btn.id]
                      const isCustom = !!currentBinding
                      const label = isCustom ? getInputLabel(currentBinding) : getDefaultInputLabel(btn.id)
                      const isDefault = !isCustom

                      return (
                        <button
                          key={btn.id}
                          className={`controller-remap-btn ${isCustom ? 'mapped' : ''} ${remapPlayer === i && remapButton === btn.id ? 'waiting' : ''}`}
                          style={btn.color ? { borderColor: btn.color } : undefined}
                          onClick={() => { playSelect(); startRemap(i, btn.id) }}
                        >
                          <span className="controller-remap-btn-label">{btn.label}</span>
                          <span className={`controller-remap-btn-value ${isDefault ? 'default' : 'custom'}`}>
                            {label}
                          </span>
                          {isCustom && (
                            <button
                              className="controller-remap-btn-clear"
                              onClick={(e) => { e.stopPropagation(); playSelect(); clearBinding(i, btn.id) }}
                              title="Reset to default"
                            >
                              ✕
                            </button>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="controller-section">
            <h3 className="controller-section-title">Deadzone & Vibration</h3>
            <div className="controller-calibration-grid">
              {[0, 1, 2, 3].map(i => {
                const assignment = settings.playerAssignments[i]
                const gp = assignment?.type === 'gamepad' ? gamepads.find(g => g.index === assignment.index) : null

                return (
                  <div key={i} className="controller-calibration-player">
                    <div className="controller-calibration-header">Player {i + 1}</div>
                    <div className="controller-deadzone-group">
                      <label className="controller-deadzone-label">
                        Left Stick: {((settings.deadzones[i]?.left || 0.15) * 100).toFixed(0)}%
                      </label>
                      <input
                        type="range"
                        min="0.05"
                        max="0.30"
                        step="0.01"
                        value={settings.deadzones[i]?.left || 0.15}
                        onChange={(e) => { updateDeadzone(i, 'left', parseFloat(e.target.value)) }}
                        className="controller-slider"
                      />
                    </div>
                    <div className="controller-deadzone-group">
                      <label className="controller-deadzone-label">
                        Right Stick: {((settings.deadzones[i]?.right || 0.15) * 100).toFixed(0)}%
                      </label>
                      <input
                        type="range"
                        min="0.05"
                        max="0.30"
                        step="0.01"
                        value={settings.deadzones[i]?.right || 0.15}
                        onChange={(e) => { updateDeadzone(i, 'right', parseFloat(e.target.value)) }}
                        className="controller-slider"
                      />
                    </div>
                    <button
                      className="controller-rumble-btn"
                      disabled={!gp}
                      onClick={() => { playSelect(); testRumble(gp?.index) }}
                    >
                      {gp ? 'Test Rumble' : 'No Gamepad'}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="controller-section">
            <h3 className="controller-section-title">Preset Profiles</h3>
            <div className="controller-presets-grid">
              {[0, 1, 2, 3].map(i => (
                <div key={i} className="controller-preset-player">
                  <div className="controller-preset-header">Player {i + 1}</div>
                  <div className="controller-preset-options">
                    {Object.entries(PRESETS).map(([id, preset]) => (
                      <button
                        key={id}
                        className={`controller-preset-btn ${settings.preset?.[i] === id ? 'active' : ''}`}
                        onClick={() => { playSelect(); applyPreset(i, id) }}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {waitingForInput && (
          <div className="controller-remap-modal" onClick={(e) => e.stopPropagation()}>
            <div className="controller-remap-modal-content">
              <div className="controller-remap-modal-icon">⬤</div>
              <div className="controller-remap-modal-title">Press a Button</div>
              <div className="controller-remap-modal-subtitle">
                Press a button on your controller or keyboard
              </div>
              <div className="controller-remap-modal-hint">
                Remapping: Player {remapPlayer + 1} → {GUIDE_BUTTONS.find(b => b.id === remapButton)?.label}
              </div>
              <button
                className="controller-remap-modal-cancel"
                onClick={() => { playBack(); setWaitingForInput(false); setRemapPlayer(null); setRemapButton(null) }}
              >
                Cancel (Esc)
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
