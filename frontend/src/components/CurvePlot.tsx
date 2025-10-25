// @ts-nocheck
import React from 'react'
import Plot from 'react-plotly.js'

// Función auxiliar para encontrar el punto de operación (intersección entre IPR y curva de bomba)
function findOperatingPoint(pumpQ: number[], pumpHead: number[], iprQ: number[], iprHead: number[]) {
  // Interpolación lineal para encontrar la intersección
  let closestDiff = Infinity
  let operatingPoint = null
  
  for (let i = 0; i < pumpQ.length - 1; i++) {
    const q1 = pumpQ[i]
    const h1 = pumpHead[i]
    const q2 = pumpQ[i + 1]
    const h2 = pumpHead[i + 1]
    
    // Buscar punto IPR cercano a este segmento de bomba
    for (let j = 0; j < iprQ.length - 1; j++) {
      const iprQ1 = iprQ[j]
      const iprH1 = iprHead[j]
      const iprQ2 = iprQ[j + 1]
      const iprH2 = iprHead[j + 1]
      
      // Verificar si los segmentos se cruzan en Q
      const qOverlap = Math.max(Math.min(q1, q2), Math.min(iprQ1, iprQ2)) <= Math.min(Math.max(q1, q2), Math.max(iprQ1, iprQ2))
      
      if (qOverlap) {
        // Calcular punto medio del rango de overlap
        const qMid = (Math.max(Math.min(q1, q2), Math.min(iprQ1, iprQ2)) + Math.min(Math.max(q1, q2), Math.max(iprQ1, iprQ2))) / 2
        
        // Interpolar Head en ese Q
        const pumpHeadAtQ = h1 + ((h2 - h1) / (q2 - q1)) * (qMid - q1)
        const iprHeadAtQ = iprH1 + ((iprH2 - iprH1) / (iprQ2 - iprQ1)) * (qMid - iprQ1)
        
        const diff = Math.abs(pumpHeadAtQ - iprHeadAtQ)
        
        if (diff < closestDiff) {
          closestDiff = diff
          operatingPoint = {
            q: qMid,
            head: (pumpHeadAtQ + iprHeadAtQ) / 2
          }
        }
      }
    }
  }
  
  return operatingPoint
}

function interpolateValue(qArray: number[], valueArray: number[], targetQ: number) {
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

function findPumpDemandIntersection(pumpQ: number[], pumpHead: number[], demandQ: number[], demandHead: number[]) {
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

const DEFAULT_SCENARIO_STYLE = {
  label: 'System Demand',
  color: '#c0392b',
  dash: 'dot',
  symbol: 'star'
}

function formatScenarioLabel(key: string) {
  if (!key || typeof key !== 'string') {
    return DEFAULT_SCENARIO_STYLE.label
  }
  return key.charAt(0).toUpperCase() + key.slice(1)
}

function resolveScenarioStyle(key: string, scenarioStyles?: any) {
  const fallback = key !== 'conservative' ? scenarioStyles?.conservative : {}
  const style = scenarioStyles?.[key] || {}
  const merged = { ...DEFAULT_SCENARIO_STYLE, ...(fallback || {}), ...(style || {}) }
  if (!merged.label) {
    merged.label = formatScenarioLabel(key)
  }
  if (!merged.color) {
    merged.color = DEFAULT_SCENARIO_STYLE.color
  }
  if (!merged.dash) {
    merged.dash = DEFAULT_SCENARIO_STYLE.dash
  }
  if (!merged.symbol) {
    merged.symbol = DEFAULT_SCENARIO_STYLE.symbol
  }
  return merged
}

export default function CurvePlot({
  curves,
  multiFreqData,
  isMultiFreq,
  isComparisonMode,
  comparisonData,
  isIndividualEfficiency,
  individualEfficiencyData,
  isIndividualHead,
  individualHeadData,
  isIndividualBhp,
  individualBhpData,
  iprData,
  showIPR,
  isIPRMode,
  pumpCurves,
  pressureDemandCurve,
  pressureDemandScenarios,
  iprScenarios,
  scenarioVisibility,
  scenarioStyles,
  scenarioOrder,
  activeScenarioKey
}: any) {
  // Modo IPR dedicado - SOLO curva IPR
  if (isIPRMode) {
    return (
      <IPRPlot
        iprData={iprData}
        pressureDemandCurve={pressureDemandCurve}
        pressureDemandScenarios={pressureDemandScenarios}
        iprScenarios={iprScenarios}
        scenarioVisibility={scenarioVisibility}
        scenarioStyles={scenarioStyles}
        scenarioOrder={scenarioOrder}
        activeScenarioKey={activeScenarioKey}
      />
    )
  }
  
  // Modo Head individual
  if (isIndividualHead && individualHeadData) {
    return (
      <IndividualHeadPlot
        data={individualHeadData}
        iprData={iprData}
        showIPR={showIPR}
        pressureDemandCurve={pressureDemandCurve}
        pressureDemandScenarios={pressureDemandScenarios}
        scenarioVisibility={scenarioVisibility}
        scenarioStyles={scenarioStyles}
        scenarioOrder={scenarioOrder}
        activeScenarioKey={activeScenarioKey}
      />
    )
  }
  
  // Modo BHP individual
  if (isIndividualBhp && individualBhpData) {
    return <IndividualBhpPlot data={individualBhpData} />
  }
  
  // Modo eficiencias individuales
  if (isIndividualEfficiency && individualEfficiencyData) {
    return <IndividualEfficiencyPlot data={individualEfficiencyData} />
  }
  
  // Modo comparador
  if (isComparisonMode && comparisonData) {
    return <ComparisonPlot comparisonData={comparisonData} />
  }
  
  // Modo multifrecuencia
  if (isMultiFreq && multiFreqData && multiFreqData.length > 0) {
    return (
      <MultiFreqPlot
        multiFreqData={multiFreqData}
        iprData={iprData}
        showIPR={showIPR}
        pressureDemandCurve={pressureDemandCurve}
        pressureDemandScenarios={pressureDemandScenarios}
        scenarioVisibility={scenarioVisibility}
        scenarioStyles={scenarioStyles}
        scenarioOrder={scenarioOrder}
        activeScenarioKey={activeScenarioKey}
      />
    )
  }
  
  // Modo normal (single frequency)
  if (!curves) return null
  
  // expect curves: { head: [{caudal, valor}], bhp: [{caudal, valor}], efficiency: [{caudal, valor}], operating_range: {min_q, max_q} }
  const q = curves.head.map((p: any) => p.caudal)
  const head = curves.head.map((p: any) => p.valor)
  const bhp = curves.bhp.map((p: any) => p.valor)
  const eff = curves.efficiency.map((p: any) => p.valor * 100.0)

  // Obtener rango de operación
  const operatingRange = curves.operating_range || { min_q: 0, max_q: 0 }
  const minQ = operatingRange.min_q
  const maxQRange = operatingRange.max_q

  // Calcular valores máximos para mejor visualización
  const maxQ = Math.max(...q)
  const maxHead = Math.max(...head)
  const maxBhp = Math.max(...bhp)
  const maxEff = Math.max(...eff)
  let headRangeMax = maxHead

  const pumpDepth = typeof pressureDemandCurve?.components?.profundidad_bomba === 'number'
    ? pressureDemandCurve.components.profundidad_bomba
    : null

  const fluidGradient = typeof pressureDemandCurve?.components?.gradiente === 'number'
    ? pressureDemandCurve.components.gradiente
    : null

  let demandData: { q: number[], head: number[], raw: any[] } | null = null
  let operatingPointWithDemand: any = null
  let demandAnnotationText = ''
  let demandHoverTemplate = ''

  if (pressureDemandCurve && pressureDemandCurve.curve && pressureDemandCurve.curve.length > 0) {
    const demandQ = pressureDemandCurve.curve.map((p: any) => p.caudal)
    const demandHeadValues = pressureDemandCurve.curve.map((p: any) => p.tdh)
    const demandPipValues = pressureDemandCurve.curve.map((p: any) => p.pip)
    const demandPwfValues = pressureDemandCurve.curve.map((p: any) => p.pwf)
    const demandLevelValues = pressureDemandCurve.curve.map((p: any) => p.nivel)
    const demandFrictionValues = pressureDemandCurve.curve.map((p: any) => p.perdidas_friccion)
    headRangeMax = Math.max(headRangeMax, Math.max(...demandHeadValues))

    demandData = {
      q: demandQ,
      head: demandHeadValues,
      raw: pressureDemandCurve.curve
    }

    const intersection = findPumpDemandIntersection(q, head, demandQ, demandHeadValues)
    if (intersection) {
      const effAtPoint = interpolateValue(q, eff, intersection.q)
      const bhpAtPoint = interpolateValue(q, bhp, intersection.q)

      let pipAtPoint: number | null = null
      let pwfAtPoint: number | null = null
      let levelAtPoint: number | null = null
      let submergenceAtPoint: number | null = null
      let fluidLevelAtPoint: number | null = null

      if (demandPipValues && demandPipValues.length > 0) {
        pipAtPoint = interpolateValue(demandQ, demandPipValues, intersection.q)
      }

      if (demandPwfValues && demandPwfValues.length > 0) {
        pwfAtPoint = interpolateValue(demandQ, demandPwfValues, intersection.q)
      }

      if (demandLevelValues && demandLevelValues.length > 0) {
        levelAtPoint = interpolateValue(demandQ, demandLevelValues, intersection.q)
      }

      if (
        pwfAtPoint !== null &&
        typeof fluidGradient === 'number' &&
        fluidGradient > 0
      ) {
        const rawSubmergence = pwfAtPoint / fluidGradient
        if (isFinite(rawSubmergence)) {
          submergenceAtPoint = Math.max(rawSubmergence, 0)
        }
      }

      if (submergenceAtPoint !== null && typeof pumpDepth === 'number') {
        const rawFluidLevel = pumpDepth - submergenceAtPoint
        if (isFinite(rawFluidLevel)) {
          fluidLevelAtPoint = Math.min(Math.max(rawFluidLevel, 0), pumpDepth)
        }
      }

      operatingPointWithDemand = {
        q: intersection.q,
        head: intersection.head,
        efficiency: effAtPoint,
        bhp: bhpAtPoint,
        pip: pipAtPoint,
        pwf: pwfAtPoint,
        nivel: levelAtPoint,
        fluidLevel: fluidLevelAtPoint,
        submergence: submergenceAtPoint,
        friction: demandFrictionValues && demandFrictionValues.length > 0
          ? interpolateValue(demandQ, demandFrictionValues, intersection.q)
          : null
      }

      demandAnnotationText = `<b>System Operating Point</b><br>Q = ${intersection.q.toFixed(1)} m³/d` +
        `<br>TDH = ${intersection.head.toFixed(1)} m` +
        (effAtPoint !== null ? `<br>η = ${effAtPoint.toFixed(1)} %` : '') +
        (bhpAtPoint !== null ? `<br>BHP = ${bhpAtPoint.toFixed(1)} HP` : '') +
        (pipAtPoint !== null ? `<br>PIP: ${pipAtPoint.toFixed(1)} bar` : '') +
        (pwfAtPoint !== null ? `<br>Pwf: ${pwfAtPoint.toFixed(1)} bar` : '') +
        (fluidLevelAtPoint !== null ? `<br>Fluid Level: ${fluidLevelAtPoint.toFixed(1)} m` : '') +
        (submergenceAtPoint !== null ? `<br>Submergence: ${submergenceAtPoint.toFixed(1)} m` : '')

      demandHoverTemplate = `<b>System Operating Point</b><br>` +
        `Flow: ${intersection.q.toFixed(2)} m³/d<br>` +
        `TDH: ${intersection.head.toFixed(2)} m` +
        (effAtPoint !== null ? `<br>Efficiency: ${effAtPoint.toFixed(2)} %` : '') +
        (bhpAtPoint !== null ? `<br>BHP: ${bhpAtPoint.toFixed(2)} HP` : '') +
        (pipAtPoint !== null ? `<br>PIP: ${pipAtPoint.toFixed(2)} bar` : '') +
        (pwfAtPoint !== null ? `<br>Pwf: ${pwfAtPoint.toFixed(2)} bar` : '') +
        (fluidLevelAtPoint !== null ? `<br>Fluid Level: ${fluidLevelAtPoint.toFixed(2)} m` : '') +
        (submergenceAtPoint !== null ? `<br>Submergence: ${submergenceAtPoint.toFixed(2)} m` : '') +
        '<extra></extra>'
    }
  }

  // Encontrar el BEP (Best Efficiency Point) - punto de máxima eficiencia
  const maxEffIndex = eff.indexOf(maxEff)
  const bepQ = q[maxEffIndex]
  const bepHead = head[maxEffIndex]
  const bepBhp = bhp[maxEffIndex]
  const bepEff = eff[maxEffIndex]

  const data = [
    // Región sombreada para el rango de operación recomendado
    {
      x: [minQ, minQ, maxQRange, maxQRange, minQ],
      y: [0, headRangeMax * 1.5, headRangeMax * 1.5, 0, 0],
      fill: 'toself',
      fillcolor: 'rgba(46, 204, 113, 0.1)',
      line: { width: 0 },
      type: 'scatter',
      mode: 'lines',
      name: 'Operating Range',
      showlegend: true,
      hoverinfo: 'skip',
      yaxis: 'y1'
    },
    // Líneas verticales para marcar min y max Q
    {
      x: [minQ, minQ],
      y: [0, headRangeMax * 1.2],
      mode: 'lines',
      type: 'scatter',
      line: { color: '#27ae60', width: 2, dash: 'dot' },
      name: `Q min: ${minQ.toFixed(0)}`,
      showlegend: true,
      hoverinfo: 'skip',
      yaxis: 'y1'
    },
    {
      x: [maxQRange, maxQRange],
      y: [0, headRangeMax * 1.2],
      mode: 'lines',
      type: 'scatter',
      line: { color: '#27ae60', width: 2, dash: 'dot' },
      name: `Q max: ${maxQRange.toFixed(0)}`,
      showlegend: true,
      hoverinfo: 'skip',
      yaxis: 'y1'
    },
    // Línea vertical para el BEP (Best Efficiency Point)
    {
      x: [bepQ, bepQ],
      y: [0, headRangeMax * 1.2],
      mode: 'lines',
      type: 'scatter',
      line: { color: '#e67e22', width: 3, dash: 'dash' },
      name: `BEP: Q=${bepQ.toFixed(0)} m³/d, η=${bepEff.toFixed(1)}%`,
      showlegend: true,
      hoverinfo: 'skip',
      yaxis: 'y1'
    },
    // Punto marcador en el BEP
    {
      x: [bepQ],
      y: [bepHead],
      mode: 'markers',
      type: 'scatter',
      marker: { color: '#e67e22', size: 12, symbol: 'diamond', line: { color: 'white', width: 2 } },
      name: 'BEP Point',
      showlegend: false,
      hovertemplate: '<b>BEP (Best Efficiency Point)</b><br>Q: %{x:.2f} m³/d<br>Head: %{y:.2f} m<br>Efficiency: ' + bepEff.toFixed(2) + '%<extra></extra>',
      yaxis: 'y1'
    },
    { 
      x: q, 
      y: head, 
      type: 'scatter', 
      mode: 'lines', 
      name: 'Head (m)', 
      yaxis: 'y1', 
      line: { color: '#3498db', width: 3 },
      hovertemplate: '<b>Q:</b> %{x:.2f} m³/d<br><b>Head:</b> %{y:.2f} m<extra></extra>'
    },
    { 
      x: q, 
      y: bhp, 
      type: 'scatter', 
      mode: 'lines', 
      name: 'BHP (HP)', 
      yaxis: 'y2', 
      line: { color: '#e74c3c', width: 3 },
      hovertemplate: '<b>Q:</b> %{x:.2f} m³/d<br><b>BHP:</b> %{y:.2f} HP<extra></extra>'
    },
    { 
      x: q, 
      y: eff, 
      type: 'scatter', 
      mode: 'lines', 
      name: 'Efficiency (%)', 
      yaxis: 'y3', 
      line: { color: '#2ecc71', width: 3, dash: 'dash' },
      hovertemplate: '<b>Q:</b> %{x:.2f} m³/d<br><b>Efficiency:</b> %{y:.2f}%<extra></extra>'
    }
  ]

  if (demandData) {
    data.push({
      x: demandData.q,
      y: demandData.head,
      type: 'scatter',
      mode: 'lines',
      name: 'System Demand (TDH)',
      yaxis: 'y1',
      line: { color: '#c0392b', width: 3, dash: 'dot' },
      hovertemplate: '<b>System Demand</b><br>Q: %{x:.2f} m³/d<br>TDH: %{y:.2f} m<extra></extra>'
    })
  }

  if (operatingPointWithDemand) {
    data.push({
      x: [operatingPointWithDemand.q],
      y: [operatingPointWithDemand.head],
      mode: 'markers',
      type: 'scatter',
      marker: {
        color: '#c0392b',
        size: 16,
        symbol: 'star',
        line: { color: 'white', width: 2 }
      },
      name: 'System Operating Point',
      showlegend: true,
      hovertemplate: demandHoverTemplate,
      yaxis: 'y1'
    })
  }

  // Agregar curva de IPR si está disponible
  if (showIPR && iprData && iprData.curve) {
    const iprQ = iprData.curve.map((p: any) => p.caudal)
    const iprPwf = iprData.curve.map((p: any) => p.pwf)
    
    // Convertir Pwf (bar) a Head (m): 1 bar ≈ 10.2 m
    const iprHead = iprPwf.map((pwf: number) => pwf * 10.2)
    
    // Agregar curva IPR
    data.push({
      x: iprQ,
      y: iprHead,
      type: 'scatter',
      mode: 'lines',
      name: `IPR (${iprData.method})`,
      yaxis: 'y1',
      line: { color: '#16a085', width: 4, dash: 'dashdot' },
      hovertemplate: '<b>IPR</b><br>Q: %{x:.2f} m³/d<br>Head: %{y:.2f} m<extra></extra>'
    })
    
    // Calcular punto de operación (intersección IPR con curva de bomba)
    const operatingPoint = findOperatingPoint(q, head, iprQ, iprHead)
    if (operatingPoint) {
      data.push({
        x: [operatingPoint.q],
        y: [operatingPoint.head],
        mode: 'markers',
        type: 'scatter',
        marker: { color: '#c0392b', size: 16, symbol: 'star', line: { color: 'white', width: 2 } },
        name: 'Operating Point',
        showlegend: true,
        hovertemplate: `<b>Operating Point</b><br>Q: ${operatingPoint.q.toFixed(2)} m³/d<br>Head: ${operatingPoint.head.toFixed(2)} m<br>Pwf: ${(operatingPoint.head / 10.2).toFixed(2)} bar<extra></extra>`,
        yaxis: 'y1'
      })
    }
  }

  const annotations: any[] = []

  if (operatingPointWithDemand) {
    annotations.push({
      x: operatingPointWithDemand.q,
      y: operatingPointWithDemand.head,
      xanchor: 'left',
      yanchor: 'bottom',
      text: demandAnnotationText,
      showarrow: true,
      arrowhead: 4,
      arrowsize: 1,
      arrowwidth: 2,
      arrowcolor: '#c0392b',
      bgcolor: 'rgba(255, 255, 255, 0.92)',
      bordercolor: '#c0392b',
      borderwidth: 1,
      font: {
        size: 12,
        color: '#2c3e50',
        family: 'Segoe UI, sans-serif'
      }
    })
  }

  const layout = {
    title: {
      text: 'Pump Performance Curves',
      font: {
        size: 24,
        color: '#2c3e50',
        family: 'Segoe UI, sans-serif',
        weight: 700
      }
    },
    xaxis: { 
      title: {
        text: 'Flow Rate (Q - m³/d)',
        font: { size: 16, color: '#34495e', weight: 600 }
      },
      domain: [0, 0.85],
      range: [0, maxQ * 1.05],
      showgrid: true,
      gridcolor: '#ecf0f1',
      zeroline: true,
      zerolinecolor: '#95a5a6',
      zerolinewidth: 2
    },
    yaxis: { 
      title: {
        text: 'Head (m)',
        font: { size: 16, color: '#3498db', weight: 600 }
      },
      side: 'left',
      showgrid: true,
      gridcolor: '#ecf0f1',
      range: [0, headRangeMax * 1.1],
      zeroline: true,
      zerolinecolor: '#95a5a6',
      zerolinewidth: 2,
      titlefont: { color: '#3498db' },
      tickfont: { color: '#3498db' }
    },
    yaxis2: { 
      title: {
        text: 'BHP (HP)',
        font: { size: 16, color: '#e74c3c', weight: 600 }
      },
      anchor: 'x',
      overlaying: 'y',
      side: 'right',
      showgrid: false,
      range: [0, maxBhp * 1.1],
      zeroline: false,
      titlefont: { color: '#e74c3c' },
      tickfont: { color: '#e74c3c' }
    },
    yaxis3: { 
      title: {
        text: 'Efficiency (%)',
        font: { size: 16, color: '#2ecc71', weight: 600 }
      },
      anchor: 'free',
      overlaying: 'y',
      side: 'right',
      position: 0.98,
      showgrid: false,
      range: [0, maxEff * 1.1],
      zeroline: false,
      titlefont: { color: '#2ecc71' },
      tickfont: { color: '#2ecc71' }
    },
    legend: {
      orientation: 'h',
      yanchor: 'bottom',
      y: 1.18,
      xanchor: 'center',
      x: 0.5,
      bgcolor: 'rgba(255, 255, 255, 0.85)',
      bordercolor: '#95a5a6',
      borderwidth: 1,
      font: { size: 12, weight: 600 }
    },
    plot_bgcolor: '#fafafa',
    paper_bgcolor: 'white',
    hovermode: 'x',
    hoverlabel: {
      bgcolor: 'white',
      bordercolor: '#95a5a6',
      font: { size: 13, family: 'Segoe UI, sans-serif' },
      namelength: -1
    },
  margin: { l: 80, r: 180, t: 160, b: 90 },
    annotations
  }

  const config = {
    responsive: true,
    displayModeBar: true,
    displaylogo: false,
    modeBarButtonsToRemove: ['lasso2d', 'select2d'],
    toImageButtonOptions: {
      format: 'png',
      filename: 'pump_curves',
      height: 800,
      width: 1200,
      scale: 2
    }
  }

  return (
    <div className="plot-container">
      <Plot 
        data={data} 
        layout={layout} 
        config={config}
  style={{ width: '100%', height: '660px' }} 
        useResizeHandler={true} 
      />
    </div>
  )
}

// Componente para gráfico multifrecuencia
function MultiFreqPlot({
  multiFreqData,
  iprData,
  showIPR,
  pressureDemandCurve,
  pressureDemandScenarios,
  scenarioVisibility,
  scenarioStyles,
  scenarioOrder,
  activeScenarioKey
}: any) {
  const colors = ['#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22', '#34495e', '#16a085', '#c0392b']

  const data: any[] = []

  const multiFreqList = Array.isArray(multiFreqData) ? multiFreqData : []
  const sortedMultiFreq = [...multiFreqList]
    .filter((item: any) => item && item.curves && item.curves.head && item.curves.head.length > 0)
    .sort((a: any, b: any) => a.freq - b.freq)

  const curveMeta: {
    freq: number
    q: number[]
    head: number[]
    minQ: number
    maxQ: number
  }[] = []
  const bepPoints: { freq: number; q: number; head: number; efficiency: number }[] = []
  const allQValues = new Set<number>()
  const scenarioOperatingPoints: Record<string, { freq: number; q: number; head: number; efficiency: number | null; bhp: number | null }[]> = {}

  let maxQ = 0
  let maxHead = 0

  const demandSeries: any[] = []

  const configuredOrder = Array.isArray(scenarioOrder) && scenarioOrder.length > 0
    ? scenarioOrder
    : Object.keys(pressureDemandScenarios || {})

  const activeKeys = configuredOrder.filter((key) => scenarioVisibility?.[key])
  const fallbackKey = activeScenarioKey
    || (configuredOrder.includes('conservative') ? 'conservative' : configuredOrder[0])
    || 'conservative'

  const baseDemandSource = pressureDemandCurve && Array.isArray(pressureDemandCurve.curve) && pressureDemandCurve.curve.length > 0
    ? pressureDemandCurve
    : null

  const pushScenario = (scenarioKey: string, source: any) => {
    if (!source || !Array.isArray(source.curve) || source.curve.length === 0) {
      return
    }
    if (demandSeries.some((series) => series.key === scenarioKey)) {
      return
    }

    const style = resolveScenarioStyle(scenarioKey, scenarioStyles)
    const qValues = source.curve.map((p: any) => p.caudal)
    const headValues = source.curve.map((p: any) => p.tdh)

    if (!qValues.length || !headValues.length) {
      return
    }

    demandSeries.push({
      key: scenarioKey,
      label: style.label,
      color: style.color,
      dash: style.dash || 'dot',
      symbol: style.symbol || 'star',
      q: qValues,
      head: headValues,
      raw: source.curve
    })
    scenarioOperatingPoints[scenarioKey] = []
  }

  const demandSources = pressureDemandScenarios || {}
  const keysToPlot = (activeKeys.length > 0 ? activeKeys : [fallbackKey]).filter(Boolean)

  keysToPlot.forEach((scenarioKey) => {
    let source = demandSources[scenarioKey]
    if (!source && scenarioKey === 'conservative') {
      source = baseDemandSource
    }
    if (source) {
      pushScenario(scenarioKey, source)
    }
  })

  if (!demandSeries.length && baseDemandSource) {
    pushScenario('conservative', baseDemandSource)
  }

  demandSeries.forEach((series) => {
    series.q.forEach((value: number) => allQValues.add(value))
    if (series.q.length) {
      maxQ = Math.max(maxQ, ...series.q, maxQ)
    }
    if (series.head.length) {
      maxHead = Math.max(maxHead, ...series.head, maxHead)
    }
  })

  sortedMultiFreq.forEach((item: any, idx: number) => {
    const freq = item.freq
    const curves = item.curves

    if (!curves || !curves.head || curves.head.length === 0) return

    const q = curves.head.map((p: any) => p.caudal)
    const head = curves.head.map((p: any) => p.valor)

    if (!q.length || !head.length) return

    const operatingRange = curves.operating_range || { min_q: q[0], max_q: q[q.length - 1] }
    const minQ = operatingRange.min_q ?? q[0]
    const maxQRange = operatingRange.max_q ?? q[q.length - 1]

    q.forEach((value: number) => allQValues.add(value))
    allQValues.add(minQ)
    allQValues.add(maxQRange)

    const efficiencyQ = curves.efficiency ? curves.efficiency.map((p: any) => p.caudal) : null
    const efficiencyValues = curves.efficiency ? curves.efficiency.map((p: any) => p.valor * 100) : null
    const bhpValues = curves.bhp ? curves.bhp.map((p: any) => p.valor) : null

    curveMeta.push({
      freq,
      q,
      head,
      minQ,
      maxQ: maxQRange
    })

    const maxCurveQ = Math.max(...q)
    const maxCurveHead = Math.max(...head)
    maxQ = Math.max(maxQ, maxCurveQ, maxQRange)
    maxHead = Math.max(maxHead, maxCurveHead)

    data.push({
      x: q,
      y: head,
      type: 'scatter',
      mode: 'lines',
      name: `${freq.toFixed(1)} Hz`,
      line: { color: colors[idx % colors.length], width: 3 },
      hovertemplate: `<b>${freq.toFixed(1)} Hz</b><br>Q: %{x:.2f} m³/d<br>Head: %{y:.2f} m<extra></extra>`
    })

    if (efficiencyQ && efficiencyValues && efficiencyValues.length > 0) {
      const maxEffValue = Math.max(...efficiencyValues)
      const maxEffIndex = efficiencyValues.indexOf(maxEffValue)
      const bepQ = efficiencyQ[maxEffIndex]
      const bepHead = interpolateValue(q, head, bepQ)

      if (bepHead !== null) {
        bepPoints.push({
          freq,
          q: bepQ,
          head: bepHead,
          efficiency: maxEffValue
        })
        allQValues.add(bepQ)
        maxQ = Math.max(maxQ, bepQ)
        maxHead = Math.max(maxHead, bepHead)
      }
    }

    demandSeries.forEach((series) => {
      const intersection = findPumpDemandIntersection(q, head, series.q, series.head)
      if (!intersection) {
        return
      }

      const effAtPoint = efficiencyValues
        ? interpolateValue(efficiencyQ || q, efficiencyValues, intersection.q)
        : null
      const bhpAtPoint = bhpValues ? interpolateValue(q, bhpValues, intersection.q) : null

      if (!scenarioOperatingPoints[series.key]) {
        scenarioOperatingPoints[series.key] = []
      }

      scenarioOperatingPoints[series.key].push({
        freq,
        q: intersection.q,
        head: intersection.head,
        efficiency: effAtPoint,
        bhp: bhpAtPoint
      })

      allQValues.add(intersection.q)
      maxQ = Math.max(maxQ, intersection.q)
      maxHead = Math.max(maxHead, intersection.head)
    })
  })

  const qSamples = Array.from(allQValues).sort((a, b) => a - b)
  const topBoundary: { q: number; head: number }[] = []
  const bottomBoundary: { q: number; head: number }[] = []

  qSamples.forEach((qVal) => {
    const headCandidates: number[] = []

    curveMeta.forEach((curve) => {
      if (qVal < curve.minQ || qVal > curve.maxQ) return
      const headVal = interpolateValue(curve.q, curve.head, qVal)
      if (headVal !== null && isFinite(headVal)) {
        headCandidates.push(headVal)
      }
    })

    if (headCandidates.length >= 2) {
      const maxHeadAtQ = Math.max(...headCandidates)
      const minHeadAtQ = Math.min(...headCandidates)
      topBoundary.push({ q: qVal, head: maxHeadAtQ })
      bottomBoundary.push({ q: qVal, head: minHeadAtQ })
    }
  })

  if (topBoundary.length >= 2 && bottomBoundary.length >= 2) {
    const upperX = topBoundary.map((point) => point.q)
    const upperY = topBoundary.map((point) => point.head)
    const lowerX = bottomBoundary.slice().reverse().map((point) => point.q)
    const lowerY = bottomBoundary.slice().reverse().map((point) => point.head)

    const envelopeX = [...upperX, ...lowerX, upperX[0]]
    const envelopeY = [...upperY, ...lowerY, upperY[0]]

    maxHead = Math.max(maxHead, ...upperY)

    data.unshift({
      x: envelopeX,
      y: envelopeY,
      fill: 'toself',
      fillcolor: 'rgba(46, 204, 113, 0.15)',
      line: { width: 0 },
      type: 'scatter',
      mode: 'lines',
      name: 'Operating Range Envelope',
      showlegend: true,
      hoverinfo: 'skip'
    })
  }

  if (bepPoints.length > 0) {
    const sortedBepPoints = [...bepPoints].sort((a, b) => a.freq - b.freq)

    data.push({
      x: sortedBepPoints.map((point) => point.q),
      y: sortedBepPoints.map((point) => point.head),
      type: 'scatter',
      mode: 'lines+markers',
      name: 'BEP Path',
      line: { color: '#e67e22', width: 2, dash: 'dot' },
      marker: { color: '#e67e22', size: 9, symbol: 'diamond' },
      customdata: sortedBepPoints.map((point) => [point.freq, point.efficiency]),
      hovertemplate: '<b>%{customdata[0]:.1f} Hz BEP</b><br>Q: %{x:.2f} m³/d<br>Head: %{y:.2f} m<br>η: %{customdata[1]:.2f}%<extra></extra>'
    })
  }

  demandSeries.forEach((series) => {
    data.push({
      x: series.q,
      y: series.head,
      type: 'scatter',
      mode: 'lines',
      name: `${series.label} Demand (TDH)`,
      line: { color: series.color, width: 3, dash: series.dash || 'dot' },
      hovertemplate: `<b>${series.label} Demand</b><br>Q: %{x:.2f} m³/d<br>TDH: %{y:.2f} m<extra></extra>`,
      legendgroup: `demand-${series.key}`
    })

    const points = scenarioOperatingPoints[series.key] || []
    if (!points.length) {
      return
    }

    const sortedOperating = [...points].sort((a, b) => a.freq - b.freq)
    const hoverTexts = sortedOperating.map((point) => {
      const freqText = `${point.freq.toFixed(1)} Hz`
      const effText = point.efficiency !== null && isFinite(point.efficiency)
        ? `${point.efficiency.toFixed(2)} %`
        : 'N/A'
      const bhpText = point.bhp !== null && isFinite(point.bhp)
        ? `${point.bhp.toFixed(2)} HP`
        : 'N/A'

      return (
        `${series.label} – ${freqText}` +
        `<br>Q: ${point.q.toFixed(2)} m³/d` +
        `<br>TDH: ${point.head.toFixed(2)} m` +
        `<br>η: ${effText}` +
        `<br>BHP: ${bhpText}`
      )
    })

    data.push({
      x: sortedOperating.map((point) => point.q),
      y: sortedOperating.map((point) => point.head),
      type: 'scatter',
      mode: 'markers',
      name: `${series.label} Operating Points`,
      legendgroup: `demand-${series.key}`,
      marker: {
        color: series.color,
        size: 14,
        symbol: series.symbol || 'star',
        line: { color: '#ffffff', width: 2 }
      },
      text: hoverTexts,
      hovertemplate: '%{text}<extra></extra>'
    })
  })

  const effectiveMaxQ = maxQ > 0 ? maxQ * 1.05 : 1
  const effectiveMaxHead = maxHead > 0 ? maxHead * 1.1 : 1
  
  // NO mostrar IPR en vista multifrecuencia (Combined System)
  // El IPR solo se muestra en la pestaña dedicada "IPR Analysis"
  
  const layout = {
    title: {
      text: 'Multi-Frequency TDH Curves',
      font: {
        size: 24,
        color: '#2c3e50',
        family: 'Segoe UI, sans-serif',
        weight: 700
      }
    },
    xaxis: {
      title: {
        text: 'Flow Rate (Q - m³/d)',
        font: { size: 16, color: '#34495e', weight: 600 }
      },
      range: [0, effectiveMaxQ],
      showgrid: true,
      gridcolor: '#ecf0f1',
      zeroline: true,
      zerolinecolor: '#95a5a6',
      zerolinewidth: 2
    },
    yaxis: {
      title: {
        text: 'Head (m)',
        font: { size: 16, color: '#3498db', weight: 600 }
      },
      range: [0, effectiveMaxHead],
      showgrid: true,
      gridcolor: '#ecf0f1',
      zeroline: true,
      zerolinecolor: '#95a5a6',
      zerolinewidth: 2
    },
    legend: {
      orientation: 'h',
      yanchor: 'bottom',
      y: 1.18,
      xanchor: 'center',
      x: 0.5,
      bgcolor: 'rgba(255, 255, 255, 0.85)',
      bordercolor: '#95a5a6',
      borderwidth: 1,
      font: { size: 12, weight: 600 }
    },
    plot_bgcolor: '#fafafa',
    paper_bgcolor: 'white',
    hovermode: 'closest',
  margin: { l: 80, r: 80, t: 160, b: 90 }
  }
  
  const config = {
    responsive: true,
    displayModeBar: true,
    displaylogo: false,
    modeBarButtonsToRemove: ['lasso2d', 'select2d'],
    toImageButtonOptions: {
      format: 'png',
      filename: 'multi_freq_pump_curves',
      height: 800,
      width: 1200,
      scale: 2
    }
  }
  
  return (
    <div className="plot-container">
      <Plot 
        data={data} 
        layout={layout} 
        config={config}
  style={{ width: '100%', height: '660px' }} 
        useResizeHandler={true} 
      />
    </div>
  )
}

// Componente para comparación de bombas
function ComparisonPlot({ comparisonData }: any) {
  const { pumps, curveType } = comparisonData
  const colors = ['#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c']
  
  if (!pumps || pumps.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '32px', color: '#7f8c8d', fontSize: '1.1rem' }}>
        👆 Select pumps to compare
      </div>
    )
  }
  
  const data: any[] = []
  let maxValue = 0
  let maxQ = 0
  
  // Etiquetas para cada tipo de curva
  const curveLabels = {
    head: { name: 'Head (m)', unit: 'm' },
    bhp: { name: 'BHP (HP)', unit: 'HP' },
    efficiency: { name: 'Efficiency (%)', unit: '%' }
  }
  
  pumps.forEach((pump: any, pumpIdx: number) => {
    if (!pump.curves) return
    
    const color = colors[pumpIdx % colors.length]
    
    // Si la bomba está en modo multi-frecuencia
    if (pump.multiFreq && Array.isArray(pump.curves)) {
      // Mostrar solo el envelope (región sombreada)
      const minQPoints: number[] = []
      const maxQPoints: number[] = []
      const minYPoints: number[] = []
      const maxYPoints: number[] = []
      
      pump.curves.forEach((item: any) => {
        const curves = item.curves
        if (!curves || !curves[curveType]) return
        
        const operatingRange = curves.operating_range || { min_q: 0, max_q: 0 }
        const minQ = operatingRange.min_q
        const maxQVal = operatingRange.max_q
        
        // Encontrar valores Y en min y max Q
        const pointAtMinQ = curves[curveType].find((p: any) => p.caudal >= minQ)
        const pointAtMaxQ = curves[curveType].find((p: any) => p.caudal >= maxQVal)
        
        if (pointAtMinQ && pointAtMaxQ) {
          minQPoints.push(minQ)
          maxQPoints.push(maxQVal)
          
          let minYVal = pointAtMinQ.valor
          let maxYVal = pointAtMaxQ.valor
          
          if (curveType === 'efficiency') {
            minYVal *= 100
            maxYVal *= 100
          }
          
          minYPoints.push(minYVal)
          maxYPoints.push(maxYVal)
          
          maxValue = Math.max(maxValue, minYVal, maxYVal)
          maxQ = Math.max(maxQ, minQ, maxQVal)
        }
      })
      
      // Crear polígono del envelope
      if (minQPoints.length > 0 && maxQPoints.length > 0) {
        const envelopeX = [...minQPoints, ...maxQPoints.reverse(), minQPoints[0]]
        const envelopeY = [...minYPoints, ...maxYPoints.reverse(), minYPoints[0]]
        
        data.push({
          x: envelopeX,
          y: envelopeY,
          fill: 'toself',
          fillcolor: `${color}33`, // 33 = 20% opacity en hex
          line: { color: color, width: 2 },
          type: 'scatter',
          mode: 'lines',
          name: `${pump.name} (Multi-Freq)`,
          showlegend: true,
          hovertemplate: `<b>${pump.name}</b><br>Q: %{x:.2f} m³/d<br>${curveLabels[curveType].name}: %{y:.2f} ${curveLabels[curveType].unit}<extra></extra>`
        })
      }
    } else {
      // Modo frecuencia única - mostrar curva completa
      const curves = pump.curves
      if (!curves || !curves[curveType]) return
      
      const q = curves[curveType].map((p: any) => p.caudal)
      let values = curves[curveType].map((p: any) => p.valor)
      
      if (curveType === 'efficiency') {
        values = values.map((v: number) => v * 100)
      }
      
      maxQ = Math.max(maxQ, ...q)
      maxValue = Math.max(maxValue, ...values)
      
      // Agregar región sombreada para el rango de operación
      const operatingRange = curves.operating_range || { min_q: 0, max_q: 0 }
      if (operatingRange.min_q > 0 && operatingRange.max_q > 0) {
        data.push({
          x: [operatingRange.min_q, operatingRange.min_q, operatingRange.max_q, operatingRange.max_q, operatingRange.min_q],
          y: [0, maxValue * 1.5, maxValue * 1.5, 0, 0],
          fill: 'toself',
          fillcolor: `${color}1A`, // 1A = 10% opacity
          line: { width: 0 },
          type: 'scatter',
          mode: 'lines',
          name: `${pump.name} Range`,
          showlegend: false,
          hoverinfo: 'skip'
        })
      }
      
      // Curva principal
      data.push({
        x: q,
        y: values,
        type: 'scatter',
        mode: 'lines',
        name: pump.name,
        line: { color: color, width: 3 },
        hovertemplate: `<b>${pump.name}</b><br>Q: %{x:.2f} m³/d<br>${curveLabels[curveType].name}: %{y:.2f} ${curveLabels[curveType].unit}<extra></extra>`
      })
      
      // Agregar BEP si es efficiency
      if (curveType === 'efficiency') {
        const maxEff = Math.max(...values)
        const maxEffIndex = values.indexOf(maxEff)
        const bepQ = q[maxEffIndex]
        
        data.push({
          x: [bepQ],
          y: [maxEff],
          mode: 'markers',
          type: 'scatter',
          marker: { color: color, size: 12, symbol: 'diamond', line: { color: 'white', width: 2 } },
          name: `${pump.name} BEP`,
          showlegend: false,
          hovertemplate: `<b>${pump.name} BEP</b><br>Q: %{x:.2f} m³/d<br>Efficiency: %{y:.2f}%<extra></extra>`
        })
      }
    }
  })
  
  const layout = {
    title: {
      text: `Pump Comparison - ${curveLabels[curveType].name}`,
      font: {
        size: 24,
        color: '#2c3e50',
        family: 'Segoe UI, sans-serif',
        weight: 700
      }
    },
    xaxis: {
      title: {
        text: 'Flow Rate (Q - m³/d)',
        font: { size: 16, color: '#34495e', weight: 600 }
      },
      range: [0, maxQ * 1.05],
      showgrid: true,
      gridcolor: '#ecf0f1',
      zeroline: true,
      zerolinecolor: '#95a5a6',
      zerolinewidth: 2
    },
    yaxis: {
      title: {
        text: curveLabels[curveType].name,
        font: { size: 16, color: '#34495e', weight: 600 }
      },
      range: [0, maxValue * 1.1],
      showgrid: true,
      gridcolor: '#ecf0f1',
      zeroline: true,
      zerolinecolor: '#95a5a6',
      zerolinewidth: 2
    },
    legend: {
      orientation: 'h',
      yanchor: 'bottom',
      y: 1.18,
      xanchor: 'center',
      x: 0.5,
      bgcolor: 'rgba(255, 255, 255, 0.85)',
      bordercolor: '#95a5a6',
      borderwidth: 1,
      font: { size: 12, weight: 600 }
    },
    plot_bgcolor: '#fafafa',
    paper_bgcolor: 'white',
    hovermode: 'closest',
  margin: { l: 80, r: 80, t: 160, b: 90 }
  }
  
  const config = {
    responsive: true,
    displayModeBar: true,
    displaylogo: false,
    modeBarButtonsToRemove: ['lasso2d', 'select2d'],
    toImageButtonOptions: {
      format: 'png',
      filename: `pump_comparison_${curveType}`,
      height: 800,
      width: 1200,
      scale: 2
    }
  }
  
  return (
    <div className="plot-container">
      <Plot 
        data={data} 
        layout={layout} 
        config={config}
  style={{ width: '100%', height: '660px' }} 
        useResizeHandler={true} 
      />
    </div>
  )
}

// Componente para mostrar eficiencias individuales dentro del rango operativo
function IndividualEfficiencyPlot({ data }: any) {
  const colors = ['#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6']
  
  if (!data || data.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '32px', color: '#7f8c8d', fontSize: '1.1rem' }}>
        No pump data available
      </div>
    )
  }
  
  const plotData: any[] = []
  let maxQ = 0
  let maxEff = 0
  
  data.forEach((pumpData: any, idx: number) => {
    const { name, curves } = pumpData
    
    if (!curves || !curves.efficiency || !curves.operating_range) return
    
    const operatingRange = curves.operating_range
    const minQ = operatingRange.min_q
    const maxQRange = operatingRange.max_q
    
    // Filtrar eficiencia solo dentro del rango operativo
    const efficiencyInRange = curves.efficiency.filter((p: any) => 
      p.caudal >= minQ && p.caudal <= maxQRange
    )
    
    if (efficiencyInRange.length === 0) return
    
    const q = efficiencyInRange.map((p: any) => p.caudal)
    const eff = efficiencyInRange.map((p: any) => p.valor * 100)
    
    maxQ = Math.max(maxQ, ...q)
    maxEff = Math.max(maxEff, ...eff)
    
    const color = colors[idx % colors.length]
    
    // Región sombreada del rango operativo
    plotData.push({
      x: [minQ, minQ, maxQRange, maxQRange, minQ],
      y: [0, 100, 100, 0, 0],
      fill: 'toself',
      fillcolor: `${color}1A`,
      line: { width: 0 },
      type: 'scatter',
      mode: 'lines',
      name: `${name} Range`,
      showlegend: false,
      hoverinfo: 'skip'
    })
    
    // Curva de eficiencia
    plotData.push({
      x: q,
      y: eff,
      type: 'scatter',
      mode: 'lines',
      name: name,
      line: { color: color, width: 3 },
      hovertemplate: `<b>${name}</b><br>Q: %{x:.2f} m³/d<br>Efficiency: %{y:.2f}%<extra></extra>`
    })
    
    // Encontrar y marcar el BEP
    const maxEffValue = Math.max(...eff)
    const maxEffIndex = eff.indexOf(maxEffValue)
    const bepQ = q[maxEffIndex]
    
    plotData.push({
      x: [bepQ],
      y: [maxEffValue],
      mode: 'markers',
      type: 'scatter',
      marker: { color: color, size: 12, symbol: 'diamond', line: { color: 'white', width: 2 } },
      name: `${name} BEP`,
      showlegend: false,
      hovertemplate: `<b>${name} BEP</b><br>Q: %{x:.2f} m³/d<br>Efficiency: %{y:.2f}%<extra></extra>`
    })
    
    // Líneas verticales para Q_min y Q_max
    plotData.push({
      x: [minQ, minQ],
      y: [0, 100],
      mode: 'lines',
      type: 'scatter',
      line: { color: color, width: 2, dash: 'dot' },
      name: `${name} Q_min`,
      showlegend: false,
      hoverinfo: 'skip'
    })
    
    plotData.push({
      x: [maxQRange, maxQRange],
      y: [0, 100],
      mode: 'lines',
      type: 'scatter',
      line: { color: color, width: 2, dash: 'dot' },
      name: `${name} Q_max`,
      showlegend: false,
      hoverinfo: 'skip'
    })
  })
  
  const layout = {
    title: {
      text: 'Individual Pump Efficiencies - Operating Range Comparison',
      font: { size: 24, color: '#2c3e50', family: 'Segoe UI, sans-serif', weight: 700 }
    },
    xaxis: {
      title: { text: 'Flow Rate (Q - m³/d)', font: { size: 16, color: '#34495e', weight: 600 } },
      range: [0, maxQ * 1.05],
      showgrid: true,
      gridcolor: '#ecf0f1',
      zeroline: true,
      zerolinecolor: '#95a5a6',
      zerolinewidth: 2
    },
    yaxis: {
      title: { text: 'Efficiency (%)', font: { size: 16, color: '#2ecc71', weight: 600 } },
      range: [0, Math.min(maxEff * 1.1, 100)],
      showgrid: true,
      gridcolor: '#ecf0f1',
      zeroline: true,
      zerolinecolor: '#95a5a6',
      zerolinewidth: 2
    },
    legend: {
      orientation: 'h',
      yanchor: 'bottom',
      y: 1.18,
      xanchor: 'center',
      x: 0.5,
      bgcolor: 'rgba(255, 255, 255, 0.85)',
      bordercolor: '#95a5a6',
      borderwidth: 1,
      font: { size: 12, weight: 600 }
    },
    plot_bgcolor: '#fafafa',
    paper_bgcolor: 'white',
    hovermode: 'closest',
  margin: { l: 80, r: 80, t: 160, b: 90 }
  }
  
  const config = {
    responsive: true,
    displayModeBar: true,
    displaylogo: false,
    modeBarButtonsToRemove: ['lasso2d', 'select2d'],
    toImageButtonOptions: {
      format: 'png',
      filename: 'individual_pump_efficiencies',
      height: 800,
      width: 1200,
      scale: 2
    }
  }
  
  return (
    <div className="plot-container">
      <Plot 
        data={plotData} 
        layout={layout} 
        config={config}
  style={{ width: '100%', height: '660px' }} 
        useResizeHandler={true} 
      />
    </div>
  )
}

// Componente para mostrar curvas de Head individuales dentro del rango operativo
function IndividualHeadPlot({ data, iprData, showIPR, pressureDemandCurve }: any) {
  const colors = ['#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6']
  
  if (!data || data.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '32px', color: '#7f8c8d', fontSize: '1.1rem' }}>
        No pump data available
      </div>
    )
  }
  
  const plotData: any[] = []
  let maxQ = 0
  let maxHead = 0
  const pumpDepth = typeof pressureDemandCurve?.components?.profundidad_bomba === 'number'
    ? pressureDemandCurve.components.profundidad_bomba
    : null

  const fluidGradient = typeof pressureDemandCurve?.components?.gradiente === 'number'
    ? pressureDemandCurve.components.gradiente
    : null

  let demandLine: { q: number[], head: number[], pip: number[], pwf: number[] } | null = null

  if (pressureDemandCurve && pressureDemandCurve.curve && pressureDemandCurve.curve.length > 0) {
    const demandQ = pressureDemandCurve.curve.map((p: any) => p.caudal)
    const demandHead = pressureDemandCurve.curve.map((p: any) => p.tdh)
    const demandPip = pressureDemandCurve.curve.map((p: any) => p.pip)
    const demandPwf = pressureDemandCurve.curve.map((p: any) => p.pwf)
    demandLine = { q: demandQ, head: demandHead, pip: demandPip, pwf: demandPwf }
    maxQ = Math.max(maxQ, ...demandQ)
    maxHead = Math.max(maxHead, ...demandHead)
  }
  
  data.forEach((pumpData: any, idx: number) => {
    const { name, curves } = pumpData
    
    if (!curves || !curves.head || !curves.operating_range) return
    
    const operatingRange = curves.operating_range
    const minQ = operatingRange.min_q
    const maxQRange = operatingRange.max_q
    
    // Filtrar head solo dentro del rango operativo
    const headInRange = curves.head.filter((p: any) => 
      p.caudal >= minQ && p.caudal <= maxQRange
    )
    
    if (headInRange.length === 0) return
    
    const q = headInRange.map((p: any) => p.caudal)
    const head = headInRange.map((p: any) => p.valor)
    
    maxQ = Math.max(maxQ, ...q)
    maxHead = Math.max(maxHead, ...head)
    
    const color = colors[idx % colors.length]
    
    // Región sombreada del rango operativo
    plotData.push({
      x: [minQ, minQ, maxQRange, maxQRange, minQ],
      y: [0, maxHead * 2, maxHead * 2, 0, 0],
      fill: 'toself',
      fillcolor: `${color}1A`,
      line: { width: 0 },
      type: 'scatter',
      mode: 'lines',
      name: `${name} Range`,
      showlegend: false,
      hoverinfo: 'skip'
    })
    
    // Curva de Head
    plotData.push({
      x: q,
      y: head,
      type: 'scatter',
      mode: 'lines',
      name: name,
      line: { color: color, width: 3 },
      hovertemplate: `<b>${name}</b><br>Q: %{x:.2f} m³/d<br>Head: %{y:.2f} m<extra></extra>`
    })
    
    // Encontrar y marcar el punto de máximo Head
    const maxHeadValue = Math.max(...head)
    const maxHeadIndex = head.indexOf(maxHeadValue)
    const peakQ = q[maxHeadIndex]
    
    plotData.push({
      x: [peakQ],
      y: [maxHeadValue],
      mode: 'markers',
      type: 'scatter',
      marker: { color: color, size: 12, symbol: 'diamond', line: { color: 'white', width: 2 } },
      name: `${name} Peak`,
      showlegend: false,
      hovertemplate: `<b>${name} Peak Head</b><br>Q: %{x:.2f} m³/d<br>Head: %{y:.2f} m<extra></extra>`
    })
    
    // Líneas verticales para Q_min y Q_max
    plotData.push({
      x: [minQ, minQ],
      y: [0, maxHead * 2],
      mode: 'lines',
      type: 'scatter',
      line: { color: color, width: 2, dash: 'dot' },
      name: `${name} Q_min`,
      showlegend: false,
      hoverinfo: 'skip'
    })
    
    plotData.push({
      x: [maxQRange, maxQRange],
      y: [0, maxHead * 2],
      mode: 'lines',
      type: 'scatter',
      line: { color: color, width: 2, dash: 'dot' },
      name: `${name} Q_max`,
      showlegend: false,
      hoverinfo: 'skip'
    })

    if (demandLine) {
      const intersection = findPumpDemandIntersection(q, head, demandLine.q, demandLine.head)
      if (intersection) {
        const effCurve = curves.efficiency ? curves.efficiency.map((p: any) => p.valor * 100) : null
        const bhpCurve = curves.bhp ? curves.bhp.map((p: any) => p.valor) : null
        const efficiencyAtPoint = effCurve ? interpolateValue(q, effCurve, intersection.q) : null
        const bhpAtPoint = bhpCurve ? interpolateValue(q, bhpCurve, intersection.q) : null
        let pipAtPoint: number | null = null
        let pwfAtPoint: number | null = null
        let fluidLevelAtPoint: number | null = null
        let submergenceAtPoint: number | null = null

        if (demandLine && demandLine.pip.length > 0) {
          pipAtPoint = interpolateValue(demandLine.q, demandLine.pip, intersection.q)
        }

        if (demandLine && demandLine.pwf.length > 0) {
          pwfAtPoint = interpolateValue(demandLine.q, demandLine.pwf, intersection.q)
        }

        if (
          pwfAtPoint !== null &&
          typeof fluidGradient === 'number' &&
          fluidGradient > 0
        ) {
          const rawSubmergence = pwfAtPoint / fluidGradient
          if (isFinite(rawSubmergence)) {
            submergenceAtPoint = Math.max(rawSubmergence, 0)
          }
        }

        if (submergenceAtPoint !== null && typeof pumpDepth === 'number') {
          const rawFluidLevel = pumpDepth - submergenceAtPoint
          if (isFinite(rawFluidLevel)) {
            fluidLevelAtPoint = Math.min(Math.max(rawFluidLevel, 0), pumpDepth)
          }
        }

        plotData.push({
          x: [intersection.q],
          y: [intersection.head],
          mode: 'markers',
          type: 'scatter',
          marker: {
            color: color,
            size: 14,
            symbol: 'star',
            line: { color: 'white', width: 2 }
          },
          name: `${name} Operating Point`,
          showlegend: false,
          hovertemplate:
            `<b>${name} · Operating Point</b><br>` +
            `Flow: ${intersection.q.toFixed(2)} m³/d<br>` +
            `TDH: ${intersection.head.toFixed(2)} m` +
            (efficiencyAtPoint !== null ? `<br>Efficiency: ${efficiencyAtPoint.toFixed(2)} %` : '') +
            (bhpAtPoint !== null ? `<br>BHP: ${bhpAtPoint.toFixed(2)} HP` : '') +
    (pipAtPoint !== null ? `<br>PIP: ${pipAtPoint.toFixed(2)} bar` : '') +
    (pwfAtPoint !== null ? `<br>Pwf: ${pwfAtPoint.toFixed(2)} bar` : '') +
            (fluidLevelAtPoint !== null ? `<br>Fluid Level: ${fluidLevelAtPoint.toFixed(2)} m` : '') +
            (submergenceAtPoint !== null ? `<br>Submergence: ${submergenceAtPoint.toFixed(2)} m` : '') +
            '<extra></extra>'
        })
      }
    }
  })
  
  if (demandLine) {
    plotData.push({
      x: demandLine.q,
      y: demandLine.head,
      type: 'scatter',
      mode: 'lines',
      name: 'System Demand (TDH)',
      line: { color: '#c0392b', width: 3, dash: 'dot' },
      hovertemplate: '<b>System Demand</b><br>Q: %{x:.2f} m³/d<br>TDH: %{y:.2f} m<extra></extra>'
    })
  }

  // NO mostrar IPR en vista de Head individual (Combined System)
  // El IPR solo se muestra en la pestaña dedicada "IPR Analysis"
  
  const layout = {
    title: {
      text: 'Individual Pump Head Curves - Operating Range Comparison',
      font: { size: 24, color: '#2c3e50', family: 'Segoe UI, sans-serif', weight: 700 }
    },
    xaxis: {
      title: { text: 'Flow Rate (Q - m³/d)', font: { size: 16, color: '#34495e', weight: 600 } },
      range: [0, maxQ * 1.05],
      showgrid: true,
      gridcolor: '#ecf0f1',
      zeroline: true,
      zerolinecolor: '#95a5a6',
      zerolinewidth: 2
    },
    yaxis: {
      title: { text: 'Head (m)', font: { size: 16, color: '#e74c3c', weight: 600 } },
      range: [0, maxHead * 1.1],
      showgrid: true,
      gridcolor: '#ecf0f1',
      zeroline: true,
      zerolinecolor: '#95a5a6',
      zerolinewidth: 2
    },
    legend: {
      orientation: 'h',
      yanchor: 'bottom',
      y: 1.18,
      xanchor: 'center',
      x: 0.5,
      bgcolor: 'rgba(255, 255, 255, 0.85)',
      bordercolor: '#95a5a6',
      borderwidth: 1,
      font: { size: 12, weight: 600 }
    },
    plot_bgcolor: '#fafafa',
    paper_bgcolor: 'white',
    hovermode: 'closest',
  margin: { l: 80, r: 80, t: 160, b: 90 }
  }
  
  const config = {
    responsive: true,
    displayModeBar: true,
    displaylogo: false,
    modeBarButtonsToRemove: ['lasso2d', 'select2d'],
    toImageButtonOptions: {
      format: 'png',
      filename: 'individual_pump_head',
      height: 800,
      width: 1200,
      scale: 2
    }
  }
  
  return (
    <div className="plot-container">
      <Plot 
        data={plotData} 
        layout={layout} 
        config={config}
  style={{ width: '100%', height: '660px' }} 
        useResizeHandler={true} 
      />
    </div>
  )
}

// Componente para mostrar curvas de BHP individuales dentro del rango operativo
function IndividualBhpPlot({ data }: any) {
  const colors = ['#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6']
  
  if (!data || data.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '32px', color: '#7f8c8d', fontSize: '1.1rem' }}>
        No pump data available
      </div>
    )
  }
  
  const plotData: any[] = []
  let maxQ = 0
  let maxBhp = 0
  
  data.forEach((pumpData: any, idx: number) => {
    const { name, curves } = pumpData
    
    if (!curves || !curves.bhp || !curves.operating_range) return
    
    const operatingRange = curves.operating_range
    const minQ = operatingRange.min_q
    const maxQRange = operatingRange.max_q
    
    // Filtrar BHP solo dentro del rango operativo
    const bhpInRange = curves.bhp.filter((p: any) => 
      p.caudal >= minQ && p.caudal <= maxQRange
    )
    
    if (bhpInRange.length === 0) return
    
    const q = bhpInRange.map((p: any) => p.caudal)
    const bhp = bhpInRange.map((p: any) => p.valor)
    
    maxQ = Math.max(maxQ, ...q)
    maxBhp = Math.max(maxBhp, ...bhp)
    
    const color = colors[idx % colors.length]
    
    // Región sombreada del rango operativo
    plotData.push({
      x: [minQ, minQ, maxQRange, maxQRange, minQ],
      y: [0, maxBhp * 2, maxBhp * 2, 0, 0],
      fill: 'toself',
      fillcolor: `${color}1A`,
      line: { width: 0 },
      type: 'scatter',
      mode: 'lines',
      name: `${name} Range`,
      showlegend: false,
      hoverinfo: 'skip'
    })
    
    // Curva de BHP
    plotData.push({
      x: q,
      y: bhp,
      type: 'scatter',
      mode: 'lines',
      name: name,
      line: { color: color, width: 3 },
      hovertemplate: `<b>${name}</b><br>Q: %{x:.2f} m³/d<br>BHP: %{y:.2f} HP<extra></extra>`
    })
    
    // Encontrar y marcar el punto de mínimo BHP (más eficiente)
    const minBhpValue = Math.min(...bhp)
    const minBhpIndex = bhp.indexOf(minBhpValue)
    const minBhpQ = q[minBhpIndex]
    
    plotData.push({
      x: [minBhpQ],
      y: [minBhpValue],
      mode: 'markers',
      type: 'scatter',
      marker: { color: color, size: 12, symbol: 'diamond', line: { color: 'white', width: 2 } },
      name: `${name} Min BHP`,
      showlegend: false,
      hovertemplate: `<b>${name} Min BHP</b><br>Q: %{x:.2f} m³/d<br>BHP: %{y:.2f} HP<extra></extra>`
    })
    
    // Líneas verticales para Q_min y Q_max
    plotData.push({
      x: [minQ, minQ],
      y: [0, maxBhp * 2],
      mode: 'lines',
      type: 'scatter',
      line: { color: color, width: 2, dash: 'dot' },
      name: `${name} Q_min`,
      showlegend: false,
      hoverinfo: 'skip'
    })
    
    plotData.push({
      x: [maxQRange, maxQRange],
      y: [0, maxBhp * 2],
      mode: 'lines',
      type: 'scatter',
      line: { color: color, width: 2, dash: 'dot' },
      name: `${name} Q_max`,
      showlegend: false,
      hoverinfo: 'skip'
    })
  })
  
  const layout = {
    title: {
      text: 'Individual Pump BHP Curves - Operating Range Comparison',
      font: { size: 24, color: '#2c3e50', family: 'Segoe UI, sans-serif', weight: 700 }
    },
    xaxis: {
      title: { text: 'Flow Rate (Q - m³/d)', font: { size: 16, color: '#34495e', weight: 600 } },
      range: [0, maxQ * 1.05],
      showgrid: true,
      gridcolor: '#ecf0f1',
      zeroline: true,
      zerolinecolor: '#95a5a6',
      zerolinewidth: 2
    },
    yaxis: {
      title: { text: 'BHP (HP)', font: { size: 16, color: '#f39c12', weight: 600 } },
      range: [0, maxBhp * 1.1],
      showgrid: true,
      gridcolor: '#ecf0f1',
      zeroline: true,
      zerolinecolor: '#95a5a6',
      zerolinewidth: 2
    },
    legend: {
      orientation: 'h',
      yanchor: 'bottom',
      y: 1.18,
      xanchor: 'center',
      x: 0.5,
      bgcolor: 'rgba(255, 255, 255, 0.85)',
      bordercolor: '#95a5a6',
      borderwidth: 1,
      font: { size: 12, weight: 600 }
    },
    plot_bgcolor: '#fafafa',
    paper_bgcolor: 'white',
    hovermode: 'closest',
  margin: { l: 80, r: 80, t: 160, b: 90 }
  }
  
  const config = {
    responsive: true,
    displayModeBar: true,
    displaylogo: false,
    modeBarButtonsToRemove: ['lasso2d', 'select2d'],
    toImageButtonOptions: {
      format: 'png',
      filename: 'individual_pump_bhp',
      height: 800,
      width: 1200,
      scale: 2
    }
  }
  
  return (
    <div className="plot-container">
      <Plot 
        data={plotData} 
        layout={layout} 
        config={config}
  style={{ width: '100%', height: '660px' }} 
        useResizeHandler={true} 
      />
    </div>
  )
}

// Componente dedicado para IPR Analysis - SOLO curva IPR
function IPRPlot({
  iprData,
  pressureDemandCurve,
  pressureDemandScenarios,
  iprScenarios,
  scenarioVisibility,
  scenarioStyles,
  scenarioOrder,
  activeScenarioKey
}: any) {
  if (!iprData || !iprData.curve) {
    return (
      <div style={{ textAlign: 'center', padding: '32px', color: '#7f8c8d', fontSize: '1.1rem' }}>
        📊 Configure IPR parameters to see the well performance curve
      </div>
    )
  }

  const configuredOrder = Array.isArray(scenarioOrder) && scenarioOrder.length > 0
    ? scenarioOrder
    : Object.keys(iprScenarios || {})

  const activeKeys = configuredOrder.filter((key) => scenarioVisibility?.[key])
  const fallbackKey = activeScenarioKey
    || (configuredOrder.includes('conservative') ? 'conservative' : configuredOrder[0])
    || 'conservative'

  const iprSeries: any[] = []
  const demandSeries: any[] = []
  const iprSourceMap = iprScenarios || {}
  const demandSourceMap = pressureDemandScenarios || {}
  const baseIprSource = iprData
  const baseDemandSource = pressureDemandCurve

  const pushIprSeries = (key: string, source: any) => {
    if (!source || !Array.isArray(source.curve) || source.curve.length === 0) {
      return
    }
    if (iprSeries.some((series) => series.key === key)) {
      return
    }

    const style = resolveScenarioStyle(key, scenarioStyles)
    const qValues = source.curve.map((p: any) => p.caudal)
    const pwfValues = source.curve.map((p: any) => p.pwf)
    const nivelValues = source.curve.map((p: any) => p.nivel || 0)

    if (!qValues.length || !pwfValues.length) {
      return
    }

    iprSeries.push({
      key,
      label: style.label,
      color: style.color,
      dash: key === 'conservative' ? 'solid' : style.dash || 'dashdot',
      q: qValues,
      pwf: pwfValues,
      nivel: nivelValues,
      source
    })
  }

  const pushDemandSeries = (key: string, source: any) => {
    if (!source || !Array.isArray(source.curve) || source.curve.length === 0) {
      return
    }
    if (demandSeries.some((series) => series.key === key)) {
      return
    }

    const style = resolveScenarioStyle(key, scenarioStyles)
    const qValues = source.curve.map((p: any) => p.caudal)
    const tdhValues = source.curve.map((p: any) => p.tdh)

    if (!qValues.length || !tdhValues.length) {
      return
    }

    const gradient = source.components?.gradiente
      || pressureDemandCurve?.components?.gradiente
      || 0.0981
    const tdhBarValues = tdhValues.map((value: number) => value * gradient)
    const pipValues = source.curve.map((p: any) => p.pip ?? null)
    const frictionValues = source.curve.map((p: any) => p.perdidas_friccion ?? null)

    demandSeries.push({
      key,
      label: style.label,
      color: style.color,
      dash: style.dash || 'dot',
      symbol: style.symbol || 'star',
      q: qValues,
      tdh: tdhValues,
      tdhBar: tdhBarValues,
      pip: pipValues,
      friction: frictionValues,
      gradient,
      source
    })
  }

  const keysToPlot = (activeKeys.length > 0 ? activeKeys : [fallbackKey]).filter(Boolean)

  keysToPlot.forEach((key) => {
    const iprSource = iprSourceMap[key] || (key === 'conservative' ? baseIprSource : null)
    if (iprSource) {
      pushIprSeries(key, iprSource)
    }

    const demandSource = demandSourceMap[key] || (key === 'conservative' ? baseDemandSource : null)
    if (demandSource) {
      pushDemandSeries(key, demandSource)
    }
  })

  if (!iprSeries.length && baseIprSource) {
    pushIprSeries('conservative', baseIprSource)
  }
  if (!demandSeries.length && baseDemandSource) {
    pushDemandSeries('conservative', baseDemandSource)
  }

  const primarySeries =
    iprSeries.find((series) => series.key === (activeScenarioKey || 'conservative')) || iprSeries[0]
  const primaryKey = primarySeries ? primarySeries.key : null

  let maxQ = 0
  let maxPwf = 0
  iprSeries.forEach((series) => {
    if (series.q.length) {
      maxQ = Math.max(maxQ, ...series.q, maxQ)
    }
    if (series.pwf.length) {
      maxPwf = Math.max(maxPwf, ...series.pwf, maxPwf)
    }
  })

  let maxDemandTDH_m = 0
  let maxDemandTDH_bar = 0
  demandSeries.forEach((series) => {
    if (series.q.length) {
      maxQ = Math.max(maxQ, ...series.q, maxQ)
    }
    if (series.tdh.length) {
      maxDemandTDH_m = Math.max(maxDemandTDH_m, ...series.tdh, maxDemandTDH_m)
    }
    if (series.tdhBar.length) {
      maxDemandTDH_bar = Math.max(maxDemandTDH_bar, ...series.tdhBar, maxDemandTDH_bar)
    }
  })

  const plotData: any[] = []

  iprSeries.forEach((series) => {
    plotData.push({
      x: series.q,
      y: series.pwf,
      type: 'scatter',
      mode: 'lines',
      name: `IPR - ${series.label}`,
      line: { color: series.color, width: 4, dash: series.dash },
      yaxis: 'y',
      customdata: series.nivel,
      hovertemplate: `<b>${series.label} IPR</b><br>Q: %{x:.2f} m³/d<br>Pwf: %{y:.2f} bar<br>Nivel: %{customdata:.2f} m<extra></extra>`
    })
  })

  const primarySource = primarySeries?.source || baseIprSource
  const qMaxValue = typeof primarySource?.q_max === 'number' ? primarySource.q_max : iprData.q_max
  if (typeof qMaxValue === 'number') {
    plotData.push({
      x: [qMaxValue],
      y: [0],
      mode: 'markers',
      type: 'scatter',
      marker: { color: '#e67e22', size: 14, symbol: 'diamond', line: { color: 'white', width: 2 } },
      name: `Q_max (${(primarySeries?.label || iprData.method)})`,
      yaxis: 'y',
      showlegend: true,
      hovertemplate: `<b>Q_max</b><br>Q: ${qMaxValue.toFixed(2)} m³/d<extra></extra>`
    })
  }

  demandSeries.forEach((series) => {
    plotData.push({
      x: series.q,
      y: series.tdh,
      type: 'scatter',
      mode: 'lines',
      name: `${series.label} Demand (TDH - m)`,
      line: { color: series.color, width: 3, dash: series.dash || 'solid' },
      yaxis: 'y2',
      customdata: series.q.map((_: number, idx: number) => ({
        pip: series.pip[idx],
        friction: series.friction[idx],
        pressure: series.tdhBar[idx]
      })),
      hovertemplate: `<b>${series.label} Demand</b><br>Q: %{x:.2f} m³/d<br>TDH: %{y:.2f} m (%{customdata.pressure:.2f} bar)<br>PIP: %{customdata.pip:.2f} bar<br>Friction: %{customdata.friction:.2f} bar<extra></extra>`
    })

    if (series.key === primaryKey) {
      plotData.push({
        x: series.q,
        y: series.tdhBar,
        type: 'scatter',
        mode: 'lines',
        name: `${series.label} Demand (bar)`,
        line: { color: series.color, width: 2, dash: 'dot' },
        yaxis: 'y3',
        showlegend: true,
        hovertemplate: `<b>${series.label} Demand (Pressure)</b><br>Q: %{x:.2f} m³/d<br>Pressure: %{y:.2f} bar<extra></extra>`
      })
    }
  })

  const gradiente = iprData.parameters?.gradiente || null
  const gradoApi = iprData.parameters?.grado_api || null
  const aguaPorcentaje = iprData.parameters?.agua_porcentaje || null

  let titleText = `IPR Analysis - ${iprData.method}`
  if (primarySeries?.label) {
    titleText += ` (${primarySeries.label})`
  }
  if (demandSeries.length) {
    titleText += ' & System Demand Curves'
  }
  if (gradiente && gradoApi !== null && aguaPorcentaje !== null) {
    titleText += `<br><sub>Oil: ${gradoApi}°API | Water: ${aguaPorcentaje}% | Gradient: ${gradiente.toFixed(4)} bar/m</sub>`
  }

  const effectiveMaxQ = maxQ > 0 ? maxQ * 1.1 : 1
  const effectiveMaxPwf = maxPwf > 0 ? maxPwf * 1.1 : 10
  const effectiveMaxTDH = maxDemandTDH_m > 0 ? maxDemandTDH_m * 1.1 : 100
  const effectiveMaxPressure = maxDemandTDH_bar > 0 ? maxDemandTDH_bar * 1.1 : 10

  const layout = {
    title: {
      text: titleText,
      font: { size: 24, color: '#2c3e50', family: 'Segoe UI, sans-serif', weight: 700 }
    },
    xaxis: {
      title: { text: 'Flow Rate (Q - m³/d)', font: { size: 16, color: '#34495e', weight: 600 } },
      range: [0, effectiveMaxQ],
      showgrid: true,
      gridcolor: '#ecf0f1',
      zeroline: true,
      zerolinecolor: '#95a5a6',
      zerolinewidth: 2
    },
    yaxis: {
      title: { text: 'IPR Pressure (Pwf - bar)', font: { size: 16, color: '#16a085', weight: 600 } },
      range: [0, effectiveMaxPwf],
      showgrid: true,
      gridcolor: '#ecf0f1',
      zeroline: true,
      zerolinecolor: '#95a5a6',
      zerolinewidth: 2,
      side: 'left'
    },
    yaxis2: {
      title: { text: 'System Demand (TDH - m)', font: { size: 15, color: '#e74c3c', weight: 600 } },
      overlaying: 'y',
      side: 'right',
      showgrid: false,
      zeroline: false,
      range: [0, Math.max(effectiveMaxTDH, 100)],
      position: 0.93
    },
    yaxis3: {
      title: { text: 'System Demand (bar)', font: { size: 13, color: '#c0392b', weight: 600 } },
      overlaying: 'y',
      side: 'right',
      anchor: 'free',
      position: 1.0,
      showgrid: false,
      zeroline: false,
      range: [0, Math.max(effectiveMaxPressure, 10)]
    },
    legend: {
      orientation: 'h',
      yanchor: 'bottom',
      y: 1.16,
      xanchor: 'center',
      x: 0.5,
      bgcolor: 'rgba(255, 255, 255, 0.85)',
      bordercolor: '#95a5a6',
      borderwidth: 1,
      font: { size: 11, weight: 600 }
    },
    plot_bgcolor: '#fafafa',
    paper_bgcolor: 'white',
    hovermode: 'closest',
    margin: { l: 80, r: 200, t: 170, b: 90 }
  }

  const config = {
    responsive: true,
    displayModeBar: true,
    displaylogo: false,
    modeBarButtonsToRemove: ['lasso2d', 'select2d'],
    toImageButtonOptions: {
      format: 'png',
      filename: 'ipr_pressure_demand_analysis',
      height: 800,
      width: 1200,
      scale: 2
    }
  }

  return (
    <div style={{ width: '100%' }}>
      <div className="plot-container">
        <Plot 
          data={plotData} 
          layout={layout} 
          config={config}
          style={{ width: '100%', height: '660px' }} 
          useResizeHandler={true} 
        />
      </div>
      {pressureDemandCurve && pressureDemandCurve.components && (
        <div style={{ 
          marginTop: '20px', 
          padding: '15px', 
          background: 'rgba(52, 152, 219, 0.1)', 
          borderRadius: '8px',
          border: '1px solid rgba(52, 152, 219, 0.3)'
        }}>
          <h4 style={{ margin: '0 0 10px 0', color: '#3498db' }}>📊 TDH Formula Components</h4>
          <div style={{ marginBottom: '10px', fontStyle: 'italic', fontSize: '0.95rem' }}>
            TDH = PD + Tf + TP/MG - PIP/MG
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '10px', fontSize: '0.9rem' }}>
            <div><strong>PD (Pump Depth):</strong> {pressureDemandCurve.components.profundidad_bomba} m</div>
            <div><strong>TP (Tubing Pressure):</strong> {pressureDemandCurve.components.p_surface_target} bar</div>
            <div><strong>MG (Mixture Gradient):</strong> {pressureDemandCurve.components.gradiente} bar/m</div>
            <div><strong>PIP (Pump Intake Pressure):</strong> From IPR (varies with Q)</div>
          </div>
          <div style={{ marginTop: '10px', padding: '8px', background: 'rgba(231, 76, 60, 0.1)', borderRadius: '4px', fontSize: '0.85rem' }}>
            ⚠️ <strong>Note:</strong> PIP depends on the IPR - it's the flowing bottom-hole pressure (Pwf) at each flow rate
          </div>
        </div>
      )}
    </div>
  )
}
