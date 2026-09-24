// FLAC metadata-block rewriter: updates Vorbis comments and cover art while
// keeping every other block (STREAMINFO, SEEKTABLE, CUESHEET, ...) intact.

import {
  parseVorbisCommentData,
  buildVorbisCommentData,
  buildTagEntries,
  buildPictureBlockBody,
} from './vorbisComment.js'

const FLAC_MAGIC = [0x66, 0x4c, 0x61, 0x43] // "fLaC"

function startsWith(u8, bytes, o = 0) {
  for (let i = 0; i < bytes.length; i++) {
    if (u8[o + i] !== bytes[i]) return false
  }
  return true
}

function findId3v2End(u8) {
  if (u8.length < 10 || u8[0] !== 0x49 || u8[1] !== 0x44 || u8[2] !== 0x33) return 0
  const flags = u8[5]
  const size = ((u8[6] & 0x7f) << 21) | ((u8[7] & 0x7f) << 14) | ((u8[8] & 0x7f) << 7) | (u8[9] & 0x7f)
  let end = 10 + size
  if (flags & 0x10) end += 10 // footer
  return end <= u8.length ? end : 0
}

/**
 * Rewrite tags in a FLAC file.
 * @param {Uint8Array} input
 * @param {{title?:string,artist?:string,album?:string,genre?:string,track?:string,year?:string}} tags
 * @param {{data:Uint8Array,mime:string,width?:number,height?:number,description?:string}|null} cover
 *   cover === null removes embedded pictures; an object replaces them.
 * @returns {Uint8Array}
 */
export function writeFlacTags(input, tags, cover) {
  let prefixLen = findId3v2End(input)
  if (!startsWith(input, FLAC_MAGIC, prefixLen)) {
    throw new Error('Not a FLAC file (missing fLaC marker)')
  }

  let o = prefixLen + 4
  const blocks = []
  let audioStart = -1
  while (o + 4 <= input.length) {
    const header = input[o]
    const last = (header & 0x80) !== 0
    const type = header & 0x7f
    const len = (input[o + 1] << 16) | (input[o + 2] << 8) | input[o + 3]
    o += 4
    if (o + len > input.length) throw new Error('FLAC block extends past end of file')
    blocks.push({ type, data: input.subarray(o, o + len) })
    o += len
    if (last) {
      audioStart = o
      break
    }
  }
  if (audioStart === -1) throw new Error('FLAC: no last metadata block found')
  if (blocks.length === 0 || blocks[0].type !== 0) throw new Error('FLAC: STREAMINFO must be first block')

  // Find an existing vendor string to preserve
  let vendor = new TextEncoder().encode('WinX360')
  const existingComment = blocks.find(b => b.type === 4)
  let existingEntries = []
  if (existingComment) {
    try {
      const parsed = parseVorbisCommentData(existingComment.data, 0)
      vendor = parsed.vendor
      existingEntries = parsed.comments
    } catch {
      // fall through with defaults
    }
  }

  const entries = buildTagEntries(existingEntries, tags)
  const commentData = buildVorbisCommentData(vendor, entries)

  // Keep everything except old comment / pictures / padding
  const kept = blocks.filter(b => b.type !== 1 && b.type !== 4 && b.type !== 6)
  const outBlocks = [...kept, { type: 4, data: commentData }]
  if (cover) {
    outBlocks.push({ type: 6, data: buildPictureBlockBody(cover) })
  }

  // Assemble: optional ID3 prefix + fLaC + blocks (last flag on final) + audio
  let total = prefixLen + 4
  for (const b of outBlocks) total += 4 + b.data.length
  total += input.length - audioStart

  const out = new Uint8Array(total)
  let w = 0
  if (prefixLen > 0) {
    out.set(input.subarray(0, prefixLen), w)
    w += prefixLen
  }
  out.set(FLAC_MAGIC, w); w += 4
  for (let i = 0; i < outBlocks.length; i++) {
    const b = outBlocks[i]
    const last = i === outBlocks.length - 1
    out[w] = (last ? 0x80 : 0x00) | b.type
    out[w + 1] = (b.data.length >>> 16) & 0xff
    out[w + 2] = (b.data.length >>> 8) & 0xff
    out[w + 3] = b.data.length & 0xff
    w += 4
    out.set(b.data, w)
    w += b.data.length
  }
  out.set(input.subarray(audioStart), w)
  return out
}
