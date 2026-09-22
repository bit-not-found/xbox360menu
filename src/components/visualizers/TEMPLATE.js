/**
 * VISUALIZER TEMPLATE
 * ===================
 * Copy this file and modify to create a new visualizer.
 *
 * Each visualizer exports an object with:
 *   - id:     Unique string identifier (kebab-case)
 *   - label:  Human-readable display name
 *   - draw:   Function called every animation frame
 *
 * The draw function receives:
 *   - ctx:       CanvasRenderingContext2D (already scaled for DPR)
 *   - w:         Canvas width in CSS pixels
 *   - h:         Canvas height in CSS pixels
 *   - analyser:  AnalyserNode (from Web Audio API)
 *   - freqData:  Uint8Array (frequency data, already filled via getByteFrequencyData)
 *   - timeData:  Uint8Array (time-domain data, already filled via getByteTimeDomainData)
 *
 * The canvas is cleared before each call to draw().
 * You do NOT need to call analyser.getByteFrequencyData() — it's done for you.
 *
 * To register your visualizer, add it to src/components/visualizers/index.js
 */

export default {
  id: 'my-visualizer',
  label: 'My Visualizer',

  draw(ctx, w, h, analyser, freqData, timeData) {
    // freqData: frequency spectrum (0-255 per bin)
    // timeData: waveform (0-255, 128 = center/silence)

    // --- Frequency bars ---
    const barCount = 64
    const gap = 2
    const barWidth = (w - gap * (barCount - 1)) / barCount
    const step = Math.floor(freqData.length / barCount)

    for (let i = 0; i < barCount; i++) {
      const value = freqData[i * step]
      const barHeight = (value / 255) * h * 0.8
      const x = i * (barWidth + gap)
      const y = h - barHeight

      // Color: green to cyan based on position
      const hue = 120 + (i / barCount) * 60
      ctx.fillStyle = `hsl(${hue}, 70%, 50%)`
      ctx.fillRect(x, y, barWidth, barHeight)
    }

    // --- Optional: overlay a faint waveform line ---
    if (timeData.length > 0) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)'
      ctx.lineWidth = 1
      ctx.beginPath()
      const sliceW = w / timeData.length
      for (let i = 0; i < timeData.length; i++) {
        const v = timeData[i] / 128.0
        const y = (v * h) / 2
        if (i === 0) ctx.moveTo(0, y)
        else ctx.lineTo(i * sliceW, y)
      }
      ctx.stroke()
    }
  },
}
