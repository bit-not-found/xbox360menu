export default {
  id: 'circular',
  label: 'Circular',

  draw(ctx, w, h, analyser, freqData) {
    const cx = w / 2
    const cy = h / 2
    const minDim = Math.min(w, h)
    // Sized so the ring + outward bars fill the available height/width
    const radius = minDim * 0.32
    const outwardMax = radius * 0.55
    const inwardMax = radius * 0.4
    const barCount = 120
    const step = Math.max(1, Math.floor(freqData.length / barCount))
    const lineWidth = Math.max(2, minDim * 0.0045)

    ctx.lineCap = 'round'

    for (let i = 0; i < barCount; i++) {
      const value = freqData[Math.min(i * step, freqData.length - 1)]
      const angle = (i / barCount) * Math.PI * 2 - Math.PI / 2
      const outward = (value / 255) * outwardMax
      const inward = (value / 255) * inwardMax

      const cos = Math.cos(angle)
      const sin = Math.sin(angle)

      const hue = 140 + (i / barCount) * 80
      const light = 35 + (value / 255) * 25

      // Outward bar
      ctx.strokeStyle = `hsla(${hue}, 70%, ${light}%, 0.9)`
      ctx.lineWidth = lineWidth
      ctx.beginPath()
      ctx.moveTo(cx + cos * (radius + lineWidth), cy + sin * (radius + lineWidth))
      ctx.lineTo(cx + cos * (radius + outward), cy + sin * (radius + outward))
      ctx.stroke()

      // Inward bar (fills space toward the center)
      if (inward > lineWidth) {
        ctx.strokeStyle = `hsla(${hue}, 70%, ${light - 5}%, 0.45)`
        ctx.lineWidth = lineWidth * 0.8
        ctx.beginPath()
        ctx.moveTo(cx + cos * (radius - lineWidth), cy + sin * (radius - lineWidth))
        ctx.lineTo(cx + cos * (radius - inward), cy + sin * (radius - inward))
        ctx.stroke()
      }
    }

    // Base ring
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(cx, cy, radius, 0, Math.PI * 2)
    ctx.stroke()

    // Outer faint ring at the max reach of the bars
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(cx, cy, radius + outwardMax, 0, Math.PI * 2)
    ctx.stroke()
  },
}
