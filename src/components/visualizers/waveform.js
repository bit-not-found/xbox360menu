export default {
  id: 'waveform',
  label: 'Waveform',

  draw(ctx, w, h, analyser, freqData, timeData) {
    ctx.lineWidth = 2.5
    ctx.strokeStyle = 'rgba(80, 200, 120, 0.9)'
    ctx.beginPath()

    const sliceWidth = w / timeData.length
    let x = 0

    for (let i = 0; i < timeData.length; i++) {
      const v = timeData[i] / 128.0
      const y = (v * h) / 2

      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
      x += sliceWidth
    }

    ctx.lineTo(w, h / 2)
    ctx.stroke()

    // Shadow / glow line
    ctx.lineWidth = 6
    ctx.strokeStyle = 'rgba(80, 200, 120, 0.15)'
    ctx.beginPath()
    x = 0
    for (let i = 0; i < timeData.length; i++) {
      const v = timeData[i] / 128.0
      const y = (v * h) / 2
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
      x += sliceWidth
    }
    ctx.lineTo(w, h / 2)
    ctx.stroke()
  },
}
