export type SocialAppGroup = 'play' | 'create' | 'watch'

export type AvatarWorldModule = typeof import('./avatar-world')

export interface SocialAppEntry {
  id: string
  title: string
  tagline: string
  icon: string
  group: SocialAppGroup
  available: boolean
  load?: () => Promise<AvatarWorldModule>
}

export const SOCIAL_BLADE_LABEL = 'Social Apps'

export const SOCIAL_APP_GROUPS: { id: SocialAppGroup; label: string }[] = [
  { id: 'play', label: 'Social Apps' },
  { id: 'create', label: 'Create' },
  { id: 'watch', label: 'Watch Together' },
]

export const SOCIAL_APPS: SocialAppEntry[] = [
  {
    id: 'avatar-world',
    title: 'Avatar World',
    tagline: 'Import your VRoid avatar and make it your own.',
    icon: './assets/icons/profile.png',
    group: 'play',
    available: true,
    load: () => import('./avatar-world'),
  },
  {
    id: 'rooms',
    title: 'Rooms',
    tagline: 'Hang out in shared spaces. Coming soon.',
    icon: './assets/icons/Friends.png',
    group: 'play',
    available: false,
  },
  {
    id: 'chats',
    title: 'Chats',
    tagline: 'Text and voice with friends. Coming soon.',
    icon: './assets/icons/SignIn.png',
    group: 'play',
    available: false,
  },
  {
    id: 'studio',
    title: 'Avatar Studio',
    tagline: 'Tweak and export poses. Coming soon.',
    icon: './assets/icons/profile_settings.png',
    group: 'create',
    available: false,
  },
  {
    id: 'watch',
    title: 'Watch Party',
    tagline: 'Synchronized video with friends. Coming soon.',
    icon: './assets/icons/video.png',
    group: 'watch',
    available: false,
  },
]

export function getSocialApp(id: string): SocialAppEntry | undefined {
  return SOCIAL_APPS.find((app) => app.id === id)
}
