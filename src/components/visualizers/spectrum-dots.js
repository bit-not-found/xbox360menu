export default {
  id: 'spectrum-dots',
  label: 'Spectrum Dots',

  draw(ctx, w, h, analyser, freqData) {
    // Scale the matrix to the screen so dots stay evenly spaced at any size
    const cols = Math.max(32, Math.min(96, Math.round(w / 26)))
    const rows = Math.max(16, Math.min(56, Math.round(h / 26)))
    const gap = 4
    const dotW = (w - gap * (cols - 1)) / cols
    const dotH = (h - gap * (rows - 1)) / rows
    const dotSize = Math.min(dotW, dotH) * 0.8
    const step = Math.max(1, Math.floor(freqData.length / cols))

    for (let col = 0; col < cols; col++) {
      const value = freqData[Math.min(col * step, freqData.length - 1)]
      const activeRows = Math.round((value / 255) * rows)
      const x = col * (dotW + gap) + dotW / 2

      for (let row = 0; row < rows; row++) {
        const y = h - row * (dotH + gap) - dotH / 2
        const isActive = row < activeRows

        if (isActive) {
          const hue = 160 + (col / cols) * 100
          const intensity = 1 - (row / rows) * 0.4
          const lightness = 35 + (value / 255) * 20

          ctx.fillStyle = `hsla(${hue}, 75%, ${lightness}%, ${intensity})`
          ctx.beginPath()
          ctx.arc(x, y, dotSize / 2, 0, Math.PI * 2)
          ctx.fill()

          // Top dot glow
          if (row === activeRows - 1 && value > 40) {
            ctx.fillStyle = `hsla(${hue}, 90%, 65%, 0.6)`
            ctx.beginPath()
            ctx.arc(x, y, dotSize / 2 + 2, 0, Math.PI * 2)
            ctx.fill()
          }
        } else {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.04)'
          ctx.beginPath()
          ctx.arc(x, y, dotSize / 2, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    }
  },
}
