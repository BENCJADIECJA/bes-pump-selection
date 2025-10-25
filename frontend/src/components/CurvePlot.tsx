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

export default function CurvePlot({ curves, multiFreqData, isMultiFreq, isComparisonMode, comparisonData, isIndividualEfficiency, individualEfficiencyData, isIndividualHead, individualHeadData, isIndividualBhp, individualBhpData, iprData, showIPR, isIPRMode, pumpCurves, pressureDemandCurve }: any) {
  // Modo IPR dedicado - SOLO curva IPR
  if (isIPRMode) {
    return <IPRPlot iprData={iprData} pressureDemandCurve={pressureDemandCurve} />
  }
  
  // Modo Head individual
  if (isIndividualHead && individualHeadData) {
    return <IndividualHeadPlot data={individualHeadData} iprData={iprData} showIPR={showIPR} />
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
    return <MultiFreqPlot multiFreqData={multiFreqData} iprData={iprData} showIPR={showIPR} />
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
      y: [0, maxHead * 1.5, maxHead * 1.5, 0, 0],
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
      y: [0, maxHead * 1.2],
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
      y: [0, maxHead * 1.2],
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
      y: [0, maxHead * 1.2],
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
      range: [0, maxHead * 1.1],
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
      y: -0.25,
      xanchor: 'center',
      x: 0.5,
      bgcolor: 'rgba(255, 255, 255, 0.8)',
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
    margin: { l: 80, r: 180, t: 80, b: 120 }
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
        style={{ width: '100%', height: '600px' }} 
        useResizeHandler={true} 
      />
    </div>
  )
}

// Componente para gráfico multifrecuencia
function MultiFreqPlot({ multiFreqData, iprData, showIPR }: any) {
  const colors = ['#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22', '#34495e', '#16a085', '#c0392b']
  
  const data: any[] = []
  
  // Arrays para construir la región sombreada (operating range envelope)
  const minQPoints: number[] = []
  const maxQPoints: number[] = []
  const freqValues: number[] = []
  const maxHeadValues: number[] = []
  
  // Agregar curvas de TDH para cada frecuencia
  multiFreqData.forEach((item: any, idx: number) => {
    const freq = item.freq
    const curves = item.curves
    
    if (!curves || !curves.head) return
    
    const q = curves.head.map((p: any) => p.caudal)
    const head = curves.head.map((p: any) => p.valor)
    const operatingRange = curves.operating_range || { min_q: 0, max_q: 0 }
    
    // Guardar datos para la región sombreada
    freqValues.push(freq)
    minQPoints.push(operatingRange.min_q)
    maxQPoints.push(operatingRange.max_q)
    maxHeadValues.push(Math.max(...head))
    
    // Curva de TDH para esta frecuencia
    data.push({
      x: q,
      y: head,
      type: 'scatter',
      mode: 'lines',
      name: `${freq.toFixed(1)} Hz`,
      line: { color: colors[idx % colors.length], width: 3 },
      hovertemplate: `<b>${freq.toFixed(1)} Hz</b><br>Q: %{x:.2f} m³/d<br>Head: %{y:.2f} m<extra></extra>`
    })
  })
  
  // Crear región sombreada uniendo los puntos de Q_min y Q_max
  // Región izquierda (Q_min envelope)
  const minQEnvelopeX: number[] = []
  const minQEnvelopeY: number[] = []
  multiFreqData.forEach((item: any) => {
    const curves = item.curves
    if (!curves || !curves.head) return
    const minQ = curves.operating_range?.min_q || 0
    const headAtMinQ = curves.head.find((p: any) => p.caudal >= minQ)
    if (headAtMinQ) {
      minQEnvelopeX.push(minQ)
      minQEnvelopeY.push(headAtMinQ.valor)
    }
  })
  
  // Región derecha (Q_max envelope)
  const maxQEnvelopeX: number[] = []
  const maxQEnvelopeY: number[] = []
  multiFreqData.forEach((item: any) => {
    const curves = item.curves
    if (!curves || !curves.head) return
    const maxQ = curves.operating_range?.max_q || 0
    const headAtMaxQ = curves.head.find((p: any) => p.caudal >= maxQ)
    if (headAtMaxQ) {
      maxQEnvelopeX.push(maxQ)
      maxQEnvelopeY.push(headAtMaxQ.valor)
    }
  })
  
  // Región sombreada: unir min y max creando un polígono
  if (minQEnvelopeX.length > 0 && maxQEnvelopeX.length > 0) {
    const envelopeX = [...minQEnvelopeX, ...maxQEnvelopeX.reverse(), minQEnvelopeX[0]]
    const envelopeY = [...minQEnvelopeY, ...maxQEnvelopeY.reverse(), minQEnvelopeY[0]]
    
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
  
  const maxQ = Math.max(...multiFreqData.flatMap((item: any) => item.curves?.head?.map((p: any) => p.caudal) || []))
  const maxHead = Math.max(...maxHeadValues)
  
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
      range: [0, maxHead * 1.1],
      showgrid: true,
      gridcolor: '#ecf0f1',
      zeroline: true,
      zerolinecolor: '#95a5a6',
      zerolinewidth: 2
    },
    legend: {
      orientation: 'v',
      yanchor: 'top',
      y: 0.98,
      xanchor: 'right',
      x: 0.98,
      bgcolor: 'rgba(255, 255, 255, 0.9)',
      bordercolor: '#95a5a6',
      borderwidth: 1,
      font: { size: 12, weight: 600 }
    },
    plot_bgcolor: '#fafafa',
    paper_bgcolor: 'white',
    hovermode: 'closest',
    margin: { l: 80, r: 80, t: 80, b: 100 }
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
        style={{ width: '100%', height: '600px' }} 
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
      orientation: 'v',
      yanchor: 'top',
      y: 0.98,
      xanchor: 'right',
      x: 0.98,
      bgcolor: 'rgba(255, 255, 255, 0.9)',
      bordercolor: '#95a5a6',
      borderwidth: 1,
      font: { size: 12, weight: 600 }
    },
    plot_bgcolor: '#fafafa',
    paper_bgcolor: 'white',
    hovermode: 'closest',
    margin: { l: 80, r: 80, t: 80, b: 100 }
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
        style={{ width: '100%', height: '600px' }} 
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
      orientation: 'v',
      yanchor: 'top',
      y: 0.98,
      xanchor: 'right',
      x: 0.98,
      bgcolor: 'rgba(255, 255, 255, 0.9)',
      bordercolor: '#95a5a6',
      borderwidth: 1,
      font: { size: 12, weight: 600 }
    },
    plot_bgcolor: '#fafafa',
    paper_bgcolor: 'white',
    hovermode: 'closest',
    margin: { l: 80, r: 80, t: 80, b: 100 }
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
        style={{ width: '100%', height: '600px' }} 
        useResizeHandler={true} 
      />
    </div>
  )
}

// Componente para mostrar curvas de Head individuales dentro del rango operativo
function IndividualHeadPlot({ data, iprData, showIPR }: any) {
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
  })
  
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
      orientation: 'v',
      yanchor: 'top',
      y: 0.98,
      xanchor: 'right',
      x: 0.98,
      bgcolor: 'rgba(255, 255, 255, 0.9)',
      bordercolor: '#95a5a6',
      borderwidth: 1,
      font: { size: 12, weight: 600 }
    },
    plot_bgcolor: '#fafafa',
    paper_bgcolor: 'white',
    hovermode: 'closest',
    margin: { l: 80, r: 80, t: 80, b: 100 }
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
        style={{ width: '100%', height: '600px' }} 
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
      orientation: 'v',
      yanchor: 'top',
      y: 0.98,
      xanchor: 'right',
      x: 0.98,
      bgcolor: 'rgba(255, 255, 255, 0.9)',
      bordercolor: '#95a5a6',
      borderwidth: 1,
      font: { size: 12, weight: 600 }
    },
    plot_bgcolor: '#fafafa',
    paper_bgcolor: 'white',
    hovermode: 'closest',
    margin: { l: 80, r: 80, t: 80, b: 100 }
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
        style={{ width: '100%', height: '600px' }} 
        useResizeHandler={true} 
      />
    </div>
  )
}

// Componente dedicado para IPR Analysis - SOLO curva IPR
function IPRPlot({ iprData, pressureDemandCurve }: any) {
  if (!iprData || !iprData.curve) {
    return (
      <div style={{ textAlign: 'center', padding: '32px', color: '#7f8c8d', fontSize: '1.1rem' }}>
        📊 Configure IPR parameters to see the well performance curve
      </div>
    )
  }
  
  // DEBUG: Verificar si tenemos datos de System Demand
  console.log('='.repeat(80))
  console.log('IPRPlot - pressureDemandCurve:', pressureDemandCurve ? 'PRESENTE' : 'NO DISPONIBLE')
  if (pressureDemandCurve) {
    console.log('pressureDemandCurve.curve:', pressureDemandCurve.curve ? 'TIENE DATOS' : 'UNDEFINED')
    console.log('pressureDemandCurve tiene', pressureDemandCurve.curve?.length || 0, 'puntos')
    if (pressureDemandCurve.curve && pressureDemandCurve.curve.length > 0) {
      console.log('Primer punto:', pressureDemandCurve.curve[0])
    }
  }
  console.log('='.repeat(80))
  
  const iprQ = iprData.curve.map((p: any) => p.caudal)
  const iprPwf = iprData.curve.map((p: any) => p.pwf)
  const iprNivel = iprData.curve.map((p: any) => p.nivel || 0)
  
  // Información del gradiente del fluido
  const gradiente = iprData.parameters?.gradiente || null
  const gradoApi = iprData.parameters?.grado_api || null
  const aguaPorcentaje = iprData.parameters?.agua_porcentaje || null
  
  const maxQ = Math.max(...iprQ)
  const maxPwf = Math.max(...iprPwf)
  
  // ===== NUEVA SECCIÓN: Curva de Demanda de Presión =====
  const plotData: any[] = [
    // IPR en eje Y1 (bar)
    {
      x: iprQ,
      y: iprPwf,
      type: 'scatter',
      mode: 'lines',
      name: `IPR - ${iprData.method} (Pwf)`,
      line: { color: '#16a085', width: 4 },
      yaxis: 'y',
      customdata: iprNivel,
      hovertemplate: '<b>IPR</b><br>Q: %{x:.2f} m³/d<br>Pwf: %{y:.2f} bar<br>Nivel: %{customdata:.2f} m<extra></extra>'
    },
    // Marcador de Q_max
    {
      x: [iprData.q_max],
      y: [0],
      mode: 'markers',
      type: 'scatter',
      marker: { color: '#e67e22', size: 14, symbol: 'diamond', line: { color: 'white', width: 2 } },
      name: `Q_max: ${iprData.q_max.toFixed(0)} m³/d`,
      yaxis: 'y',
      showlegend: true,
      hovertemplate: `<b>Q_max</b><br>Q: ${iprData.q_max.toFixed(2)} m³/d<extra></extra>`
    }
  ]
  
  // Variables para calcular rangos
  let maxDemandTDH_m = 0
  let maxDemandTDH_bar = 0
  
  // Agregar curva de demanda de presión si está disponible
  if (pressureDemandCurve && pressureDemandCurve.curve) {
    const demandQ = pressureDemandCurve.curve.map((p: any) => p.caudal)
    const demandTDH = pressureDemandCurve.curve.map((p: any) => p.tdh)
    const pipPressure = pressureDemandCurve.curve.map((p: any) => p.pip)
    const frictionLosses = pressureDemandCurve.curve.map((p: any) => p.perdidas_friccion)
    
    // Obtener gradiente para convertir TDH (m) a presión (bar)
    const gradient = pressureDemandCurve.components?.gradiente || 0.0981  // bar/m
    const demandTDH_bar = demandTDH.map((tdh: number) => tdh * gradient)
    
    // DEBUG: Ver qué datos tenemos
    console.log('='.repeat(80))
    console.log('DEBUG FRONTEND - System Demand Curve (primeros 3 puntos):')
    console.log('='.repeat(80))
    for (let i = 0; i < Math.min(3, pressureDemandCurve.curve.length); i++) {
      const p = pressureDemandCurve.curve[i]
      console.log(`Punto ${i}: Q=${p.caudal?.toFixed(1)}, TDH=${p.tdh?.toFixed(2)} m (${(p.tdh * gradient).toFixed(2)} bar), PIP=${p.pip?.toFixed(2)}, Nivel=${p.nivel}`)
    }
    console.log('demandQ:', demandQ.slice(0, 3))
    console.log('demandTDH:', demandTDH.slice(0, 3))
    console.log('='.repeat(80))
    
    // Calcular rangos máximos
    const maxDemandTDH = Math.max(...demandTDH)
    const maxDemandBar = Math.max(...demandTDH_bar)
    maxDemandTDH_m = maxDemandTDH
    maxDemandTDH_bar = maxDemandBar
    
    // Curva de System Demand en METROS (eje Y2 - derecha)
    plotData.push({
      x: demandQ,
      y: demandTDH,
      type: 'scatter',
      mode: 'lines',
      name: 'System Demand (TDH - m)',
      line: { color: '#e74c3c', width: 3, dash: 'solid' },
      yaxis: 'y2',
      customdata: demandQ.map((q: number, idx: number) => ({
        pip: pipPressure[idx],
        friction: frictionLosses[idx],
        tdh_bar: demandTDH_bar[idx]
      })),
      hovertemplate: '<b>System Demand</b><br>Q: %{x:.2f} m³/d<br>TDH: %{y:.2f} m (%{customdata.tdh_bar:.2f} bar)<br>PIP: %{customdata.pip:.2f} bar<br>Friction: %{customdata.friction:.2f} bar<extra></extra>'
    })
    
    // Curva de System Demand en BAR (eje Y3 - derecha extrema)
    plotData.push({
      x: demandQ,
      y: demandTDH_bar,
      type: 'scatter',
      mode: 'lines',
      name: 'System Demand (Pressure - bar)',
      line: { color: '#c0392b', width: 2, dash: 'dot' },
      yaxis: 'y3',
      showlegend: true,
      hovertemplate: '<b>System Demand (Pressure)</b><br>Q: %{x:.2f} m³/d<br>Pressure: %{y:.2f} bar<extra></extra>'
    })
  }
  
  // Título con información del fluido
  let titleText = `IPR Analysis - ${iprData.method}`
  if (pressureDemandCurve) {
    titleText += ' & System Demand Curve'
  }
  if (gradiente && gradoApi !== null && aguaPorcentaje !== null) {
    titleText += `<br><sub>Oil: ${gradoApi}°API | Water: ${aguaPorcentaje}% | Gradient: ${gradiente.toFixed(4)} bar/m</sub>`
  }
  
  const layout = {
    title: {
      text: titleText,
      font: { size: 24, color: '#2c3e50', family: 'Segoe UI, sans-serif', weight: 700 }
    },
    xaxis: {
      title: { text: 'Flow Rate (Q - m³/d)', font: { size: 16, color: '#34495e', weight: 600 } },
      range: [0, maxQ * 1.1],
      showgrid: true,
      gridcolor: '#ecf0f1',
      zeroline: true,
      zerolinecolor: '#95a5a6',
      zerolinewidth: 2
    },
    yaxis: {
      title: { text: 'IPR Pressure (Pwf - bar)', font: { size: 16, color: '#16a085', weight: 600 } },
      range: [0, maxPwf * 1.1],
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
      range: [0, Math.max(maxDemandTDH_m * 1.1, 100)],  // Mínimo 100m para evitar rango [0,0]
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
      range: [0, Math.max(maxDemandTDH_bar * 1.1, 10)]  // Mínimo 10 bar para evitar rango [0,0]
    },
    legend: {
      orientation: 'v',
      yanchor: 'top',
      y: 0.98,
      xanchor: 'left',
      x: 0.02,
      bgcolor: 'rgba(255, 255, 255, 0.9)',
      bordercolor: '#95a5a6',
      borderwidth: 1,
      font: { size: 11, weight: 600 }
    },
    plot_bgcolor: '#fafafa',
    paper_bgcolor: 'white',
    hovermode: 'closest',
    margin: { l: 80, r: 200, t: 120, b: 100 }
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
          style={{ width: '100%', height: '600px' }} 
          useResizeHandler={true} 
        />
      </div>
      
      {/* Información adicional de la curva de presión */}
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
