import React, { useEffect, useState } from 'react'
import axios from 'axios'
import PumpSelector from './components/PumpSelector'
import CurveControls from './components/CurveControls'
import CurvePlot from './components/CurvePlot'
import IPRControls from './components/IPRControls'
import InstallationControls from './components/InstallationControls'

export default function App() {
  const [pumps, setPumps] = useState<string[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [freq, setFreq] = useState(50)
  const [stages, setStages] = useState(300)
  const [points, setPoints] = useState(300)
  const [curves, setCurves] = useState<any | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Estados para modo multifrecuencia
  const [isMultiFreq, setIsMultiFreq] = useState(false)
  const [minFreq, setMinFreq] = useState(40)
  const [maxFreq, setMaxFreq] = useState(60)
  const [numCurves, setNumCurves] = useState(5)
  const [multiFreqCurves, setMultiFreqCurves] = useState<any[]>([])
  
  // Estados para modo diseño combinado (suma de bombas)
  const [numPumpsDesign, setNumPumpsDesign] = useState(1)
  const [designPumps, setDesignPumps] = useState<Array<{id: string | null, stages: number}>>([
    { id: null, stages: 300 },
    { id: null, stages: 300 },
    { id: null, stages: 300 },
    { id: null, stages: 300 },
    { id: null, stages: 300 }
  ])
  const [combinedCurves, setCombinedCurves] = useState<any>(null)
  const [individualCurves, setIndividualCurves] = useState<any[]>([])
  
  // Estado para controlar pestaña activa en modo diseño
  const [activeTab, setActiveTab] = useState<'combined' | 'efficiency' | 'head' | 'bhp' | 'ipr'>('combined')
  
  // Estados para modo comparador
  const [isComparisonMode, setIsComparisonMode] = useState(false)
  const [numPumpsToCompare, setNumPumpsToCompare] = useState(2)
  const [curveTypeToCompare, setCurveTypeToCompare] = useState<'head' | 'bhp' | 'efficiency'>('head')
  
  // Estados para cada bomba en el comparador (hasta 3 bombas)
  const [pump1, setPump1] = useState<string | null>(null)
  const [pump1Freq, setPump1Freq] = useState(50)
  const [pump1Stages, setPump1Stages] = useState(300)
  const [pump1MultiFreq, setPump1MultiFreq] = useState(false)
  const [pump1Curves, setPump1Curves] = useState<any>(null)
  
  const [pump2, setPump2] = useState<string | null>(null)
  const [pump2Freq, setPump2Freq] = useState(50)
  const [pump2Stages, setPump2Stages] = useState(300)
  const [pump2MultiFreq, setPump2MultiFreq] = useState(false)
  const [pump2Curves, setPump2Curves] = useState<any>(null)
  
  const [pump3, setPump3] = useState<string | null>(null)
  const [pump3Freq, setPump3Freq] = useState(50)
  const [pump3Stages, setPump3Stages] = useState(300)
  const [pump3MultiFreq, setPump3MultiFreq] = useState(false)
  const [pump3Curves, setPump3Curves] = useState<any>(null)

  // Estados para IPR (Inflow Performance Relationship) - UNIDADES MÉTRICAS
  const [showIPR, setShowIPR] = useState(false)
  const [iprMethod, setIprMethod] = useState('vogel')
  const [presionReservorio, setPresionReservorio] = useState(150)  // bar
  const [pi, setPi] = useState(5.0)  // m³/d/bar
  const [presionBurbuja, setPresionBurbuja] = useState(30)  // bar
  const [qTest, setQTest] = useState(100)  // m³/d
  const [pwfTest, setPwfTest] = useState(20)  // bar
  const [nExponent, setNExponent] = useState(1.0)
  const [permeabilidad, setPermeabilidad] = useState(100)  // mD
  const [espesor, setEspesor] = useState(15)  // m
  const [radioDrenaje, setRadioDrenaje] = useState(300)  // m
  const [radioPozo, setRadioPozo] = useState(0.15)  // m
  const [viscosidad, setViscosidad] = useState(1.0)  // cp
  const [factorVolumen, setFactorVolumen] = useState(1.2)  // m³/m³
  const [skin, setSkin] = useState(0)
  const [gradoApi, setGradoApi] = useState(21)  // °API
  const [aguaPorcentaje, setAguaPorcentaje] = useState(95)  // %
  const [gravedadEspecificaAgua, setGravedadEspecificaAgua] = useState(1.033)  // Specific gravity
  const [iprData, setIprData] = useState<any>(null)
  
  // Estado para curva de demanda de presión
  const [pressureDemandCurve, setPressureDemandCurve] = useState<any>(null)

  // Estados para Installation Design (FASE 1)
  const [profundidadIntake, setProfundidadIntake] = useState(1500)  // m
  const [nivelFluidoDinamico, setNivelFluidoDinamico] = useState(500)  // m
  const [tubingSelected, setTubingSelected] = useState('Tbg 2-7/8"')
  const [tubingIdMm, setTubingIdMm] = useState(62.0)  // mm
  const [tubingRoughness, setTubingRoughness] = useState('acero_nuevo')
  const [presionSuperficie, setPresionSuperficie] = useState(10)  // bar
  const [presionCasing, setPresionCasing] = useState(5)  // bar

  useEffect(() => {
    axios.get('/api/pumps').then(r => {
      const list = r.data || []
      // Expect list of pump records; map to ids
      setPumps(list.map((p: any) => p[equipmentIdKey(list)]) )
    }).catch(e => console.error(e))
  }, [])

  function equipmentIdKey(list: any[]) {
    // try to guess the ID key
    if (!list || list.length === 0) return 'Tipo'
    const sample = list[0]
    // prefer common keys
    for (const k of ['Tipo', 'Tipo bomba', 'id', 'Tipo motor', 'Bomba']) {
      if (k in sample) return k
    }
    return Object.keys(sample)[0]
  }

  async function fetchCurves() {
    if (!selected) return
    setLoading(true)
    setError(null)
    try {
      const res = await axios.get(`/api/pumps/${encodeURIComponent(selected)}/curves?freq=${freq}&stages=${stages}&points=${points}`)
      const payload = res.data || {}
      if (payload.success === false) {
        setError(payload.error || 'Error from server')
        setCurves(null)
      } else if (payload.curves) {
        setCurves(payload.curves)
      } else {
        setCurves(payload)
      }
    } catch (e: any) {
      setError(e?.response?.data?.error || e.message)
    } finally {
      setLoading(false)
    }
  }

  async function fetchMultiFreqCurves() {
    if (!selected) return
    setLoading(true)
    setError(null)
    try {
      const frequencies = []
      const step = (maxFreq - minFreq) / (numCurves - 1)
      for (let i = 0; i < numCurves; i++) {
        frequencies.push(minFreq + step * i)
      }

      const promises = frequencies.map(f => 
        axios.get(`/api/pumps/${encodeURIComponent(selected)}/curves?freq=${f}&stages=${stages}&points=${points}`)
      )
      
      const results = await Promise.all(promises)
      const curvesData = results.map((res, idx) => {
        const payload = res.data || {}
        return {
          freq: frequencies[idx],
          curves: payload.curves || payload
        }
      })
      
      setMultiFreqCurves(curvesData)
    } catch (e: any) {
      setError(e?.response?.data?.error || e.message)
    } finally {
      setLoading(false)
    }
  }

  // Función para obtener y combinar curvas de múltiples bombas (diseño)
  async function fetchCombinedCurves() {
    setLoading(true)
    setError(null)
    setCombinedCurves(null)
    setIndividualCurves([])
    
    try {
      // Filtrar solo las bombas seleccionadas
      const selectedPumps = designPumps.slice(0, numPumpsDesign).filter(p => p.id !== null)
      
      if (selectedPumps.length === 0) {
        setLoading(false)
        return
      }
      
      // Obtener curvas de cada bomba
      const promises = selectedPumps.map(pump =>
        axios.get(`/api/pumps/${encodeURIComponent(pump.id!)}/curves?freq=${freq}&stages=${pump.stages}&points=${points}`)
      )
      
      const results = await Promise.all(promises)
      const allCurves = results.map(res => res.data?.curves || res.data)
      
      // Guardar curvas individuales con nombres de bombas
      const individualData = allCurves.map((curve, idx) => ({
        name: selectedPumps[idx].id,
        curves: curve
      }))
      setIndividualCurves(individualData)
      
      // Sumar las curvas
      if (allCurves.length === 1) {
        setCombinedCurves(allCurves[0])
      } else {
        // Encontrar el caudal máximo común
        const maxQs = allCurves.map(c => Math.max(...c.head.map((p: any) => p.caudal)))
        const minMaxQ = Math.min(...maxQs)
        
        // Crear curvas combinadas punto por punto
        const combinedHead: any[] = []
        const combinedBhp: any[] = []
        const combinedEfficiency: any[] = []
        
        // Usar los puntos de caudal de la primera bomba como referencia
        const referenceCaudals = allCurves[0].head.map((p: any) => p.caudal).filter((q: number) => q <= minMaxQ)
        
        referenceCaudals.forEach((q: number) => {
          let sumHead = 0
          let sumBhp = 0
          
          // Sumar valores de todas las bombas para este caudal
          allCurves.forEach(curve => {
            // Encontrar el valor más cercano a este caudal
            const headPoint = curve.head.find((p: any) => Math.abs(p.caudal - q) < 0.1) || 
                             curve.head.reduce((prev: any, curr: any) => 
                               Math.abs(curr.caudal - q) < Math.abs(prev.caudal - q) ? curr : prev
                             )
            const bhpPoint = curve.bhp.find((p: any) => Math.abs(p.caudal - q) < 0.1) || 
                            curve.bhp.reduce((prev: any, curr: any) => 
                              Math.abs(curr.caudal - q) < Math.abs(prev.caudal - q) ? curr : prev
                            )
            
            sumHead += headPoint.valor
            sumBhp += bhpPoint.valor
          })
          
          // Calcular eficiencia combinada: η = (Q * H) / (6570 * BHP)
          const efficiency = sumBhp > 0 ? (q * sumHead) / (6570 * sumBhp) : 0
          
          combinedHead.push({ caudal: q, valor: sumHead })
          combinedBhp.push({ caudal: q, valor: sumBhp })
          combinedEfficiency.push({ caudal: q, valor: efficiency })
        })
        
        // Calcular rango operativo combinado
        const minQs = allCurves.map(c => c.operating_range?.min_q || 0)
        const maxQs2 = allCurves.map(c => c.operating_range?.max_q || 0)
        
        setCombinedCurves({
          head: combinedHead,
          bhp: combinedBhp,
          efficiency: combinedEfficiency,
          operating_range: {
            min_q: Math.max(...minQs), // El mínimo es el mayor de los mínimos
            max_q: Math.min(...maxQs2)  // El máximo es el menor de los máximos
          }
        })
      }
    } catch (e: any) {
      setError(e?.response?.data?.error || e.message)
    } finally {
      setLoading(false)
    }
  }

  // Función para obtener curvas de una bomba específica en modo comparador
  async function fetchPumpCurves(
    pumpId: string,
    frequency: number,
    stagesCount: number,
    isMultiFreq: boolean,
    setPumpCurves: (curves: any) => void
  ) {
    try {
      if (isMultiFreq) {
        // Modo multi-frecuencia para esta bomba
        const frequencies = []
        const step = (maxFreq - minFreq) / (numCurves - 1)
        
        for (let i = 0; i < numCurves; i++) {
          frequencies.push(minFreq + step * i)
        }
        
        const promises = frequencies.map(f =>
          axios.get(`/api/pumps/${encodeURIComponent(pumpId)}/curves?freq=${f}&stages=${stagesCount}&points=${points}`)
        )
        
        const results = await Promise.all(promises)
        const curvesData = results.map((res, idx) => {
          const payload = res.data || {}
          return {
            freq: frequencies[idx],
            curves: payload.curves || payload
          }
        })
        setPumpCurves(curvesData)
      } else {
        // Modo frecuencia única para esta bomba
        const res = await axios.get(`/api/pumps/${encodeURIComponent(pumpId)}/curves?freq=${frequency}&stages=${stagesCount}&points=${points}`)
        const payload = res.data || {}
        setPumpCurves(payload.curves || payload)
      }
    } catch (err: any) {
      console.error(`Error loading curves for pump ${pumpId}:`, err)
    }
  }
  
  // Función para calcular IPR
  async function fetchIPR() {
    console.log('🚀 fetchIPR() llamado - numPumpsDesign:', numPumpsDesign)
    setLoading(true)
    setError(null)
    try {
      const wellData = {
        method: iprMethod,
        presion_reservorio: presionReservorio,
        pi: pi,
        presion_burbuja: presionBurbuja,
        q_test: qTest,
        pwf_test: pwfTest,
        n_exponent: nExponent,
        permeabilidad: permeabilidad,
        espesor: espesor,
        radio_drenaje: radioDrenaje,
        radio_pozo: radioPozo,
        viscosidad: viscosidad,
        factor_volumen: factorVolumen,
        skin: skin,
        grado_api: gradoApi,
        agua_porcentaje: aguaPorcentaje,
        gravedad_especifica_agua: gravedadEspecificaAgua,
        n_points: points,
        // Parámetros de instalación (FASE 1)
        profundidad_intake: profundidadIntake,
        nivel_fluido_dinamico: nivelFluidoDinamico,
        presion_superficie: presionSuperficie,
        presion_casing: presionCasing,
        tubing_id_mm: tubingIdMm,
        tubing_roughness: tubingRoughness,
        q_max_estimate: 500
      }
      
      const res = await axios.post('/api/calculate_conditions', wellData)
      const payload = res.data || {}
      
      // DEBUG: Verificar respuesta del backend
      console.log('===== RESPUESTA API calculate_conditions =====')
      console.log('payload.success:', payload.success)
      console.log('payload.ipr_data:', payload.ipr_data ? 'PRESENTE' : 'NO')
      console.log('payload.pressure_demand_curve:', payload.pressure_demand_curve ? 'PRESENTE' : 'NO')
      if (payload.pressure_demand_curve) {
        console.log('pressure_demand_curve.curve tiene', payload.pressure_demand_curve.curve?.length || 0, 'puntos')
        console.log('Primeros 3 puntos:', payload.pressure_demand_curve.curve?.slice(0, 3))
      }
      console.log('==============================================')
      
      if (payload.success && payload.ipr_data) {
        setIprData(payload.ipr_data)
        
        // Guardar curva de demanda de presión si está disponible
        if (payload.pressure_demand_curve) {
          setPressureDemandCurve(payload.pressure_demand_curve)
          console.log('✅ pressureDemandCurve guardado en el estado')
        } else {
          console.log('⚠️ NO se recibió pressure_demand_curve del backend')
        }
      } else {
        setError('Error calculating IPR')
      }
    } catch (e: any) {
      setError(e?.response?.data?.error || e.message)
    } finally {
      setLoading(false)
    }
  }
  
  // useEffect para actualizar IPR cuando cambien los parámetros
  useEffect(() => {
    if (showIPR) {
      fetchIPR()
    }
  }, [
    showIPR,
    iprMethod,
    presionReservorio,
    pi,
    presionBurbuja,
    qTest,
    pwfTest,
    nExponent,
    permeabilidad,
    espesor,
    radioDrenaje,
    radioPozo,
    viscosidad,
    factorVolumen,
    skin,
    gradoApi,
    aguaPorcentaje,
    gravedadEspecificaAgua,
    points,
    // Parámetros de instalación para System Demand Curve
    profundidadIntake,
    nivelFluidoDinamico,
    presionSuperficie,
    presionCasing,
    tubingIdMm,
    tubingRoughness,
    // IMPORTANTE: Recalcular cuando cambia el número de bombas
    numPumpsDesign
  ])
  
  // useEffect para actualizar curvas en modo comparador
  useEffect(() => {
    if (!isComparisonMode) return
    
    setLoading(true)
    const promises = []
    
    if (pump1) {
      promises.push(fetchPumpCurves(pump1, pump1Freq, pump1Stages, pump1MultiFreq, setPump1Curves))
    }
    if (pump2) {
      promises.push(fetchPumpCurves(pump2, pump2Freq, pump2Stages, pump2MultiFreq, setPump2Curves))
    }
    if (numPumpsToCompare >= 3 && pump3) {
      promises.push(fetchPumpCurves(pump3, pump3Freq, pump3Stages, pump3MultiFreq, setPump3Curves))
    }
    
    Promise.all(promises).finally(() => setLoading(false))
  }, [
    isComparisonMode,
    pump1, pump1Freq, pump1Stages, pump1MultiFreq,
    pump2, pump2Freq, pump2Stages, pump2MultiFreq,
    pump3, pump3Freq, pump3Stages, pump3MultiFreq,
    numPumpsToCompare,
    points, minFreq, maxFreq, numCurves
  ])

  // Auto-fetch curves when pump, frequency, stages, or points change
  useEffect(() => {
    if (selected) {
      if (isMultiFreq) {
        fetchMultiFreqCurves()
      } else {
        fetchCurves()
      }
    }
  }, [selected, freq, stages, points, isMultiFreq, minFreq, maxFreq, numCurves])

  // Auto-fetch combined curves in design mode
  useEffect(() => {
    if (!isComparisonMode && numPumpsDesign > 1) {
      fetchCombinedCurves()
    }
  }, [numPumpsDesign, designPumps, freq, points, isComparisonMode])

  return (
    <div className="app">
      <h1>🔧 BES Pump Performance Curves</h1>
      {/* Checkboxes para Comparison Mode y IPR */}
      <div style={{ width: '100%', display: 'flex', justifyContent: 'center', gap: '20px', marginBottom: '18px', flexWrap: 'wrap' }}>
        <label className="checkbox-label" style={{
          background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          fontWeight: 600,
          fontSize: '1.15rem',
          padding: '12px 32px',
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(52, 73, 94, 0.08)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          cursor: 'pointer',
          border: isComparisonMode ? '2px solid #e67e22' : '2px solid #764ba2',
          transition: 'border 0.2s',
        }}>
          <input 
            type="checkbox" 
            checked={isComparisonMode} 
            onChange={(e) => setIsComparisonMode(e.target.checked)} 
            style={{ width: 22, height: 22, accentColor: isComparisonMode ? '#e67e22' : '#764ba2', marginRight: 8 }}
          />
          <span>Comparison Mode</span>
        </label>
        
        <label className="checkbox-label" style={{
          background: showIPR ? 'linear-gradient(90deg, #27ae60 0%, #2ecc71 100%)' : 'linear-gradient(90deg, #95a5a6 0%, #7f8c8d 100%)',
          color: 'white',
          fontWeight: 600,
          fontSize: '1.15rem',
          padding: '12px 32px',
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(52, 73, 94, 0.08)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          cursor: 'pointer',
          border: showIPR ? '2px solid #27ae60' : '2px solid #7f8c8d',
          transition: 'all 0.3s',
        }}>
          <input 
            type="checkbox" 
            checked={showIPR} 
            onChange={(e) => setShowIPR(e.target.checked)} 
            style={{ width: 22, height: 22, accentColor: showIPR ? '#27ae60' : '#7f8c8d', marginRight: 8 }}
          />
          <span>📈 Show IPR</span>
        </label>
      </div>
      <div className="controls">
        {!isComparisonMode ? (
          <>
            {numPumpsDesign === 1 ? (
              <>
                <PumpSelector pumps={pumps} value={selected} onChange={setSelected} />
                <CurveControls 
                  freq={freq} setFreq={setFreq} 
                  stages={stages} setStages={setStages} 
                  points={points} setPoints={setPoints} 
                  onPlot={() => {}}
                  isMultiFreq={isMultiFreq} setIsMultiFreq={setIsMultiFreq}
                  minFreq={minFreq} setMinFreq={setMinFreq}
                  maxFreq={maxFreq} setMaxFreq={setMaxFreq}
                  numCurves={numCurves} setNumCurves={setNumCurves}
                />
              </>
            ) : (
              <div style={{ width: '100%' }}>
                {/* Controles globales */}
                <div style={{ marginBottom: '20px', padding: '15px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      <span>Frequency (Hz):</span>
                      <input 
                        type="number" 
                        value={freq} 
                        onChange={(e) => setFreq(Number(e.target.value))} 
                        min="30" max="70" step="0.1"
                        style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #3498db', background: '#34495e', color: 'white' }}
                      />
                    </label>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      <span>Points per Curve:</span>
                      <input 
                        type="number" 
                        value={points} 
                        onChange={(e) => setPoints(Number(e.target.value))} 
                        min="50" max="500" step="10"
                        style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #3498db', background: '#34495e', color: 'white' }}
                      />
                    </label>
                  </div>
                </div>
                
                {/* Controles de cada bomba en columnas */}
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(numPumpsDesign, 3)}, 1fr)`, gap: '20px' }}>
                  {[...Array(numPumpsDesign)].map((_, idx) => (
                    <div key={idx} style={{ padding: '15px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                      <h3 style={{ margin: '0 0 15px 0', color: '#3498db', textAlign: 'center' }}>Pump {idx + 1}</h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        <label style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                          <span>Select Pump:</span>
                          <select 
                            value={designPumps[idx]?.id || ''} 
                            onChange={(e) => {
                              const newPumps = [...designPumps]
                              newPumps[idx] = { ...newPumps[idx], id: e.target.value || null }
                              setDesignPumps(newPumps)
                            }}
                            style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #3498db', background: '#34495e', color: 'white' }}
                          >
                            <option value="">-- Select --</option>
                            {pumps.map(p => <option key={p} value={p}>{p}</option>)}
                          </select>
                        </label>
                        <label style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                          <span>Stages:</span>
                          <input 
                            type="number" 
                            value={designPumps[idx]?.stages || 300} 
                            onChange={(e) => {
                              const newPumps = [...designPumps]
                              newPumps[idx] = { ...newPumps[idx], stages: Number(e.target.value) }
                              setDesignPumps(newPumps)
                            }}
                            min="1" max="500" step="1"
                            style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #3498db', background: '#34495e', color: 'white' }}
                          />
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Selector de número de bombas para diseño */}
            <div style={{ width: '100%', marginTop: '15px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontWeight: 600 }}>Number of Pumps in System:</span>
                <select 
                  value={numPumpsDesign} 
                  onChange={(e) => setNumPumpsDesign(Number(e.target.value))}
                  style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #3498db', background: '#34495e', color: 'white' }}
                >
                  <option value={1}>1 Pump</option>
                  <option value={2}>2 Pumps (Series)</option>
                  <option value={3}>3 Pumps (Series)</option>
                  <option value={4}>4 Pumps (Series)</option>
                  <option value={5}>5 Pumps (Series)</option>
                </select>
              </label>
            </div>
          </>
        ) : (
          <div style={{ width: '100%' }}>
            <div style={{ marginBottom: '20px', padding: '15px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
                <span>Curve Type to Compare:</span>
                <select 
                  value={curveTypeToCompare} 
                  onChange={(e) => setCurveTypeToCompare(e.target.value as 'head' | 'bhp' | 'efficiency')}
                  style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #3498db', background: '#34495e', color: 'white' }}
                >
                  <option value="head">Head (TDH)</option>
                  <option value="bhp">BHP</option>
                  <option value="efficiency">Efficiency</option>
                </select>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span>Number of Pumps:</span>
                <select 
                  value={numPumpsToCompare} 
                  onChange={(e) => setNumPumpsToCompare(Number(e.target.value))}
                  style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #3498db', background: '#34495e', color: 'white' }}
                >
                  <option value={2}>2 Pumps</option>
                  <option value={3}>3 Pumps</option>
                </select>
              </label>
            </div>
            {/* Controles para cada bomba en columnas */}
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${numPumpsToCompare}, 1fr)`, gap: '24px', marginBottom: '18px' }}>
              {[1, 2, 3].slice(0, numPumpsToCompare).map((num) => {
                const pumpState = num === 1 ? { pump: pump1, setPump: setPump1, freq: pump1Freq, setFreq: setPump1Freq, stages: pump1Stages, setStages: setPump1Stages, multiFreq: pump1MultiFreq, setMultiFreq: setPump1MultiFreq } :
                                 num === 2 ? { pump: pump2, setPump: setPump2, freq: pump2Freq, setFreq: setPump2Freq, stages: pump2Stages, setStages: setPump2Stages, multiFreq: pump2MultiFreq, setMultiFreq: setPump2MultiFreq } :
                                 { pump: pump3, setPump: setPump3, freq: pump3Freq, setFreq: setPump3Freq, stages: pump3Stages, setStages: setPump3Stages, multiFreq: pump3MultiFreq, setMultiFreq: setPump3MultiFreq }
                return (
                  <div key={num} style={{ padding: '15px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                    <h3 style={{ margin: '0 0 15px 0', color: '#3498db', textAlign: 'center' }}>Pump {num}</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                      <label style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                        <span>Select Pump:</span>
                        <select 
                          value={pumpState.pump || ''} 
                          onChange={(e) => pumpState.setPump(e.target.value || null)}
                          style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #3498db', background: '#34495e', color: 'white' }}
                        >
                          <option value="">-- Select --</option>
                          {pumps.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </label>
                      <label className="checkbox-label">
                        <input 
                          type="checkbox" 
                          checked={pumpState.multiFreq} 
                          onChange={(e) => pumpState.setMultiFreq(e.target.checked)} 
                        />
                        <span>Multi-Frequency Mode</span>
                      </label>
                      {!pumpState.multiFreq && (
                        <label style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                          <span>Frequency (Hz):</span>
                          <input 
                            type="number" 
                            value={pumpState.freq} 
                            onChange={(e) => pumpState.setFreq(Number(e.target.value))} 
                            min="30" max="70" step="0.1"
                            style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #3498db', background: '#34495e', color: 'white' }}
                          />
                        </label>
                      )}
                      <label style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                        <span>Stages:</span>
                        <input 
                          type="number" 
                          value={pumpState.stages} 
                          onChange={(e) => pumpState.setStages(Number(e.target.value))} 
                          min="1" max="500" step="1"
                          style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #3498db', background: '#34495e', color: 'white' }}
                        />
                      </label>
                    </div>
                  </div>
                )
              })}
            </div>
            {/* Controles globales para modo multi-frecuencia */}
            {(pump1MultiFreq || pump2MultiFreq || (numPumpsToCompare >= 3 && pump3MultiFreq)) && (
              <div style={{ padding: '15px', background: 'rgba(52, 152, 219, 0.1)', borderRadius: '8px', marginBottom: '15px' }}>
                <h4 style={{ margin: '0 0 10px 0', color: '#3498db' }}>Multi-Frequency Settings</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <span>Min Frequency (Hz):</span>
                    <input 
                      type="number" 
                      value={minFreq} 
                      onChange={(e) => setMinFreq(Number(e.target.value))} 
                      min="30" max="60" step="1"
                      style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #3498db', background: '#34495e', color: 'white' }}
                    />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <span>Max Frequency (Hz):</span>
                    <input 
                      type="number" 
                      value={maxFreq} 
                      onChange={(e) => setMaxFreq(Number(e.target.value))} 
                      min="40" max="70" step="1"
                      style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #3498db', background: '#34495e', color: 'white' }}
                    />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <span>Number of Curves:</span>
                    <input 
                      type="number" 
                      value={numCurves} 
                      onChange={(e) => setNumCurves(Number(e.target.value))} 
                      min="2" max="10" step="1"
                      style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #3498db', background: '#34495e', color: 'white' }}
                    />
                  </label>
                </div>
              </div>
            )}
            <label style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginTop: '15px' }}>
              <span>Points per Curve:</span>
              <input 
                type="number" 
                value={points} 
                onChange={(e) => setPoints(Number(e.target.value))} 
                min="50" max="500" step="10"
                style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #3498db', background: '#34495e', color: 'white' }}
              />
            </label>
          </div>
        )}
      </div>
      
      {/* Controles del IPR */}
      {showIPR && !isComparisonMode && (
        <>
          <IPRControls 
            method={iprMethod}
            setMethod={setIprMethod}
            presionReservorio={presionReservorio}
            setPresionReservorio={setPresionReservorio}
            pi={pi}
            setPi={setPi}
            presionBurbuja={presionBurbuja}
            setPresionBurbuja={setPresionBurbuja}
            qTest={qTest}
            setQTest={setQTest}
            pwfTest={pwfTest}
            setPwfTest={setPwfTest}
            nExponent={nExponent}
            setNExponent={setNExponent}
            permeabilidad={permeabilidad}
            setPermeabilidad={setPermeabilidad}
            espesor={espesor}
            setEspesor={setEspesor}
            radioDrenaje={radioDrenaje}
            setRadioDrenaje={setRadioDrenaje}
            radioPozo={radioPozo}
            setRadioPozo={setRadioPozo}
            viscosidad={viscosidad}
            setViscosidad={setViscosidad}
            factorVolumen={factorVolumen}
            setFactorVolumen={setFactorVolumen}
            skin={skin}
            setSkin={setSkin}
            gradoApi={gradoApi}
            setGradoApi={setGradoApi}
            aguaPorcentaje={aguaPorcentaje}
            setAguaPorcentaje={setAguaPorcentaje}
            gravedadEspecificaAgua={gravedadEspecificaAgua}
            setGravedadEspecificaAgua={setGravedadEspecificaAgua}
          />
          
          {/* FASE 1: Controles de Instalación */}
          <InstallationControls
            profundidadIntake={profundidadIntake}
            setProfundidadIntake={setProfundidadIntake}
            tubingSelected={tubingSelected}
            setTubingSelected={setTubingSelected}
            tubingIdMm={tubingIdMm}
            setTubingIdMm={setTubingIdMm}
            tubingRoughness={tubingRoughness}
            setTubingRoughness={setTubingRoughness}
            presionSuperficie={presionSuperficie}
            setPresionSuperficie={setPresionSuperficie}
            presionCasing={presionCasing}
            setPresionCasing={setPresionCasing}
            nivelFluidoDinamico={nivelFluidoDinamico}
            setNivelFluidoDinamico={setNivelFluidoDinamico}
          />
        </>
      )}
      
      {loading && <div className="loading">⏳ Loading pump curves...</div>}
      {error && <div className="error">❌ {error}</div>}
      
      {!isComparisonMode && numPumpsDesign === 1 && !selected && !loading && !error && (
        <div style={{ textAlign: 'center', padding: '32px', color: '#7f8c8d', fontSize: '1.1rem' }}>
          👆 Select a pump to view its performance curves
        </div>
      )}
      
      {/* Sistema de Pestañas para 1 bomba */}
      {!isComparisonMode && numPumpsDesign === 1 && (curves || multiFreqCurves.length > 0) && (
        <>
          <div style={{ textAlign: 'center', padding: '16px', background: 'rgba(52, 152, 219, 0.1)', borderRadius: '8px', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, color: '#3498db' }}>
              Single Pump Analysis @ {freq} Hz
            </h3>
            <p style={{ margin: '8px 0 0 0', color: '#7f8c8d', fontSize: '0.95rem' }}>
              View pump performance curves and IPR analysis
            </p>
          </div>
          
          <div className="tabs-container">
            <div className="tabs-header">
              <button 
                className={`tab-button combined ${activeTab === 'combined' ? 'active' : ''}`}
                onClick={() => setActiveTab('combined')}
              >
                <span className="tab-icon">📊</span>
                <span>Pump Curves</span>
              </button>
              {iprData && (
                <button 
                  className={`tab-button ipr ${activeTab === 'ipr' ? 'active' : ''}`}
                  onClick={() => setActiveTab('ipr')}
                >
                  <span className="tab-icon">🛢️</span>
                  <span>IPR Analysis</span>
                </button>
              )}
            </div>
            
            <div className="tab-content">
              {/* Tab Pump Curves */}
              <div className={`tab-panel ${activeTab === 'combined' ? 'active' : ''}`}>
                <div style={{ textAlign: 'center', padding: '12px', marginBottom: '16px' }}>
                  <h4 style={{ margin: 0, color: '#3498db', fontSize: '1.3rem' }}>
                    Pump Performance Curves
                  </h4>
                  <p style={{ margin: '8px 0 0 0', color: '#7f8c8d', fontSize: '0.9rem' }}>
                    Head, efficiency, and power characteristics
                  </p>
                </div>
                {!isMultiFreq && curves && <CurvePlot curves={curves} iprData={null} showIPR={false} />}
                {isMultiFreq && multiFreqCurves.length > 0 && <CurvePlot curves={null} multiFreqData={multiFreqCurves} isMultiFreq={true} iprData={null} showIPR={false} />}
              </div>
              
              {/* Tab IPR */}
              {iprData && (
                <div className={`tab-panel ${activeTab === 'ipr' ? 'active' : ''}`}>
                  <div style={{ textAlign: 'center', padding: '12px', marginBottom: '16px' }}>
                    <h4 style={{ margin: 0, color: '#16a085', fontSize: '1.3rem' }}>
                      IPR Analysis - Inflow Performance Relationship
                    </h4>
                    <p style={{ margin: '8px 0 0 0', color: '#7f8c8d', fontSize: '0.9rem' }}>
                      Well productivity analysis
                    </p>
                  </div>
                  <CurvePlot 
                    curves={null}
                    isIPRMode={true}
                    iprData={iprData}
                    showIPR={true}
                  />
                </div>
              )}
            </div>
          </div>
        </>
      )}
      
      {!isComparisonMode && numPumpsDesign > 1 && combinedCurves && (
        <>
          <div style={{ textAlign: 'center', padding: '16px', background: 'rgba(52, 152, 219, 0.1)', borderRadius: '8px', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, color: '#3498db' }}>
              System Design: {numPumpsDesign} Pumps in Series @ {freq} Hz
            </h3>
            <p style={{ margin: '8px 0 0 0', color: '#7f8c8d', fontSize: '0.95rem' }}>
              View combined and individual pump performance curves
            </p>
          </div>
          
          {/* Sistema de Pestañas */}
          {(individualCurves.length > 0 || iprData) && (
            <div className="tabs-container">
              <div className="tabs-header">
                {individualCurves.length > 1 && (
                  <>
                    <button 
                      className={`tab-button combined ${activeTab === 'combined' ? 'active' : ''}`}
                      onClick={() => setActiveTab('combined')}
                    >
                      <span className="tab-icon">📊</span>
                      <span>Combined System</span>
                    </button>
                    <button 
                      className={`tab-button efficiency ${activeTab === 'efficiency' ? 'active' : ''}`}
                      onClick={() => setActiveTab('efficiency')}
                    >
                      <span className="tab-icon">⚡</span>
                      <span>Efficiency</span>
                    </button>
                    <button 
                      className={`tab-button head ${activeTab === 'head' ? 'active' : ''}`}
                      onClick={() => setActiveTab('head')}
                    >
                      <span className="tab-icon">📈</span>
                      <span>Head (TDH)</span>
                    </button>
                    <button 
                      className={`tab-button bhp ${activeTab === 'bhp' ? 'active' : ''}`}
                      onClick={() => setActiveTab('bhp')}
                    >
                      <span className="tab-icon">🔋</span>
                      <span>Power (BHP)</span>
                    </button>
                  </>
                )}
                <button 
                  className={`tab-button ipr ${activeTab === 'ipr' ? 'active' : ''}`}
                  onClick={() => setActiveTab('ipr')}
                >
                  <span className="tab-icon">🛢️</span>
                  <span>IPR Analysis</span>
                </button>
              </div>
              
              <div className="tab-content">
                {/* Tab Combined System */}
                {individualCurves.length > 1 && (
                  <div className={`tab-panel ${activeTab === 'combined' ? 'active' : ''}`}>
                    <div style={{ textAlign: 'center', padding: '12px', marginBottom: '16px' }}>
                      <h4 style={{ margin: 0, color: '#3498db', fontSize: '1.3rem' }}>
                        Combined System Performance
                      </h4>
                      <p style={{ margin: '8px 0 0 0', color: '#7f8c8d', fontSize: '0.9rem' }}>
                        Total Head = Sum of all pump heads | Total BHP = Sum of all pump BHP
                      </p>
                    </div>
                    <CurvePlot curves={combinedCurves} iprData={iprData} showIPR={showIPR} />
                  </div>
                )}
                
                {/* Tab Efficiency */}
                {individualCurves.length > 1 && (
                  <div className={`tab-panel ${activeTab === 'efficiency' ? 'active' : ''}`}>
                    <div style={{ textAlign: 'center', padding: '12px', marginBottom: '16px' }}>
                      <h4 style={{ margin: 0, color: '#2ecc71', fontSize: '1.3rem' }}>
                        Individual Pump Efficiencies
                      </h4>
                      <p style={{ margin: '8px 0 0 0', color: '#7f8c8d', fontSize: '0.9rem' }}>
                        Compare efficiency performance within recommended operating range
                      </p>
                    </div>
                    <CurvePlot 
                      curves={null}
                      isIndividualEfficiency={true}
                      individualEfficiencyData={individualCurves}
                    />
                  </div>
                )}
                
                {/* Tab Head */}
                {individualCurves.length > 1 && (
                  <div className={`tab-panel ${activeTab === 'head' ? 'active' : ''}`}>
                    <div style={{ textAlign: 'center', padding: '12px', marginBottom: '16px' }}>
                      <h4 style={{ margin: 0, color: '#e74c3c', fontSize: '1.3rem' }}>
                        Individual Pump Head Curves
                      </h4>
                      <p style={{ margin: '8px 0 0 0', color: '#7f8c8d', fontSize: '0.9rem' }}>
                        Compare head performance within recommended operating range
                      </p>
                    </div>
                    <CurvePlot 
                      curves={null}
                      isIndividualHead={true}
                      individualHeadData={individualCurves}
                      iprData={iprData}
                      showIPR={showIPR}
                    />
                  </div>
                )}
                
                {/* Tab BHP */}
                {individualCurves.length > 1 && (
                  <div className={`tab-panel ${activeTab === 'bhp' ? 'active' : ''}`}>
                    <div style={{ textAlign: 'center', padding: '12px', marginBottom: '16px' }}>
                      <h4 style={{ margin: 0, color: '#f39c12', fontSize: '1.3rem' }}>
                        Individual Pump Power Curves
                      </h4>
                      <p style={{ margin: '8px 0 0 0', color: '#7f8c8d', fontSize: '0.9rem' }}>
                        Compare power consumption within recommended operating range
                      </p>
                    </div>
                    <CurvePlot 
                      curves={null}
                      isIndividualBhp={true}
                      individualBhpData={individualCurves}
                    />
                  </div>
                )}
                
                {/* Tab IPR */}
                <div className={`tab-panel ${activeTab === 'ipr' ? 'active' : ''}`}>
                  <div style={{ textAlign: 'center', padding: '12px', marginBottom: '16px' }}>
                    <h4 style={{ margin: 0, color: '#16a085', fontSize: '1.3rem' }}>
                      IPR Analysis - Inflow Performance Relationship
                    </h4>
                    <p style={{ margin: '8px 0 0 0', color: '#7f8c8d', fontSize: '0.9rem' }}>
                      Well productivity analysis with optional pump curve overlay
                    </p>
                  </div>
                  
                  {/* Renderizar si tenemos iprData (pressureDemandCurve es opcional) */}
                  {iprData ? (
                    <CurvePlot 
                      curves={null}
                      isIPRMode={true}
                      iprData={iprData}
                      showIPR={true}
                      pumpCurves={combinedCurves}
                      pressureDemandCurve={pressureDemandCurve}
                    />
                  ) : (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#7f8c8d' }}>
                      <p>⏳ Calculando IPR...</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
      
      {isComparisonMode && (
        <CurvePlot 
          curves={null}
          isComparisonMode={true}
          comparisonData={{
            pumps: [
              { id: pump1, curves: pump1Curves, multiFreq: pump1MultiFreq, name: pump1 || 'Pump 1' },
              { id: pump2, curves: pump2Curves, multiFreq: pump2MultiFreq, name: pump2 || 'Pump 2' },
              ...(numPumpsToCompare >= 3 ? [{ id: pump3, curves: pump3Curves, multiFreq: pump3MultiFreq, name: pump3 || 'Pump 3' }] : [])
            ].filter(p => p.id),
            curveType: curveTypeToCompare
          }}
        />
      )}
    </div>
  )
}
