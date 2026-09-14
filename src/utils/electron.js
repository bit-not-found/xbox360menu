export function isElectron() {
  try {
    return typeof window !== 'undefined' && typeof window.require === 'function'
  } catch {
    return false
  }
}

export function getIpcRenderer() {
  if (!isElectron()) return null
  try {
    return window.require('electron').ipcRenderer
  } catch {
    return null
  }
}

export function getNodeFs() {
  if (!isElectron()) return null
  try {
    return window.require('fs')
  } catch {
    return null
  }
}

export function getNodePath() {
  if (!isElectron()) return null
  try {
    return window.require('path')
  } catch {
    return null
  }
}

export function getNodeChildProcess() {
  if (!isElectron()) return null
  try {
    return window.require('child_process')
  } catch {
    return null
  }
}

export function getNodeHttps() {
  if (!isElectron()) return null
  try {
    return window.require('https')
  } catch {
    return null
  }
}

export function browserBasename(filePath) {
  const parts = filePath.replace(/\\/g, '/').split('/')
  return parts[parts.length - 1] || ''
}

export function browserExtname(filePath) {
  const base = browserBasename(filePath)
  const dotIndex = base.lastIndexOf('.')
  return dotIndex > 0 ? base.slice(dotIndex) : ''
}

export function browserBasenameNoExt(filePath) {
  const base = browserBasename(filePath)
  const dotIndex = base.lastIndexOf('.')
  return dotIndex > 0 ? base.slice(0, dotIndex) : base
}

export function browserJoin(...parts) {
  return parts.join('/').replace(/\/+/g, '/')
}

export function toFileUrl(filePath) {
  let formatted = filePath.replace(/\\/g, '/')
  if (formatted.match(/^[a-zA-Z]:/)) {
    formatted = `file:///${formatted}`
  }
  return encodeURI(formatted).replace(/#/g, '%23')
}
