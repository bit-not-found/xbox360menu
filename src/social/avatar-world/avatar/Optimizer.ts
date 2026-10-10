import { VRM_LIMITS } from './VrmLoader'
import type { QualityProfile } from '../engine/Quality'

export const OPTIMIZER_LIMITS = {
  ...VRM_LIMITS,
  fullTextureMax: 2048,
  liteTextureMax: 1024,
} as const

export interface OptimizeOptions {
  profile?: QualityProfile
  onProgress?: (progress: number, phase: string) => void
}

export interface OptimizeResult {
  buffer: ArrayBuffer
  originalSize: number
  optimizedSize: number
  texturesProcessed: number
  changed: boolean
}

type WorkerResponse =
  | { type: 'progress'; progress: number; phase: string }
  | {
      type: 'done'
      buffer: ArrayBuffer
      optimizedSize: number
      texturesProcessed: number
      changed: boolean
    }
  | { type: 'error'; message: string }

function passthrough(buffer: ArrayBuffer, originalSize: number): OptimizeResult {
  return {
    buffer,
    originalSize,
    optimizedSize: originalSize,
    texturesProcessed: 0,
    changed: false,
  }
}

export async function optimizeVrm(blob: Blob, options: OptimizeOptions = {}): Promise<OptimizeResult> {
  const originalSize = blob.size
  const input = await blob.arrayBuffer()

  if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined') {
    return passthrough(input, originalSize)
  }

  const maxTextureSize =
    options.profile === 'lite' ? OPTIMIZER_LIMITS.liteTextureMax : OPTIMIZER_LIMITS.fullTextureMax

  return new Promise<OptimizeResult>((resolve) => {
    let worker: Worker
    try {
      worker = new Worker(new URL('./Optimizer.worker.ts', import.meta.url), { type: 'module' })
    } catch {
      resolve(passthrough(input, originalSize))
      return
    }

    let settled = false
    const finish = (result: OptimizeResult): void => {
      if (settled) return
      settled = true
      worker.terminate()
      resolve(result)
    }

    worker.onmessage = (event: MessageEvent<WorkerResponse>): void => {
      const data = event.data
      if (data.type === 'progress') {
        options.onProgress?.(data.progress, data.phase)
        return
      }
      if (data.type === 'done') {
        finish({
          buffer: data.buffer,
          originalSize,
          optimizedSize: data.optimizedSize,
          texturesProcessed: data.texturesProcessed,
          changed: data.changed,
        })
        return
      }
      finish(passthrough(input, originalSize))
    }

    worker.onerror = (): void => {
      finish(passthrough(input, originalSize))
    }

    const transferable = input.slice(0)
    worker.postMessage(
      { buffer: transferable, maxTextureSize, quality: 0.82 },
      [transferable],
    )
  })
}
