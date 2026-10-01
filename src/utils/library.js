import { useSyncExternalStore } from 'react'

const SECTIONS = ['media', 'music', 'apps']

const sections = { media: [], music: [], apps: [] }
let snapshot = { ...sections }
const listeners = new Set()

function emit() {
  snapshot = {}
  SECTIONS.forEach(section => { snapshot[section] = sections[section] })
  listeners.forEach(listener => listener())
}

// Pages publish their items so any other page (e.g. Home "My Pins") can reach them.
export function publishLibrary(section, items) {
  sections[section] = items || []
  emit()
}

export function clearLibrary(section) {
  publishLibrary(section, [])
}

export function subscribeLibrary(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getLibrary() {
  return snapshot
}

export function useLibrary() {
  return useSyncExternalStore(subscribeLibrary, getLibrary, getLibrary)
}