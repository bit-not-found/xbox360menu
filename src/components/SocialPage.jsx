import { useCallback, useEffect, useRef, useState } from 'react'
import Tile from './Tile'
import SocialAppsHub from '../social/SocialAppsHub'
import { buildAppDescriptor } from '../social/appDescriptor'
import { getSocialApp } from '../social/registry'
import { onNavFocusChange } from '../navigation/navEngine'

export default function SocialPage({ onOpenApp, isActive = false }) {
  const [showApps, setShowApps] = useState(false)
  const [stageHandle, setStageHandle] = useState(null)
  const [stageReady, setStageReady] = useState(false)
  const stageRef = useRef(null)
  const stageHandleRef = useRef(null)
  const bootedRef = useRef(false)
  const mountedRef = useRef(true)
  const isActiveRef = useRef(isActive)

  useEffect(() => {
    isActiveRef.current = isActive
  }, [isActive])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      stageHandleRef.current?.dispose()
      stageHandleRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!isActive || bootedRef.current || !stageRef.current) return
    bootedRef.current = true

    ;(async () => {
      try {
        const [stage, avatarsStore] = await Promise.all([
          import('../vrm-stage'),
          import('../social/avatar-world/store/avatars'),
        ])
        if (!mountedRef.current || !stageRef.current) return
        const active = await avatarsStore.getActiveAvatar().catch(() => undefined)
        if (!mountedRef.current || !stageRef.current) return
        const handle = await stage.mountSocialStage(stageRef.current, {
          mainSource: active?.blob,
          friendCount: 2,
          isActive: isActiveRef.current,
        })
        if (!mountedRef.current) {
          handle.dispose()
          return
        }
        stageHandleRef.current = handle
        setStageHandle(handle)
        handle.ready
          .then(() => {
            if (mountedRef.current) setStageReady(true)
          })
          .catch(() => {})
      } catch (error) {
        bootedRef.current = false
        console.error('[SocialPage] Failed to start avatar stage:', error)
      }
    })()
  }, [isActive])

  useEffect(() => {
    stageHandleRef.current?.setActive(isActive)
  }, [isActive, stageHandle])

  useEffect(() => {
    return onNavFocusChange((el) => {
      const tileEl = el?.closest?.('[data-tile-id]')
      if (!tileEl) {
        stageHandleRef.current?.notifyTileBlur()
        return
      }
      stageHandleRef.current?.notifyTileFocus(tileEl.getAttribute('data-tile-id'), tileEl)
    })
  }, [])

  const handleTileHover = useCallback((tileId, event) => {
    const tileEl = event.currentTarget.closest('[data-tile-id]') ?? event.currentTarget
    stageHandleRef.current?.notifyTileFocus(tileId, tileEl)
  }, [])

  const handleTileLeave = useCallback(() => {
    stageHandleRef.current?.notifyTileBlur()
  }, [])

  const openAvatarWorld = useCallback(() => {
    const entry = getSocialApp('avatar-world')
    if (!entry) return
    onOpenApp(buildAppDescriptor(entry))
  }, [onOpenApp])

  const handleAvatarTileClick = useCallback(() => {
    stageHandleRef.current?.notifyTileClick('avatar')
    openAvatarWorld()
  }, [openAvatarWorld])

  return (
    <div className="social-grid">
      <div className="social-left-1" data-tile-id="friends">
        <Tile
          label="Friends"
          icon={<img src="./assets/icons/Friends.png" alt="Friends" />}
          onMouseEnter={(e) => handleTileHover('friends', e)}
          onMouseLeave={handleTileLeave}
        />
      </div>
      <div className="social-left-2" data-tile-id="apps">
        <Tile
          label="Social Apps"
          icon={<img src="./assets/icons/social_Apps.png" alt="Social Apps" />}
          onClick={() => setShowApps(true)}
          onMouseEnter={(e) => handleTileHover('apps', e)}
          onMouseLeave={handleTileLeave}
        />
      </div>
      <div className="social-left-3" data-tile-id="signin">
        <Tile
          label="Sign In or Out"
          icon={<img src="./assets/icons/SignIn.png" alt="Sign In" />}
          onMouseEnter={(e) => handleTileHover('signin', e)}
          onMouseLeave={handleTileLeave}
        />
      </div>
      <div className="social-left-4" data-tile-id="avatar">
        <Tile
          label="My Avatar"
          icon={<img src="./assets/icons/profile.png" alt="My Avatar" />}
          onClick={handleAvatarTileClick}
          onMouseEnter={(e) => handleTileHover('avatar', e)}
          onMouseLeave={handleTileLeave}
        />
      </div>

      <div
        className={`social-stage${stageReady ? ' social-stage-ready' : ''}${isActive ? ' social-stage-active' : ''}`}
        ref={stageRef}
        aria-hidden="true"
        data-nav-ignore=""
      />

      {showApps && (
        <SocialAppsHub onClose={() => setShowApps(false)} onOpenApp={onOpenApp} />
      )}
    </div>
  )
}
