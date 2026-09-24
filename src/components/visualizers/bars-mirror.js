export default {
  id: 'bars-mirror',
  label: 'Bars Mirror',

  draw(ctx, w, h, analyser, freqData) {
    const barCount = Math.max(40, Math.min(120, Math.round(w / 22)))
    const gap = Math.max(2, Math.min(4, w / 720))
    const barWidth = (w - gap * (barCount - 1)) / barCount
    const step = Math.max(1, Math.floor(freqData.length / barCount))
    const centerY = h / 2
    const maxHalf = (h / 2) * 0.96

    for (let i = 0; i < barCount; i++) {
      const value = freqData[Math.min(i * step, freqData.length - 1)]
      const barHeight = (value / 255) * maxHalf
      const x = i * (barWidth + gap)

      const hue = 200 + (i / barCount) * 120
      const sat = 65 + (value / 255) * 25
      const light = 30 + (value / 255) * 30

      // Top half (grows upward from center)
      const topGrad = ctx.createLinearGradient(x, centerY, x, centerY - barHeight)
      topGrad.addColorStop(0, `hsla(${hue}, ${sat}%, ${light}%, 0.95)`)
      topGrad.addColorStop(1, `hsla(${hue}, ${sat}%, ${light + 15}%, 0.6)`)
      ctx.fillStyle = topGrad
      ctx.fillRect(x, centerY - barHeight, barWidth, barHeight)

      // Bottom half (grows downward from center — mirror)
      const botGrad = ctx.createLinearGradient(x, centerY, x, centerY + barHeight)
      botGrad.addColorStop(0, `hsla(${hue}, ${sat}%, ${light}%, 0.85)`)
      botGrad.addColorStop(1, `hsla(${hue}, ${sat}%, ${light + 10}%, 0.35)`)
      ctx.fillStyle = botGrad
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
