// Public API for reading and writing music tags in the browser (and Electron).
//
// Reading uses music-metadata (same library the app already uses on import).
// Writing:
//   - MP3  → browser-id3-writer (ID3v2.3)
//   - FLAC → custom metadata-block rewriter (Vorbis comments + PICTURE)
//   - OGG  → custom Ogg page rewriter (Vorbis comments + METADATA_BLOCK_PICTURE)

import { isElectron, getNodeFs } from './electron.js'

const MIME_BY_EXT = {
  mp3: 'audio/mpeg',
  flac: 'audio/flac',
  ogg: 'audio/ogg',
  oga: 'audio/ogg',
  opus: 'audio/ogg',
  wav: 'audio/wav',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
}

const WRITABLE_EXTS = new Set(['mp3', 'flac', 'ogg', 'oga'])

export function getAudioExt(pathOrName = '') {
  const m = /\.([a-z0-9]+)$/i.exec(pathOrName.split(/[?#]/)[0] || '')
  return m ? m[1].toLowerCase() : ''
}

export function getAudioMime(pathOrName = '') {
  return MIME_BY_EXT[getAudioExt(pathOrName)] || ''
}

export function canWriteTags(pathOrName = '') {
  return WRITABLE_EXTS.has(getAudioExt(pathOrName))
}

/**
 * Sniff image dimensions without decoding (PNG/JPEG/GIF/WebP-VP8X).
 * Returns { width, height } or null.
 */
export function sniffImageSize(u8) {
  if (!u8 || u8.length < 16) return null
  // PNG
  if (u8[0] === 0x89 && u8[1] === 0x50 && u8[2] === 0x4e && u8[3] === 0x47) {
    if (u8.length < 24) return null
    const width = (u8[16] << 24) | (u8[17] << 16) | (u8[18] << 8) | u8[19]
    const height = (u8[20] << 24) | (u8[21] << 16) | (u8[22] << 8) | u8[23]
    return { width: width >>> 0, height: height >>> 0 }
  }
  // GIF
  if (u8[0] === 0x47 && u8[1] === 0x49 && u8[2] === 0x46) {
    return { width: u8[6] | (u8[7] << 8), height: u8[8] | (u8[9] << 8) }
  }
  // JPEG
  if (u8[0] === 0xff && u8[1] === 0xd8) {
    let i = 2
    while (i + 9 < u8.length) {
      if (u8[i] !== 0xff) { i++; continue }
      const marker = u8[i + 1]
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { height: (u8[i + 5] << 8) | u8[i + 6], width: (u8[i + 7] << 8) | u8[i + 8] }
      }
      if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd9)) { i += 2; continue }
      const len = (u8[i + 2] << 8) | u8[i + 3]
      i += 2 + len
    }
    return null
  }
  // WebP (VP8X extended header only)
  if (u8.length > 30 && u8[0] === 0x52 && u8[1] === 0x49 && u8[2] === 0x46 && u8[3] === 0x46 &&
      u8[8] === 0x57 && u8[9] === 0x45 && u8[10] === 0x42 && u8[11] === 0x50 &&
      u8[12] === 0x56 && u8[13] === 0x50 && u8[14] === 0x38 && u8[15] === 0x58) {
    const width = 1 + (u8[24] | (u8[25] << 8) | (u8[26] << 16))
    const height = 1 + (u8[27] | (u8[28] << 8) | (u8[29] << 16))
    return { width, height }
  }
  return null
}

export function sniffImageMime(u8) {
  if (!u8 || u8.length < 12) return ''
  if (u8[0] === 0x89 && u8[1] === 0x50) return 'image/png'
  if (u8[0] === 0xff && u8[1] === 0xd8) return 'image/jpeg'
  if (u8[0] === 0x47 && u8[1] === 0x49) return 'image/gif'
  if (u8[0] === 0x52 && u8[1] === 0x49) return 'image/webp'
  return ''
}

/**
 * Read the raw bytes of a track.
 * Electron: full file via fs. Browser: fetch of the (never-revoked) blob URL.
 */
export async function readTrackBytes(track) {
  const fs = isElectron() ? getNodeFs() : null
  if (fs && track.path && /^[a-zA-Z]:[\\/]|^\//.test(track.path)) {
    try {
      if (fs.existsSync(track.path)) {
        const buf = fs.readFileSync(track.path)
        return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
      }
    } catch (e) {
      console.error('Failed to read track via fs', e)
    }
  }
  if (track.url) {
    const res = await fetch(track.url)
    if (res.ok) return await res.arrayBuffer()
  }
  throw new Error('Could not read the audio file')
}

/**
 * Parse tags from raw bytes using music-metadata.
 * @returns {Promise<{title,artist,album,genre,track,year,picture:{data:Uint8Array,format:string}|null,duration}>}
 */
export async function readAudioTags(arrayBuffer, pathOrName = '') {
  const { parseBuffer } = await import('music-metadata')
  const mimeType = getAudioMime(pathOrName)
  const meta = await parseBuffer(new Uint8Array(arrayBuffer), mimeType ? { mimeType } : undefined)
  const pic = meta.common.picture?.[0]
  const trackNo = meta.common.track?.no
  const year = meta.common.year ||
    (meta.common.date ? parseInt(String(meta.common.date).slice(0, 4), 10) : NaN)
  let picture = null
  if (pic?.data) {
    const data = new Uint8Array(pic.data)
    picture = { data, format: pic.format || sniffImageMime(data) }
  }
  return {
    title: meta.common.title || '',
    artist: meta.common.artist || '',
    album: meta.common.album || '',
    genre: meta.common.genre?.[0] || '',
    track: trackNo ? String(trackNo) : '',
    year: Number.isFinite(year) ? String(year) : '',
    picture,
    duration: meta.format.duration || 0,
  }
}

/** Strip a trailing ID3v1 tag (128 bytes starting with "TAG"). */
function stripId3v1(u8) {
  if (u8.length >= 128) {
    const s = u8.length - 128
    if (u8[s] === 0x54 && u8[s + 1] === 0x41 && u8[s + 2] === 0x47) {
      return u8.subarray(0, s)
    }
  }
  return u8
}

async function writeMp3Tags(u8, tags, cover) {
  const { ID3Writer } = await import('browser-id3-writer')
  const writer = new ID3Writer(stripId3v1(u8).slice().buffer)
  if (tags.title) writer.setFrame('TIT2', tags.title)
  if (tags.artist) writer.setFrame('TPE1', tags.artist.split('/').map(s => s.trim()).filter(Boolean))
  if (tags.album) writer.setFrame('TALB', tags.album)
  if (tags.genre) writer.setFrame('TCON', [tags.genre])
  if (tags.track) writer.setFrame('TRCK', tags.track)
  const year = parseInt(tags.year, 10)
  if (Number.isFinite(year)) writer.setFrame('TYER', year)
  if (cover) {
    writer.setFrame('APIC', {
      type: 3, // front cover
      data: cover.data.slice().buffer,
      description: cover.description || 'Cover',
    })
  }
  writer.addTag()
  const out = writer.arrayBuffer
  return new Blob([out], { type: 'audio/mpeg' })
}

/**
 * Write tags into audio bytes.
 * @param {Object} p
 * @param {ArrayBuffer|Uint8Array} p.data original file bytes
 * @param {string} p.path file name/path (used for extension detection)
 * @param {{title?:string,artist?:string,album?:string,genre?:string,track?:string,year?:string}} p.tags
 * @param {{data:Uint8Array,mime:string,width?:number,height?:number,description?:string}|null} p.cover
 *   null = no cover / remove cover
 * @returns {Promise<Blob>}
 */
export async function writeAudioTags({ data, path, tags = {}, cover = null }) {
  const u8 = data instanceof Uint8Array ? data : new Uint8Array(data)
  const ext = getAudioExt(path)

  if (ext === 'mp3') {
    return writeMp3Tags(u8, tags, cover)
  }

  if (ext === 'flac') {
    const { writeFlacTags } = await import('./flacTags.js')
    const out = writeFlacTags(u8, tags, cover)
    return new Blob([out], { type: 'audio/flac' })
  }

  if (ext === 'ogg' || ext === 'oga') {
    const { writeOggTags } = await import('./oggTags.js')
    const out = writeOggTags(u8, tags, cover)
    return new Blob([out], { type: 'audio/ogg' })
  }

  throw new Error(`Editing tags is not supported for .${ext || '?'} files (MP3, FLAC, OGG only)`)
}
