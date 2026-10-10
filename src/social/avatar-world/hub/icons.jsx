import { createElement } from 'react'

function make(path, extra = {}) {
  return function Icon({ className, size = 22 }) {
    return createElement(
      'svg',
      {
        className,
        width: size,
        height: size,
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: extra.stroke ?? 1.6,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        'aria-hidden': true,
        focusable: false,
      },
      path,
    )
  }
}

export const Person = make(
  <>
    <circle cx="12" cy="8" r="3.4" />
    <path d="M5.5 19.5a6.5 6.5 0 0 1 13 0" />
  </>,
)

export const DressUp = make(
  <>
    <path d="M9 3 5 5 3.5 9.5 6 11v9h12v-9l2.5-1.5L19 5l-4-2a3 3 0 0 1-6 0Z" />
    <path d="M9 3v3a3 3 0 0 0 6 0V3" />
  </>,
)

export const Poses = make(
  <>
    <circle cx="12" cy="5" r="2" />
    <path d="M12 7v6l-3 6M12 13l3 6M8 10h8" />
  </>,
)

export const Smile = make(
  <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M8.5 14a4 4 0 0 0 7 0" />
    <path d="M9 9.5h.01M15 9.5h.01" strokeWidth="2.2" />
  </>,
)

export const Earrings = make(
  <>
    <path d="M8 4c-2 0-3.5 1.6-3.5 3.6 0 1.8 1.4 2.6 1.4 4.4 0 1.2-.9 2-.9 2 0 1.7 1.4 3 3 3s3-1.3 3-3" />
    <circle cx="8" cy="19.5" r="1.6" />
    <path d="M16 4c2 0 3.5 1.6 3.5 3.6 0 1.8-1.4 2.6-1.4 4.4 0 1.2.9 2 .9 2 0 1.7-1.4 3-3 3" />
  </>,
)

export const Glasses = make(
  <>
    <circle cx="6.5" cy="14" r="3.2" />
    <circle cx="17.5" cy="14" r="3.2" />
    <path d="M9.7 14c.7-1 1.9-1 2.6 0M3.3 12 5 7h2M20.7 12 19 7h-2" />
  </>,
)

export const Gloves = make(
  <>
    <path d="M7 11V6.5a1.5 1.5 0 0 1 3 0V11m0-1V5a1.5 1.5 0 0 1 3 0v5m0-1V6a1.5 1.5 0 0 1 3 0v7c0 3.3-2.2 6-5.5 6S5 16.3 5 13v-2a1.5 1.5 0 0 1 3 0" />
  </>,
)

export const Hat = make(
  <>
    <path d="M3.5 16.5c0-4.7 3.8-8.5 8.5-8.5s8.5 3.8 8.5 8.5" />
    <path d="M2.5 16.5h19" />
    <path d="M8 8.8V6.2M16 8.8V6.2" />
  </>,
)

export const Ring = make(
  <>
    <circle cx="12" cy="14.5" r="5" />
    <path d="m9.5 9.7 1-4.2h3l1 4.2" />
    <path d="M12 5.5 10.8 3.8h2.4L12 5.5Z" />
  </>,
)

export const Tops = make(
  <>
    <path d="M9 3 5 5 3.5 9.5 6 11v9h12v-9l2.5-1.5L19 5l-4-2a3 3 0 0 1-6 0Z" />
    <path d="M6 11h12" />
  </>,
)

export const Shoes = make(
  <>
    <path d="M3 15h11l3.5 2H21v2H3z" />
    <path d="M3 15V9c0-1 .8-1.7 1.8-1.5L8 8l2 3 3 1" />
  </>,
)

export const Bottoms = make(
  <>
    <path d="M6 3h12l1 18h-4l-1-8-1 8H9l-1-8-1 8H3z" />
    <path d="M6 6h12" />
  </>,
)

export const Wristwear = make(
  <>
    <rect x="8" y="7.5" width="8" height="9" rx="2" />
    <path d="M9.5 7.5V4.5h5v3M9.5 16.5v3h5v-3" />
    <path d="M12 10.5v1.7l1.2.8" />
  </>,
)

export const Props = make(
  <>
    <path d="m5 19 9-9" />
    <path d="m13.5 4.5 1 2.2 2.2 1-2.2 1-1 2.2-1-2.2-2.2-1 2.2-1z" />
    <path d="M18 14l.7 1.6 1.6.7-1.6.7-.7 1.6-.7-1.6-1.6-.7 1.6-.7z" />
  </>,
)

export const Gauge = make(
  <>
    <path d="M4 17a8 8 0 1 1 16 0" />
    <path d="m12 17 4-4" />
    <circle cx="12" cy="17" r="1.3" />
  </>,
)

export const MoreStyles = make(
  <>
    <path d="M12 3.5 14.4 9l5.6.4-4.3 3.7 1.4 5.4L12 15.6 6.9 18.5l1.4-5.4L4 9.4 9.6 9z" />
  </>,
)

export const Play = make(
  <>
    <path d="M7 4.5 19 12 7 19.5z" />
  </>,
)

export const Rooms = make(
  <>
    <path d="M4 11 12 4l8 7" />
    <path d="M6 10v9h12v-9" />
    <path d="M10 19v-5h4v5" />
  </>,
)

export const Chats = make(
  <>
    <path d="M4 5h16v10H9l-4 3.5V15H4z" />
    <path d="M8 9h8M8 11.5h5" />
  </>,
)

export const Settings = make(
  <>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2.5v2.2M12 19.3v2.2M4.2 4.2l1.6 1.6M18.2 18.2l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.2 19.8l1.6-1.6M18.2 5.8l1.6-1.6" />
  </>,
)

export const Import = make(
  <>
    <path d="M12 4v10" />
    <path d="m8 10 4 4 4-4" />
    <path d="M4 17v2.5h16V17" />
  </>,
)

export const Back = make(
  <>
    <path d="M15 5 8 12l7 7" />
  </>,
)
