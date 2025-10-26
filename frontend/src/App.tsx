// @ts-nocheck
import React, { useEffect, useMemo, useRef, useState } from 'react'
import axios from 'axios'
import PumpSelector from './components/PumpSelector'
import CurveControls from './components/CurveControls'
import CurvePlot from './components/CurvePlot'
import IPRControls from './components/IPRControls'
import InstallationControls from './components/InstallationControls'
import ScenarioSensitivityModal from './components/ScenarioSensitivityModal'

const DEFAULT_SCENARIO_ORDER = ['optimistic', 'conservative', 'pessimistic']
const DEFAULT_SCENARIO_STYLES = {
  optimistic: { label: 'Optimistic', color: '#2ecc71', dash: 'solid', symbol: 'circle' },
  conservative: { label: 'Conservative', color: '#3498db', dash: 'dash', symbol: 'diamond' },
  pessimistic: { label: 'Pessimistic', color: '#e74c3c', dash: 'dot', symbol: 'triangle-up' }
}
const FALLBACK_SCENARIO_STYLE = { label: 'System Demand', color: '#c0392b', dash: 'dot', symbol: 'star' }

type ScenarioOverride = {
  freq?: number
  qTest?: number
  pwfTest?: number
}

type ScenarioDisplayValues = {
  freq: number
  qTest: number
  pwfTest: number
}

const interpolateValue = (qArray: number[], valueArray: number[], targetQ: number) => {
  if (!qArray || !valueArray || qArray.length === 0 || valueArray.length === 0) return null
  if (targetQ <= qArray[0]) return valueArray[0]
  if (targetQ >= qArray[qArray.length - 1]) return valueArray[valueArray.length - 1]

  for (let i = 0; i < qArray.length - 1; i++) {
    const q1 = qArray[i]
    const q2 = qArray[i + 1]
    if (targetQ >= q1 && targetQ <= q2 && q2 !== q1) {
      const v1 = valueArray[i]
      const v2 = valueArray[i + 1]
      const fraction = (targetQ - q1) / (q2 - q1)
      return v1 + fraction * (v2 - v1)
    }
  }

  return null
}

const findPumpDemandIntersection = (pumpQ: number[], pumpHead: number[], demandQ: number[], demandHead: number[]) => {
  if (!pumpQ || !pumpHead || !demandQ || !demandHead) return null

  for (let i = 0; i < pumpQ.length - 1; i++) {
    const q1 = pumpQ[i]
    const q2 = pumpQ[i + 1]
    if (q2 === q1) continue

    const pumpHead1 = pumpHead[i]
    const pumpHead2 = pumpHead[i + 1]
    const demandHead1 = interpolateValue(demandQ, demandHead, q1)
    const demandHead2 = interpolateValue(demandQ, demandHead, q2)

    if (demandHead1 === null || demandHead2 === null) continue

    const diff1 = pumpHead1 - demandHead1
    const diff2 = pumpHead2 - demandHead2

    if (diff1 === 0) {
      return { q: q1, head: pumpHead1 }
    }

    if (diff1 * diff2 < 0) {
      const fraction = diff1 / (diff1 - diff2)
      const intersectionQ = q1 + fraction * (q2 - q1)
      const pumpHeadAtQ = interpolateValue(pumpQ, pumpHead, intersectionQ)
      const demandHeadAtQ = interpolateValue(demandQ, demandHead, intersectionQ)
      const headValue = pumpHeadAtQ !== null ? pumpHeadAtQ : demandHeadAtQ
      return {
        q: intersectionQ,
        head: headValue !== null ? headValue : pumpHead1
      }
    }
  }

  return null
}

type DesignPump = { id: string | null; stages: number }

export default function App() {
  const [pumps, setPumps] = useState<string[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [freq, setFreq] = useState(50)
  const [stages, setStages] = useState(300)
  const [points, setPoints] = useState(300)
  const [curves, setCurves] = useState<any | null>(null)
  const [combinedCurves, setCombinedCurves] = useState<any | null>(null)
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
  const [designPumps, setDesignPumps] = useState<DesignPump[]>([
    { id: null, stages: 300 },
    { id: null, stages: 300 },
    { id: null, stages: 300 },
    { id: null, stages: 300 },
    { id: null, stages: 300 }
  ])
  const prevSelectedRef = useRef<string | null>(null)
  const [individualCurves, setIndividualCurves] = useState<any[]>([])
  
  // Estado para controlar pestañas
  const [configTab, setConfigTab] = useState<'pump' | 'installation' | 'ipr'>('pump')
  const [visualTab, setVisualTab] = useState<'curves' | 'ipr' | 'demand'>('curves')
  const [pumpCurvesTab, setPumpCurvesTab] = useState<'combined' | 'efficiency' | 'head' | 'bhp'>('combined')
  
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
  const [showSensitivity, setShowSensitivity] = useState(false)
  const [iprMethod, setIprMethod] = useState('vogel')
  const [presionReservorio, setPresionReservorio] = useState(150)  // bar
  const [pi, setPi] = useState(5.0)  // m³/d/bar
  const [presionBurbuja, setPresionBurbuja] = useState(30)  // bar
  const [qTest, setQTest] = useState(150)  // m³/d
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
  const [iprScenarios, setIprScenarios] = useState<any>({})
  const [pressureDemandScenarios, setPressureDemandScenarios] = useState<any>({})
  const [scenarioDefinitions, setScenarioDefinitions] = useState<any>({})
  const [scenarioOrder, setScenarioOrder] = useState(DEFAULT_SCENARIO_ORDER)
  const [scenarioVisibility, setScenarioVisibility] = useState({
    optimistic: false,
    conservative: true,
    pessimistic: false
  })
  const [scenarioOverrides, setScenarioOverrides] = useState<Record<string, ScenarioOverride>>({})
  const [openScenarioKey, setOpenScenarioKey] = useState<string | null>(null)
  const [scenarioPumpCurves, setScenarioPumpCurves] = useState<Record<string, any>>({})
  const [scenarioMeta, setScenarioMeta] = useState<Record<string, { frequency?: number }>>({})
  const [scenarioPumpLoading, setScenarioPumpLoading] = useState(false)
  const prevSensitivityEnabledRef = useRef(false)

  // Estados para Installation Design (FASE 1)
  const [profundidadIntake, setProfundidadIntake] = useState(2000)  // m
  const [tubingSelected, setTubingSelected] = useState('Tbg 2-7/8"')
  const [tubingIdMm, setTubingIdMm] = useState(62.0)  // mm
  const [tubingRoughness, setTubingRoughness] = useState('acero_nuevo')
  const [presionSuperficie, setPresionSuperficie] = useState(10)  // bar
  const [presionCasing, setPresionCasing] = useState(5)  // bar

  const scenarioStyles = React.useMemo(() => {
    const styles: any = {}
    const definitions = scenarioDefinitions || {}

    DEFAULT_SCENARIO_ORDER.forEach((key) => {
      const definition = definitions[key] || {}
      const baseStyle = DEFAULT_SCENARIO_STYLES[key] || {}
      styles[key] = {
        ...FALLBACK_SCENARIO_STYLE,
        ...baseStyle,
        label: definition.label || baseStyle.label || key.charAt(0).toUpperCase() + key.slice(1),
        color: definition.color || baseStyle.color || FALLBACK_SCENARIO_STYLE.color
      }
    })

    Object.keys(definitions).forEach((key) => {
      if (!styles[key]) {
        const definition = definitions[key] || {}
        const baseStyle = DEFAULT_SCENARIO_STYLES[key] || {}
        styles[key] = {
          ...FALLBACK_SCENARIO_STYLE,
          ...baseStyle,
          label: definition.label || baseStyle.label || key.charAt(0).toUpperCase() + key.slice(1),
          color: definition.color || baseStyle.color || FALLBACK_SCENARIO_STYLE.color
        }
      }
    })

    return styles
  }, [scenarioDefinitions])

  const availableScenarioKeys = React.useMemo(() => {
    const keys = new Set<string>()
    ;(scenarioOrder || []).forEach((key) => keys.add(key))
    Object.keys(pressureDemandScenarios || {}).forEach((key) => keys.add(key))
    Object.keys(iprScenarios || {}).forEach((key) => keys.add(key))
    if (!keys.size) {
      DEFAULT_SCENARIO_ORDER.forEach((key) => keys.add(key))
    }
    return Array.from(keys)
  }, [scenarioOrder, pressureDemandScenarios, iprScenarios])

  const sensitivityEnabled = showIPR && showSensitivity

  const activeScenarioKeys = availableScenarioKeys.filter((key) => scenarioVisibility[key])

  const primaryScenarioKey = sensitivityEnabled
    ? activeScenarioKeys[0]
      || (availableScenarioKeys.includes('conservative') ? 'conservative' : availableScenarioKeys[0])
      || null
    : null

  const primaryDemandCurve = sensitivityEnabled && primaryScenarioKey
    ? (pressureDemandScenarios?.[primaryScenarioKey] || pressureDemandCurve)
    : pressureDemandCurve

  const scenarioPlotProps = {
    pressureDemandCurve: primaryDemandCurve,
    basePressureDemandCurve: pressureDemandCurve,
    pressureDemandScenarios: sensitivityEnabled ? pressureDemandScenarios : {},
    iprScenarios: sensitivityEnabled ? iprScenarios : {},
    scenarioVisibility: sensitivityEnabled ? scenarioVisibility : {},
    scenarioStyles,
    scenarioOrder: sensitivityEnabled ? availableScenarioKeys : [],
    activeScenarioKey: sensitivityEnabled ? primaryScenarioKey : null
  }

  const handleScenarioToggle = (scenarioKey: string) => {
    setScenarioVisibility((prev) => ({
      ...prev,
      [scenarioKey]: !prev?.[scenarioKey]
    }))
  }

  const handleScenarioConfigure = (scenarioKey: string) => {
    if (!scenarioKey || !sensitivityEnabled) return
    setOpenScenarioKey(scenarioKey)
  }

  const handleScenarioOverrideSave = (scenarioKey: string, values: ScenarioDisplayValues) => {
    setScenarioOverrides((prev) => {
      const next: Record<string, ScenarioOverride> = { ...prev }

      if (!values || !scenarioKey) {
        delete next[scenarioKey]
        return next
      }

      next[scenarioKey] = {
        freq: Number.isFinite(values.freq) ? values.freq : undefined,
        qTest: Number.isFinite(values.qTest) ? values.qTest : undefined,
        pwfTest: Number.isFinite(values.pwfTest) ? values.pwfTest : undefined
      }

      const current = next[scenarioKey]
      if (
        (current.freq === undefined || current.freq === null) &&
        (current.qTest === undefined || current.qTest === null) &&
        (current.pwfTest === undefined || current.pwfTest === null)
      ) {
        delete next[scenarioKey]
      }

      return next
    })
  }

  const closeScenarioModal = () => {
    setOpenScenarioKey(null)
  }

  useEffect(() => {
    if (!sensitivityEnabled) {
      setOpenScenarioKey(null)
    }
  }, [sensitivityEnabled])

  useEffect(() => {
    if (!pressureDemandCurve || !Array.isArray(pressureDemandCurve.curve)) {
      return
    }

    const sample = pressureDemandCurve.curve.slice(0, 2)
    console.log('[debug] base demand updated', {
      count: pressureDemandCurve.curve.length,
      sample
    })
  }, [pressureDemandCurve])

  useEffect(() => {
    if (!pressureDemandScenarios || typeof pressureDemandScenarios !== 'object') {
      console.log('[debug] scenario demand updated', {})
      return
    }

    const summary = Object.fromEntries(
      Object.entries(pressureDemandScenarios).map(([key, data]) => [
        key,
        {
          count: Array.isArray(data?.curve) ? data.curve.length : 0,
          sample: Array.isArray(data?.curve) ? data.curve.slice(0, 2) : []
        }
      ])
    )

    console.log('[debug] scenario demand updated', summary)
  }, [pressureDemandScenarios])

  useEffect(() => {
    if (sensitivityEnabled && !prevSensitivityEnabledRef.current) {
      setScenarioVisibility((prev) => {
        const next = { ...prev }
        let changed = false
        availableScenarioKeys.forEach((key) => {
          if (!next[key]) {
            next[key] = true
            changed = true
          }
        })
        return changed ? next : prev
      })
    }

    prevSensitivityEnabledRef.current = sensitivityEnabled
  }, [sensitivityEnabled, availableScenarioKeys])

  useEffect(() => {
    setScenarioOverrides((prev) => {
      const next: Record<string, ScenarioOverride> = { ...prev }
      let changed = false

      Object.entries(scenarioDefinitions || {}).forEach(([key, definition]) => {
        if (next[key]) {
          return
        }

        const overrides = (definition as any)?.overrides || {}
        if (!overrides) return

        const entry: ScenarioOverride = {}
        if (typeof overrides.q_test === 'number' && Number.isFinite(overrides.q_test)) {
          entry.qTest = overrides.q_test
        }
        if (typeof overrides.pwf_test === 'number' && Number.isFinite(overrides.pwf_test)) {
          entry.pwfTest = overrides.pwf_test
        }
        if (typeof overrides.frequency_hz === 'number' && Number.isFinite(overrides.frequency_hz)) {
          entry.freq = overrides.frequency_hz
        }

        if (Object.keys(entry).length > 0) {
          next[key] = entry
          changed = true
        }
      })

      return changed ? next : prev
    })
  }, [scenarioDefinitions])

  const scenarioDisplayValues = useMemo(() => {
    const result: Record<string, ScenarioDisplayValues> = {}
    const pumpCurve = !isComparisonMode && numPumpsDesign > 1 ? combinedCurves : curves
    const pumpQ = pumpCurve?.head?.map((point: any) => Number(point.caudal))
    const pumpHead = pumpCurve?.head?.map((point: any) => Number(point.valor))

    const demandFallback = primaryDemandCurve?.curve || pressureDemandCurve?.curve || []

    availableScenarioKeys.forEach((key) => {
      const override = scenarioOverrides?.[key] || {}
      const definitionOverride = scenarioDefinitions?.[key]?.overrides || {}
      const demandCurve = pressureDemandScenarios?.[key]?.curve || demandFallback

      let freqValue = override.freq
      if (freqValue === undefined && typeof definitionOverride.frequency_hz === 'number') {
        freqValue = definitionOverride.frequency_hz
      }
      if (freqValue === undefined && typeof definitionOverride.freq === 'number') {
        freqValue = definitionOverride.freq
      }
      if (freqValue === undefined) {
        freqValue = freq
      }

      let qValue = override.qTest
      if (qValue === undefined && typeof definitionOverride.q_test === 'number') {
        qValue = definitionOverride.q_test
      }

      let pwfValue = override.pwfTest
      if (pwfValue === undefined && typeof definitionOverride.pwf_test === 'number') {
        pwfValue = definitionOverride.pwf_test
      }

      if ((qValue === undefined || pwfValue === undefined) && pumpQ && pumpHead && Array.isArray(demandCurve) && demandCurve.length > 0) {
        const demandQ = demandCurve.map((point: any) => Number(point.caudal))
        const demandHead = demandCurve.map((point: any) => Number(point.tdh))
        const intersection = findPumpDemandIntersection(pumpQ, pumpHead, demandQ, demandHead)

        if (intersection) {
          if (qValue === undefined) {
            qValue = Number(intersection.q.toFixed(2))
          }

          if (pwfValue === undefined) {
            const demandPwfValues = demandCurve.map((point: any) => {
              if (typeof point.pwf === 'number') return Number(point.pwf)
              if (typeof point.pip === 'number') return Number(point.pip)
              return null
            }).filter((value) => value !== null) as number[]

            if (demandPwfValues.length === demandQ.length) {
              const interpolated = interpolateValue(demandQ, demandPwfValues, intersection.q)
              if (interpolated !== null && Number.isFinite(interpolated)) {
                pwfValue = Number(interpolated.toFixed(2))
              }
            }
          }
        }
      }

      if (qValue === undefined) {
        qValue = qTest
      }

      if (pwfValue === undefined) {
        pwfValue = pwfTest
      }

      result[key] = {
        freq: typeof freqValue === 'number' && Number.isFinite(freqValue) ? freqValue : freq,
        qTest: typeof qValue === 'number' && Number.isFinite(qValue) ? qValue : qTest,
        pwfTest: typeof pwfValue === 'number' && Number.isFinite(pwfValue) ? pwfValue : pwfTest
      }
    })

    return result
  }, [
    availableScenarioKeys,
    scenarioOverrides,
    scenarioDefinitions,
    pressureDemandScenarios,
    primaryDemandCurve,
    pressureDemandCurve,
    curves,
    combinedCurves,
    isComparisonMode,
    numPumpsDesign,
    freq,
    qTest,
    pwfTest
  ])

  useEffect(() => {
    if (!sensitivityEnabled || !showIPR || !selected || numPumpsDesign !== 1) {
      setScenarioPumpCurves({})
      setScenarioMeta({})
      setScenarioPumpLoading(false)
      return
    }

    if (!availableScenarioKeys.length) {
      setScenarioPumpCurves({})
      setScenarioMeta({})
      setScenarioPumpLoading(false)
      return
    }

    let cancelled = false
    const controller = new AbortController()
    setScenarioPumpLoading(true)

    const loadScenarioCurves = async () => {
      try {
        const requests = await Promise.all(
          availableScenarioKeys.map(async (scenarioKey) => {
            const display = scenarioDisplayValues?.[scenarioKey]
            const targetFrequency = typeof display?.freq === 'number' ? display.freq : freq

            if (!Number.isFinite(targetFrequency)) {
              return { scenarioKey, curves: null, frequency: display?.freq }
            }

            if (
              curves &&
              Number.isFinite(freq) &&
              Math.abs(targetFrequency - freq) < 1e-6
            ) {
              return { scenarioKey, curves, frequency: targetFrequency }
            }

            const url = `/api/pumps/${encodeURIComponent(selected)}/curves?freq=${targetFrequency}&stages=${stages}&points=${points}`
            const response = await axios.get(url, { signal: controller.signal })
            const payload = response.data || {}
            const curvePayload = payload.curves || payload
            return { scenarioKey, curves: curvePayload, frequency: targetFrequency }
          })
        )

        if (cancelled) {
          return
        }

        const pumpMap: Record<string, any> = {}
        const metaMap: Record<string, { frequency?: number }> = {}

        requests.forEach((entry) => {
          if (!entry) return
          metaMap[entry.scenarioKey] = { frequency: entry.frequency }
          if (entry.curves) {
            pumpMap[entry.scenarioKey] = entry.curves
          }
        })

        setScenarioPumpCurves(pumpMap)
        setScenarioMeta(metaMap)
      } catch (error: any) {
        if (!axios.isCancel(error)) {
          console.error('Error loading scenario pump curves:', error)
        }
      } finally {
        if (!cancelled) {
          setScenarioPumpLoading(false)
        }
      }
    }

    loadScenarioCurves()

    return () => {
      cancelled = true
      controller.abort()
      setScenarioPumpLoading(false)
    }
  }, [
    sensitivityEnabled,
    showIPR,
    selected,
    numPumpsDesign,
    availableScenarioKeys,
    scenarioDisplayValues,
    freq,
    curves,
    stages,
    points
  ])

  const scenarioOperatingSummary = useMemo(() => {
    if (!sensitivityEnabled) {
      return [] as any[]
    }

    const summaries: any[] = []

    availableScenarioKeys.forEach((scenarioKey) => {
      const pumpCurve = scenarioPumpCurves?.[scenarioKey]
      const demandSource = pressureDemandScenarios?.[scenarioKey] || pressureDemandCurve

      if (!pumpCurve || !Array.isArray(pumpCurve.head) || pumpCurve.head.length < 2) {
        return
      }

      if (!demandSource || !Array.isArray(demandSource.curve) || demandSource.curve.length < 2) {
        return
      }

      const pumpQ = pumpCurve.head
        .map((point: any) => Number(point.caudal))
        .filter((value: number) => Number.isFinite(value))
      const pumpHead = pumpCurve.head
        .map((point: any) => Number(point.valor))
        .filter((value: number) => Number.isFinite(value))

      if (pumpQ.length < 2 || pumpHead.length < 2) {
        return
      }

      const demandQ = demandSource.curve
        .map((point: any) => Number(point.caudal))
        .filter((value: number) => Number.isFinite(value))
      const demandHead = demandSource.curve
        .map((point: any) => Number(point.tdh))
        .filter((value: number) => Number.isFinite(value))

      if (demandQ.length < 2 || demandHead.length < 2) {
        return
      }

      const intersection = findPumpDemandIntersection(pumpQ, pumpHead, demandQ, demandHead)

      const displayValues = scenarioDisplayValues?.[scenarioKey]
      const targetFlowOverride = displayValues?.qTest
      const targetPwfOverride = displayValues?.pwfTest

      const targetFlow = Number.isFinite(targetFlowOverride)
        ? Number(targetFlowOverride)
        : (intersection && Number.isFinite(intersection.q) ? Number(intersection.q) : null)

      if (!Number.isFinite(targetFlow)) {
        return
      }

      const mapSeries = (series: any[], multiplier = 1) => {
        if (!Array.isArray(series)) {
          return null
        }
        const filtered = series
          .map((point: any) => ({ q: Number(point.caudal), value: Number(point.valor) * multiplier }))
          .filter((entry) => Number.isFinite(entry.q) && Number.isFinite(entry.value))
        return filtered.length > 1 ? filtered : null
      }

      const efficiencySeries = mapSeries(pumpCurve.efficiency, 100)
      const bhpSeries = mapSeries(pumpCurve.bhp)

      const interpolateFromSeries = (series: any[] | null, flow: number) =>
        series
          ? interpolateValue(
              series.map((entry) => entry.q),
              series.map((entry) => entry.value),
              flow
            )
          : null

      const pumpHeadAtFlow = interpolateValue(pumpQ, pumpHead, targetFlow)
      const efficiency = interpolateFromSeries(efficiencySeries, targetFlow)
      const bhp = interpolateFromSeries(bhpSeries, targetFlow)

      const extractDemandSeries = (key: string) => {
        const filtered = demandSource.curve
          .map((point: any) => ({ q: Number(point.caudal), value: Number(point[key]) }))
          .filter((entry) => Number.isFinite(entry.q) && Number.isFinite(entry.value))
        return filtered.length > 1 ? filtered : null
      }

      const pipSeries = extractDemandSeries('pip')
      const pwfSeries = extractDemandSeries('pwf')
      const nivelSeries = extractDemandSeries('nivel')
      const frictionSeries = extractDemandSeries('perdidas_friccion')

      const demandHeadAtFlow = interpolateValue(demandQ, demandHead, targetFlow)
      const pip = interpolateFromSeries(pipSeries, targetFlow)
      const pwfFromDemand = interpolateFromSeries(pwfSeries, targetFlow)
      const nivel = interpolateFromSeries(nivelSeries, targetFlow)
      const friction = interpolateFromSeries(frictionSeries, targetFlow)

      const pwfValue = Number.isFinite(targetPwfOverride)
        ? Number(targetPwfOverride)
        : (Number.isFinite(pwfFromDemand) ? Number(pwfFromDemand) : null)

      const components = demandSource.components || {}
      const gradient = typeof components.gradiente === 'number'
        ? components.gradiente
        : (typeof pressureDemandCurve?.components?.gradiente === 'number'
          ? pressureDemandCurve.components.gradiente
          : null)

      const pumpDepth = typeof components.profundidad_bomba === 'number'
        ? components.profundidad_bomba
        : (typeof pressureDemandCurve?.components?.profundidad_bomba === 'number'
          ? pressureDemandCurve.components.profundidad_bomba
          : null)

      let submergence: number | null = null
      if (typeof gradient === 'number' && gradient > 0 && typeof pwfValue === 'number') {
        const rawSub = pwfValue / gradient
        if (Number.isFinite(rawSub)) {
          submergence = Math.max(rawSub, 0)
        }
      }

      let fluidLevel: number | null = null
      if (typeof pumpDepth === 'number' && typeof submergence === 'number') {
        const rawLevel = pumpDepth - submergence
        if (Number.isFinite(rawLevel)) {
          fluidLevel = Math.min(Math.max(rawLevel, 0), pumpDepth)
        }
      }

      const frequency = scenarioMeta?.[scenarioKey]?.frequency
        ?? displayValues?.freq
        ?? freq

      const headValue = Number.isFinite(pumpHeadAtFlow)
        ? Number(pumpHeadAtFlow)
        : (Number.isFinite(demandHeadAtFlow) ? Number(demandHeadAtFlow) : (intersection?.head ?? null))

      const pwfDisplay = typeof pwfValue === 'number' && Number.isFinite(pwfValue)
        ? pwfValue
        : (typeof pwfFromDemand === 'number' ? pwfFromDemand : null)

      summaries.push({
        scenarioKey,
        flow: Number(targetFlow),
        head: headValue,
        efficiency,
        bhp,
        pip,
        pwf: pwfDisplay,
        nivel,
        friction,
        submergence,
        fluidLevel,
        frequency
      })
    })

    return summaries
  }, [
    sensitivityEnabled,
    availableScenarioKeys,
    scenarioPumpCurves,
    pressureDemandScenarios,
    pressureDemandCurve,
    scenarioMeta,
    scenarioDisplayValues,
    freq
  ])

  const handleNumPumpsDesignChange = (newCount: number) => {
    setNumPumpsDesign(newCount)

    if (!selected) {
      return
    }

    const previousSelected = prevSelectedRef.current ?? selected

    setDesignPumps((prev: DesignPump[]) => {
      const updated = [...prev]

      for (let i = 0; i < newCount; i++) {
        const existing = updated[i] ?? { id: null, stages }
        const shouldUpdate = existing.id === null || existing.id === previousSelected

        if (shouldUpdate) {
          const desiredStages = existing.stages ?? stages
          updated[i] = { ...existing, id: selected, stages: desiredStages }
        } else {
          updated[i] = existing
        }
      }

      return updated
    })

    prevSelectedRef.current = selected
  }

  useEffect(() => {
    axios.get('/api/pumps').then(r => {
      const list = r.data || []
      // Expect list of pump records; map to ids
      const pumpIds = list.map((p: any) => p[equipmentIdKey(list)])
      setPumps(pumpIds)

      if (!selected) {
        const defaultPump = pumpIds.find((pumpId: string) => pumpId === 'NHV760') || pumpIds[0] || null
        if (defaultPump) {
          setSelected(defaultPump)
        }
      }
    }).catch(e => console.error(e))
  }, [])

  useEffect(() => {
    if (!selected) {
      prevSelectedRef.current = null
      return
    }

    const previousSelected = prevSelectedRef.current
    setDesignPumps((prev: DesignPump[]) => {
      let didChange = false
      const updated = prev.map((pump) => {
        if (!pump) {
          didChange = true
          return { id: selected, stages }
        }

        const shouldFollowDefault = pump.id === null || pump.id === previousSelected
        if (!shouldFollowDefault) {
          return pump
        }

        const desiredStages = pump.stages ?? stages
        if (pump.id === selected && pump.stages === desiredStages) {
          return pump
        }

        didChange = true
        return { ...pump, id: selected, stages: desiredStages }
      })

      return didChange ? updated : prev
    })

    prevSelectedRef.current = selected
  }, [selected, stages])

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

        setScenarioOrder(DEFAULT_SCENARIO_ORDER)
        setScenarioDefinitions({})
        setIprScenarios({})

        if (payload.pressure_demand_curve) {
          const baseCurve = payload.pressure_demand_curve
          const cloneCurve = (source: any) => {
            if (!source) return null
            const result: any = { ...source }
            if (Array.isArray(source.curve)) {
              result.curve = source.curve.map((point: any) => ({ ...point }))
            } else {
              result.curve = []
            }
            if (source.components && typeof source.components === 'object') {
              result.components = { ...source.components }
            }
            return result
          }

          const scenarioMap: Record<string, any> = {}
          DEFAULT_SCENARIO_ORDER.forEach((key) => {
            scenarioMap[key] = cloneCurve(baseCurve)
          })

          setPressureDemandCurve(baseCurve)
          setPressureDemandScenarios(scenarioMap)
          setScenarioOverrides({})
          console.log('✅ pressureDemandCurve guardado en el estado (manual scenarios)')
        } else {
          setPressureDemandCurve(null)
          setPressureDemandScenarios({})
          setScenarioOverrides({})
          console.log('⚠️ NO se recibió pressure_demand_curve del backend')
        }

        setScenarioVisibility({
          optimistic: false,
          conservative: true,
          pessimistic: false
        })
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

  useEffect(() => {
    if (!showIPR) {
      setShowSensitivity(false)
    }
  }, [showIPR])

  useEffect(() => {
    if (!showIPR && visualTab !== 'curves') {
      setVisualTab('curves')
    }
  }, [showIPR, visualTab])

  useEffect(() => {
    setPumpCurvesTab('combined')
  }, [numPumpsDesign, isComparisonMode])

  const renderNumberOfPumpsSelector = (): React.ReactNode => (
    <div className="panel-card">
      <label style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
        <span style={{ fontWeight: 600, color: '#d8e4ff' }}>Number of Pumps in System</span>
        <select
          value={numPumpsDesign}
          onChange={(event) => handleNumPumpsDesignChange(Number(event.target.value))}
          style={{
            padding: '10px 12px',
            borderRadius: '8px',
            border: '1px solid #3498db',
            background: 'white',
            color: '#2c3e50',
            fontWeight: 600
          }}
        >
          <option value={1}>1 Pump</option>
          <option value={2}>2 Pumps (Series)</option>
          <option value={3}>3 Pumps (Series)</option>
          <option value={4}>4 Pumps (Series)</option>
          <option value={5}>5 Pumps (Series)</option>
        </select>
      </label>
    </div>
  )

  const renderSinglePumpControls = (): React.ReactNode => (
    <>
      <div className="panel-card">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '12px', alignItems: 'flex-end' }}>
          <PumpSelector pumps={pumps} value={selected} onChange={setSelected} />
          <label className="panel-field" style={{ margin: 0 }}>
            <span>Points per Curve</span>
            <input
              type="number"
              value={points}
              onChange={(event) => setPoints(Number(event.target.value))}
              min={50}
              max={500}
              step={10}
            />
          </label>
        </div>
      </div>
      {renderNumberOfPumpsSelector()}
      <div className="panel-card">
        <CurveControls
          freq={freq}
          setFreq={setFreq}
          stages={stages}
          setStages={setStages}
          points={points}
          setPoints={setPoints}
          onPlot={() => {}}
          isMultiFreq={isMultiFreq}
          setIsMultiFreq={setIsMultiFreq}
          minFreq={minFreq}
          setMinFreq={setMinFreq}
          maxFreq={maxFreq}
          setMaxFreq={setMaxFreq}
          numCurves={numCurves}
          setNumCurves={setNumCurves}
          showPointsField={false}
        />
      </div>
    </>
  )

  const renderMultiPumpControls = (): React.ReactNode => (
    <>
      {renderNumberOfPumpsSelector()}
      <div className="panel-card">
        <h3 className="panel-heading">Global Settings</h3>
        <div className="panel-grid">
          <label className="panel-field">
            <span>Frequency (Hz)</span>
            <input
              type="number"
              value={freq}
              onChange={(event) => setFreq(Number(event.target.value))}
              min={30}
              max={70}
              step={0.1}
            />
          </label>
          <label className="panel-field">
            <span>Points per Curve</span>
            <input
              type="number"
              value={points}
              onChange={(event) => setPoints(Number(event.target.value))}
              min={50}
              max={500}
              step={10}
            />
          </label>
        </div>
      </div>
      <div className="panel-card">
        <h3 className="panel-heading">Pump Lineup</h3>
        <div
          className="multi-pump-grid"
          style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(numPumpsDesign, 2)}, 1fr)`, gap: '16px' }}
        >
          {[...Array(numPumpsDesign)].map((_, idx) => (
            <div
              key={`design-pump-${idx}`}
              style={{
                padding: '16px',
                background: 'linear-gradient(180deg, #ffffff 0%, #f6f8fb 100%)',
                borderRadius: '10px',
                border: '1px solid #dce3f0',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px'
              }}
            >
              <h4 style={{ margin: 0, color: '#3498db', fontSize: '1rem', fontWeight: 600 }}>Pump {idx + 1}</h4>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontWeight: 600, color: '#34495e' }}>Select Pump</span>
                <select
                  value={designPumps[idx]?.id || ''}
                  onChange={(event) => {
                    const newPumps = [...designPumps]
                    newPumps[idx] = { ...newPumps[idx], id: event.target.value || null }
                    setDesignPumps(newPumps)
                  }}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #3498db',
                    background: 'white'
                  }}
                >
                  <option value="">-- Select --</option>
                  {pumps.map((pumpId) => (
                    <option key={pumpId} value={pumpId}>
                      {pumpId}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontWeight: 600, color: '#34495e' }}>Stages</span>
                <input
                  type="number"
                  value={designPumps[idx]?.stages || 300}
                  onChange={(event) => {
                    const newPumps = [...designPumps]
                    newPumps[idx] = { ...newPumps[idx], stages: Number(event.target.value) }
                    setDesignPumps(newPumps)
                  }}
                  min={1}
                  max={500}
                  step={1}
                  style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #3498db', background: 'white' }}
                />
              </label>
            </div>
          ))}
        </div>
      </div>
    </>
  )

  const renderComparisonControls = (): React.ReactNode => (
    <>
      <div className="panel-card">
        <h3 className="panel-heading">Comparison Setup</h3>
        <div className="panel-grid">
          <label className="panel-field">
            <span>Curve Type to Compare</span>
            <select
              value={curveTypeToCompare}
              onChange={(event) => setCurveTypeToCompare(event.target.value as 'head' | 'bhp' | 'efficiency')}
            >
              <option value="head">Head (TDH)</option>
              <option value="bhp">BHP</option>
              <option value="efficiency">Efficiency</option>
            </select>
          </label>
          <label className="panel-field">
            <span>Number of Pumps</span>
            <select value={numPumpsToCompare} onChange={(event) => setNumPumpsToCompare(Number(event.target.value))}>
              <option value={2}>2 Pumps</option>
              <option value={3}>3 Pumps</option>
            </select>
          </label>
        </div>
      </div>
      <div className="panel-card">
        <h3 className="panel-heading">Pump Parameters</h3>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${numPumpsToCompare}, 1fr)`, gap: '18px' }}>
          {[1, 2, 3].slice(0, numPumpsToCompare).map((num) => {
            const pumpState =
              num === 1
                ? { pump: pump1, setPump: setPump1, freq: pump1Freq, setFreq: setPump1Freq, stages: pump1Stages, setStages: setPump1Stages, multiFreq: pump1MultiFreq, setMultiFreq: setPump1MultiFreq }
                : num === 2
                ? { pump: pump2, setPump: setPump2, freq: pump2Freq, setFreq: setPump2Freq, stages: pump2Stages, setStages: setPump2Stages, multiFreq: pump2MultiFreq, setMultiFreq: setPump2MultiFreq }
                : { pump: pump3, setPump: setPump3, freq: pump3Freq, setFreq: setPump3Freq, stages: pump3Stages, setStages: setPump3Stages, multiFreq: pump3MultiFreq, setMultiFreq: setPump3MultiFreq }

            return (
              <div
                key={`comparison-pump-${num}`}
                style={{
                  padding: '14px',
                  borderRadius: '10px',
                  border: '1px solid #e1e6f0',
                  background: 'linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}
              >
                <h4 style={{ margin: 0, color: '#3498db', textAlign: 'center' }}>Pump {num}</h4>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={{ fontWeight: 600, color: '#34495e' }}>Select Pump</span>
                  <select
                    value={pumpState.pump || ''}
                    onChange={(event) => pumpState.setPump(event.target.value || null)}
                    style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #3498db', background: 'white' }}
                  >
                    <option value="">-- Select --</option>
                    {pumps.map((pumpId) => (
                      <option key={pumpId} value={pumpId}>
                        {pumpId}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="checkbox-label" style={{ justifyContent: 'center' }}>
                  <input
                    type="checkbox"
                    checked={pumpState.multiFreq}
                    onChange={(event) => pumpState.setMultiFreq(event.target.checked)}
                  />
                  <span>Multi-Frequency Mode</span>
                </label>
                {!pumpState.multiFreq && (
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span style={{ fontWeight: 600, color: '#34495e' }}>Frequency (Hz)</span>
                    <input
                      type="number"
                      value={pumpState.freq}
                      onChange={(event) => pumpState.setFreq(Number(event.target.value))}
                      min={30}
                      max={70}
                      step={0.1}
                      style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #3498db', background: 'white' }}
                    />
                  </label>
                )}
                <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={{ fontWeight: 600, color: '#34495e' }}>Stages</span>
                  <input
                    type="number"
                    value={pumpState.stages}
                    onChange={(event) => pumpState.setStages(Number(event.target.value))}
                    min={1}
                    max={500}
                    step={1}
                    style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #3498db', background: 'white' }}
                  />
                </label>
              </div>
            )
          })}
        </div>
      </div>
      {(pump1MultiFreq || pump2MultiFreq || (numPumpsToCompare >= 3 && pump3MultiFreq)) && (
        <div className="panel-card">
          <h3 className="panel-heading">Multi-Frequency Settings</h3>
          <div className="panel-grid">
            <label className="panel-field">
              <span>Min Frequency (Hz)</span>
              <input
                type="number"
                value={minFreq}
                onChange={(event) => setMinFreq(Number(event.target.value))}
                min={30}
                max={60}
                step={1}
              />
            </label>
            <label className="panel-field">
              <span>Max Frequency (Hz)</span>
              <input
                type="number"
                value={maxFreq}
                onChange={(event) => setMaxFreq(Number(event.target.value))}
                min={40}
                max={70}
                step={1}
              />
            </label>
            <label className="panel-field">
              <span>Number of Curves</span>
              <input
                type="number"
                value={numCurves}
                onChange={(event) => setNumCurves(Number(event.target.value))}
                min={2}
                max={10}
                step={1}
              />
            </label>
          </div>
        </div>
      )}
      <div className="panel-card">
        <label className="panel-field">
          <span>Points per Curve</span>
          <input
            type="number"
            value={points}
            onChange={(event) => setPoints(Number(event.target.value))}
            min={50}
            max={500}
            step={10}
          />
        </label>
      </div>
    </>
  )

  const renderPumpConfiguration = (): React.ReactNode => {
    if (isComparisonMode) {
      return renderComparisonControls()
    }

    return numPumpsDesign === 1 ? renderSinglePumpControls() : renderMultiPumpControls()
  }

  const renderInstallationConfiguration = (): React.ReactNode => (
    <div className="panel-card">
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
      />
    </div>
  )

  const renderIprConfiguration = (): React.ReactNode => (
    <div className="panel-card">
      {!showIPR && (
        <div className="panel-hint">
          Enable “Show IPR” to calculate well performance in real time.
        </div>
      )}
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
        scenarioVisibility={scenarioVisibility}
        onToggleScenario={handleScenarioToggle}
        scenarioStyles={scenarioStyles}
        scenarioOrder={availableScenarioKeys}
        showScenarioOverlay={sensitivityEnabled}
        onScenarioConfigure={handleScenarioConfigure}
        scenarioOverrides={scenarioDisplayValues}
      />
    </div>
  )

  const renderPumpCurvesContent = (): React.ReactNode => {
    if (isComparisonMode) {
      return (
        <>
          <CurvePlot
            {...scenarioPlotProps}
            curves={null}
            isComparisonMode={true}
            comparisonData={{
              pumps: [
                { id: pump1, curves: pump1Curves, multiFreq: pump1MultiFreq, name: pump1 || 'Pump 1' },
                { id: pump2, curves: pump2Curves, multiFreq: pump2MultiFreq, name: pump2 || 'Pump 2' },
                ...(numPumpsToCompare >= 3
                  ? [{ id: pump3, curves: pump3Curves, multiFreq: pump3MultiFreq, name: pump3 || 'Pump 3' }]
                  : [])
              ].filter((pumpEntry) => pumpEntry.id),
              curveType: curveTypeToCompare
            }}
          />
        </>
      )
    }

    const summariesByKey = scenarioOperatingSummary.reduce<Record<string, any>>((acc, entry) => {
      acc[entry.scenarioKey] = entry
      return acc
    }, {})

    const displayScenarioKeys = availableScenarioKeys.filter((key) => summariesByKey[key])

    const scenarioOperatingPoints = scenarioOperatingSummary.map((entry) => ({
      scenarioKey: entry.scenarioKey,
      flow: entry.flow,
      head: entry.head,
      pwf: entry.pwf,
      frequency: entry.frequency
    }))

    const renderScenarioOperatingTable = () => {
      if (!sensitivityEnabled || displayScenarioKeys.length === 0) {
        return null
      }

      const activeScenarioKeysForTable = displayScenarioKeys.filter((scenarioKey) => {
        if (scenarioVisibility && Object.prototype.hasOwnProperty.call(scenarioVisibility, scenarioKey)) {
          return Boolean(scenarioVisibility[scenarioKey])
        }
        return true
      })

      if (activeScenarioKeysForTable.length === 0) {
        return null
      }

      const formatNumber = (value: any, digits = 1, suffix = '') => {
        if (typeof value !== 'number' || !Number.isFinite(value)) {
          return '—'
        }
        return `${value.toFixed(digits)}${suffix ? ` ${suffix}` : ''}`
      }

      const metrics = [
        { key: 'flow', label: 'Flow (m³/d)', format: (value: any) => formatNumber(value, 1) },
        { key: 'head', label: 'TDH (m)', format: (value: any) => formatNumber(value, 1) },
        { key: 'pwf', label: 'Pwf (bar)', format: (value: any) => formatNumber(value, 2) },
        { key: 'pip', label: 'PIP (bar)', format: (value: any) => formatNumber(value, 2) },
        { key: 'frequency', label: 'Frequency (Hz)', format: (value: any) => formatNumber(value, 1) },
        {
          key: 'efficiency',
          label: 'Efficiency (%)',
          format: (value: any) => {
            const formatted = formatNumber(value, 1)
            return formatted === '—' ? formatted : `${formatted} %`
          }
        },
        { key: 'bhp', label: 'BHP (HP)', format: (value: any) => formatNumber(value, 1) },
        { key: 'fluidLevel', label: 'Fluid Level (m)', format: (value: any) => formatNumber(value, 1) },
        { key: 'submergence', label: 'Submergence (m)', format: (value: any) => formatNumber(value, 1) },
        { key: 'friction', label: 'Friction Loss (m)', format: (value: any) => formatNumber(value, 1) }
      ]

      return (
        <div className="panel-card sensitivity-table-card">
          <h3 className="panel-heading">System Operating Points</h3>
          <div className="table-wrapper">
            <table className="sensitivity-table sensitivity-table--scenario-grid">
              <thead>
                <tr>
                  <th>Metric</th>
                  {activeScenarioKeysForTable.map((scenarioKey) => (
                    <th
                      key={`header-${scenarioKey}`}
                      style={{ color: scenarioStyles?.[scenarioKey]?.color || '#9fb7ff' }}
                    >
                      {scenarioStyles?.[scenarioKey]?.label || scenarioKey}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {metrics.map((metric) => (
                  <tr key={metric.key}>
                    <td className="metric-label">{metric.label}</td>
                    {activeScenarioKeysForTable.map((scenarioKey) => {
                      const summary = summariesByKey[scenarioKey]
                      const value = summary ? summary[metric.key as keyof typeof summary] : null
                      return (
                        <td
                          key={`${metric.key}-${scenarioKey}`}
                          className="scenario-value"
                          style={{ color: scenarioStyles?.[scenarioKey]?.color || '#dbe4ff' }}
                        >
                          {metric.format(value)}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )
    }

    if (numPumpsDesign === 1) {
      if (!selected) {
        return <div className="empty-state">Select a pump to view the performance curves.</div>
      }

      if (isMultiFreq && multiFreqCurves.length > 0) {
        return (
          <CurvePlot
            {...scenarioPlotProps}
            curves={null}
            multiFreqData={multiFreqCurves}
            isMultiFreq={true}
            iprData={null}
            showIPR={false}
          />
        )
      }

      if (sensitivityEnabled) {
        if (!pressureDemandCurve && !Object.keys(pressureDemandScenarios || {}).length) {
          return <div className="empty-state">Run the IPR calculation to generate the scenario overlays.</div>
        }

        if (scenarioPumpLoading) {
          return <div className="empty-state">Calculating sensitivity curves…</div>
        }

        if (Object.keys(scenarioPumpCurves || {}).length > 0) {
          return (
            <>
              <div className="panel-card panel-card--no-padding">
                <CurvePlot
                  {...scenarioPlotProps}
                  curves={null}
                  iprData={null}
                  showIPR={false}
                  sensitivityPumpData={{
                    pumpCurves: scenarioPumpCurves,
                    demandCurves: pressureDemandScenarios,
                    fallbackDemandCurve: pressureDemandCurve,
                    scenarioMeta,
                    operatingPoints: scenarioOperatingPoints,
                    scenarioOrder: availableScenarioKeys,
                    scenarioStyles
                  }}
                />
              </div>
              {renderScenarioOperatingTable()}
            </>
          )
        }

        return <div className="empty-state">No sensitivity data available for the current configuration.</div>
      }

      if (curves) {
        return (
          <CurvePlot
            {...scenarioPlotProps}
            curves={curves}
            iprData={null}
            showIPR={false}
          />
        )
      }

      return <div className="empty-state">Adjust the configuration and wait for the curves to load.</div>
    }

    if (!combinedCurves) {
      return <div className="empty-state">Configure at least one pump to generate the system curves.</div>
    }

    const hasIndividual = individualCurves.length > 1

    return (
      <>
        <div className="panel-card panel-card--no-padding">
          {hasIndividual && (
            <div className="subtabs-header">
              <button
                className={`subtab-button ${pumpCurvesTab === 'combined' ? 'active' : ''}`}
                onClick={() => setPumpCurvesTab('combined')}
              >
                Combined System
              </button>
              <button
                className={`subtab-button ${pumpCurvesTab === 'efficiency' ? 'active' : ''}`}
                onClick={() => setPumpCurvesTab('efficiency')}
              >
                Efficiency
              </button>
              <button
                className={`subtab-button ${pumpCurvesTab === 'head' ? 'active' : ''}`}
                onClick={() => setPumpCurvesTab('head')}
              >
                Head (TDH)
              </button>
              <button
                className={`subtab-button ${pumpCurvesTab === 'bhp' ? 'active' : ''}`}
                onClick={() => setPumpCurvesTab('bhp')}
              >
                Power (BHP)
              </button>
            </div>
          )}
          <div className="subtab-content">
            {(!hasIndividual || pumpCurvesTab === 'combined') && (
              <CurvePlot
                {...scenarioPlotProps}
                curves={combinedCurves}
                iprData={null}
                showIPR={false}
              />
            )}
            {hasIndividual && pumpCurvesTab === 'efficiency' && (
              <CurvePlot
                {...scenarioPlotProps}
                curves={null}
                isIndividualEfficiency={true}
                individualEfficiencyData={individualCurves}
              />
            )}
            {hasIndividual && pumpCurvesTab === 'head' && (
              <CurvePlot
                {...scenarioPlotProps}
                curves={null}
                isIndividualHead={true}
                individualHeadData={individualCurves}
                iprData={null}
                showIPR={false}
              />
            )}
            {hasIndividual && pumpCurvesTab === 'bhp' && (
              <CurvePlot
                {...scenarioPlotProps}
                curves={null}
                isIndividualBhp={true}
                individualBhpData={individualCurves}
              />
            )}
          </div>
        </div>
        {renderScenarioOperatingTable()}
      </>
    )
  }

  const renderIprContent = (): React.ReactNode => {
    if (!showIPR) {
      return <div className="empty-state">Enable “Show IPR” to display the well inflow curve.</div>
    }

    if (loading) {
      return <div className="empty-state">Loading IPR results…</div>
    }

    if (!iprData) {
      return <div className="empty-state">Adjust the IPR parameters to calculate the inflow curve.</div>
    }

    return (
      <CurvePlot
        {...scenarioPlotProps}
        curves={null}
        isIPRMode={true}
        iprData={iprData}
        showIPR={true}
        pumpCurves={numPumpsDesign > 1 ? combinedCurves : curves}
        hideDemandWithinIPR={true}
      />
    )
  }

  const renderDemandContent = (): React.ReactNode => {
    if (!showIPR) {
      return <div className="empty-state">Enable “Show IPR” to display the system demand curve.</div>
    }

    if (loading) {
      return <div className="empty-state">Loading demand curves…</div>
    }

    const hasDemandData =
      (pressureDemandCurve && Array.isArray(pressureDemandCurve.curve) && pressureDemandCurve.curve.length > 0) ||
      Object.values(pressureDemandScenarios || {}).some(
        (scenario: any) => Array.isArray(scenario?.curve) && scenario.curve.length > 0
      )

    if (!hasDemandData) {
      return <div className="empty-state">Run the IPR calculation to generate the system demand curve.</div>
    }

    return (
      <CurvePlot
        {...scenarioPlotProps}
        curves={null}
        isDemandMode={true}
      />
    )
  }

  return (
    <div className="app">
      <h1>🔧 BES Pump Performance Curves</h1>
      <div className="layout-two-column">
        <aside className="config-panel">
          <div className="global-toggles">
            <label
              className={`checkbox-label toggle-chip ${isComparisonMode ? 'toggle-chip--active' : ''}`}
            >
              <input
                type="checkbox"
                checked={isComparisonMode}
                onChange={(event) => setIsComparisonMode(event.target.checked)}
              />
              <span>Comparison Mode</span>
            </label>
            <label
              className={`checkbox-label toggle-chip ${showIPR ? 'toggle-chip--ipr-active' : ''}`}
            >
              <input
                type="checkbox"
                checked={showIPR}
                onChange={(event) => setShowIPR(event.target.checked)}
              />
              <span>📈 Show IPR</span>
            </label>
            <label
              className={`checkbox-label toggle-chip ${showSensitivity ? 'toggle-chip--active' : ''}`}
              title={!showIPR ? 'Enable “Show IPR” to access sensitivity overlays' : undefined}
              style={!showIPR ? { opacity: 0.6, cursor: 'not-allowed' } : undefined}
            >
              <input
                type="checkbox"
                checked={showSensitivity}
                onChange={(event) => setShowSensitivity(event.target.checked)}
                disabled={!showIPR}
              />
              <span>🎯 Sensitivity</span>
            </label>
          </div>
          <div className="config-tabs">
            <div className="config-tabs-header">
              <button
                className={`config-tab-button ${configTab === 'pump' ? 'active' : ''}`}
                onClick={() => setConfigTab('pump')}
              >
                Pump Configuration
              </button>
              <button
                className={`config-tab-button ${configTab === 'installation' ? 'active' : ''}`}
                onClick={() => setConfigTab('installation')}
              >
                Installation Parameters
              </button>
              <button
                className={`config-tab-button ${configTab === 'ipr' ? 'active' : ''}`}
                onClick={() => setConfigTab('ipr')}
              >
                IPR Configuration
              </button>
            </div>
            <div className="config-tab-body">
              {configTab === 'pump' && renderPumpConfiguration()}
              {configTab === 'installation' && renderInstallationConfiguration()}
              {configTab === 'ipr' && renderIprConfiguration()}
            </div>
          </div>
        </aside>
        <section className="visual-panel">
          {error && <div className="error">❌ {error}</div>}
          {loading && <div className="loading">⏳ Loading data…</div>}
          <div className="tabs-container visual-tabs">
            <div className="tabs-header visual-tabs-header">
              <button
                className={`tab-button ${visualTab === 'curves' ? 'active' : ''}`}
                onClick={() => setVisualTab('curves')}
              >
                <span className="tab-icon">📊</span>
                <span>Pump Curves</span>
              </button>
              <button
                className={`tab-button ${visualTab === 'ipr' ? 'active' : ''}`}
                onClick={() => setVisualTab('ipr')}
                disabled={!showIPR}
                title={!showIPR ? 'Enable “Show IPR” to access this view' : undefined}
              >
                <span className="tab-icon">🛢️</span>
                <span>IPR</span>
              </button>
              <button
                className={`tab-button ${visualTab === 'demand' ? 'active' : ''}`}
                onClick={() => setVisualTab('demand')}
                disabled={!showIPR}
                title={!showIPR ? 'Enable “Show IPR” to access this view' : undefined}
              >
                <span className="tab-icon">📐</span>
                <span>Demand Curve</span>
              </button>
            </div>
            <div className="tab-content visual-tab-content">
              <div className={`tab-panel ${visualTab === 'curves' ? 'active' : ''}`}>
                {renderPumpCurvesContent()}
              </div>
              <div className={`tab-panel ${visualTab === 'ipr' ? 'active' : ''}`}>
                {renderIprContent()}
              </div>
              <div className={`tab-panel ${visualTab === 'demand' ? 'active' : ''}`}>
                {renderDemandContent()}
              </div>
            </div>
          </div>
        </section>
      </div>
      <ScenarioSensitivityModal
        open={sensitivityEnabled && openScenarioKey !== null}
        scenarioKey={openScenarioKey}
        scenarioLabel={openScenarioKey ? scenarioStyles?.[openScenarioKey]?.label : undefined}
        values={openScenarioKey ? scenarioDisplayValues?.[openScenarioKey] : null}
        onClose={closeScenarioModal}
        onSave={handleScenarioOverrideSave}
      />
    </div>
  )
}
