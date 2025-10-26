// @ts-nocheck
import React, { useEffect, useState } from 'react'
import axios from 'axios'

interface TubingOption {
  nombre: string
  od_inch: number
  od_mm: number
  id_mm: number
  peso_lb_ft: number
  descripcion: string
}

interface InstallationControlsProps {
  profundidadIntake: number
  setProfundidadIntake: (value: number) => void
  tubingSelected: string
  setTubingSelected: (value: string) => void
  tubingIdMm: number
  setTubingIdMm: (value: number) => void
  tubingRoughness: string
  setTubingRoughness: (value: string) => void
  presionSuperficie: number
  setPresionSuperficie: (value: number) => void
  presionCasing: number
  setPresionCasing: (value: number) => void
}

export default function InstallationControls(props: InstallationControlsProps) {
  const {
    profundidadIntake, setProfundidadIntake,
    tubingSelected, setTubingSelected,
    tubingIdMm, setTubingIdMm,
    tubingRoughness, setTubingRoughness,
    presionSuperficie, setPresionSuperficie,
    presionCasing, setPresionCasing
  } = props

  const [tubingCatalog, setTubingCatalog] = useState<TubingOption[]>([])
  const [roughnessOptions, setRoughnessOptions] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(false)

  const CONTROL_SURFACE = '#15233d'
  const getFieldStyle = (borderColor: string, overrides: any = {}) => ({
    padding: '8px 12px',
    borderRadius: '6px',
    border: `1px solid ${borderColor}`,
    background: CONTROL_SURFACE,
    color: '#e4ecff',
    boxShadow: 'inset 0 1px 0 rgba(0, 0, 0, 0.25)',
    ...overrides
  })

  // Cargar catálogo de tuberías al montar el componente
  useEffect(() => {
    setLoading(true)
    axios.get('/api/tubing-catalog')
      .then(response => {
        if (response.data.success) {
          setTubingCatalog(response.data.catalog)
          setRoughnessOptions(response.data.roughness_options)
          
          // Seleccionar la primera opción por defecto si no hay selección
          if (!tubingSelected && response.data.catalog.length > 0) {
            const firstTubing = response.data.catalog[0]
            setTubingSelected(firstTubing.nombre)
            setTubingIdMm(firstTubing.id_mm)
          }
        }
      })
      .catch(error => {
        console.error('Error al cargar catálogo de tuberías:', error)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  // Actualizar ID cuando cambia la selección de tubería
  const handleTubingChange = (tubingName: string) => {
    setTubingSelected(tubingName)
    const selected = tubingCatalog.find(t => t.nombre === tubingName)
    if (selected) {
      setTubingIdMm(selected.id_mm)
    }
  }

  return (
    <div style={{ width: '100%' }}>
      <div style={{ marginBottom: '20px', padding: '15px', background: 'rgba(230, 126, 34, 0.1)', borderRadius: '8px', border: '2px solid #e67e22' }}>
        <h3 style={{ margin: '0 0 15px 0', color: '#e67e22', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '1.5rem' }}>🔧</span>
          Installation Design Parameters
        </h3>
        
        {loading ? (
          <div style={{ textAlign: 'center', padding: '20px', color: '#c7d4f0' }}>
            Cargando catálogo de tuberías...
          </div>
        ) : (
          <>
            {/* Fila 1: Profundidad de la bomba */}
            <div style={{ marginBottom: '15px', padding: '12px', background: 'rgba(52, 152, 219, 0.1)', borderRadius: '6px', border: '1px solid rgba(52, 152, 219, 0.3)' }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#3498db', fontSize: '0.95rem' }}>📏 Profundidad</h4>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <span style={{ fontWeight: 600, color: '#d6def7' }}>Profundidad Intake (m):</span>
                <input
                  type="number"
                  value={profundidadIntake}
                  onChange={(e) => setProfundidadIntake(Number(e.target.value))}
                  min="100"
                  max="5000"
                  step="10"
                  style={getFieldStyle('#3498db', { maxWidth: '280px' })}
                  title="Profundidad de instalación del intake de la bomba desde superficie"
                />
              </label>
            </div>

            {/* Fila 2: Tubería de Producción */}
            <div style={{ marginBottom: '15px', padding: '12px', background: 'rgba(155, 89, 182, 0.1)', borderRadius: '6px', border: '1px solid rgba(155, 89, 182, 0.3)' }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#9b59b6', fontSize: '0.95rem' }}>🔩 Tubería de Producción (Tubing)</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <span style={{ fontWeight: 600, color: '#d6def7' }}>Tamaño de Tubería:</span>
                  <select
                    value={tubingSelected}
                    onChange={(e) => handleTubingChange(e.target.value)}
                    style={getFieldStyle('#9b59b6', { borderWidth: '2px', fontSize: '0.95rem' })}
                  >
                    {tubingCatalog.map((tubing) => (
                      <option key={tubing.nombre} value={tubing.nombre}>
                        {tubing.descripcion}
                      </option>
                    ))}
                  </select>
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <span style={{ fontWeight: 600, color: '#d6def7' }}>ID Tubería (mm):</span>
                  <input
                    type="number"
                    value={tubingIdMm}
                    readOnly
                    style={getFieldStyle('#b0bcdc', { background: '#101a2c', color: '#dce8ff' })}
                    title="Diámetro interno de la tubería (calculado automáticamente)"
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <span style={{ fontWeight: 600, color: '#d6def7' }}>Condición Tubería:</span>
                  <select
                    value={tubingRoughness}
                    onChange={(e) => setTubingRoughness(e.target.value)}
                    style={getFieldStyle('#9b59b6', { borderWidth: '2px', fontSize: '0.95rem' })}
                  >
                    {Object.entries(roughnessOptions).map(([key, value]) => (
                      <option key={key} value={key}>
                        {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} ({value} mm)
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            {/* Fila 3: Presiones */}
            <div style={{ marginBottom: '15px', padding: '12px', background: 'rgba(46, 204, 113, 0.1)', borderRadius: '6px', border: '1px solid rgba(46, 204, 113, 0.3)' }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#2ecc71', fontSize: '0.95rem' }}>💨 Presiones del Sistema</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <span style={{ fontWeight: 600, color: '#d6def7' }}>Presión Superficie (bar):</span>
                  <input
                    type="number"
                    value={presionSuperficie}
                    onChange={(e) => setPresionSuperficie(Number(e.target.value))}
                    min="0"
                    max="100"
                    step="1"
                    style={getFieldStyle('#2ecc71')}
                    title="Presión deseada en el cabezal del pozo"
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <span style={{ fontWeight: 600, color: '#d6def7' }}>Presión Casing (bar):</span>
                  <input
                    type="number"
                    value={presionCasing}
                    onChange={(e) => setPresionCasing(Number(e.target.value))}
                    min="0"
                    max="100"
                    step="1"
                    style={getFieldStyle('#2ecc71')}
                    title="Presión en el anular (casing) - ayuda a empujar el fluido hacia la bomba"
                  />
                </label>
              </div>
            </div>

            {/* Información adicional */}
            <div style={{ 
              padding: '10px', 
              background: 'rgba(241, 196, 15, 0.1)', 
              borderRadius: '6px', 
              border: '1px solid rgba(241, 196, 15, 0.5)',
              fontSize: '0.85rem',
              color: '#c0cee8'
            }}>
              <strong style={{ color: '#f39c12' }}>ℹ️ Nota:</strong> La presión de casing ayuda a empujar el fluido hacia el intake de la bomba, 
              reduciendo el TDH requerido. Una mayor presión de casing significa menos carga para la bomba.
            </div>
          </>
        )}
      </div>
    </div>
  )
}
