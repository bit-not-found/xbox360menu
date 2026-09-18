import { useState, useEffect, useRef, useCallback } from 'react'

export function useGamepad() {
  const [gamepads, setGamepads] = useState([])
  const rafRef = useRef(null)
  const prevRawRef = useRef([])

  const poll = useCallback(() => {
    const raw = navigator.getGamepads ? navigator.getGamepads() : []
    const connected = []
    for (let i = 0; i < raw.length; i++) {
      const gp = raw[i]
      if (gp) {
        connected.push({
          index: gp.index,
          id: gp.id,
          mapping: gp.mapping,
          connected: gp.connected,
          axes: [...gp.axes],
          buttons: gp.buttons.map(b => ({
            pressed: b.pressed,
            touched: b.touched,
            value: b.value,
          })),
        })
      }
    }

    let changed = connected.length !== prevRawRef.current.length
    if (!changed) {
      for (let i = 0; i < connected.length; i++) {
        const a = prevRawRef.current[i]
        const b = connected[i]
        if (!a || !b || a.id !== b.id || a.connected !== b.connected) {
          changed = true
          break
        }
      }
    }

    if (changed) {
      prevRawRef.current = connected
      setGamepads(connected)
    }

    rafRef.current = requestAnimationFrame(poll)
  }, [])

  useEffect(() => {
    const onConnect = (e) => {
      setGamepads(prev => {
        const exists = prev.some(g => g.index === e.gamepad.index)
        if (exists) return prev
        return [...prev, {
          index: e.gamepad.index,
          id: e.gamepad.id,
          mapping: e.gamepad.mapping,
          connected: true,
          axes: [...e.gamepad.axes],
          buttons: e.gamepad.buttons.map(b => ({
            pressed: b.pressed,
            touched: b.touched,
            value: b.value,
          })),
        }]
      })
    }

    const onDisconnect = (e) => {
      setGamepads(prev => prev.filter(g => g.index !== e.gamepad.index))
    }

    window.addEventListener('gamepadconnected', onConnect)
    window.addEventListener('gamepaddisconnected', onDisconnect)

    rafRef.current = requestAnimationFrame(poll)

    return () => {
      window.removeEventListener('gamepadconnected', onConnect)
      window.removeEventListener('gamepaddisconnected', onDisconnect)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [poll])

  const getGamepad = useCallback((index) => {
    return gamepads.find(g => g.index === index) || null
  }, [gamepads])

  return { gamepads, getGamepad }
}
