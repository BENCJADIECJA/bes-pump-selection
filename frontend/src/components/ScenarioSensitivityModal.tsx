// @ts-nocheck
import React, { useEffect, useRef, useState } from 'react'

type ScenarioValues = {
  freq: number
  qTest: number
  pwfTest: number
}

type ScenarioSensitivityModalProps = {
  open: boolean
  scenarioKey: string | null
  scenarioLabel?: string
  values?: ScenarioValues | null
  onClose: () => void
  onSave: (scenarioKey: string, values: ScenarioValues) => void
}

const parseNumber = (value: unknown, fallback: number) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const scenariosEqual = (a: ScenarioValues | null, b: ScenarioValues | null) => {
  if (a === b) {
    return true
  }
  if (!a || !b) {
    return false
  }
  return a.freq === b.freq && a.qTest === b.qTest && a.pwfTest === b.pwfTest
}

const parseEditableNumber = (value: string | number | null | undefined): number | null => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }
  if (typeof value !== 'string') {
    return null
  }
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

const containerStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  pointerEvents: 'none',
  zIndex: 1200
}

const modalStyle: React.CSSProperties = {
  width: 'min(420px, 92vw)',
  background: 'linear-gradient(145deg, #0d1526 0%, #101c34 100%)',
  borderRadius: '14px',
  border: '1px solid rgba(120, 157, 255, 0.4)',
  boxShadow: '0 22px 46px rgba(4, 10, 24, 0.65)',
  padding: '24px',
  color: '#dbe6ff',
  display: 'flex',
  flexDirection: 'column',
  gap: '18px',
  position: 'absolute',
  pointerEvents: 'auto'
}

const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '12px'
}

const computeDefaultPosition = () => {
  if (typeof window === 'undefined') {
    return { x: 160, y: 120 }
  }
  const width = Math.min(420, window.innerWidth - 32)
  const height = 320
  return {
    x: Math.max((window.innerWidth - width) / 2, 16),
    y: Math.max((window.innerHeight - height) / 2, 16)
  }
}

const AUTO_SAVE_DELAY_MS = 200

export default function ScenarioSensitivityModal({
  open,
  scenarioKey,
  scenarioLabel,
  values,
  onClose,
  onSave
}: ScenarioSensitivityModalProps) {
  const [freq, setFreq] = useState(() => String(values?.freq ?? 50))
  const [qTest, setQTest] = useState(() => String(values?.qTest ?? 0))
  const [pwfTest, setPwfTest] = useState(() => String(values?.pwfTest ?? 0))
  const [position, setPosition] = useState(() => computeDefaultPosition())
  const [isDragging, setIsDragging] = useState(false)

  const dialogRef = useRef<HTMLDivElement | null>(null)
  const dragStateRef = useRef({
    active: false,
    pointerId: null as number | null,
    offsetX: 0,
    offsetY: 0
  })
  const lastScenarioRef = useRef<string | null>(null)
  const initialValuesRef = useRef<ScenarioValues | null>(null)
  const lastAppliedRef = useRef<ScenarioValues | null>(null)

  const currentValues = () => {
    const freqNumber = parseEditableNumber(freq)
    const qNumber = parseEditableNumber(qTest)
    const pwfNumber = parseEditableNumber(pwfTest)

    if (freqNumber === null || qNumber === null || pwfNumber === null) {
      return null
    }

    return {
      freq: freqNumber,
      qTest: qNumber,
      pwfTest: pwfNumber
    }
  }

  const clampPosition = (coords: { x: number; y: number }) => {
    if (typeof window === 'undefined') {
      return coords
    }

    const node = dialogRef.current
    const width = node?.offsetWidth ?? 360
    const height = node?.offsetHeight ?? 320
    const margin = 16
    const maxX = Math.max(margin, window.innerWidth - width - margin)
    const maxY = Math.max(margin, window.innerHeight - height - margin)

    return {
      x: Math.min(Math.max(margin, coords.x), maxX),
      y: Math.min(Math.max(margin, coords.y), maxY)
    }
  }

  useEffect(() => {
    if (open && scenarioKey) {
      const initial = {
        freq: parseNumber(values?.freq, 50),
        qTest: parseNumber(values?.qTest, 0),
        pwfTest: parseNumber(values?.pwfTest, 0)
      }

      initialValuesRef.current = initial
      lastAppliedRef.current = initial

      setFreq(String(initial.freq))
      setQTest(String(initial.qTest))
      setPwfTest(String(initial.pwfTest))
    }
  }, [open, scenarioKey])

  useEffect(() => {
    if (!open) {
      initialValuesRef.current = null
      lastAppliedRef.current = null
    }
  }, [open])

  useEffect(() => {
    if (!open) return

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  useEffect(() => {
    if (!open) {
      dragStateRef.current.active = false
      dragStateRef.current.pointerId = null
      setIsDragging(false)
      return
    }

    if (scenarioKey && lastScenarioRef.current !== scenarioKey) {
      lastScenarioRef.current = scenarioKey
      setPosition(clampPosition(computeDefaultPosition()))
    } else {
      setPosition((prev) => clampPosition(prev))
    }
  }, [open, scenarioKey])

  useEffect(() => {
    if (!open) {
      return
    }

    const handlePointerMove = (event: PointerEvent) => {
      const state = dragStateRef.current
      if (!state.active) {
        return
      }
      if (state.pointerId !== null && event.pointerId !== state.pointerId) {
        return
      }

      const nextX = event.clientX - state.offsetX
      const nextY = event.clientY - state.offsetY
      setPosition(clampPosition({ x: nextX, y: nextY }))
    }

    const finishDrag = (event: PointerEvent) => {
      const state = dragStateRef.current
      if (!state.active) {
        return
      }
      if (state.pointerId !== null && event.pointerId !== state.pointerId) {
        return
      }
      state.active = false
      state.pointerId = null
      setIsDragging(false)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', finishDrag)
    window.addEventListener('pointercancel', finishDrag)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', finishDrag)
      window.removeEventListener('pointercancel', finishDrag)
    }
  }, [open])

  useEffect(() => {
    if (!open) {
      return
    }

    const handleResize = () => {
      setPosition((prev) => clampPosition(prev))
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [open])

  useEffect(() => {
    if (!open || !scenarioKey) {
      return
    }

    const latest = currentValues()
    if (!latest) {
      return
    }

    const handle = window.setTimeout(() => {
      if (!scenariosEqual(latest, lastAppliedRef.current)) {
        lastAppliedRef.current = latest
        onSave(scenarioKey, latest)
      }
    }, AUTO_SAVE_DELAY_MS)

    return () => window.clearTimeout(handle)
  }, [freq, qTest, pwfTest, open, scenarioKey, onSave])

  if (!open || !scenarioKey) {
    return null
  }

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 && event.pointerType === 'mouse') {
      return
    }
    event.preventDefault()
    const state = dragStateRef.current
    state.active = true
    state.pointerId = event.pointerId ?? null
    state.offsetX = event.clientX - position.x
    state.offsetY = event.clientY - position.y
    setIsDragging(true)
  }

  const currentLabel = scenarioLabel || scenarioKey

  const handleCancel = () => {
    const initial = initialValuesRef.current
    if (initial && scenarioKey) {
      setFreq(String(initial.freq))
      setQTest(String(initial.qTest))
      setPwfTest(String(initial.pwfTest))
      if (!scenariosEqual(initial, lastAppliedRef.current)) {
        lastAppliedRef.current = initial
        onSave(scenarioKey, initial)
      }
    }
    onClose()
  }

  return (
    <div style={containerStyle}>
      <div
        ref={dialogRef}
        style={{
          ...modalStyle,
          left: `${position.x}px`,
          top: `${position.y}px`,
          cursor: isDragging ? 'grabbing' : 'default'
        }}
      >
        <header
          style={{
            ...headerStyle,
            cursor: isDragging ? 'grabbing' : 'grab',
            userSelect: 'none'
          }}
          onPointerDown={handlePointerDown}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: '1.35rem', color: '#9fc3ff' }}>Adjust Scenario</h2>
            <p style={{ margin: '6px 0 0 0', color: '#8ca1d4', fontSize: '0.9rem' }}>{currentLabel}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            onPointerDown={(event) => event.stopPropagation()}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#8ca1d4',
              fontSize: '1.4rem',
              cursor: 'pointer',
              lineHeight: 1
            }}
            aria-label="Close sensitivity dialog"
          >
            ×
          </button>
        </header>

  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', paddingTop: '4px' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontWeight: 600, color: '#d3e1ff' }}>Frequency (Hz)</span>
            <input
              type="number"
              value={freq}
              onChange={(event) => setFreq(event.target.value)}
              min={30}
              max={70}
              step={0.5}
              style={{
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid rgba(118, 147, 234, 0.6)',
                background: '#0b1426',
                color: '#e2eaff',
                fontWeight: 600
              }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontWeight: 600, color: '#d3e1ff' }}>Q Test (m³/d)</span>
            <input
              type="number"
              value={qTest}
              onChange={(event) => setQTest(event.target.value)}
              min={0}
              step={5}
              style={{
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid rgba(118, 147, 234, 0.6)',
                background: '#0b1426',
                color: '#e2eaff',
                fontWeight: 600
              }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontWeight: 600, color: '#d3e1ff' }}>Pwf Test (bar)</span>
            <input
              type="number"
              value={pwfTest}
              onChange={(event) => setPwfTest(event.target.value)}
              min={0}
              step={1}
              style={{
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid rgba(118, 147, 234, 0.6)',
                background: '#0b1426',
                color: '#e2eaff',
                fontWeight: 600
              }}
            />
          </label>
        </div>

        <footer style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button
            type="button"
            onClick={handleCancel}
            onPointerDown={(event) => event.stopPropagation()}
            style={{
              padding: '10px 18px',
              borderRadius: '8px',
              border: '1px solid rgba(132, 149, 198, 0.5)',
              background: 'rgba(16, 28, 50, 0.6)',
              color: '#a8bdf0',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onClose}
            onPointerDown={(event) => event.stopPropagation()}
            style={{
              padding: '10px 18px',
              borderRadius: '8px',
              border: '1px solid rgba(118, 147, 234, 0.9)',
              background: 'linear-gradient(135deg, #3a4bc8 0%, #8559f6 100%)',
              color: '#f5f7ff',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 12px 28px rgba(47, 75, 177, 0.4)'
            }}
          >
            Close
          </button>
        </footer>
      </div>
    </div>
  )
}
