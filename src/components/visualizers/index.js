import bars from './bars.js'
import circular from './circular.js'
import waveform from './waveform.js'
import barsMirror from './bars-mirror.js'
import spectrumDots from './spectrum-dots.js'

const visualizers = [
  bars,
  circular,
  waveform,
  barsMirror,
  spectrumDots,
]

export default visualizers

export const getVisualizer = (id) => visualizers.find(v => v.id === id)
export const getVisualizerIds = () => visualizers.map(v => v.id)
