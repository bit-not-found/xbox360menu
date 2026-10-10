import { useState } from 'react'
import Tile from './Tile'
import SocialAppsHub from '../social/SocialAppsHub'

export default function SocialPage({ onOpenApp }) {
  const [showApps, setShowApps] = useState(false)

  return (
    <div className="social-grid">
      <div className="social-left-1">
        <Tile label="Friends" icon={<img src="./assets/icons/Friends.png" alt="Friends" />} />
      </div>
      <div className="social-left-2">
        <Tile
          label="Social Apps"
          icon={<img src="./assets/icons/social_Apps.png" alt="Social Apps" />}
          onClick={() => setShowApps(true)}
        />
      </div>
      <div className="social-left-3">
        <Tile label="Sign In or Out" icon={<img src="./assets/icons/SignIn.png" alt="Sign In" />} />
      </div>

      {showApps && (
        <SocialAppsHub onClose={() => setShowApps(false)} onOpenApp={onOpenApp} />
      )}
    </div>
  )
}
