export default {
  id: 'bars',
  label: 'Frequency Bars',

  draw(ctx, w, h, analyser, freqData) {
    const barCount = 80
    const gap = 3
    const barWidth = (w - gap * (barCount - 1)) / barCount
    const step = Math.floor(freqData.length / barCount)

    for (let i = 0; i < barCount; i++) {
      const value = freqData[i * step]
      const barHeight = (value / 255) * h * 0.8
      const x = i * (barWidth + gap)
      const y = h - barHeight

      const hue = 140 + (i / barCount) * 80
      const sat = 60 + (value / 255) * 30
      const light = 30 + (value / 255) * 30

      ctx.fillStyle = `hsla(${hue}, ${sat}%, ${light}%, 0.9)`
      ctx.fillRect(x, y, barWidth, barHeight)

      ctx.fillStyle = `hsla(${hue}, ${sat + 10}%, ${light + 15}%, 0.5)`
      ctx.fillRect(x, y - 3, barWidth, 3)
    }
  },
}
