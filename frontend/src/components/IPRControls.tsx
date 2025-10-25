import React from 'react'

interface IPRControlsProps {
  method: string
  setMethod: (value: string) => void
  presionReservorio: number
  setPresionReservorio: (value: number) => void
  pi: number
  setPi: (value: number) => void
  presionBurbuja: number
  setPresionBurbuja: (value: number) => void
  qTest: number
  setQTest: (value: number) => void
  pwfTest: number
  setPwfTest: (value: number) => void
  nExponent: number
  setNExponent: (value: number) => void
  permeabilidad: number
  setPermeabilidad: (value: number) => void
  espesor: number
  setEspesor: (value: number) => void
  radioDrenaje: number
  setRadioDrenaje: (value: number) => void
  radioPozo: number
  setRadioPozo: (value: number) => void
  viscosidad: number
  setViscosidad: (value: number) => void
  factorVolumen: number
  setFactorVolumen: (value: number) => void
  skin: number
  setSkin: (value: number) => void
  gradoApi: number
  setGradoApi: (value: number) => void
  aguaPorcentaje: number
  setAguaPorcentaje: (value: number) => void
  gravedadEspecificaAgua: number
  setGravedadEspecificaAgua: (value: number) => void
}

export default function IPRControls(props: IPRControlsProps) {
  const {
    method, setMethod,
    presionReservorio, setPresionReservorio,
    pi, setPi,
    presionBurbuja, setPresionBurbuja,
    qTest, setQTest,
    pwfTest, setPwfTest,
    nExponent, setNExponent,
    permeabilidad, setPermeabilidad,
    espesor, setEspesor,
    radioDrenaje, setRadioDrenaje,
    radioPozo, setRadioPozo,
    viscosidad, setViscosidad,
    factorVolumen, setFactorVolumen,
    skin, setSkin,
    gradoApi, setGradoApi,
    aguaPorcentaje, setAguaPorcentaje,
    gravedadEspecificaAgua, setGravedadEspecificaAgua
  } = props

  // Calcular PI automáticamente para método Linear cuando se ingresan Q y Pwf
  const handleQTestChange = (newQTest: number) => {
    setQTest(newQTest)
    if (method === 'linear' && newQTest > 0 && pwfTest > 0 && presionReservorio > pwfTest) {
      const calculatedPI = newQTest / (presionReservorio - pwfTest)
      setPi(Number(calculatedPI.toFixed(4)))
    }
  }

  const handlePwfTestChange = (newPwfTest: number) => {
    setPwfTest(newPwfTest)
    if (method === 'linear' && qTest > 0 && newPwfTest > 0 && presionReservorio > newPwfTest) {
      const calculatedPI = qTest / (presionReservorio - newPwfTest)
      setPi(Number(calculatedPI.toFixed(4)))
    }
  }

  const handlePresionReservorioChange = (newPr: number) => {
    setPresionReservorio(newPr)
    if (method === 'linear' && qTest > 0 && pwfTest > 0 && newPr > pwfTest) {
      const calculatedPI = qTest / (newPr - pwfTest)
      setPi(Number(calculatedPI.toFixed(4)))
    }
  }

  return (
    <div style={{ width: '100%' }}>
      <div style={{ marginBottom: '20px', padding: '15px', background: 'rgba(52, 152, 219, 0.1)', borderRadius: '8px' }}>
        <h3 style={{ margin: '0 0 15px 0', color: '#3498db' }}>IPR Configuration</h3>
        
        {/* Método de IPR */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '15px' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <span style={{ fontWeight: 600, color: '#34495e' }}>IPR Method:</span>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: '6px', border: '2px solid #3498db', background: 'white', fontSize: '0.95rem' }}
            >
              <option value="linear">Linear (Darcy - Monofásico)</option>
              <option value="vogel">Vogel (Bifásico - Gas en solución)</option>
              <option value="fetkovich">Fetkovich (Empírico - Baja permeabilidad)</option>
              <option value="darcy">Darcy Completo (Radial estacionario)</option>
            </select>
          </label>
        </div>

        {/* Propiedades del Fluido */}
        <div style={{ marginBottom: '15px', padding: '12px', background: 'rgba(22, 160, 133, 0.1)', borderRadius: '6px', border: '1px solid rgba(22, 160, 133, 0.3)' }}>
          <h4 style={{ margin: '0 0 10px 0', color: '#16a085', fontSize: '0.95rem' }}>🛢️ Propiedades del Fluido</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '15px' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <span style={{ fontWeight: 600, color: '#34495e' }}>°API:</span>
              <input
                type="number"
                value={gradoApi}
                onChange={(e) => setGradoApi(Number(e.target.value))}
                min="5"
                max="60"
                step="0.5"
                style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #16a085', background: 'white' }}
                title="Grado API del petróleo (típico: 15-40)"
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <span style={{ fontWeight: 600, color: '#34495e' }}>% Agua:</span>
              <input
                type="number"
                value={aguaPorcentaje}
                onChange={(e) => setAguaPorcentaje(Number(e.target.value))}
                min="0"
                max="100"
                step="1"
                style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #16a085', background: 'white' }}
                title="Porcentaje de agua en el fluido producido"
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <span style={{ fontWeight: 600, color: '#34495e' }}>SG Agua:</span>
              <input
                type="number"
                value={gravedadEspecificaAgua}
                onChange={(e) => setGravedadEspecificaAgua(Number(e.target.value))}
                min="1.000"
                max="1.200"
                step="0.001"
                style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #16a085', background: 'white' }}
                title="Gravedad específica del agua (típico: 1.000-1.100)"
              />
            </label>
          </div>
        </div>

        {/* Parámetros Comunes */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '15px' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <span style={{ fontWeight: 600, color: '#34495e' }}>Pr (bar):</span>
            <input
              type="number"
              value={presionReservorio}
              onChange={(e) => handlePresionReservorioChange(Number(e.target.value))}
              min="0"
              step="10"
              style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #3498db', background: 'white' }}
            />
          </label>

          {/* Linear: Q y Pwf para calcular PI automáticamente */}
          {method === 'linear' && (
            <>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <span style={{ fontWeight: 600, color: '#34495e' }}>Q Test (m³/d):</span>
                <input
                  type="number"
                  value={qTest}
                  onChange={(e) => handleQTestChange(Number(e.target.value))}
                  min="0"
                  step="10"
                  style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #3498db', background: 'white' }}
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <span style={{ fontWeight: 600, color: '#34495e' }}>Pwf Test (bar):</span>
                <input
                  type="number"
                  value={pwfTest}
                  onChange={(e) => handlePwfTestChange(Number(e.target.value))}
                  min="0"
                  step="10"
                  style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #3498db', background: 'white' }}
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <span style={{ fontWeight: 600, color: '#34495e' }}>PI (calculado):</span>
                <input
                  type="number"
                  value={pi}
                  readOnly
                  style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #95a5a6', background: '#ecf0f1', color: '#7f8c8d' }}
                  title="PI calculado automáticamente = Q / (Pr - Pwf)"
                />
              </label>
            </>
          )}

          {/* Fetkovich: PI manual */}
          {method === 'fetkovich' && (
            <label style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <span style={{ fontWeight: 600, color: '#34495e' }}>PI (m³/d/bar):</span>
              <input
                type="number"
                value={pi}
                onChange={(e) => setPi(Number(e.target.value))}
                min="0"
                step="0.1"
                style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #3498db', background: 'white' }}
              />
            </label>
          )}

          {/* Vogel: Presión de burbuja */}
          {method === 'vogel' && (
            <label style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <span style={{ fontWeight: 600, color: '#34495e' }}>Pb (bar):</span>
              <input
                type="number"
                value={presionBurbuja}
                onChange={(e) => setPresionBurbuja(Number(e.target.value))}
                min="0"
                step="10"
                style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #3498db', background: 'white' }}
              />
            </label>
          )}

          {/* Vogel/Fetkovich: Datos de prueba */}
          {(method === 'vogel' || method === 'fetkovich') && (
            <>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <span style={{ fontWeight: 600, color: '#34495e' }}>Q Test (m³/d):</span>
                <input
                  type="number"
                  value={qTest}
                  onChange={(e) => setQTest(Number(e.target.value))}
                  min="0"
                  step="10"
                  style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #3498db', background: 'white' }}
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <span style={{ fontWeight: 600, color: '#34495e' }}>Pwf Test (bar):</span>
                <input
                  type="number"
                  value={pwfTest}
                  onChange={(e) => setPwfTest(Number(e.target.value))}
                  min="0"
                  step="10"
                  style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #3498db', background: 'white' }}
                />
              </label>
            </>
          )}

          {/* Fetkovich: Exponente */}
          {method === 'fetkovich' && (
            <label style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <span style={{ fontWeight: 600, color: '#34495e' }}>n (exponente):</span>
              <input
                type="number"
                value={nExponent}
                onChange={(e) => setNExponent(Number(e.target.value))}
                min="0.1"
                max="1.5"
                step="0.1"
                style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #3498db', background: 'white' }}
              />
            </label>
          )}
        </div>

        {/* Darcy: Parámetros adicionales */}
        {method === 'darcy' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '15px', marginTop: '15px' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <span style={{ fontWeight: 600, color: '#34495e' }}>k (mD):</span>
              <input
                type="number"
                value={permeabilidad}
                onChange={(e) => setPermeabilidad(Number(e.target.value))}
                min="0.1"
                step="1"
                style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #3498db', background: 'white' }}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <span style={{ fontWeight: 600, color: '#34495e' }}>h (m):</span>
              <input
                type="number"
                value={espesor}
                onChange={(e) => setEspesor(Number(e.target.value))}
                min="1"
                step="1"
                style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #3498db', background: 'white' }}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <span style={{ fontWeight: 600, color: '#34495e' }}>re (m):</span>
              <input
                type="number"
                value={radioDrenaje}
                onChange={(e) => setRadioDrenaje(Number(e.target.value))}
                min="10"
                step="10"
                style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #3498db', background: 'white' }}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <span style={{ fontWeight: 600, color: '#34495e' }}>rw (m):</span>
              <input
                type="number"
                value={radioPozo}
                onChange={(e) => setRadioPozo(Number(e.target.value))}
                min="0.1"
                step="0.1"
                style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #3498db', background: 'white' }}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <span style={{ fontWeight: 600, color: '#34495e' }}>μ (cp):</span>
              <input
                type="number"
                value={viscosidad}
                onChange={(e) => setViscosidad(Number(e.target.value))}
                min="0.1"
                step="0.1"
                style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #3498db', background: 'white' }}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <span style={{ fontWeight: 600, color: '#34495e' }}>Bo (m³/m³):</span>
              <input
                type="number"
                value={factorVolumen}
                onChange={(e) => setFactorVolumen(Number(e.target.value))}
                min="1"
                step="0.01"
                style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #3498db', background: 'white' }}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <span style={{ fontWeight: 600, color: '#34495e' }}>Skin:</span>
              <input
                type="number"
                value={skin}
                onChange={(e) => setSkin(Number(e.target.value))}
                step="0.1"
                style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #3498db', background: 'white' }}
              />
            </label>
          </div>
        )}
      </div>
    </div>
  )
}
