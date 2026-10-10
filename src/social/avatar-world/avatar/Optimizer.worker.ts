interface OptimizeRequest {
  buffer: ArrayBuffer
  maxTextureSize: number
  quality: number
}

type OptimizeResponse =
  | { type: 'progress'; progress: number; phase: string }
  | {
      type: 'done'
      buffer: ArrayBuffer
      optimizedSize: number
      texturesProcessed: number
      changed: boolean
    }
  | { type: 'error'; message: string }

interface WorkerScope {
  postMessage(message: OptimizeResponse, transfer?: Transferable[]): void
  onmessage: ((event: MessageEvent<OptimizeRequest>) => void) | null
}

const scope = self as unknown as WorkerScope

interface BufferView {
  byteOffset?: number
  byteLength: number
  byteStride?: number
  target?: number
  buffer?: number
  [key: string]: unknown
}

interface GltfImage {
  bufferView?: number
  mimeType?: string
  uri?: string
  [key: string]: unknown
}

interface GltfAccessor {
  bufferView?: number
  sparse?: {
    indices?: { bufferView?: number }
    values?: { bufferView?: number }
  }
  [key: string]: unknown
}

interface GltfJson {
  buffers?: { byteLength?: number }[]
  bufferViews?: BufferView[]
  accessors?: GltfAccessor[]
  images?: GltfImage[]
  [key: string]: unknown
}

const GLB_MAGIC = 0x46546c67
const CHUNK_JSON = 0x4e4f534a
const CHUNK_BIN = 0x004e4942

function parseGLB(buffer: ArrayBuffer): { json: GltfJson; bin: Uint8Array } | null {
  if (buffer.byteLength < 12) return null
  const view = new DataView(buffer)
  if (view.getUint32(0, true) !== GLB_MAGIC) return null
  const total = view.getUint32(8, true)
  let offset = 12
  let json: GltfJson | null = null
  let bin: Uint8Array | null = null
  const decoder = new TextDecoder()

  while (offset + 8 <= total) {
    const chunkLength = view.getUint32(offset, true)
    const chunkType = view.getUint32(offset + 4, true)
    const start = offset + 8
    const data = new Uint8Array(buffer, start, chunkLength)
    if (chunkType === CHUNK_JSON) {
      try {
        json = JSON.parse(decoder.decode(data)) as GltfJson
      } catch {
        return null
      }
    } else if (chunkType === CHUNK_BIN) {
      bin = data.slice()
    }
    offset = start + chunkLength + ((4 - (chunkLength % 4)) % 4)
  }

  if (!json || !bin) return null
  return { json, bin }
}

async function optimizeImage(
  bytes: Uint8Array,
  mime: string,
  maxTextureSize: number,
  quality: number,
): Promise<{ bytes: Uint8Array; mime: string } | null> {
  if (typeof createImageBitmap !== 'function' || typeof OffscreenCanvas === 'undefined') return null
  try {
    const blob = new Blob([bytes.slice().buffer], { type: mime })
    const bitmap = await createImageBitmap(blob)
    const maxEdge = Math.max(bitmap.width, bitmap.height)
    if (maxEdge <= maxTextureSize) {
      bitmap.close()
      return null
    }
    const scale = maxTextureSize / maxEdge
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = new OffscreenCanvas(width, height)
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      bitmap.close()
      return null
    }
    ctx.drawImage(bitmap, 0, 0, width, height)
    bitmap.close()
    const outBlob = await canvas.convertToBlob({ type: 'image/webp', quality })
    const outBytes = new Uint8Array(await outBlob.arrayBuffer())
    if (outBytes.byteLength === 0 || outBytes.byteLength >= bytes.byteLength) return null
    return { bytes: outBytes, mime: 'image/webp' }
  } catch {
    return null
  }
}

function collectAccessorViews(json: GltfJson): Set<number> {
  const set = new Set<number>()
  for (const accessor of json.accessors ?? []) {
    if (typeof accessor.bufferView === 'number') set.add(accessor.bufferView)
    const sparse = accessor.sparse
    if (sparse?.indices && typeof sparse.indices.bufferView === 'number') {
      set.add(sparse.indices.bufferView)
    }
    if (sparse?.values && typeof sparse.values.bufferView === 'number') {
      set.add(sparse.values.bufferView)
    }
  }
  return set
}

function packGLB(json: GltfJson, bin: Uint8Array): ArrayBuffer {
  const jsonBytes = new TextEncoder().encode(JSON.stringify(json))
  const jsonPad = (4 - (jsonBytes.byteLength % 4)) % 4
  const jsonLength = jsonBytes.byteLength + jsonPad
  const binPad = (4 - (bin.byteLength % 4)) % 4
  const binLength = bin.byteLength + binPad
  const total = 12 + 8 + jsonLength + 8 + binLength

  const out = new ArrayBuffer(total)
  const view = new DataView(out)
  const bytes = new Uint8Array(out)

  view.setUint32(0, GLB_MAGIC, true)
  view.setUint32(4, 2, true)
  view.setUint32(8, total, true)

  view.setUint32(12, jsonLength, true)
  view.setUint32(16, CHUNK_JSON, true)
  bytes.set(jsonBytes, 20)
  for (let i = 0; i < jsonPad; i++) bytes[20 + jsonBytes.byteLength + i] = 0x20

  const binChunkStart = 20 + jsonLength
  view.setUint32(binChunkStart, binLength, true)
  view.setUint32(binChunkStart + 4, CHUNK_BIN, true)
  bytes.set(bin, binChunkStart + 8)

  return out
}

async function handle(request: OptimizeRequest): Promise<void> {
  const { buffer, maxTextureSize, quality } = request
  try {
    const parsed = parseGLB(buffer)
    if (!parsed) {
      scope.postMessage({
        type: 'done',
        buffer,
        optimizedSize: buffer.byteLength,
        texturesProcessed: 0,
        changed: false,
      })
      return
    }

    const { json, bin } = parsed
    if (!json.bufferViews || json.bufferViews.length === 0 || (json.buffers?.length ?? 0) > 1) {
      scope.postMessage({
        type: 'done',
        buffer,
        optimizedSize: buffer.byteLength,
        texturesProcessed: 0,
        changed: false,
      })
      return
    }

    const accessorViews = collectAccessorViews(json)
    const viewBytes = json.bufferViews.map((view) =>
      bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength),
    )
    const images = json.images ?? []
    let texturesProcessed = 0

    for (let i = 0; i < images.length; i++) {
      const image = images[i]
      if (typeof image.bufferView !== 'number' || image.uri) continue
      if (accessorViews.has(image.bufferView)) continue
      const source = viewBytes[image.bufferView]
      if (!source) continue
      const optimized = await optimizeImage(source, image.mimeType ?? 'image/png', maxTextureSize, quality)
      if (optimized) {
        viewBytes[image.bufferView] = optimized.bytes
        image.mimeType = optimized.mime
        texturesProcessed++
      }
      scope.postMessage({
        type: 'progress',
        progress: (i + 1) / Math.max(images.length, 1),
        phase: 'Optimizing textures',
      })
    }

    if (texturesProcessed === 0) {
      scope.postMessage({
        type: 'done',
        buffer,
        optimizedSize: buffer.byteLength,
        texturesProcessed: 0,
        changed: false,
      })
      return
    }

    const chunks: Uint8Array[] = []
    let offset = 0
    for (let i = 0; i < viewBytes.length; i++) {
      const view = json.bufferViews[i]
      const padding = (4 - (offset % 4)) % 4
      if (padding > 0) {
        chunks.push(new Uint8Array(padding))
        offset += padding
      }
      view.byteOffset = offset
      view.byteLength = viewBytes[i].byteLength
      chunks.push(viewBytes[i])
      offset += view.byteLength
    }

    if (json.buffers && json.buffers[0]) {
      json.buffers[0].byteLength = offset
    } else {
      json.buffers = [{ byteLength: offset }]
    }

    const newBin = new Uint8Array(offset)
    let cursor = 0
    for (const chunk of chunks) {
      newBin.set(chunk, cursor)
      cursor += chunk.byteLength
    }

    const packed = packGLB(json, newBin)
    scope.postMessage(
      {
        type: 'done',
        buffer: packed,
        optimizedSize: packed.byteLength,
        texturesProcessed,
        changed: true,
      },
      [packed],
    )
  } catch (error) {
    scope.postMessage({
      type: 'error',
      message: error instanceof Error ? error.message : 'Optimizer failed',
    })
  }
}

scope.onmessage = (event: MessageEvent<OptimizeRequest>): void => {
  void handle(event.data)
}
