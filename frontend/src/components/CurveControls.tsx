import React from 'react'

type Props = {
  freq: number
  setFreq: (n: number) => void
  stages: number
  setStages: (n: number) => void
  points: number
  setPoints: (n: number) => void
  onPlot: () => void
  isMultiFreq: boolean
  setIsMultiFreq: (b: boolean) => void
  minFreq: number
  setMinFreq: (n: number) => void
  maxFreq: number
  setMaxFreq: (n: number) => void
  numCurves: number
  setNumCurves: (n: number) => void
}

export default function CurveControls({ 
  freq, setFreq, stages, setStages, points, setPoints, onPlot,
  isMultiFreq, setIsMultiFreq, minFreq, setMinFreq, maxFreq, setMaxFreq, numCurves, setNumCurves 
}: Props) {
  return (
    <div className="curve-controls">
      <label className="checkbox-label">
        <input type="checkbox" checked={isMultiFreq} onChange={e => setIsMultiFreq(e.target.checked)} />
        Multi-Frequency Mode
      </label>
      
      {!isMultiFreq ? (
        <>
          <label>Freq (Hz): <input type="number" value={freq} onChange={e => setFreq(Number(e.target.value))} /></label>
          <label>Stages: <input type="number" value={stages} onChange={e => setStages(Number(e.target.value))} /></label>
          <label>Points: <input type="number" value={points} onChange={e => setPoints(Number(e.target.value))} /></label>
        </>
      ) : (
        <>
          <label>Min Freq (Hz): <input type="number" value={minFreq} onChange={e => setMinFreq(Number(e.target.value))} /></label>
          <label>Max Freq (Hz): <input type="number" value={maxFreq} onChange={e => setMaxFreq(Number(e.target.value))} /></label>
          <label>Num Curves: <input type="number" value={numCurves} min="2" max="10" onChange={e => setNumCurves(Number(e.target.value))} /></label>
          <label>Stages: <input type="number" value={stages} onChange={e => setStages(Number(e.target.value))} /></label>
          <label>Points: <input type="number" value={points} onChange={e => setPoints(Number(e.target.value))} /></label>
        </>
      )}
    </div>
  )
}
