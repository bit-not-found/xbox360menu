# Adding a New Visualizer

## Quick Start (3 steps)

1. **Copy the template:**
   ```bash
   cp src/components/visualizers/TEMPLATE.js src/components/visualizers/my-visualizer.js
   ```

2. **Edit your new file** — change `id`, `label`, and the `draw()` function

3. **Register it** in `src/components/visualizers/index.js`:
   ```js
   import myVisualizer from './my-visualizer.js'

   const visualizers = [
     bars,
     circular,
     waveform,
     barsMirror,
     spectrumDots,
     myVisualizer,  // <-- add here
   ]
   ```

That's it. The visualizer will appear in the Fullscreen Player settings panel automatically.

---

## File Structure

```
src/components/visualizers/
  index.js           ← Registry (import + export all visualizers)
  TEMPLATE.js        ← Copy this to create new visualizers
  bars.js            ← Frequency bars
  circular.js        ← Circular radial bars
  waveform.js        ← Time-domain waveform line
  bars-mirror.js     ← Mirrored frequency bars
  spectrum-dots.js   ← Dot matrix grid
```

---

## Visualizer File Format

Each file exports a default object with 3 properties:

```js
export default {
  id: 'my-visualizer',      // Unique ID (kebab-case)
  label: 'My Visualizer',   // Display name in settings panel

  draw(ctx, w, h, analyser, freqData, timeData) {
    // Your drawing code here
  },
}
```

### Parameters

| Param      | Type                   | Description                                        |
|------------|------------------------|----------------------------------------------------|
| `ctx`      | `CanvasRenderingContext2D` | Canvas context (already DPR-scaled)             |
| `w`        | `number`               | Canvas width in CSS pixels                         |
| `h`        | `number`               | Canvas height in CSS pixels                        |
| `analyser` | `AnalyserNode`         | Web Audio API analyser (for advanced use)          |
| `freqData` | `Uint8Array`           | Frequency data (already filled, 0-255 per bin)     |
| `timeData` | `Uint8Array`           | Time-domain data (already filled, 0-255, 128=center) |

### Important Notes

- The canvas is **cleared before each call** to `draw()` — no need to call `ctx.clearRect()`
- `freqData` and `timeData` are **already populated** — no need to call `getByteFrequencyData()`
- The canvas context is **already scaled for DPR** — draw in CSS pixel coordinates
- `freqData.length` is typically 1024 (half of fftSize 2048)
- Values in `freqData` and `timeData` range from 0 to 255

---

## Example: Minimal Visualizer

```js
export default {
  id: 'simple-bars',
  label: 'Simple Bars',

  draw(ctx, w, h, analyser, freqData) {
    const barCount = 32
    const barWidth = w / barCount

    for (let i = 0; i < barCount; i++) {
      const value = freqData[i * Math.floor(freqData.length / barCount)]
      const barHeight = (value / 255) * h

      ctx.fillStyle = `hsl(${i * 4}, 70%, 50%)`
      ctx.fillRect(i * barWidth, h - barHeight, barWidth - 1, barHeight)
    }
  },
}
```

---

## Example: Advanced Visualizer with AnalyserNode

```js
export default {
  id: 'peak-meter',
  label: 'Peak Meter',

  draw(ctx, w, h, analyser, freqData) {
    // You can use the analyser directly for getFloatFrequencyData
    // for higher precision (dB scale)
    const floatData = new Float32Array(analyser.frequencyBinCount)
    analyser.getFloatFrequencyData(floatData)

    const barCount = 16
    const barWidth = w / barCount - 4
    const step = Math.floor(floatData.length / barCount)

    for (let i = 0; i < barCount; i++) {
      // Convert dB (-100 to 0) to 0-1 range
      const db = floatData[i * step]
      const normalized = Math.max(0, (db + 100) / 100)
      const barHeight = normalized * h * 0.9

      const hue = 120 - normalized * 120  // green to red
      ctx.fillStyle = `hsl(${hue}, 80%, 50%)`
      ctx.fillRect(
        i * (barWidth + 4) + 2,
        h - barHeight,
        barWidth,
        barHeight
      )
    }
  },
}
```

---

## Tips

- **Performance:** Keep draw calls minimal. Avoid allocations inside `draw()` — create arrays once outside.
- **Colors:** Use HSL/HSLA for easy color gradients based on frequency or position.
- **Effects:** Combine frequency data with time data for reactive effects (e.g., pulse on beat).
- **Beat detection:** Compare current `freqData` average against a running average to detect beats.
- **Gradient fills:** Use `ctx.createLinearGradient()` or `ctx.createRadialGradient()` for smooth color transitions.
