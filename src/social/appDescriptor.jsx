import AvatarWorldApp from './avatar-world/AvatarWorldApp'

export function buildAppDescriptor(entry) {
  return {
    id: `social-${entry.id}`,
    label: entry.title,
    url: `social://${entry.id}`,
    type: 'internal',
    component: entry.id === 'avatar-world' ? <AvatarWorldApp appId={entry.id} /> : null,
  }
}
