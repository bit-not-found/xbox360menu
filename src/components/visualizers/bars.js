export default {
  id: 'bars',
  label: 'Frequency Bars',

  draw(ctx, w, h, analyser, freqData) {
    const barCount = Math.max(48, Math.min(140, Math.round(w / 16)))
    const gap = Math.max(2, Math.min(4, w / 640))
    const barWidth = (w - gap * (barCount - 1)) / barCount
    const step = Math.max(1, Math.floor(freqData.length / barCount))
    const maxBarHeight = h * 0.95

    for (let i = 0; i < barCount; i++) {
      const value = freqData[Math.min(i * step, freqData.length - 1)]
      const barHeight = (value / 255) * maxBarHeight
      const x = i * (barWidth + gap)
      const y = h - barHeight

      const hue = 140 + (i / barCount) * 80
      const sat = 60 + (value / 255) * 30
      const light = 30 + (value / 255) * 30

      const gradient = ctx.createLinearGradient(x, h, x, y)
      gradient.addColorStop(0, `hsla(${hue}, ${sat}%, ${light}%, 0.55)`)
      gradient.addColorStop(1, `hsla(${hue}, ${sat}%, ${light + 15}%, 0.95)`)
      ctx.fillStyle = gradient
      ctx.fillRect(x, y, barWidth, barHeight)

      if (barHeight > 4) {
        ctx.fillStyle = `hsla(${hue}, ${sat + 15}%, ${light + 30}%, 0.9)`
        ctx.fillRect(x, y - 3, barWidth, 3)
      }
    }
  },
}
