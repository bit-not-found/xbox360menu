export default {
  id: 'bars-mirror',
  label: 'Bars Mirror',

  draw(ctx, w, h, analyser, freqData) {
    const barCount = 64
    const gap = 2
    const barWidth = (w - gap * (barCount - 1)) / barCount
    const step = Math.floor(freqData.length / barCount)
    const centerY = h / 2

    for (let i = 0; i < barCount; i++) {
      const value = freqData[i * step]
      const barHeight = (value / 255) * (h / 2) * 0.85
      const x = i * (barWidth + gap)

      const hue = 200 + (i / barCount) * 120
      const sat = 65 + (value / 255) * 25
      const light = 30 + (value / 255) * 30

      // Top half (grows upward from center)
      ctx.fillStyle = `hsla(${hue}, ${sat}%, ${light}%, 0.9)`
      ctx.fillRect(x, centerY - barHeight, barWidth, barHeight)

      // Bottom half (grows downward from center — mirror)
      ctx.fillStyle = `hsla(${hue}, ${sat}%, ${light}%, 0.7)`
      ctx.fillRect(x, centerY, barWidth, barHeight)

      // Center glow line
      if (value > 30) {
        ctx.fillStyle = `hsla(${hue}, 80%, 60%, ${(value / 255) * 0.6})`
        ctx.fillRect(x, centerY - 1, barWidth, 2)
      }
    }

    // Center axis line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, centerY)
    ctx.lineTo(w, centerY)
    ctx.stroke()
  },
}
