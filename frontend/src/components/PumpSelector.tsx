import React from 'react'

type Props = {
  pumps: string[]
  value: string | null
  onChange: (v: string | null) => void
}

export default function PumpSelector({ pumps, value, onChange }: Props) {
  return (
    <div className="pump-selector">
      <label>Choose pump: </label>
      <select value={value ?? ''} onChange={e => onChange(e.target.value || null)}>
        <option value="">-- select --</option>
        {pumps.map(p => (<option key={p} value={p}>{p}</option>))}
      </select>
    </div>
  )
}
