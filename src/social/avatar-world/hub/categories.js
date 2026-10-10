import {
  DressUp,
  Poses,
  Smile,
  Earrings,
  Glasses,
  Gloves,
  Hat,
  Ring,
  Tops,
  Shoes,
  Bottoms,
  Wristwear,
  Props,
  MoreStyles,
  Gauge,
} from './icons'

// Wardrobe/customize categories. `real` categories expose live controls in the
// detail panel; the rest are cosmetic slots shown as "coming soon" so the grid
// reads like the reference customizer.
export const CATEGORIES = [
  { id: 'dressup', label: 'Dress up', Icon: DressUp, real: true },
  { id: 'poses', label: 'Poses', Icon: Poses, real: true },
  { id: 'expressions', label: 'Expressions', Icon: Smile, real: true },
  { id: 'quality', label: 'Quality', Icon: Gauge, real: true },
  { id: 'earrings', label: 'Earrings', Icon: Earrings, real: false },
  { id: 'glasses', label: 'Glasses', Icon: Glasses, real: false },
  { id: 'gloves', label: 'Gloves', Icon: Gloves, real: false },
  { id: 'hats', label: 'Hats & more', Icon: Hat, real: false },
  { id: 'rings', label: 'Rings', Icon: Ring, real: false },
  { id: 'tops', label: 'Tops', Icon: Tops, real: false },
  { id: 'shoes', label: 'Shoes', Icon: Shoes, real: false },
  { id: 'bottoms', label: 'Bottoms', Icon: Bottoms, real: false },
  { id: 'wristwear', label: 'Wristwear', Icon: Wristwear, real: false },
  { id: 'props', label: 'Props', Icon: Props, real: false },
  { id: 'more', label: 'Get more styles', Icon: MoreStyles, real: false },
]

export function getCategory(id) {
  return CATEGORIES.find((c) => c.id === id)
}
