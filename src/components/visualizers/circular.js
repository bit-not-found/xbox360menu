export default {
  id: 'circular',
  label: 'Circular',

  draw(ctx, w, h, analyser, freqData) {
    const cx = w / 2
    const cy = h / 2
    const radius = Math.min(w, h) * 0.25
    const barCount = 120
    const step = Math.floor(freqData.length / barCount)

    for (let i = 0; i < barCount; i++) {
      const value = freqData[i * step]
      const angle = (i / barCount) * Math.PI * 2 - Math.PI / 2
      const barLen = (value / 255) * radius * 1.2

      const x1 = cx + Math.cos(angle) * radius
      const y1 = cy + Math.sin(angle) * radius
      const x2 = cx + Math.cos(angle) * (radius + barLen)
      const y2 = cy + Math.sin(angle) * (radius + barLen)

      const hue = 140 + (i / barCount) * 80
      const light = 35 + (value / 255) * 25

      ctx.strokeStyle = `hsla(${hue}, 70%, ${light}%, 0.85)`
      ctx.lineWidth = 2.5
      ctx.beginPath()
      ctx.moveTo(x1, y1)
      ctx.lineTo(x2, y2)
      ctx.stroke()
    }

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(cx, cy, radius, 0, Math.PI * 2)
    ctx.stroke()
  },
}
