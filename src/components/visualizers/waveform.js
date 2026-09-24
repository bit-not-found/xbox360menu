export default {
  id: 'waveform',
  label: 'Waveform',

  draw(ctx, w, h, analyser, freqData, timeData) {
    const centerY = h / 2
    // Amplified so the wave uses the full height of the screen
    const amp = h * 0.9
    const lineWidth = Math.max(2, h * 0.003)

    const yAt = (i) => {
      const v = timeData[i] / 128.0 - 1
      const y = centerY + v * amp
      return Math.max(2, Math.min(h - 2, y))
    }

    // Glow line (drawn first, underneath)
    ctx.lineWidth = lineWidth * 2.5
    ctx.strokeStyle = 'rgba(80, 200, 120, 0.15)'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    const sliceWidth = w / timeData.length
    for (let i = 0; i < timeData.length; i++) {
      const x = i * sliceWidth
      if (i === 0) ctx.moveTo(x, yAt(i))
      else ctx.lineTo(x, yAt(i))
    }
    ctx.lineTo(w, centerY)
    ctx.stroke()

    // Main wave line
    ctx.lineWidth = lineWidth
    ctx.strokeStyle = 'rgba(80, 200, 120, 0.9)'
    ctx.beginPath()
    for (let i = 0; i < timeData.length; i++) {
      const x = i * sliceWidth
      if (i === 0) ctx.moveTo(x, yAt(i))
      else ctx.lineTo(x, yAt(i))
    }
    ctx.lineTo(w, centerY)
    ctx.stroke()
  },
}
