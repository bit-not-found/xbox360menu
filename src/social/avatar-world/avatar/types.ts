export type ClipCategory = 'idle' | 'idle-fallback' | 'fidget' | 'greeting' | 'excited'

export interface ClipDef {
  name: string
  url: string
  category: ClipCategory
  weight: number
  tags?: string[]
}
