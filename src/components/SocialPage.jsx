import Tile from './Tile'

export default function SocialPage() {
  return (
    <div className="social-grid">
      <div className="social-left-1">
        <Tile label="Friends" icon={<img src="./assets/icons/Friends.png" alt="Friends" />} />
      </div>
      <div className="social-left-2">
        <Tile label="Social Apps" icon={<img src="./assets/icons/social_Apps.png" alt="Social Apps" />} />
      </div>
      <div className="social-left-3">
        <Tile label="Sign In or Out" icon={<img src="./assets/icons/SignIn.png" alt="Sign In" />} />
      </div>
    </div>
  )
}


