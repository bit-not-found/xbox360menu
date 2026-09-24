// Shared helpers for Xiph Vorbis comments and FLAC PICTURE blocks.

export const MANAGED_COMMENT_KEYS = ['TITLE', 'ARTIST', 'ALBUM', 'GENRE', 'TRACKNUMBER', 'DATE']

const encoder = new TextEncoder()
const decoder = new TextDecoder('utf-8', { fatal: false })

export function readU32LE(u8, o) {
  return (u8[o] | (u8[o + 1] << 8) | (u8[o + 2] << 16) | (u8[o + 3] << 24)) >>> 0
}

export function writeU32LE(u8, o, v) {
  u8[o] = v & 0xff
  u8[o + 1] = (v >>> 8) & 0xff
  u8[o + 2] = (v >>> 16) & 0xff
  u8[o + 3] = (v >>> 24) & 0xff
}

export function concatBytes(chunks, totalLength) {
  if (chunks.length === 1) return chunks[0]
  const out = new Uint8Array(totalLength)
  let o = 0
  for (const c of chunks) {
    out.set(c, o)
    o += c.length
  }
  return out
}

/**
 * Parse a Vorbis comment block body (also the payload of OpusTags after its
 * 8-byte magic) starting at `offset`.
 * Returns { vendor, comments, endOffset } where comments are raw "KEY=value" strings.
 */
export function parseVorbisCommentData(u8, offset = 0) {
  if (offset + 4 > u8.length) throw new Error('Vorbis comment: truncated vendor length')
  const vendorLen = readU32LE(u8, offset)
  offset += 4
  if (offset + vendorLen + 4 > u8.length) throw new Error('Vorbis comment: truncated vendor')
  const vendor = u8.subarray(offset, offset + vendorLen)
  offset += vendorLen
  const count = readU32LE(u8, offset)
  offset += 4
  const comments = []
  for (let i = 0; i < count; i++) {
    if (offset + 4 > u8.length) throw new Error('Vorbis comment: truncated comment length')
    const len = readU32LE(u8, offset)
    offset += 4
    if (offset + len > u8.length) throw new Error('Vorbis comment: truncated comment')
    comments.push(decoder.decode(u8.subarray(offset, offset + len)))
    offset += len
  }
  return { vendor, comments, endOffset: offset }
}

/**
 * Build a Vorbis comment block body.
 * @param {Uint8Array} vendor
 * @param {string[]} entries "KEY=value" strings
 */
export function buildVorbisCommentData(vendor, entries) {
  const encoded = entries.map(e => encoder.encode(e))
  let total = 4 + vendor.length + 4
  for (const e of encoded) total += 4 + e.length
  const out = new Uint8Array(total)
  const dv = new DataView(out.buffer)
  let o = 0
  dv.setUint32(o, vendor.length, true); o += 4
  out.set(vendor, o); o += vendor.length
  dv.setUint32(o, encoded.length, true); o += 4
  for (const e of encoded) {
    dv.setUint32(o, e.length, true); o += 4
    out.set(e, o); o += e.length
  }
  return out
}

/**
 * Build a complete set of Vorbis comment entries from existing ones plus the
 * tags being edited. Existing comments for managed keys are dropped and
 * replaced (empty tag values simply omit the key). METADATA_BLOCK_PICTURE is
 * always handled separately via the cover argument, never passed through here.
 */
export function buildTagEntries(existingComments, tags) {
  const managed = new Set(MANAGED_COMMENT_KEYS)
  const out = []
  for (const c of existingComments) {
    const eq = c.indexOf('=')
    const key = (eq === -1 ? c : c.slice(0, eq)).toUpperCase()
    if (key === 'METADATA_BLOCK_PICTURE') continue
    if (managed.has(key)) continue
    out.push(c)
  }
  const add = (key, value) => {
    const v = (value ?? '').toString().trim()
    if (v) out.push(`${key}=${v}`)
  }
  add('TITLE', tags.title)
  add('ARTIST', tags.artist)
  add('ALBUM', tags.album)
  add('GENRE', tags.genre)
  add('TRACKNUMBER', tags.track)
  add('DATE', tags.year)
  return out
}

/**
 * FLAC PICTURE block body (without the 4-byte block header).
 * cover: { data: Uint8Array, mime, width, height, description }
 */
export function buildPictureBlockBody(cover) {
  const mimeBytes = encoder.encode(cover.mime || 'image/jpeg')
  const descBytes = encoder.encode(cover.description || '')
  const width = cover.width || 0
  const height = cover.height || 0
  const depth = (cover.mime === 'image/jpeg' || cover.mime === 'image/jpg') ? 24 : 32
  const data = cover.data
  const total = 4 + 4 + mimeBytes.length + 4 + descBytes.length + 4 + 4 + 4 + 4 + 4 + data.length
  const out = new Uint8Array(total)
  const dv = new DataView(out.buffer)
  let o = 0
  dv.setUint32(o, 3, false); o += 4 // picture type: front cover
  dv.setUint32(o, mimeBytes.length, false); o += 4
  out.set(mimeBytes, o); o += mimeBytes.length
  dv.setUint32(o, descBytes.length, false); o += 4
  out.set(descBytes, o); o += descBytes.length
  dv.setUint32(o, width, false); o += 4
  dv.setUint32(o, height, false); o += 4
  dv.setUint32(o, depth, false); o += 4
  dv.setUint32(o, 0, false); o += 4 // indexed colors (0 = not indexed)
  dv.setUint32(o, data.length, false); o += 4
  out.set(data, o)
  return out
}

const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

export function bytesToBase64(u8) {
  let out = ''
  const len = u8.length
  for (let i = 0; i < len; i += 3) {
    const b0 = u8[i]
    const b1 = i + 1 < len ? u8[i + 1] : 0
    const b2 = i + 2 < len ? u8[i + 2] : 0
    out += B64_CHARS[b0 >> 2]
    out += B64_CHARS[((b0 & 3) << 4) | (b1 >> 4)]
    out += i + 1 < len ? B64_CHARS[((b1 & 15) << 2) | (b2 >> 6)] : '='
    out += i + 2 < len ? B64_CHARS[b2 & 63] : '='
  }
  return out
}
