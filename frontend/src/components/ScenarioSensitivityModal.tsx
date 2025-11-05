// @ts-nocheck
import React, { useEffect, useRef, useState } from 'react'

type ScenarioValues = {
  freq: number
  qTest?: number
  pwfTest?: number
  lockFlow?: boolean
  lockPwf?: boolean
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
  return (
    a.freq === b.freq &&
    a.qTest === b.qTest &&
    a.pwfTest === b.pwfTest &&
    Boolean(a.lockFlow) === Boolean(b.lockFlow) &&
    Boolean(a.lockPwf) === Boolean(b.lockPwf)
  )
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
  position: 'absolute',
  pointerEvents: 'auto',
  width: 'min(480px, 94vw)',
  background: 'linear-gradient(145deg, #0d1526 0%, #101c34 100%)',
  borderRadius: '16px',
  border: '1px solid rgba(120, 157, 255, 0.5)',
  boxShadow: '0 28px 64px rgba(4, 10, 24, 0.7)',
  padding: '30px',
  color: '#e2ebff',
  display: 'flex',
  flexDirection: 'column',
  gap: '24px'
}

const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '16px'
}

const headerTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '1.45rem',
  color: '#c1d9ff',
  letterSpacing: '-0.01em',
  fontWeight: 700,
  lineHeight: 1.15
}

const headerSubtitleStyle: React.CSSProperties = {
  margin: '10px 0 0 0',
  color: '#a5bff5',
  fontSize: '1.05rem',
  fontWeight: 500
}

const closeButtonStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: '#a5bff5',
  fontSize: '1.6rem',
  cursor: 'pointer',
  lineHeight: 1,
  padding: 0
}

const contentStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '22px',
  paddingTop: '6px'
}

const fieldLabelStyle: React.CSSProperties = {
  fontWeight: 650,
  color: '#dbe6ff',
  fontSize: '1.08rem',
  letterSpacing: '-0.005em'
}

const inputStyle: React.CSSProperties = {
  padding: '14px 16px',
  borderRadius: '12px',
  border: '1px solid rgba(118, 147, 234, 0.75)',
  background: '#0b1426',
  color: '#f4f7ff',
  fontWeight: 600,
  fontSize: '1.05rem',
  boxShadow: '0 0 0 1px rgba(74, 103, 190, 0.35) inset'
}

const footerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '14px'
}

const secondaryButtonStyle: React.CSSProperties = {
  padding: '12px 22px',
  borderRadius: '12px',
  border: '1px solid rgba(132, 149, 198, 0.55)',
  background: 'rgba(18, 31, 56, 0.8)',
  color: '#cfdbff',
  fontWeight: 600,
  fontSize: '1.05rem',
  cursor: 'pointer'
}

const primaryButtonStyle: React.CSSProperties = {
  padding: '12px 24px',
  borderRadius: '12px',
  border: '1px solid rgba(118, 147, 234, 0.95)',
  background: 'linear-gradient(135deg, #4156d8 0%, #8c5ff9 100%)',
  color: '#f5f7ff',
  fontWeight: 700,
  fontSize: '1.08rem',
  cursor: 'pointer',
  boxShadow: '0 14px 32px rgba(47, 75, 177, 0.45)'
}

const computeDefaultPosition = () => {
  if (typeof window === 'undefined') {
    return { x: 160, y: 120 }
  }
  const width = Math.min(480, window.innerWidth - 32)
  const height = 340
  return {
    x: Math.max((window.innerWidth - width) / 2, 16),
    y: Math.max((window.innerHeight - height) / 2, 16)
  }
}

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
  const [lockFlow, setLockFlow] = useState(() => Boolean(values?.lockFlow))
  const [lockPwf, setLockPwf] = useState(() => Boolean(values?.lockPwf))
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
  const skipCommitRef = useRef(false)

  const latestDraftRef = useRef<ScenarioValues | null>(null)
  const currentValues = () => {
    const freqNumber = parseEditableNumber(freq)
    const qNumber = parseEditableNumber(qTest)
    const pwfNumber = parseEditableNumber(pwfTest)

    if (freqNumber === null) {
      return null
    }

    if (lockFlow && qNumber === null) {
      return null
    }

    if (lockPwf && pwfNumber === null) {
      return null
    }

    return {
      freq: freqNumber,
      qTest: qNumber === null ? undefined : qNumber,
      pwfTest: pwfNumber === null ? undefined : pwfNumber,
      lockFlow,
      lockPwf
    }
  }

  const commitDraftValues = () => {
    if (!open || !scenarioKey) {
      return
    }

    if (skipCommitRef.current) {
      skipCommitRef.current = false
      return
    }

    const latest = currentValues()
    if (!latest) {
      return
    }

    if (!scenariosEqual(latest, lastAppliedRef.current)) {
      lastAppliedRef.current = latest
      onSave(scenarioKey, latest)
    }
    latestDraftRef.current = latest
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
      const initial: ScenarioValues = {
        freq: parseNumber(values?.freq, 50),
        qTest: parseNumber(values?.qTest, 0),
        pwfTest: parseNumber(values?.pwfTest, 0),
        lockFlow: Boolean(values?.lockFlow),
        lockPwf: Boolean(values?.lockPwf)
      }

      initialValuesRef.current = initial
      lastAppliedRef.current = initial
      latestDraftRef.current = initial

      setFreq(String(initial.freq))
      setQTest(initial.qTest !== undefined ? String(initial.qTest) : '')
      setPwfTest(initial.pwfTest !== undefined ? String(initial.pwfTest) : '')
      setLockFlow(Boolean(initial.lockFlow))
      setLockPwf(Boolean(initial.lockPwf))
    }
  }, [open, scenarioKey, values])

  useEffect(() => {
    latestDraftRef.current = currentValues()
  }, [freq, qTest, pwfTest, lockFlow, lockPwf])

  useEffect(() => {
    if (!open) {
      initialValuesRef.current = null
      lastAppliedRef.current = null
      latestDraftRef.current = null
      skipCommitRef.current = false
      setLockFlow(false)
      setLockPwf(false)
    }
  }, [open])

  useEffect(() => {
    if (!open || !scenarioKey) {
      return
    }

    return () => {
      if (skipCommitRef.current) {
        skipCommitRef.current = false
        return
      }

      const latest = latestDraftRef.current
      if (!latest) {
        return
      }

      if (!scenariosEqual(latest, lastAppliedRef.current)) {
        lastAppliedRef.current = latest
        onSave(scenarioKey, latest)
      }
    }
  }, [open, scenarioKey, onSave])

  useEffect(() => {
    if (!open) return

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        skipCommitRef.current = true
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
    skipCommitRef.current = false
    const initial = initialValuesRef.current
    if (initial && scenarioKey) {
      setFreq(String(initial.freq))
      setQTest(initial.qTest !== undefined ? String(initial.qTest) : '')
      setPwfTest(initial.pwfTest !== undefined ? String(initial.pwfTest) : '')
      setLockFlow(Boolean(initial.lockFlow))
      setLockPwf(Boolean(initial.lockPwf))
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
            <h2 style={headerTitleStyle}>Adjust Scenario</h2>
            <p style={headerSubtitleStyle}>{currentLabel}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              commitDraftValues()
              onClose()
            }}
            onPointerDown={(event) => event.stopPropagation()}
            style={closeButtonStyle}
            aria-label="Close sensitivity dialog"
          >
            ×
          </button>
        </header>

        <div style={contentStyle}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={fieldLabelStyle}>Frequency (Hz)</span>
            <input
              type="number"
              value={freq}
              onChange={(event) => setFreq(event.target.value)}
              min={30}
              max={70}
              step={0.5}
              style={inputStyle}
              onBlur={commitDraftValues}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={fieldLabelStyle}>Q Test (m3/d)</span>
            <input
              type="number"
              value={qTest}
              onChange={(event) => {
                const next = event.target.value
                setQTest(next)
                setLockFlow(next.trim().length > 0)
              }}
              min={0}
              step={5}
              style={inputStyle}
              onBlur={commitDraftValues}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={fieldLabelStyle}>Pwf Test (bar)</span>
            <input
              type="number"
              value={pwfTest}
              onChange={(event) => {
                const next = event.target.value
                setPwfTest(next)
                setLockPwf(next.trim().length > 0)
              }}
              min={0}
              step={1}
              style={inputStyle}
              onBlur={commitDraftValues}
            />
          </label>
        </div>

        <footer style={footerStyle}>
          <button
            type="button"
            onClick={handleCancel}
            onPointerDown={(event) => {
              skipCommitRef.current = true
              event.stopPropagation()
            }}
            style={secondaryButtonStyle}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              commitDraftValues()
              onClose()
            }}
            onPointerDown={(event) => event.stopPropagation()}
            style={primaryButtonStyle}
          >
            Close
          </button>
        </footer>
      </div>
    </div>
  )
}
