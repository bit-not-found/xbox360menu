// Ogg tag rewriter for Vorbis and Opus streams.
//
// Strategy: reconstruct all packets, replace the comment packet (packet #1),
// then re-page every packet that touches a page at or after the comment's
// first page. Kept leading pages are copied verbatim; re-paged pages get
// renumbered sequence counts, recomputed CRCs, and granule positions carried
// over from the original end-page of each packet.

import {
  parseVorbisCommentData,
  buildVorbisCommentData,
  buildTagEntries,
  buildPictureBlockBody,
  bytesToBase64,
  concatBytes,
} from './vorbisComment.js'

// ---- Ogg CRC (poly 0x04c11db7, non-reflected, init 0) ----
const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let r = i << 24
    for (let j = 0; j < 8; j++) {
      r = (r & 0x80000000) ? (((r << 1) >>> 0) ^ 0x04c11db7) : ((r << 1) >>> 0)
    }
    t[i] = r >>> 0
  }
  return t
})()

export function oggCrc(u8) {
  let c = 0
  for (let i = 0; i < u8.length; i++) {
    c = ((c << 8) ^ CRC_TABLE[((c >>> 24) ^ u8[i]) & 0xff]) >>> 0
  }
  return c >>> 0
}

function readU32LE(u8, o) {
  return (u8[o] | (u8[o + 1] << 8) | (u8[o + 2] << 16) | (u8[o + 3] << 24)) >>> 0
}

function readU64LE(u8, o) {
  let v = 0n
  for (let i = 7; i >= 0; i--) v = (v << 8n) | BigInt(u8[o + i])
  return v
}

function writeU32LE(u8, o, v) {
  u8[o] = v & 0xff
  u8[o + 1] = (v >>> 8) & 0xff
  u8[o + 2] = (v >>> 16) & 0xff
  u8[o + 3] = (v >>> 24) & 0xff
}

function writeU64LE(u8, o, v) {
  let bv = typeof v === 'bigint' ? v : BigInt(v)
  if (bv < 0n) bv += 0x10000000000000000n // two's complement (granule -1)
  for (let i = 0; i < 8; i++) {
    u8[o + i] = Number(bv & 0xffn)
    bv >>= 8n
  }
}

export function isOggPage(u8, o) {
  return u8[o] === 0x4f && u8[o + 1] === 0x67 && u8[o + 2] === 0x67 && u8[o + 3] === 0x53
}

/**
 * Parse the Ogg page structure of a file.
 * Returns [{ offset, size, headerType, granule, serial, seq, segTableOff, dataOff, nsegs }]
 */
export function parseOggPages(u8) {
  const pages = []
  let i = 0
  while (i + 27 <= u8.length) {
    if (!isOggPage(u8, i)) throw new Error(`Invalid Ogg page at offset ${i}`)
    const nsegs = u8[i + 26]
    let dataLen = 0
    for (let s = 0; s < nsegs; s++) dataLen += u8[i + 27 + s]
    const total = 27 + nsegs + dataLen
    if (i + total > u8.length) throw new Error('Truncated Ogg page')
    pages.push({
      offset: i,
      size: total,
      headerType: u8[i + 5],
      granule: readU64LE(u8, i + 6),
      serial: readU32LE(u8, i + 14),
      seq: readU32LE(u8, i + 18),
      segTableOff: i + 27,
      dataOff: i + 27 + nsegs,
      nsegs,
    })
    i += total
  }
  if (i !== u8.length) throw new Error('Trailing garbage after last Ogg page')
  if (pages.length === 0) throw new Error('No Ogg pages found')
  return pages
}

/**
 * Reconstruct packets from pages.
 * Each packet: { bytes, segLens, segPages, startPage, endPage, endGranule }
 */
export function buildOggPackets(u8, pages) {
  const packets = []
  let parts = []
  let byteLen = 0
  let segLens = []
  let segPages = []
  let startPage = -1

  for (let p = 0; p < pages.length; p++) {
    const page = pages[p]
    let off = page.dataOff
    for (let s = 0; s < page.nsegs; s++) {
      const len = u8[page.segTableOff + s]
      if (startPage === -1) startPage = p
      parts.push(u8.subarray(off, off + len))
      segLens.push(len)
      segPages.push(p)
      byteLen += len
      off += len
      if (len < 255) {
        packets.push({
          bytes: concatBytes(parts, byteLen),
          segLens,
          segPages,
          startPage,
          endPage: p,
          endGranule: page.granule,
        })
        parts = []
        byteLen = 0
        segLens = []
        segPages = []
        startPage = -1
      }
    }
  }
  if (startPage !== -1) throw new Error('Ogg: file ends mid-packet')
  return packets
}

/** Lacing segments for a packet of S bytes. */
function packetSegments(S) {
  if (S === 0) return [0]
  const segs = []
  let rem = S
  while (rem >= 255) {
    segs.push(255)
    rem -= 255
  }
  if (rem > 0) segs.push(rem)
  else segs.push(0) // exact multiple of 255 needs a terminating 0 segment
  return segs
}

function ascii(u8, o, len) {
  let s = ''
  for (let i = 0; i < len; i++) s += String.fromCharCode(u8[o + i])
  return s
}

function assemblePage({ granule, serial, seq, headerType, segs }) {
  const nsegs = segs.length
  let dataLen = 0
  for (const s of segs) dataLen += s.len
  const out = new Uint8Array(27 + nsegs + dataLen)
  out[0] = 0x4f; out[1] = 0x67; out[2] = 0x67; out[3] = 0x53 // OggS
  out[4] = 0 // stream structure version
  out[5] = headerType
  writeU64LE(out, 6, granule)
  writeU32LE(out, 14, serial)
  writeU32LE(out, 18, seq)
  writeU32LE(out, 22, 0) // CRC placeholder
  out[26] = nsegs
  let o = 27
  let d = 27 + nsegs
  for (const s of segs) {
    out[o++] = s.len
    out.set(s.data, d)
    d += s.len
  }
  writeU32LE(out, 22, oggCrc(out))
  return out
}

/**
 * Rewrite tags in an Ogg Vorbis or Opus file.
 * @param {Uint8Array} input
 * @param {{title?:string,artist?:string,album?:string,genre?:string,track?:string,year?:string}} tags
 * @param {{data:Uint8Array,mime:string,width?:number,height?:number,description?:string}|null} cover
 * @returns {Uint8Array}
 */
export function writeOggTags(input, tags, cover) {
  const pages = parseOggPages(input)
  const serial = pages[0].serial
  if (pages.some(p => p.serial !== serial)) {
    throw new Error('Chained/multi-stream Ogg files are not supported')
  }

  const packets = buildOggPackets(input, pages)
  if (packets.length < 2) throw new Error('Ogg: not enough header packets')

  const p0 = packets[0].bytes
  const p1 = packets[1].bytes

  let magic
  if (p0.length > 7 && p0[0] === 0x01 && ascii(p0, 1, 6) === 'vorbis' &&
      p1.length > 7 && p1[0] === 0x03 && ascii(p1, 1, 6) === 'vorbis') {
    magic = p1.subarray(0, 7)
  } else if (p0.length >= 8 && ascii(p0, 0, 8) === 'OpusHead' &&
             p1.length >= 8 && ascii(p1, 0, 8) === 'OpusTags') {
    magic = p1.subarray(0, 8)
  } else {
    throw new Error('Unsupported Ogg stream (expected Vorbis or Opus)')
  }

  const { vendor, comments } = parseVorbisCommentData(p1, magic.length)
  const entries = buildTagEntries(comments, tags)
  if (cover) {
    // METADATA_BLOCK_PICTURE is base64 of the PICTURE block *body* only
    // (no 4-byte FLAC block header) — what music-metadata and other
    // Vorbis-comment readers expect.
    entries.push(`METADATA_BLOCK_PICTURE=${bytesToBase64(buildPictureBlockBody(cover))}`)
  }
  const commentBody = buildVorbisCommentData(vendor, entries)
  const newCommentPacket = concatBytes([magic, commentBody], magic.length + commentBody.length)

  const commentIdx = 1
  const startPage = packets[commentIdx].startPage
  const hadEos = (pages[pages.length - 1].headerType & 0x04) !== 0

  // First packet that (fully or partially) lives on startPage or later
  let firstIdx = -1
  for (let i = 0; i < packets.length; i++) {
    if (packets[i].endPage >= startPage) { firstIdx = i; break }
  }
  if (firstIdx === -1) firstIdx = commentIdx

  // Build the re-paged segment stream
  /** @type {{len:number, data:Uint8Array, endGranule:bigint|null}[]} */
  const segs = []
  let commentEnd = -1
  const pushPacketSegs = (pkt, sourceBytes, skipSegs) => {
    let offset = 0
    for (let s = 0; s < skipSegs; s++) offset += pkt.segLens[s]
    for (let s = skipSegs; s < pkt.segLens.length; s++) {
      const len = pkt.segLens[s]
      segs.push({
        len,
        data: sourceBytes.subarray(offset, offset + len),
        endGranule: len < 255 ? pkt.endGranule : null,
      })
      offset += len
    }
  }

  for (let j = firstIdx; j < packets.length; j++) {
    const original = packets[j]
    let skip = 0
    if (original.startPage < startPage) {
      // Packet spans into startPage — its earlier segments live on kept pages
      while (skip < original.segPages.length && original.segPages[skip] < startPage) skip++
    }
    if (j === commentIdx) {
      // Use the rebuilt comment packet; its segmentation is recomputed
      const segLens = packetSegments(newCommentPacket.length)
      const rebuilt = {
        segLens,
        segPages: segLens.map(() => startPage), // all live on >= startPage
        startPage,
        endPage: original.endPage,
        endGranule: original.endGranule,
      }
      pushPacketSegs(rebuilt, newCommentPacket, 0)
      commentEnd = segs.length
    } else {
      pushPacketSegs(original, original.bytes, skip)
    }
  }
  if (segs.length === 0) throw new Error('Ogg: nothing to write')

  const firstIsContinuation = (() => {
    const j = firstIdx
    if (j === commentIdx) return false // rebuilt comment always starts fresh (its original start is startPage)
    const original = packets[j]
    return original.startPage < startPage
  })()

  // Pack segments into pages (max 255 segments each).
  //
  // Two layout rules for consumer compatibility (notably music-metadata, which
  // buffers a page and only parses it when the *next* page arrives, and drops
  // the data of a non-continued EOS page entirely):
  //   1. Force a page break right after the comment packet so the comment is
  //      never the payload of the EOS page (setup/audio that follow will carry EOS).
  //   2. Set the continued flag whenever a packet is split across our pages.
  const newPages = []
  let seq = pages[startPage].seq >>> 0
  let batch = []
  let pendingContinuation = firstIsContinuation
  const flush = (isLast) => {
    if (batch.length === 0) return
    let headerType = 0
    if (newPages.length === 0 && startPage === 0) headerType |= 0x02 // bos
    if (pendingContinuation) headerType |= 0x01
    if (isLast && hadEos) headerType |= 0x04
    // Page granule = granule of the last packet that COMPLETES on this page.
    // If the page ends mid-packet (last seg len 255), look further back;
    // only use -1 when no packet completes on this page at all.
    let granule = -1n
    for (let bi = batch.length - 1; bi >= 0; bi--) {
      const g = batch[bi].endGranule
      if (g !== null && g !== undefined) { granule = g; break }
    }
    pendingContinuation = batch[batch.length - 1].len === 255 // packet continues onto next page
    newPages.push(assemblePage({
      granule,
      serial,
      seq: seq >>> 0,
      headerType,
      segs: batch,
    }))
    seq = (seq + 1) >>> 0
    batch = []
  }

  for (let si = 0; si < segs.length; si++) {
    batch.push(segs[si])
    const atCommentEnd = commentEnd >= 0 && si + 1 === commentEnd && si + 1 < segs.length
    if (batch.length === 255 || atCommentEnd) flush(false)
  }
  flush(true)

  // Assemble output: kept pages verbatim + new pages
  const keptEnd = startPage > 0 ? pages[startPage - 1].offset + pages[startPage - 1].size : 0
  let total = keptEnd
  for (const p of newPages) total += p.length
  const out = new Uint8Array(total)
  let w = 0
  if (keptEnd > 0) {
    out.set(input.subarray(0, keptEnd), w)
    w += keptEnd
  }
  for (const p of newPages) {
    out.set(p, w)
    w += p.length
  }
  return out
}
