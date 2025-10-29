// @ts-nocheck
import React, { useEffect, useMemo, useRef, useState } from 'react'
import axios from 'axios'
import * as XLSX from 'xlsx'
import PumpSelector from './components/PumpSelector'
import CurveControls from './components/CurveControls'
import CurvePlot from './components/CurvePlot'
import IPRControls from './components/IPRControls'
import InstallationControls from './components/InstallationControls'
import ScenarioSensitivityModal from './components/ScenarioSensitivityModal'
import PumpManagerModal from './components/PumpManagerModal'

const DEFAULT_SCENARIO_ORDER = ['optimistic', 'conservative', 'pessimistic']
const DEFAULT_SCENARIO_STYLES = {
  optimistic: { label: 'Optimistic', color: '#2ecc71', dash: 'solid', symbol: 'circle' },
  conservative: { label: 'Conservative', color: '#3498db', dash: 'dash', symbol: 'diamond' },
  pessimistic: { label: 'Pessimistic', color: '#e74c3c', dash: 'dot', symbol: 'triangle-up' }
}
const FALLBACK_SCENARIO_STYLE = { label: 'System Demand', color: '#c0392b', dash: 'dot', symbol: 'star' }

const DEFAULT_MOTOR_ID = 'N406AM130 2400V SGL'
const DEFAULT_MLE_CABLE_ID = 'awg_6'
const DEFAULT_DOWNHOLE_CABLE_ID = 'awg_4'
const DEFAULT_SURFACE_CABLE_ID = 'awg_4'
const DEFAULT_MLE_LENGTH_METERS = 20
const DEFAULT_SURFACE_LENGTH_METERS = 70

type ScenarioOverride = {
  freq?: number
  qTest?: number
  pwfTest?: number
}

type ScenarioDisplayValues = {
  freq: number
  qTest: number
  pwfTest: number
  lockFlow?: boolean
  lockPwf?: boolean
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

const toFiniteNumber = (value: any) =>
  typeof value === 'number' && Number.isFinite(value) ? Number(value) : null

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
  const selectedRef = useRef<string | null>(null)
  const [individualCurves, setIndividualCurves] = useState<any[]>([])

  const [motorCatalog, setMotorCatalog] = useState<any[]>([])
  const [motorIdKey, setMotorIdKey] = useState<string>('Tipo')
  const [motorLabelKey, setMotorLabelKey] = useState<string | null>(null)
  const [selectedMotorId, setSelectedMotorId] = useState<string | null>(DEFAULT_MOTOR_ID)

  const [cableCatalog, setCableCatalog] = useState<any[]>([])
  const [selectedCableMle, setSelectedCableMle] = useState<string | null>(DEFAULT_MLE_CABLE_ID)
  const [selectedCableFondo, setSelectedCableFondo] = useState<string | null>(DEFAULT_DOWNHOLE_CABLE_ID)
  const [selectedCableSuperficie, setSelectedCableSuperficie] = useState<string | null>(DEFAULT_SURFACE_CABLE_ID)
  const [mleLengthMeters, setMleLengthMeters] = useState<number>(DEFAULT_MLE_LENGTH_METERS)
  const [surfaceLengthMeters, setSurfaceLengthMeters] = useState<number>(DEFAULT_SURFACE_LENGTH_METERS)

  const [tempSuperficieGrad, setTempSuperficieGrad] = useState<number>(15)
  const [gradienteTemperatura, setGradienteTemperatura] = useState<number>(0.0425)
  const [tempAmbienteSuperficie, setTempAmbienteSuperficie] = useState<number>(25)

  const [isPumpManagerOpen, setPumpManagerOpen] = useState(false)
  
  // Estado para controlar pestañas
  const [configTab, setConfigTab] = useState<'motor' | 'cable' | 'pump' | 'installation' | 'ipr'>('motor')
  const [visualTab, setVisualTab] = useState<'curves' | 'ipr' | 'demand' | 'electrical'>('curves')
  const [pumpCurvesTab, setPumpCurvesTab] = useState<'combined' | 'efficiency' | 'head' | 'bhp'>('combined')
  
  // Estados para modo comparador
  const [isComparisonMode, setIsComparisonMode] = useState(false)
  const [numPumpsToCompare, setNumPumpsToCompare] = useState(2)
  const [curveTypeToCompare, setCurveTypeToCompare] = useState<'head' | 'bhp' | 'efficiency'>('head')
  
  // Estados para cada bomba en el comparador (hasta 5 bombas)
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

  const [pump4, setPump4] = useState<string | null>(null)
  const [pump4Freq, setPump4Freq] = useState(50)
  const [pump4Stages, setPump4Stages] = useState(300)
  const [pump4MultiFreq, setPump4MultiFreq] = useState(false)
  const [pump4Curves, setPump4Curves] = useState<any>(null)

  const [pump5, setPump5] = useState<string | null>(null)
  const [pump5Freq, setPump5Freq] = useState(50)
  const [pump5Stages, setPump5Stages] = useState(300)
  const [pump5MultiFreq, setPump5MultiFreq] = useState(false)
  const [pump5Curves, setPump5Curves] = useState<any>(null)

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
  const [electricalData, setElectricalData] = useState<any>(null)
  const [scenarioElectricalData, setScenarioElectricalData] = useState<Record<string, any>>({})

  const motorCatalogById = useMemo(() => {
    const mapping: Record<string, any> = {}
    motorCatalog.forEach((entry: any) => {
      const idValue = entry?.[motorIdKey]
      if (idValue !== undefined && idValue !== null) {
        mapping[String(idValue).trim()] = entry
      }
    })
    return mapping
  }, [motorCatalog, motorIdKey])

  const selectedMotorEntry = selectedMotorId ? motorCatalogById[selectedMotorId] : null

  const cableCatalogById = useMemo(() => {
    const mapping: Record<string, any> = {}
    cableCatalog.forEach((entry: any) => {
      const idValue = entry?.id ?? entry?.name ?? entry?.Tipo
      if (idValue !== undefined && idValue !== null) {
        mapping[String(idValue).trim()] = entry
      }
    })
    return mapping
  }, [cableCatalog])

  const selectedCableMleEntry = selectedCableMle ? cableCatalogById[selectedCableMle] : null
  const selectedCableFondoEntry = selectedCableFondo ? cableCatalogById[selectedCableFondo] : null
  const selectedCableSuperficieEntry = selectedCableSuperficie ? cableCatalogById[selectedCableSuperficie] : null

  const scenarioOverridesForIpr = useMemo(() => {
    const filtered: Record<string, ScenarioOverride> = {}

    Object.entries(scenarioOverrides || {}).forEach(([key, override]) => {
      if (!override) return

      const entry: ScenarioOverride = {}

      if (typeof override.qTest === 'number' && Number.isFinite(override.qTest)) {
        entry.qTest = override.qTest
      }

      if (typeof override.pwfTest === 'number' && Number.isFinite(override.pwfTest)) {
        entry.pwfTest = override.pwfTest
      }

      if (Object.keys(entry).length > 0) {
        filtered[key] = entry
      }
    })

    return filtered
  }, [scenarioOverrides])

  const scenarioOverridesForIprSignature = useMemo(
    () => JSON.stringify(scenarioOverridesForIpr),
    [scenarioOverridesForIpr]
  )

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

  const hasElectricalResults = Boolean(electricalData) || Object.keys(scenarioElectricalData || {}).length > 0

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

      const entry: ScenarioOverride = {}

      if (Number.isFinite(values.freq)) {
        entry.freq = values.freq
      }

      if (values.lockFlow && Number.isFinite(values.qTest)) {
        entry.qTest = values.qTest
      }

      if (values.lockPwf && Number.isFinite(values.pwfTest)) {
        entry.pwfTest = values.pwfTest
      }

      if (Object.keys(entry).length > 0) {
        next[scenarioKey] = entry
      } else {
        delete next[scenarioKey]
        return next
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

  const serializeOverrides = (overrides: Record<string, ScenarioOverride>) => {
    const result: Record<string, any> = {}
    Object.entries(overrides || {}).forEach(([key, override]) => {
      if (!override) return
      const entry: Record<string, number> = {}
      if (typeof override.qTest === 'number' && Number.isFinite(override.qTest)) {
        entry.q_test = override.qTest
      }
      if (typeof override.pwfTest === 'number' && Number.isFinite(override.pwfTest)) {
        entry.pwf_test = override.pwfTest
      }
      if (typeof override.freq === 'number' && Number.isFinite(override.freq)) {
        entry.frequency_hz = override.freq
      }
      if (Object.keys(entry).length > 0) {
        result[key] = entry
      }
    })
    return result
  }

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

      const hasOverrideFlow = typeof override.qTest === 'number' && Number.isFinite(override.qTest)
      const hasDefinitionFlow = typeof definitionOverride.q_test === 'number' && Number.isFinite(definitionOverride.q_test)

      let qValue = hasOverrideFlow ? override.qTest : undefined
      if (qValue === undefined && typeof definitionOverride.q_test === 'number') {
        qValue = definitionOverride.q_test
      }

      const hasOverridePwf = typeof override.pwfTest === 'number' && Number.isFinite(override.pwfTest)
      const hasDefinitionPwf = typeof definitionOverride.pwf_test === 'number' && Number.isFinite(definitionOverride.pwf_test)

      let pwfValue = hasOverridePwf ? override.pwfTest : undefined
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
        pwfTest: typeof pwfValue === 'number' && Number.isFinite(pwfValue) ? pwfValue : pwfTest,
        lockFlow: hasOverrideFlow || hasDefinitionFlow,
        lockPwf: hasOverridePwf || hasDefinitionPwf
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

            const motorQuery = selectedMotorId ? `&motor_id=${encodeURIComponent(selectedMotorId)}` : ''
            const url = `/api/pumps/${encodeURIComponent(selected)}/curves?freq=${targetFrequency}&stages=${stages}&points=${points}${motorQuery}`
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
    points,
    selectedMotorId
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
      const manualFlow = toFiniteNumber(displayValues?.qTest)
      const manualPwf = toFiniteNumber(displayValues?.pwfTest)
      const flowLocked = Boolean(displayValues?.lockFlow)
      const pwfLocked = Boolean(displayValues?.lockPwf)

      const intersectionFlow = toFiniteNumber(intersection?.q)
      const intersectionHeadCandidate = toFiniteNumber(intersection?.head)

      let targetFlow: number | null = null
      if (flowLocked && manualFlow !== null) {
        targetFlow = manualFlow
      } else if (intersectionFlow !== null) {
        targetFlow = intersectionFlow
      } else {
        targetFlow = manualFlow
      }

      if (targetFlow === null) {
        return
      }

  const hydraulicFlow = intersectionFlow ?? targetFlow
  const flowForPumpCurves = hydraulicFlow ?? targetFlow

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

  const pumpHeadAtFlow = toFiniteNumber(interpolateValue(pumpQ, pumpHead, flowForPumpCurves))
  const efficiency = interpolateFromSeries(efficiencySeries, flowForPumpCurves)
  const bhp = interpolateFromSeries(bhpSeries, flowForPumpCurves)

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

      const demandHeadAtFlow = toFiniteNumber(interpolateValue(demandQ, demandHead, hydraulicFlow))
      const pip = interpolateFromSeries(pipSeries, hydraulicFlow)
      const pwfFromDemand = interpolateFromSeries(pwfSeries, hydraulicFlow)
      const nivel = interpolateFromSeries(nivelSeries, hydraulicFlow)
      const friction = interpolateFromSeries(frictionSeries, hydraulicFlow)


      // Usar la Pwf del punto de intersección salvo override explícito
      const intersectionPwf = intersectionFlow !== null
        ? toFiniteNumber(interpolateFromSeries(pwfSeries, intersectionFlow))
        : null;

      // Si el usuario bloqueó Pwf, usar el override; si no, usar la Pwf de la intersección
      const pwfValue = pwfLocked && manualPwf !== null
        ? manualPwf
        : intersectionPwf;

      const demandHeadAtIntersection = intersectionFlow !== null
        ? toFiniteNumber(interpolateValue(demandQ, demandHead, intersectionFlow))
        : null;
      const pumpHeadAtIntersection = intersectionFlow !== null
        ? toFiniteNumber(interpolateValue(pumpQ, pumpHead, intersectionFlow))
        : null;
      const intersectionHeadValue =
        intersectionHeadCandidate
        ?? demandHeadAtIntersection
        ?? pumpHeadAtIntersection;

      const components = demandSource.components || {};
      const gradient = typeof components.gradiente === 'number'
        ? components.gradiente
        : (typeof pressureDemandCurve?.components?.gradiente === 'number'
          ? pressureDemandCurve.components.gradiente
          : null);

      const pumpDepth = typeof components.profundidad_bomba === 'number'
        ? components.profundidad_bomba
        : (typeof pressureDemandCurve?.components?.profundidad_bomba === 'number'
          ? pressureDemandCurve.components.profundidad_bomba
          : null);

      let submergence: number | null = null;
      // Siempre recalcular submergence y fluidLevel con la Pwf actual del punto de intersección
      if (typeof gradient === 'number' && gradient > 0 && typeof intersectionPwf === 'number') {
        const rawSub = intersectionPwf / gradient;
        if (Number.isFinite(rawSub)) {
          submergence = Math.max(rawSub, 0);
        }
      }

      let fluidLevel: number | null = null;
      if (typeof pumpDepth === 'number' && typeof submergence === 'number') {
        const rawLevel = pumpDepth - submergence;
        if (Number.isFinite(rawLevel)) {
          fluidLevel = Math.min(Math.max(rawLevel, 0), pumpDepth);
        }
      }

      const frequency = scenarioMeta?.[scenarioKey]?.frequency
        ?? displayValues?.freq
        ?? freq;

      const headValue = demandHeadAtFlow !== null
        ? demandHeadAtFlow
        : (pumpHeadAtFlow !== null ? pumpHeadAtFlow : intersectionHeadValue)

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
        frequency,
        intersectionFlow,
        intersectionHead: intersectionHeadValue,
        intersectionPwf
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
    selectedRef.current = selected
  }, [selected])

  const loadPumpCatalog = React.useCallback(async (options?: { preserveSelection?: boolean }) => {
    try {
      const response = await axios.get('/api/pumps')
      const list = Array.isArray(response.data) ? response.data : []

      if (list.length === 0) {
        setPumps([])
        if (!options?.preserveSelection) {
          setSelected(null)
        }
        return
      }

      const idKey = equipmentIdKey(list)
      const pumpIds = list
        .map((item: any) => item?.[idKey])
        .filter((value: any) => typeof value === 'string' && value.trim().length > 0)

      setPumps(pumpIds)

      const currentSelected = selectedRef.current
      const shouldPreserve = Boolean(options?.preserveSelection)

      if (shouldPreserve && currentSelected && pumpIds.includes(currentSelected)) {
        return
      }

      if (shouldPreserve && currentSelected && !pumpIds.includes(currentSelected)) {
        const fallback = pumpIds[0] || null
        setSelected(fallback || null)
        return
      }

      if (currentSelected && pumpIds.includes(currentSelected)) {
        return
      }

      const defaultPump = pumpIds.find((pumpId: string) => pumpId === 'NHV760') || pumpIds[0] || null
      setSelected(defaultPump || null)
    } catch (catalogError) {
      console.error(catalogError)
    }
  }, [])

  useEffect(() => {
    loadPumpCatalog()
  }, [loadPumpCatalog])

  useEffect(() => {
    const loadEquipmentCatalogs = async () => {
      try {
        const response = await axios.get('/api/catalogs')
        const catalogs = response.data?.catalogs || {}

        const motors = Array.isArray(catalogs.motors) ? catalogs.motors : []
        setMotorCatalog(motors)
        if (motors.length > 0) {
          const descriptionKey = findEntryKey(motors[0], ['descripción', 'descripcion', 'Descripción', 'Descripcion'])
          const idKey = descriptionKey || equipmentIdKey(motors)
          setMotorIdKey(idKey)
          setMotorLabelKey(descriptionKey && descriptionKey !== idKey ? descriptionKey : null)

          const availableMotorIds = motors
            .map((entry: any) => entry?.[idKey])
            .filter((value: any) => value !== undefined && value !== null && String(value).trim().length > 0)
            .map((value: any) => String(value).trim())

          const normalizedDefaultMotor = normalizeIdentifier(DEFAULT_MOTOR_ID)
          const defaultMatch = availableMotorIds.find((candidate) => normalizeIdentifier(candidate) === normalizedDefaultMotor) || null

          setSelectedMotorId((prev) => {
            if (defaultMatch) {
              return defaultMatch
            }
            if (prev) {
              const normalizedPrev = normalizeIdentifier(prev)
              const prevMatch = availableMotorIds.find((candidate) => normalizeIdentifier(candidate) === normalizedPrev)
              if (prevMatch) {
                return prevMatch
              }
            }
            return availableMotorIds[0] || null
          })
        } else {
          setMotorIdKey('Descripción')
          setMotorLabelKey(null)
          setSelectedMotorId(DEFAULT_MOTOR_ID)
        }

        const cables = Array.isArray(catalogs.cables) ? catalogs.cables : []
        setCableCatalog(cables)
        if (cables.length > 0) {
          const availableCableIds = cables
            .map((entry: any) => entry?.id ?? entry?.name ?? entry?.Tipo)
            .filter((value: any) => value !== undefined && value !== null && String(value).trim().length > 0)
            .map((value: any) => String(value).trim())

          const fallbackCableId = availableCableIds[0] || null

          const defaultMleMatch = availableCableIds.find((candidate) => normalizeIdentifier(candidate) === normalizeIdentifier(DEFAULT_MLE_CABLE_ID)) || null
          const defaultDownholeMatch = availableCableIds.find((candidate) => normalizeIdentifier(candidate) === normalizeIdentifier(DEFAULT_DOWNHOLE_CABLE_ID)) || null
          const defaultSurfaceMatch = availableCableIds.find((candidate) => normalizeIdentifier(candidate) === normalizeIdentifier(DEFAULT_SURFACE_CABLE_ID)) || null

          setSelectedCableMle((prev) => {
            if (defaultMleMatch) {
              return defaultMleMatch
            }
            if (prev) {
              const prevMatch = availableCableIds.find((candidate) => normalizeIdentifier(candidate) === normalizeIdentifier(prev))
              if (prevMatch) {
                return prevMatch
              }
            }
            return fallbackCableId
          })

          setSelectedCableFondo((prev) => {
            if (defaultDownholeMatch) {
              return defaultDownholeMatch
            }
            if (prev) {
              const prevMatch = availableCableIds.find((candidate) => normalizeIdentifier(candidate) === normalizeIdentifier(prev))
              if (prevMatch) {
                return prevMatch
              }
            }
            return fallbackCableId
          })

          setSelectedCableSuperficie((prev) => {
            if (defaultSurfaceMatch) {
              return defaultSurfaceMatch
            }
            if (prev) {
              const prevMatch = availableCableIds.find((candidate) => normalizeIdentifier(candidate) === normalizeIdentifier(prev))
              if (prevMatch) {
                return prevMatch
              }
            }
            return fallbackCableId
          })
        } else {
          setSelectedCableMle(DEFAULT_MLE_CABLE_ID)
          setSelectedCableFondo(DEFAULT_DOWNHOLE_CABLE_ID)
          setSelectedCableSuperficie(DEFAULT_SURFACE_CABLE_ID)
        }
      } catch (catalogError) {
        console.error('Error loading equipment catalogs:', catalogError)
      }
    }

    loadEquipmentCatalogs()
  }, [])

  const handlePumpCatalogChanged = React.useCallback(async () => {
    await loadPumpCatalog({ preserveSelection: true })
  }, [loadPumpCatalog])

  const handlePumpSelectedFromManager = React.useCallback((pumpId: string) => {
    setSelected(pumpId)
    setPumpManagerOpen(false)
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
    const preferred = ['Tipo', 'Tipo bomba', 'Tipo motor', 'Bomba', 'Modelo', 'Pump', 'Nombre']
    for (const key of preferred) {
      if (key in sample && sample[key] !== undefined && sample[key] !== null && String(sample[key]).trim() !== '') {
        return key
      }
    }

    const nonIdKeys = Object.keys(sample).filter((key) => key !== 'id' && sample[key] !== undefined && sample[key] !== null)
    if (nonIdKeys.length > 0) {
      return nonIdKeys[0]
    }

    return 'id' in sample ? 'id' : Object.keys(sample)[0]
  }

  function pickEntryValue(entry: any, candidates: string[]) {
    if (!entry || typeof entry !== 'object') {
      return undefined
    }
    const lowered: Record<string, string> = {}
    Object.keys(entry).forEach((key) => {
      lowered[key.toLowerCase()] = key
    })
    for (const candidate of candidates || []) {
      if (!candidate) continue
      const actualKey = lowered[candidate.toLowerCase()]
      if (actualKey !== undefined) {
        return entry[actualKey]
      }
    }
    return undefined
  }

  function findEntryKey(entry: any, candidates: string[]) {
    if (!entry || typeof entry !== 'object') {
      return null
    }
    const lowered: Record<string, string> = {}
    Object.keys(entry).forEach((key) => {
      lowered[key.toLowerCase()] = key
    })
    for (const candidate of candidates || []) {
      if (!candidate) continue
      const actualKey = lowered[candidate.toLowerCase()]
      if (actualKey !== undefined) {
        return actualKey
      }
    }
    return null
  }

  function formatNumericValue(value: any, digits = 2) {
    const numeric = Number(value)
    if (Number.isFinite(numeric)) {
      return numeric.toFixed(digits)
    }
    if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) {
      return '—'
    }
    return String(value)
  }

  function normalizeIdentifier(value: any) {
    if (value === undefined || value === null) {
      return ''
    }
    return String(value).trim().replace(/\s+/g, ' ').toLowerCase()
  }

  async function fetchCurves() {
    if (!selected) return
    setLoading(true)
    setError(null)
    try {
      const motorQuery = selectedMotorId ? `&motor_id=${encodeURIComponent(selectedMotorId)}` : ''
      const res = await axios.get(`/api/pumps/${encodeURIComponent(selected)}/curves?freq=${freq}&stages=${stages}&points=${points}${motorQuery}`)
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

      const motorQuery = selectedMotorId ? `&motor_id=${encodeURIComponent(selectedMotorId)}` : ''
      const promises = frequencies.map(f => 
        axios.get(`/api/pumps/${encodeURIComponent(selected)}/curves?freq=${f}&stages=${stages}&points=${points}${motorQuery}`)
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
      const motorQuery = selectedMotorId ? `&motor_id=${encodeURIComponent(selectedMotorId)}` : ''
      const promises = selectedPumps.map(pump =>
        axios.get(`/api/pumps/${encodeURIComponent(pump.id!)}/curves?freq=${freq}&stages=${pump.stages}&points=${points}${motorQuery}`)
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
        
        const motorQuery = selectedMotorId ? `&motor_id=${encodeURIComponent(selectedMotorId)}` : ''
        const promises = frequencies.map(f =>
          axios.get(`/api/pumps/${encodeURIComponent(pumpId)}/curves?freq=${f}&stages=${stagesCount}&points=${points}${motorQuery}`)
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
        const motorQuery = selectedMotorId ? `&motor_id=${encodeURIComponent(selectedMotorId)}` : ''
        const res = await axios.get(`/api/pumps/${encodeURIComponent(pumpId)}/curves?freq=${frequency}&stages=${stagesCount}&points=${points}${motorQuery}`)
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

    if (!selected) {
      setError('Select a pump before running the calculation.')
      return
    }

    if (!selectedMotorId) {
      setError('Select a motor before running the calculation.')
      return
    }

    if (!selectedCableMle || !selectedCableFondo || !selectedCableSuperficie) {
      setError('Select cable types for MLE, downhole, and surface sections before running the calculation.')
      return
    }

    const normalizedMleLength = Number.isFinite(mleLengthMeters) ? Math.max(mleLengthMeters, 0) : 0
    const normalizedSurfaceLength = Number.isFinite(surfaceLengthMeters) ? Math.max(surfaceLengthMeters, 0) : 0

    setLoading(true)
    setError(null)
    setElectricalData(null)
    setScenarioElectricalData({})
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

      const overridesPayload = sensitivityEnabled
        ? serializeOverrides(scenarioOverridesForIpr)
        : {}

      if (sensitivityEnabled && Object.keys(overridesPayload).length > 0) {
        wellData.sensitivity_overrides = overridesPayload
      }

      const pumpConfigPayload: any = {
        pump_id: selected,
        stages,
        stages_count: stages,
        frequency_hz: freq,
        num_pumps_design: numPumpsDesign
      }

      const designPumpPayload = designPumps
        .slice(0, numPumpsDesign)
        .filter((item) => item && item.id)
        .map((item) => ({ pump_id: item.id, stages: item.stages }))

      if (designPumpPayload.length > 0) {
        pumpConfigPayload.design_pumps = designPumpPayload
      }

      const motorConfigPayload = {
        motor_id: selectedMotorId
      }

      const cableConfigPayload = {
        mle_tipo_id: selectedCableMle,
        mle_longitud: normalizedMleLength,
        fondo_tipo_id: selectedCableFondo,
        superficie_tipo_id: selectedCableSuperficie,
        superficie_longitud: normalizedSurfaceLength
      }

      const configuracionPozoPayload = {
        temp_superficie_grad: tempSuperficieGrad,
        gradiente_temp: gradienteTemperatura,
        temp_ambiente_superficie: tempAmbienteSuperficie
      }

      const requestPayload: any = {
        well_data: wellData,
        pump_config: pumpConfigPayload,
        motor_config: motorConfigPayload,
        cable_config: cableConfigPayload,
        configuracion_pozo: configuracionPozoPayload
      }

      if (sensitivityEnabled && Object.keys(overridesPayload).length > 0) {
        requestPayload.sensitivity_overrides = overridesPayload
      }

      const res = await axios.post('/api/calculate_conditions', requestPayload)
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

        const nextScenarioOrder = Array.isArray(payload.scenario_order) && payload.scenario_order.length > 0
          ? payload.scenario_order
          : DEFAULT_SCENARIO_ORDER

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

        const baseCurve = payload.pressure_demand_curve || null
        const serverScenarioCurvesRaw = payload.pressure_demand_scenarios || {}
        const serverIprScenariosRaw = payload.ipr_scenarios || {}

        const normalizedIprScenarios: Record<string, any> = {}
        const scenarioElectricalMap: Record<string, any> = {}
        const combinedScenarioCurves: Record<string, any> = { ...serverScenarioCurvesRaw }

        Object.entries(serverIprScenariosRaw || {}).forEach(([key, value]) => {
          if (!key || !value) return
          if (typeof value === 'object') {
            const entry: any = value
            const iprSource = entry.ipr || entry
            if (iprSource) {
              normalizedIprScenarios[key] = cloneCurve(iprSource)
            }
            if (entry.electrical_data) {
              scenarioElectricalMap[key] = entry.electrical_data
            }
            if (entry.pressure_demand_curve) {
              combinedScenarioCurves[key] = entry.pressure_demand_curve
            }
          } else {
            normalizedIprScenarios[key] = value
          }
        })

        if (payload.electrical_scenarios) {
          Object.entries(payload.electrical_scenarios).forEach(([key, value]) => {
            if (!key || !value) return
            scenarioElectricalMap[key] = value
          })
        }

        setElectricalData(payload.electrical_data || null)
        setScenarioElectricalData(scenarioElectricalMap)

        const allScenarioKeys = new Set<string>([...nextScenarioOrder, ...DEFAULT_SCENARIO_ORDER])
        Object.keys(combinedScenarioCurves || {}).forEach((key) => allScenarioKeys.add(key))
        Object.keys(normalizedIprScenarios || {}).forEach((key) => allScenarioKeys.add(key))
        Object.keys(scenarioOverridesForIpr || {}).forEach((key) => allScenarioKeys.add(key))

        const nextScenarioCurves: Record<string, any> = {}
        allScenarioKeys.forEach((key) => {
          if (!key) return
          if (!normalizedIprScenarios[key] && payload.ipr_data) {
            normalizedIprScenarios[key] = cloneCurve(payload.ipr_data)
          }
          const serverCurve = combinedScenarioCurves?.[key]
          const sourceCurve = serverCurve || baseCurve
          if (sourceCurve) {
            nextScenarioCurves[key] = cloneCurve(sourceCurve)
          }
        })

        setScenarioOrder(nextScenarioOrder)
        setScenarioDefinitions(payload.scenario_definitions || {})
        setIprScenarios(normalizedIprScenarios)
        setPressureDemandCurve(baseCurve)
        setPressureDemandScenarios(nextScenarioCurves)

        setScenarioVisibility((prev) => {
          const nextVisibility: Record<string, boolean> = { ...prev }

          allScenarioKeys.forEach((key) => {
            if (nextVisibility[key] === undefined) {
              nextVisibility[key] = key === 'conservative'
            }
          })

          Object.keys(nextVisibility).forEach((key) => {
            if (!allScenarioKeys.has(key)) {
              delete nextVisibility[key]
            }
          })

          if (!Object.values(nextVisibility).some(Boolean) && allScenarioKeys.size > 0) {
            const fallbackKey = allScenarioKeys.has('conservative')
              ? 'conservative'
              : Array.from(allScenarioKeys)[0]
            if (fallbackKey) {
              nextVisibility[fallbackKey] = true
            }
          }

          return nextVisibility
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
    // Parámetros eléctricos y selección de motor/cable
    freq,
    stages,
    selectedMotorId,
    selectedCableMle,
    selectedCableFondo,
    selectedCableSuperficie,
    mleLengthMeters,
    surfaceLengthMeters,
    tempSuperficieGrad,
    gradienteTemperatura,
    tempAmbienteSuperficie,
    // IMPORTANTE: Recalcular cuando cambia el número de bombas
    numPumpsDesign,
    designPumps,
    scenarioOverridesForIprSignature
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
    if (numPumpsToCompare >= 4 && pump4) {
      promises.push(fetchPumpCurves(pump4, pump4Freq, pump4Stages, pump4MultiFreq, setPump4Curves))
    }
    if (numPumpsToCompare >= 5 && pump5) {
      promises.push(fetchPumpCurves(pump5, pump5Freq, pump5Stages, pump5MultiFreq, setPump5Curves))
    }
    
    Promise.all(promises).finally(() => setLoading(false))
  }, [
    isComparisonMode,
    pump1, pump1Freq, pump1Stages, pump1MultiFreq,
    pump2, pump2Freq, pump2Stages, pump2MultiFreq,
  pump3, pump3Freq, pump3Stages, pump3MultiFreq,
  pump4, pump4Freq, pump4Stages, pump4MultiFreq,
  pump5, pump5Freq, pump5Stages, pump5MultiFreq,
  numPumpsToCompare,
    points, minFreq, maxFreq, numCurves,
    selectedMotorId
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
  }, [selected, freq, stages, points, isMultiFreq, minFreq, maxFreq, numCurves, selectedMotorId])

  // Auto-fetch combined curves in design mode
  useEffect(() => {
    if (!isComparisonMode && numPumpsDesign > 1) {
      fetchCombinedCurves()
    }
  }, [numPumpsDesign, designPumps, freq, points, isComparisonMode, selectedMotorId])

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
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto auto',
            gap: '12px',
            alignItems: 'flex-end'
          }}
        >
          <PumpSelector pumps={pumps} value={selected} onChange={setSelected} />
          <button
            type="button"
            className="panel-action-button panel-action-button--ghost pump-manager-trigger"
            onClick={() => setPumpManagerOpen(true)}
          >
            Gestionar bombas
          </button>
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
        <div className="multi-pump-grid pump-card-grid">
          {[...Array(numPumpsDesign)].map((_, idx) => (
            <div key={`design-pump-${idx}`} className="pump-card">
              <h4 className="pump-card__title">Pump {idx + 1}</h4>
              <label className="pump-card__field">
                <span className="pump-card__label">Select Pump</span>
                <select
                  className="pump-card__control"
                  value={designPumps[idx]?.id || ''}
                  onChange={(event) => {
                    const newPumps = [...designPumps]
                    newPumps[idx] = { ...newPumps[idx], id: event.target.value || null }
                    setDesignPumps(newPumps)
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
              <label className="pump-card__field">
                <span className="pump-card__label">Stages</span>
                <input
                  className="pump-card__control"
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
              <option value={4}>4 Pumps</option>
              <option value={5}>5 Pumps</option>
            </select>
          </label>
        </div>
      </div>
      <div className="panel-card">
        <h3 className="panel-heading">Pump Parameters</h3>
        {(() => {
          const pumpConfigs = [
            { pump: pump1, setPump: setPump1, freq: pump1Freq, setFreq: setPump1Freq, stages: pump1Stages, setStages: setPump1Stages, multiFreq: pump1MultiFreq, setMultiFreq: setPump1MultiFreq },
            { pump: pump2, setPump: setPump2, freq: pump2Freq, setFreq: setPump2Freq, stages: pump2Stages, setStages: setPump2Stages, multiFreq: pump2MultiFreq, setMultiFreq: setPump2MultiFreq },
            { pump: pump3, setPump: setPump3, freq: pump3Freq, setFreq: setPump3Freq, stages: pump3Stages, setStages: setPump3Stages, multiFreq: pump3MultiFreq, setMultiFreq: setPump3MultiFreq },
            { pump: pump4, setPump: setPump4, freq: pump4Freq, setFreq: setPump4Freq, stages: pump4Stages, setStages: setPump4Stages, multiFreq: pump4MultiFreq, setMultiFreq: setPump4MultiFreq },
            { pump: pump5, setPump: setPump5, freq: pump5Freq, setFreq: setPump5Freq, stages: pump5Stages, setStages: setPump5Stages, multiFreq: pump5MultiFreq, setMultiFreq: setPump5MultiFreq }
          ]
          const activePumpConfigs = pumpConfigs.slice(0, numPumpsToCompare)

          return (
            <div className="pump-card-grid pump-card-grid--comparison">
              {activePumpConfigs.map((pumpState, index) => (
                <div key={`comparison-pump-${index + 1}`} className="pump-card pump-card--comparison">
                  <h4 className="pump-card__title pump-card__title--centered">Pump {index + 1}</h4>
                  <label className="pump-card__field">
                    <span className="pump-card__label">Select Pump</span>
                    <select
                      className="pump-card__control"
                      value={pumpState.pump || ''}
                      onChange={(event) => pumpState.setPump(event.target.value || null)}
                    >
                      <option value="">-- Select --</option>
                      {pumps.map((pumpId) => (
                        <option key={pumpId} value={pumpId}>
                          {pumpId}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="checkbox-label pump-card__toggle">
                    <input
                      type="checkbox"
                      checked={pumpState.multiFreq}
                      onChange={(event) => pumpState.setMultiFreq(event.target.checked)}
                    />
                    <span>Multi-Frequency Mode</span>
                  </label>
                  {!pumpState.multiFreq && (
                    <label className="pump-card__field">
                      <span className="pump-card__label">Frequency (Hz)</span>
                      <input
                        className="pump-card__control"
                        type="number"
                        value={pumpState.freq}
                        onChange={(event) => pumpState.setFreq(Number(event.target.value))}
                        min={30}
                        max={70}
                        step={0.1}
                      />
                    </label>
                  )}
                  <label className="pump-card__field">
                    <span className="pump-card__label">Stages</span>
                    <input
                      className="pump-card__control"
                      type="number"
                      value={pumpState.stages}
                      onChange={(event) => pumpState.setStages(Number(event.target.value))}
                      min={1}
                      max={500}
                      step={1}
                    />
                  </label>
                </div>
              ))}
            </div>
          )
        })()}
      </div>
      {(() => {
        const pumpConfigs = [
          pump1MultiFreq,
          pump2MultiFreq,
          pump3MultiFreq,
          pump4MultiFreq,
          pump5MultiFreq
        ]
        const hasMultiFreq = pumpConfigs.slice(0, numPumpsToCompare).some(Boolean)
        if (!hasMultiFreq) {
          return null
        }
        return (
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
        )
      })()}
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

  const renderMotorConfiguration = (): React.ReactNode => {
    const hasCatalog = motorCatalog.length > 0

    const buildMotorLabel = (entry: any) => {
      if (!entry || typeof entry !== 'object') {
        return 'Unknown motor'
      }
      const idValue = entry?.[motorIdKey]
      const idText = idValue !== undefined && idValue !== null ? String(idValue) : 'Unknown motor'
      const descriptionCandidate = motorLabelKey ? entry?.[motorLabelKey] : pickEntryValue(entry, ['Descripción', 'Descripcion'])
      const descriptionText = descriptionCandidate !== undefined && descriptionCandidate !== null
        ? String(descriptionCandidate).trim()
        : ''
      return descriptionText || idText
    }

    return (
      <div className="panel-card">
        <label className="panel-field">
          <span>Motor</span>
          <select
            value={selectedMotorId ?? ''}
            onChange={(event) => {
              const nextValue = event.target.value ? event.target.value.trim() : null
              setSelectedMotorId(nextValue)
            }}
          >
            <option value="">Select a motor</option>
            {motorCatalog.map((entry: any, index: number) => {
              const idValue = entry?.[motorIdKey]
              if (idValue === undefined || idValue === null) {
                return null
              }
              const idText = String(idValue).trim()
              return (
                <option key={`${idText}-${index}`} value={idText}>
                  {buildMotorLabel(entry)}
                </option>
              )
            })}
          </select>
        </label>

        {!hasCatalog && (
          <div className="empty-state" style={{ marginTop: 12 }}>
            Motor catalog not available. Verify the backend catalogs endpoint.
          </div>
        )}

        {hasCatalog && !selectedMotorEntry && (
          <div className="empty-state" style={{ marginTop: 12 }}>
            Select a motor to view plate characteristics.
          </div>
        )}

        {selectedMotorEntry && (
          <>
            <div className="panel-grid">
              <div className="panel-field">
                <span>HP Nominal</span>
                <strong>{formatNumericValue(pickEntryValue(selectedMotorEntry, ['HP NOM', 'hp_nom', 'HP']), 0)}</strong>
              </div>
              <div className="panel-field">
                <span>Voltage Nominal</span>
                <strong>{formatNumericValue(pickEntryValue(selectedMotorEntry, ['VOLT NOM', 'volt_nom', 'Voltaje', 'VOLT']), 0)}</strong>
              </div>
              <div className="panel-field">
                <span>Current Nominal</span>
                <strong>{formatNumericValue(pickEntryValue(selectedMotorEntry, ['AMP NOM', 'amp_nom', 'Amperaje']), 1)}</strong>
              </div>
              <div className="panel-field">
                <span>Power Factor</span>
                <strong>{formatNumericValue(pickEntryValue(selectedMotorEntry, ['COS FI NOM', 'cos_fi_nom', 'Cos Fi']), 3)}</strong>
              </div>
              <div className="panel-field">
                <span>Efficiency</span>
                <strong>
                  {(() => {
                    const effRaw = pickEntryValue(selectedMotorEntry, ['EFF', 'eff'])
                    const effNumeric = Number(effRaw)
                    if (Number.isFinite(effNumeric)) {
                      return effNumeric <= 1.5 ? `${(effNumeric * 100).toFixed(1)} %` : `${effNumeric.toFixed(1)} %`
                    }
                    if (effRaw === undefined || effRaw === null || (typeof effRaw === 'string' && effRaw.trim() === '')) {
                      return '—'
                    }
                    return String(effRaw)
                  })()}
                </strong>
              </div>
              <div className="panel-field">
                <span>Frequency Nominal</span>
                <strong>{formatNumericValue(pickEntryValue(selectedMotorEntry, ['HZ NOM', 'hz_nom', 'Hz']), 0)}</strong>
              </div>
              <div className="panel-field">
                <span>Motor Type</span>
                <strong>{pickEntryValue(selectedMotorEntry, ['Tipo Motor', 'tipo_motor', 'Tipo']) || '—'}</strong>
              </div>
            </div>
            {selectedMotorEntry?.__warnings && Array.isArray(selectedMotorEntry.__warnings) && selectedMotorEntry.__warnings.length > 0 && (
              <div className="error" style={{ marginTop: 8 }}>
                <strong>Warnings:</strong>
                <ul>
                  {selectedMotorEntry.__warnings.map((warning: string, idx: number) => (
                    <li key={`motor-warning-${idx}`}>{warning}</li>
                  ))}
                </ul>
              </div>
            )}
            {selectedMotorEntry?.__is_complete === false && (
              <div className="panel-hint" style={{ marginTop: 8 }}>
                Some motor nameplate fields are missing; electrical calculations will include warnings.
              </div>
            )}
          </>
        )}
      </div>
    )
  }

  const renderCableConfiguration = (): React.ReactNode => {
    const cableOptions = cableCatalog.map((entry: any, index: number) => {
      const optionId = entry?.id ?? entry?.name ?? entry?.Tipo
      if (optionId === undefined || optionId === null) {
        return null
      }
      const valueText = String(optionId).trim()
      const display = entry?.name || entry?.Tipo || valueText
      return (
        <option key={`${valueText}-${index}`} value={valueText}>
          {display}
        </option>
      )
    })

    const renderCableCard = (label: string, entry: any) => (
      <div className="panel-field" key={label}>
        <span>{label}</span>
        <strong>{entry ? entry.name || entry.Tipo || entry.id || '—' : '—'}</strong>
        {entry && (
          <div style={{ fontSize: '0.85rem', color: '#9fb7ff', fontWeight: 500 }}>
            <div>R (20°C): {formatNumericValue(entry.r_ohm_km_20c, 4)} Ω/km</div>
            <div>Temp coeff: {formatNumericValue(entry.temp_coeff, 5)} 1/°C</div>
          </div>
        )}
      </div>
    )

    return (
      <div className="panel-card">
        <div className="panel-grid">
          <label className="panel-field">
            <span>MLE Cable Type</span>
            <select
              value={selectedCableMle ?? ''}
              onChange={(event) => {
                const nextValue = event.target.value ? event.target.value.trim() : null
                setSelectedCableMle(nextValue)
              }}
            >
              <option value="">Select cable</option>
              {cableOptions}
            </select>
          </label>
          <label className="panel-field">
            <span>MLE Length (m)</span>
            <input
              type="number"
              min={0}
              step={10}
              value={Number.isFinite(mleLengthMeters) ? mleLengthMeters : 0}
              onChange={(event) => {
                const value = Number(event.target.value)
                setMleLengthMeters(Number.isFinite(value) && value >= 0 ? value : 0)
              }}
            />
          </label>
          <label className="panel-field">
            <span>Downhole Cable Type</span>
            <select
              value={selectedCableFondo ?? ''}
              onChange={(event) => {
                const nextValue = event.target.value ? event.target.value.trim() : null
                setSelectedCableFondo(nextValue)
              }}
            >
              <option value="">Select cable</option>
              {cableOptions}
            </select>
          </label>
          <label className="panel-field">
            <span>Surface Cable Type</span>
            <select
              value={selectedCableSuperficie ?? ''}
              onChange={(event) => {
                const nextValue = event.target.value ? event.target.value.trim() : null
                setSelectedCableSuperficie(nextValue)
              }}
            >
              <option value="">Select cable</option>
              {cableOptions}
            </select>
          </label>
          <label className="panel-field">
            <span>Surface Cable Length (m)</span>
            <input
              type="number"
              min={0}
              step={10}
              value={Number.isFinite(surfaceLengthMeters) ? surfaceLengthMeters : 0}
              onChange={(event) => {
                const value = Number(event.target.value)
                setSurfaceLengthMeters(Number.isFinite(value) && value >= 0 ? value : 0)
              }}
            />
          </label>
        </div>

        <div className="panel-grid" style={{ marginTop: 12 }}>
          <label className="panel-field">
            <span>Surface Fluid Temperature (°C)</span>
            <input
              type="number"
              value={tempSuperficieGrad}
              step={0.5}
              onChange={(event) => {
                const value = Number(event.target.value)
                setTempSuperficieGrad(Number.isFinite(value) ? value : 15)
              }}
            />
          </label>
          <label className="panel-field">
            <span>Temperature Gradient (°C/m)</span>
            <input
              type="number"
              value={gradienteTemperatura}
              step={0.001}
              onChange={(event) => {
                const value = Number(event.target.value)
                setGradienteTemperatura(Number.isFinite(value) ? value : 0.0425)
              }}
            />
          </label>
          <label className="panel-field">
            <span>Surface Ambient Temperature (°C)</span>
            <input
              type="number"
              value={tempAmbienteSuperficie}
              step={0.5}
              onChange={(event) => {
                const value = Number(event.target.value)
                setTempAmbienteSuperficie(Number.isFinite(value) ? value : 25)
              }}
            />
          </label>
        </div>

        {(selectedCableMleEntry || selectedCableFondoEntry || selectedCableSuperficieEntry) && (
          <>
            <div style={{ fontSize: '0.95rem', color: '#9fb7ff', fontWeight: 600, marginTop: 12 }}>
              Selected Cable Properties
            </div>
            <div className="panel-grid">
              {renderCableCard('MLE Cable', selectedCableMleEntry)}
              {renderCableCard('Downhole Cable', selectedCableFondoEntry)}
              {renderCableCard('Surface Cable', selectedCableSuperficieEntry)}
            </div>
          </>
        )}

        {!cableCatalog.length && (
          <div className="empty-state" style={{ marginTop: 12 }}>
            Cable catalog not available. Verify the backend catalogs endpoint.
          </div>
        )}
      </div>
    )
  }

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
                { id: pump3, curves: pump3Curves, multiFreq: pump3MultiFreq, name: pump3 || 'Pump 3' },
                { id: pump4, curves: pump4Curves, multiFreq: pump4MultiFreq, name: pump4 || 'Pump 4' },
                { id: pump5, curves: pump5Curves, multiFreq: pump5MultiFreq, name: pump5 || 'Pump 5' }
              ]
                .slice(0, numPumpsToCompare)
                .filter((pumpEntry) => pumpEntry.id),
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

    const scenarioOperatingPoints = scenarioOperatingSummary.map((entry) => {
      const flow = typeof entry.intersectionFlow === 'number' && Number.isFinite(entry.intersectionFlow)
        ? entry.intersectionFlow
        : entry.flow
      const head = typeof entry.intersectionHead === 'number' && Number.isFinite(entry.intersectionHead)
        ? entry.intersectionHead
        : entry.head
      const pwf = typeof entry.intersectionPwf === 'number' && Number.isFinite(entry.intersectionPwf)
        ? entry.intersectionPwf
        : entry.pwf

      return {
        scenarioKey: entry.scenarioKey,
        flow,
        head,
        pwf,
        frequency: entry.frequency
      }
    })

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

      const metricDefinitions = [
        { key: 'flow', label: 'Flow (m³/d)', digits: 1 },
        { key: 'head', label: 'TDH (m)', digits: 1 },
        { key: 'pwf', label: 'Pwf (bar)', digits: 2 },
        { key: 'pip', label: 'PIP (bar)', digits: 2 },
        { key: 'frequency', label: 'Frequency (Hz)', digits: 1 },
        { key: 'efficiency', label: 'Efficiency (%)', digits: 1, suffix: '%' },
        { key: 'bhp', label: 'BHP (HP)', digits: 1 },
        { key: 'fluidLevel', label: 'Fluid Level (m)', digits: 2 },
        { key: 'submergence', label: 'Submergence (m)', digits: 2 },
        { key: 'friction', label: 'Friction Loss (m)', digits: 2 }
      ]

      const metrics = metricDefinitions.map((definition) => ({
        ...definition,
        format: (value: any) => formatNumber(value, definition.digits, definition.suffix)
      }))

      const exportScenarioOperatingPoints = () => {
        const columnHeaders = [
          'Metric',
          ...activeScenarioKeysForTable.map(
            (scenarioKey) => scenarioStyles?.[scenarioKey]?.label || scenarioKey
          )
        ]

        const dataRows = metrics.map((metric) => {
          const rowValues: (string | number | null)[] = [metric.label]
          activeScenarioKeysForTable.forEach((scenarioKey) => {
            const summary = summariesByKey[scenarioKey]
            const value = summary ? summary[metric.key as keyof typeof summary] : null
            if (typeof value === 'number' && Number.isFinite(value)) {
              rowValues.push(value)
            } else {
              rowValues.push(null)
            }
          })
          return rowValues
        })

        const summaryContextRows: (string | number | null)[][] = [
          ['Selected Pump', selected || 'N/A'],
          ['Base Stages', Number.isFinite(stages) ? stages : 'N/A'],
          ['Base Frequency (Hz)', Number.isFinite(freq) ? Number(freq).toFixed(2) : 'N/A']
        ]

        const scenarioDetailRows = activeScenarioKeysForTable.map((scenarioKey) => {
          const style = scenarioStyles?.[scenarioKey]
          const label = style?.label || scenarioKey
          const frequency = scenarioMeta?.[scenarioKey]?.frequency
          const display = scenarioDisplayValues?.[scenarioKey]
          const freqText = Number.isFinite(frequency) ? Number(frequency).toFixed(2) : 'N/A'
          const qText = Number.isFinite(display?.qTest) ? display!.qTest : 'N/A'
          const pwfText = Number.isFinite(display?.pwfTest) ? display!.pwfTest : 'N/A'
          return [label, freqText, qText, pwfText]
        })

        const sheetRows: (string | number | null)[][] = []
        sheetRows.push(['Simulation Export'])
        sheetRows.push(...summaryContextRows)

        let scenarioHeaderRowIndex: number | null = null

        if (scenarioDetailRows.length > 0) {
          sheetRows.push([''])
          scenarioHeaderRowIndex = sheetRows.length
          sheetRows.push(['Scenario', 'Frequency (Hz)', 'Q Test (m³/d)', 'Pwf Test (bar)'])
          sheetRows.push(...scenarioDetailRows)
        }

        sheetRows.push([''])
        const tableHeaderRowIndex = sheetRows.length
        sheetRows.push(columnHeaders)
        const tableDataStartRowIndex = sheetRows.length
        sheetRows.push(...dataRows)

        const worksheet = XLSX.utils.aoa_to_sheet(sheetRows)
        const totalColumns = columnHeaders.length

        worksheet['!cols'] = [
          { wch: 28 },
          ...Array.from({ length: totalColumns - 1 }, () => ({ wch: 18 }))
        ]

        const headerCellStyle: any = {
          font: { bold: true, color: { rgb: 'FFFFFFFF' } },
          fill: { fgColor: { rgb: '4A5568' } },
          alignment: { horizontal: 'center' as const, vertical: 'center' as const }
        }

        const sectionHeaderStyle: any = {
          font: { bold: true, color: { rgb: 'FFFFFFFF' } },
          fill: { fgColor: { rgb: '2D3748' } },
          alignment: { horizontal: 'center' as const, vertical: 'center' as const }
        }

        const titleCell = worksheet[XLSX.utils.encode_cell({ r: 0, c: 0 })]
        if (titleCell) {
          titleCell.s = {
            font: { bold: true, sz: 14, color: { rgb: 'FFFFFFFF' } },
            fill: { fgColor: { rgb: '1A2335' } },
            alignment: { horizontal: 'left', vertical: 'center' }
          }
        }

        summaryContextRows.forEach((_, index) => {
          const labelCell = worksheet[XLSX.utils.encode_cell({ r: 1 + index, c: 0 })]
          if (labelCell) {
            labelCell.s = {
              font: { bold: true, color: { rgb: 'DDE6FF' } }
            }
          }
        })

        if (scenarioHeaderRowIndex !== null) {
          const headerRowIndex = scenarioHeaderRowIndex
          const scenarioHeaderRow = sheetRows[headerRowIndex] || []
          scenarioHeaderRow.forEach((_, colIndex) => {
            const cellRef = XLSX.utils.encode_cell({ r: headerRowIndex, c: colIndex })
            const cell = worksheet[cellRef]
            if (cell) {
              cell.s = sectionHeaderStyle
            }
          })

          scenarioDetailRows.forEach((_, rowIndex) => {
            const scenarioLabelCell = worksheet[XLSX.utils.encode_cell({
              r: headerRowIndex + 1 + rowIndex,
              c: 0
            })]
            if (scenarioLabelCell) {
              scenarioLabelCell.s = { font: { bold: true, color: { rgb: 'C4D5FF' } } }
            }
          })
        }

        columnHeaders.forEach((_, colIndex) => {
          const cellRef = XLSX.utils.encode_cell({ r: tableHeaderRowIndex, c: colIndex })
          const cell = worksheet[cellRef]
          if (cell) {
            cell.s = headerCellStyle
          }
        })

        const freezeRowCount = tableHeaderRowIndex + 1
        worksheet['!freeze'] = { xSplit: 1, ySplit: freezeRowCount }

        const autofilterRange = XLSX.utils.encode_range({
          s: { r: tableHeaderRowIndex, c: 0 },
          e: { r: tableHeaderRowIndex + dataRows.length, c: totalColumns - 1 }
        })
        worksheet['!autofilter'] = { ref: autofilterRange }

        const tableNumberStartRow = tableDataStartRowIndex
        dataRows.forEach((_, metricIndex) => {
          const metric = metrics[metricIndex]
          const decimalPattern = metric.digits > 0 ? `0.${'0'.repeat(metric.digits)}` : '0'
          activeScenarioKeysForTable.forEach((_, scenarioIndex) => {
            const cellRef = XLSX.utils.encode_cell({
              r: tableNumberStartRow + metricIndex,
              c: scenarioIndex + 1
            })
            const cell = worksheet[cellRef]
            if (cell && typeof cell.v === 'number') {
              cell.z = decimalPattern
            }
          })
        })

        worksheet['!merges'] = worksheet['!merges'] || []
        worksheet['!merges'].push({
          s: { r: 0, c: 0 },
          e: { r: 0, c: Math.max(totalColumns - 1, 0) }
        })

        const workbook = XLSX.utils.book_new()
        const operatingSheetName = 'Operating Points'
        XLSX.utils.book_append_sheet(workbook, worksheet, operatingSheetName)

        const usedSheetNames = new Set<string>([operatingSheetName])

        const sanitizeSheetName = (name: string) => name.replace(/[\\/?*\[\]:]/g, '_').trim()
        const getUniqueSheetName = (desired: string, fallback: string) => {
          const MAX_LENGTH = 31
          const baseNameRaw = sanitizeSheetName(desired) || sanitizeSheetName(fallback) || 'Scenario'
          const baseName = baseNameRaw.slice(0, MAX_LENGTH) || 'Scenario'
          let candidate = baseName
          let counter = 1
          while (usedSheetNames.has(candidate)) {
            const suffix = `-${counter}`
            const trimmedBase = baseName.slice(0, Math.max(MAX_LENGTH - suffix.length, 1))
            candidate = `${trimmedBase}${suffix}`
            counter += 1
          }
          usedSheetNames.add(candidate)
          return candidate
        }

        const scenarioKeysForCurveExport = activeScenarioKeysForTable.filter(
          (scenarioKey) => scenarioPumpCurves?.[scenarioKey]
        )

        const toKey = (value: number) => value.toFixed(6)

        const buildSeriesMap = (series: any[] | undefined, multiplier = 1) => {
          const map = new Map<string, number>()
          if (!Array.isArray(series)) {
            return map
          }
          series.forEach((point: any) => {
            const flow = Number(point?.caudal)
            const rawValue = Number(point?.valor)
            if (Number.isFinite(flow) && Number.isFinite(rawValue)) {
              map.set(toKey(flow), rawValue * multiplier)
            }
          })
          return map
        }

        scenarioKeysForCurveExport.forEach((scenarioKey, index) => {
          const pumpCurve = scenarioPumpCurves?.[scenarioKey]
          if (!pumpCurve) {
            return
          }

          const demandSource = pressureDemandScenarios?.[scenarioKey] || pressureDemandCurve
          const scenarioLabel = scenarioStyles?.[scenarioKey]?.label || scenarioKey
          const sheetName = getUniqueSheetName(scenarioLabel || '', `Scenario ${index + 1}`)

          const sheetData: (string | number | null)[][] = []
          sheetData.push(['Scenario', scenarioLabel])

          const freqValue = scenarioMeta?.[scenarioKey]?.frequency
          sheetData.push([
            'Frequency (Hz)',
            Number.isFinite(freqValue) ? Number(freqValue).toFixed(2) : 'N/A'
          ])

          const display = scenarioDisplayValues?.[scenarioKey]
          if (display && (Number.isFinite(display.qTest) || Number.isFinite(display.pwfTest))) {
            sheetData.push([
              'Override Q Test (m³/d)',
              Number.isFinite(display.qTest) ? Number(display.qTest) : 'N/A'
            ])
            sheetData.push([
              'Override Pwf (bar)',
              Number.isFinite(display.pwfTest) ? Number(display.pwfTest) : 'N/A'
            ])
          }

          sheetData.push([''])
          const pumpSectionTitleRow = sheetData.length
          sheetData.push(['Pump Curve Data'])
          const pumpHeaderRowIndex = sheetData.length
          sheetData.push(['Flow (m³/d)', 'Head (m)', 'Efficiency (%)', 'BHP (HP)'])

          const efficiencyMap = buildSeriesMap(pumpCurve.efficiency, 100)
          const bhpMap = buildSeriesMap(pumpCurve.bhp)

          const pumpRows = Array.isArray(pumpCurve.head)
            ? pumpCurve.head
                .map((point: any) => {
                  const flow = Number(point?.caudal)
                  const headValue = Number(point?.valor)
                  if (!Number.isFinite(flow) || !Number.isFinite(headValue)) {
                    return null
                  }
                  const key = toKey(flow)
                  const eff = efficiencyMap.get(key)
                  const bhp = bhpMap.get(key)
                  return [flow, headValue, eff ?? null, bhp ?? null]
                })
                .filter((row): row is (number | null)[] => Array.isArray(row))
            : []

          sheetData.push(...pumpRows)

          let demandHeaderRowIndex: number | null = null
          let demandTableHeaderRowIndex: number | null = null
          let demandRows: (number | null)[][] = []

          if (demandSource && Array.isArray(demandSource.curve) && demandSource.curve.length > 0) {
            sheetData.push([''])
            demandHeaderRowIndex = sheetData.length
            sheetData.push(['Demand Curve Data'])
            demandTableHeaderRowIndex = sheetData.length
            sheetData.push([
              'Flow (m³/d)',
              'TDH (m)',
              'Pwf (bar)',
              'PIP (bar)',
              'Fluid Level (m)',
              'Friction Loss (m)'
            ])

            demandRows = demandSource.curve
              .map((point: any) => {
                const flow = Number(point?.caudal)
                const tdh = Number(point?.tdh)
                const pwfValue = Number(point?.pwf)
                const pip = Number(point?.pip)
                const nivel = Number(point?.nivel)
                const friction = Number(point?.perdidas_friccion)
                if (!Number.isFinite(flow)) {
                  return null
                }
                return [
                  flow,
                  Number.isFinite(tdh) ? tdh : null,
                  Number.isFinite(pwfValue) ? pwfValue : null,
                  Number.isFinite(pip) ? pip : null,
                  Number.isFinite(nivel) ? nivel : null,
                  Number.isFinite(friction) ? friction : null
                ]
              })
              .filter((row): row is (number | null)[] => Array.isArray(row))

            sheetData.push(...demandRows)
          }

          const scenarioSheet = XLSX.utils.aoa_to_sheet(sheetData)
          scenarioSheet['!cols'] = [
            { wch: 22 },
            { wch: 16 },
            { wch: 16 },
            { wch: 16 },
            { wch: 18 },
            { wch: 18 }
          ]

          const applyRowStyle = (rowIndex: number | null, style: any) => {
            if (rowIndex === null) {
              return
            }
            const row = sheetData[rowIndex] || []
            row.forEach((_, colIndex) => {
              const ref = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex })
              const cell = scenarioSheet[ref]
              if (cell) {
                cell.s = style
              }
            })
          }

          applyRowStyle(pumpSectionTitleRow, sectionHeaderStyle)
          applyRowStyle(pumpHeaderRowIndex, headerCellStyle)
          applyRowStyle(demandHeaderRowIndex, sectionHeaderStyle)
          applyRowStyle(demandTableHeaderRowIndex, headerCellStyle)

          const pumpFormats = ['0.0', '0.0', '0.0', '0.0']
          pumpRows.forEach((_, rowIndex) => {
            pumpFormats.forEach((pattern, columnIndex) => {
              const ref = XLSX.utils.encode_cell({
                r: pumpHeaderRowIndex + 1 + rowIndex,
                c: columnIndex
              })
              const cell = scenarioSheet[ref]
              if (cell && typeof cell.v === 'number') {
                cell.z = pattern
              }
            })
          })

          if (demandTableHeaderRowIndex !== null) {
            const demandFormats = ['0.0', '0.0', '0.0', '0.0', '0.0', '0.0']
            demandRows.forEach((_, rowIndex) => {
              demandFormats.forEach((pattern, columnIndex) => {
                const ref = XLSX.utils.encode_cell({
                  r: demandTableHeaderRowIndex + 1 + rowIndex,
                  c: columnIndex
                })
                const cell = scenarioSheet[ref]
                if (cell && typeof cell.v === 'number') {
                  cell.z = pattern
                }
              })
            })
          }

          XLSX.utils.book_append_sheet(workbook, scenarioSheet, sheetName)
        })

        XLSX.writeFile(workbook, 'system-operating-points.xlsx')
      }

      return (
        <div className="panel-card sensitivity-table-card">
          <div className="panel-heading-row">
            <h3 className="panel-heading">System Operating Points</h3>
            <button
              type="button"
              className="panel-action-button panel-action-button--excel"
              onClick={exportScenarioOperatingPoints}
            >
              Export to Excel
            </button>
          </div>
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
                      let value = summary ? summary[metric.key as keyof typeof summary] : null

                      if (summary) {
                        switch (metric.key) {
                          case 'flow':
                            value = typeof summary.intersectionFlow === 'number' && Number.isFinite(summary.intersectionFlow)
                              ? summary.intersectionFlow
                              : summary.flow
                            break
                          case 'head':
                            value = typeof summary.intersectionHead === 'number' && Number.isFinite(summary.intersectionHead)
                              ? summary.intersectionHead
                              : summary.head
                            break
                          case 'pwf':
                            value = typeof summary.intersectionPwf === 'number' && Number.isFinite(summary.intersectionPwf)
                              ? summary.intersectionPwf
                              : summary.pwf
                            break
                          default:
                            break
                        }
                      }

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

  const renderElectricalContent = (): React.ReactNode => {
    if (loading && !electricalData) {
      return <div className="empty-state">Loading electrical summary…</div>
    }

    if (!electricalData) {
      return <div className="empty-state">Run the IPR calculation to generate the electrical summary.</div>
    }

    type MetricDef = {
      path: string
      label: string
      digits?: number
      suffix?: string
      multiplier?: number
      allowString?: boolean
    }

    const readValue = (source: any, path: string) => {
      return path.split('.').reduce<any>((acc, part) => {
        if (acc === undefined || acc === null) {
          return undefined
        }
        const next = acc[part]
        return next === undefined ? undefined : next
      }, source)
    }

    const formatValue = (def: MetricDef, source: any) => {
      const raw = readValue(source, def.path)
      if (raw === undefined || raw === null) {
        return '—'
      }
      if (def.allowString && typeof raw === 'string') {
        const trimmed = raw.trim()
        return trimmed.length ? trimmed : '—'
      }
      const numeric = Number(raw)
      if (!Number.isFinite(numeric)) {
        return '—'
      }
      const multiplier = def.multiplier ?? 1
      const digits = def.digits ?? 2
      const value = numeric * multiplier
      return `${value.toFixed(digits)}${def.suffix || ''}`
    }

    const baseSummaryMetrics: MetricDef[] = [
      { path: 'P_motor_kW', label: 'Motor Power', suffix: ' kW', digits: 2 },
      { path: 'I_motor', label: 'Motor Current', suffix: ' A', digits: 2 },
      { path: 'V_op', label: 'Motor Voltage', suffix: ' V', digits: 0 },
      { path: 'V_superficie', label: 'Surface Voltage', suffix: ' V', digits: 0 },
      { path: 'Motor_Load_Percent', label: 'Motor Load', suffix: ' %', digits: 1 },
      { path: 'P_perdida_kW', label: 'Cable Losses', suffix: ' kW', digits: 3 },
      { path: 'P_superficie_kW', label: 'Surface Power', suffix: ' kW', digits: 2 },
  { path: 'Energy_Index', label: 'Energy Index', suffix: ' kW*d/(m³*m)', digits: 2 },
      { path: 'P_superficie_kVA', label: 'Surface kVA', suffix: ' kVA', digits: 2 },
      { path: 'PF_superficie', label: 'Power Factor', digits: 3 },
      { path: 'Eff_Sistema', label: 'System Efficiency', suffix: ' %', digits: 1, multiplier: 100 }
    ]

    const operatingPointMetrics: MetricDef[] = [
      { path: 'metadata.operating_point.q_m3d', label: 'Operating Flow', suffix: ' m³/d', digits: 1 },
      { path: 'metadata.operating_point.head_m', label: 'Operating TDH', suffix: ' m', digits: 1 },
      { path: 'metadata.operating_point.pump_bhp_hp', label: 'Pump BHP', suffix: ' hp', digits: 2 },
      { path: 'metadata.operating_point.pump_efficiency', label: 'Pump Efficiency', suffix: ' %', digits: 1, multiplier: 100 },
      { path: 'metadata.operating_point.pip_bar', label: 'PIP', suffix: ' bar', digits: 2 },
      { path: 'metadata.operating_point.pwf_bar', label: 'Pwf', suffix: ' bar', digits: 2 },
      { path: 'metadata.operating_point.fluid_level_m', label: 'Fluid Level', suffix: ' m', digits: 1 },
      { path: 'metadata.operating_point.sumergencia_m', label: 'Submergence', suffix: ' m', digits: 1 }
    ]

    const metadataMetrics: MetricDef[] = [
      { path: 'metadata.motor_type', label: 'Motor Type', allowString: true },
      { path: 'metadata.fef', label: 'Frequency Scaling (FEF)', digits: 2 },
      { path: 'metadata.cable_resistance_ohm', label: 'Cable Resistance', suffix: ' Ω', digits: 4 },
      { path: 'metadata.temps.intake', label: 'Intake Temperature', suffix: ' °C', digits: 1 },
      { path: 'metadata.temps.superficie', label: 'Surface Temperature', suffix: ' °C', digits: 1 }
    ]

    const scenarioMetrics: MetricDef[] = [
      { path: 'P_motor_kW', label: 'Motor Power (kW)', suffix: ' kW', digits: 2 },
      { path: 'I_motor', label: 'Motor Current (A)', suffix: ' A', digits: 2 },
      { path: 'Motor_Load_Percent', label: 'Motor Load (%)', suffix: ' %', digits: 1 },
      { path: 'P_perdida_kW', label: 'Cable Losses (kW)', suffix: ' kW', digits: 3 },
      { path: 'P_superficie_kW', label: 'Surface Power (kW)', suffix: ' kW', digits: 2 },
  { path: 'Energy_Index', label: 'Energy Index', suffix: ' kW*d/(m³*m)', digits: 2 },
      { path: 'PF_superficie', label: 'Power Factor', digits: 3 },
      { path: 'Eff_Sistema', label: 'System Efficiency (%)', suffix: ' %', digits: 1, multiplier: 100 },
      { path: 'metadata.operating_point.q_m3d', label: 'Operating Flow (m³/d)', suffix: ' m³/d', digits: 1 },
      { path: 'metadata.operating_point.head_m', label: 'Operating TDH (m)', suffix: ' m', digits: 1 },
      { path: 'metadata.operating_point.pump_bhp_hp', label: 'Pump BHP (hp)', suffix: ' hp', digits: 2 },
      { path: 'metadata.operating_point.pump_efficiency', label: 'Pump Efficiency (%)', suffix: ' %', digits: 1, multiplier: 100 },
      { path: 'metadata.operating_point.pip_bar', label: 'PIP (bar)', suffix: ' bar', digits: 2 },
      { path: 'metadata.operating_point.pwf_bar', label: 'Pwf (bar)', suffix: ' bar', digits: 2 },
      { path: 'metadata.operating_point.fluid_level_m', label: 'Fluid Level (m)', suffix: ' m', digits: 1 },
      { path: 'metadata.operating_point.sumergencia_m', label: 'Submergence (m)', suffix: ' m', digits: 1 }
    ]

    const baseData = electricalData || {}
    const baseWarnings = Array.isArray(baseData?.warnings) ? baseData.warnings : []

    const scenarioKeysForTable = availableScenarioKeys.filter((key) => {
      return Boolean(scenarioElectricalData?.[key])
    })

    const getScenarioHeaderLabel = (key: string) => {
      const label = scenarioStyles?.[key]?.label || key
      const overrideFreq = scenarioDisplayValues?.[key]?.freq
      const metaFreq = scenarioMeta?.[key]?.frequency
      const hasOverrideFreq = typeof overrideFreq === 'number' && Number.isFinite(overrideFreq)
      const hasMetaFreq = typeof metaFreq === 'number' && Number.isFinite(metaFreq)
      const freq = hasOverrideFreq ? overrideFreq : hasMetaFreq ? metaFreq : null
      if (typeof freq === 'number') {
        return `${label} (${freq.toFixed(0)} Hz)`
      }
      return label
    }

    const scenarioWarningEntries = scenarioKeysForTable
      .map((key) => {
        const warnings = scenarioElectricalData?.[key]?.warnings
        if (!Array.isArray(warnings) || warnings.length === 0) {
          return null
        }
        return { key, warnings }
      })
      .filter((entry): entry is { key: string; warnings: string[] } => Boolean(entry))

    const hasScenarioData = scenarioKeysForTable.length > 0

    return (
      <>
        <div className="panel-card">
          <div className="panel-heading-row">
            <h3 className="panel-heading">Base Electrical Summary</h3>
          </div>
          <div className="panel-grid">
            {baseSummaryMetrics.map((metric) => (
              <div key={metric.path} className="panel-field">
                <span>{metric.label}</span>
                <strong>{formatValue(metric, baseData)}</strong>
              </div>
            ))}
          </div>
          <div style={{ fontSize: '0.95rem', color: '#9fb7ff', fontWeight: 600 }}>Operating Point</div>
          <div className="panel-grid">
            {operatingPointMetrics.map((metric) => (
              <div key={metric.path} className="panel-field">
                <span>{metric.label}</span>
                <strong>{formatValue(metric, baseData)}</strong>
              </div>
            ))}
          </div>
          <div style={{ fontSize: '0.95rem', color: '#9fb7ff', fontWeight: 600 }}>Motor &amp; Cable Context</div>
          <div className="panel-grid">
            {metadataMetrics.map((metric) => (
              <div key={metric.path} className="panel-field">
                <span>{metric.label}</span>
                <strong>{formatValue(metric, baseData)}</strong>
              </div>
            ))}
          </div>
          {baseWarnings.length > 0 && (
            <div className="error" style={{ marginTop: 4 }}>
              <strong>Warnings:</strong>
              <ul>
                {baseWarnings.map((message: string, index: number) => (
                  <li key={`electrical-warning-${index}`}>{message}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
        {hasScenarioData && (
          <div className="panel-card sensitivity-table-card">
            <div className="panel-heading-row">
              <h3 className="panel-heading">Scenario Electrical Comparison</h3>
            </div>
            <div className="table-wrapper">
              <table className="sensitivity-table sensitivity-table--scenario-grid">
                <thead>
                  <tr>
                    <th>Metric</th>
                    <th style={{ color: '#dbe4ff' }}>Base</th>
                    {scenarioKeysForTable.map((key) => (
                      <th
                        key={`electrical-scenario-header-${key}`}
                        style={{ color: scenarioStyles?.[key]?.color || '#9fb7ff' }}
                      >
                        {getScenarioHeaderLabel(key)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {scenarioMetrics.map((metric) => (
                    <tr key={metric.path}>
                      <td className="metric-label">{metric.label}</td>
                      <td className="scenario-value" style={{ color: '#dbe4ff' }}>
                        {formatValue(metric, baseData)}
                      </td>
                      {scenarioKeysForTable.map((key) => (
                        <td
                          key={`${metric.path}-${key}`}
                          className="scenario-value"
                          style={{ color: scenarioStyles?.[key]?.color || '#dbe4ff' }}
                        >
                          {formatValue(metric, scenarioElectricalData?.[key])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {!hasScenarioData && sensitivityEnabled && (
          <div className="panel-card">
            <div className="panel-heading-row">
              <h3 className="panel-heading">Scenario Electrical Comparison</h3>
            </div>
            <div className="empty-state" style={{ margin: 0 }}>
              Scenario electrical results will appear once sensitivity calculations finish.
            </div>
          </div>
        )}
        {scenarioWarningEntries.length > 0 && (
          <div className="panel-card">
            <div className="panel-heading-row">
              <h3 className="panel-heading">Scenario Warnings</h3>
            </div>
            <ul>
              {scenarioWarningEntries.map((entry) => (
                entry.warnings.map((message, idx) => (
                  <li key={`${entry.key}-warning-${idx}`}>
                    <strong>{scenarioStyles?.[entry.key]?.label || entry.key}:</strong> {message}
                  </li>
                ))
              ))}
            </ul>
          </div>
        )}
      </>
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
                className={`config-tab-button ${configTab === 'motor' ? 'active' : ''}`}
                onClick={() => setConfigTab('motor')}
              >
                Motor Configuration
              </button>
              <button
                className={`config-tab-button ${configTab === 'cable' ? 'active' : ''}`}
                onClick={() => setConfigTab('cable')}
              >
                Cable Configuration
              </button>
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
              {configTab === 'motor' && renderMotorConfiguration()}
              {configTab === 'cable' && renderCableConfiguration()}
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
              <button
                className={`tab-button ${visualTab === 'electrical' ? 'active' : ''}`}
                onClick={() => setVisualTab('electrical')}
                disabled={!hasElectricalResults}
                title={!hasElectricalResults
                  ? 'Run the calculation to view electrical metrics'
                  : undefined}
              >
                <span className="tab-icon">⚡</span>
                <span>Electrical</span>
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
              <div className={`tab-panel ${visualTab === 'electrical' ? 'active' : ''}`}>
                {renderElectricalContent()}
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
      <PumpManagerModal
        isOpen={isPumpManagerOpen}
        activePumpId={selected}
        onClose={() => setPumpManagerOpen(false)}
        onSelect={(pumpId) => handlePumpSelectedFromManager(pumpId)}
        onCatalogChanged={handlePumpCatalogChanged}
      />
    </div>
  )
}
