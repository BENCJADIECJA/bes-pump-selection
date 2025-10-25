# 🎓 GUÍA DE USO - FASE 1: Installation Design

## 📖 Introducción

Esta guía te mostrará cómo usar las nuevas funcionalidades de **diseño de instalación** agregadas en FASE 1.

---

## 🚀 Inicio Rápido

### 1. Iniciar el Sistema

**Terminal 1 - Backend:**
```bash
cd "c:\Users\bpatterson\Documents\PROYECTO APLICACIÓN MÁS DB\proyecto-bes-api"
python app.py
```
Espera a ver: `Running on http://127.0.0.1:5000`

**Terminal 2 - Frontend:**
```bash
cd "c:\Users\bpatterson\Documents\PROYECTO APLICACIÓN MÁS DB\proyecto-bes-api\frontend"
npm run dev
```
Espera a ver: `Local: http://localhost:5173/`

### 2. Abrir Aplicación

Abre tu navegador en: **http://localhost:5173**

---

## 📋 Paso a Paso: Diseño de Instalación

### Paso 1: Activar Modo IPR

1. En la parte superior, marca el checkbox:
   ```
   ☑ Enable IPR Analysis
   ```

2. Verás aparecer dos secciones:
   - **IPR Configuration** (azul)
   - **Installation Design Parameters** (naranja)

---

### Paso 2: Configurar IPR (Análisis del Pozo)

#### Sección: IPR Configuration

1. **Seleccionar método de IPR:**
   - Linear (Darcy - Monofásico)
   - Vogel (Bifásico - Gas en solución) ⭐ Recomendado
   - Fetkovich (Empírico)
   - Darcy Completo

2. **Propiedades del Fluido:**
   ```
   °API:      21  (típico para crudo pesado)
   % Agua:    95  (water cut alto)
   SG Agua:   1.033 (agua salina)
   ```

3. **Parámetros del Pozo:**
   ```
   Pr (presión reservorio):  150 bar
   Pb (presión burbuja):     120 bar
   Q Test:                   100 m³/d
   Pwf Test:                  20 bar
   ```

---

### Paso 3: Configurar Instalación (¡NUEVO en FASE 1!)

#### Sección: 🔧 Installation Design Parameters

##### 📏 Profundidades

```
┌─────────────────────────────────────────┐
│ Profundidad Intake (m):     [1500]      │
│ Nivel Fluido Dinámico (m):  [500]       │
└─────────────────────────────────────────┘
```

**Qué significa:**
- **Profundidad Intake**: A qué profundidad instalas el intake de la bomba
- **Nivel Fluido Dinámico**: Dónde está el nivel del fluido cuando el pozo produce

**Ejemplo:**
```
Si tu pozo tiene 2000m de profundidad y decides instalar 
la bomba a 1500m, con nivel de fluido en 500m:
  → La bomba debe elevar el fluido 1000m (1500 - 500)
```

##### 🔩 Tubería de Producción

```
┌─────────────────────────────────────────┐
│ Tamaño: [Tbg 2-7/8" - ID 62.0 mm ▼]    │
│ ID Tubería: [62.0] mm (auto)            │
│ Condición: [Acero Nuevo ▼]              │
└─────────────────────────────────────────┘
```

**Opciones de tubería:**
- Tbg 2-3/8" → ID 52.5 mm (caudales bajos)
- **Tbg 2-7/8" → ID 62.0 mm** ⭐ Más común
- Tbg 3-1/2" → ID 76.2 mm (caudales altos)
- Tbg 4" → ID 88.9 mm
- Tbg 4-1/2" → ID 101.6 mm (muy altos caudales)

**Condiciones de tubería:**
- **Acero Nuevo** (0.046 mm) ⭐ Mejor
- Acero Usado (0.15 mm)
- Acero Corroído (0.5 mm)
- Acero Incrustado (1.5 mm)
- Revestido Interno (0.01 mm)

##### 💨 Presiones del Sistema

```
┌─────────────────────────────────────────┐
│ Presión Superficie (bar):  [10]         │
│ Presión Casing (bar):      [5]          │
└─────────────────────────────────────────┘
```

**Qué significa:**
- **Presión Superficie**: Presión que quieres mantener en el cabezal del pozo
- **Presión Casing**: Presión en el anular (espacio entre casing y tubing)

**⚠️ Importante:**
> La presión de casing **AYUDA** a la bomba. Mayor presión de casing = Menor TDH requerido

---

### Paso 4: Ver Resultados

Los cálculos se actualizan automáticamente. El sistema calcula:

1. **Propiedades del Fluido:**
   - Densidad (kg/m³)
   - Gradiente (bar/m)

2. **Curva IPR:**
   - Pwf vs Caudal
   - Muestra capacidad del pozo

3. **Curva TDH:**
   - TDH vs Caudal
   - Muestra demanda del sistema

---

## 💡 Ejemplos Prácticos

### Ejemplo 1: Instalación Típica

**Pozo productor de crudo pesado con alto water cut**

```yaml
IPR:
  Método: Vogel
  Pr: 150 bar
  Pb: 120 bar
  °API: 21
  % Agua: 95

Instalación:
  Profundidad Intake: 1500 m
  Nivel Fluido: 500 m
  Tubería: Tbg 2-7/8" (ID 62 mm)
  Condición: Acero Nuevo
  P Superficie: 10 bar
  P Casing: 5 bar

Resultado:
  TDH @ 150 m³/d ≈ 1052 m
  Componentes:
    - Elevación: 1000 m
    - Presión: 50 m
    - Fricción: 2 m (simplificado)
```

### Ejemplo 2: Efecto de Presión de Casing

**Mismo pozo, variando presión de casing:**

| P_casing | TDH @ 150 m³/d | Diferencia |
|----------|----------------|------------|
| 0 bar    | 1101 m         | Base       |
| 5 bar    | 1052 m         | -49 m ✅   |
| 10 bar   | 1002 m         | -99 m ✅✅ |

**Conclusión:** Más presión de casing = Bomba más pequeña necesaria

### Ejemplo 3: Efecto de Tubería

**Mismo pozo, variando tamaño de tubería:**

| Tubería | ID (mm) | Velocidad @ 150 m³/d | Fricción (FASE 2) |
|---------|---------|----------------------|-------------------|
| 2-3/8"  | 52.5    | 0.78 m/s            | Más alta          |
| 2-7/8"  | 62.0    | 0.58 m/s ✅         | Media             |
| 3-1/2"  | 76.2    | 0.38 m/s            | Más baja          |

**Nota:** En FASE 1, la fricción es simplificada. En FASE 2 verás diferencias reales.

---

## 🎯 Casos de Uso Comunes

### Caso 1: Bomba Profunda con Gas

```
Situación:
  - Pozo con gas libre
  - Instalación profunda para meter bomba bajo punto de burbuja

Configuración:
  ☑ Método: Vogel
  ☑ Pb < Pr (hay gas)
  ☑ Profundidad Intake: 2000+ m
  ☑ Tubería: 2-7/8" o 3-1/2"
```

### Caso 2: Pozo con Alto Water Cut

```
Situación:
  - 90-95% agua
  - Mayor densidad del fluido
  - Mayor gradiente

Configuración:
  ☑ °API: 15-25
  ☑ % Agua: 90-95
  ☑ SG Agua: 1.03-1.10 (si es salina)
  → Sistema calcula gradiente automáticamente
```

### Caso 3: Optimización de Presión de Casing

```
Situación:
  - Quieres reducir TDH
  - Tienes gas disponible para inyectar en casing

Pasos:
  1. Configura instalación base (P_casing = 0)
  2. Anota TDH requerido
  3. Incrementa P_casing (5, 10, 15 bar)
  4. Observa reducción de TDH
  5. Selecciona presión óptima
```

---

## ⚠️ Limitaciones Actuales (FASE 1)

### Lo que SÍ funciona:
- ✅ Catálogo completo de tuberías API
- ✅ Cálculo de propiedades del fluido
- ✅ TDH con presión de casing
- ✅ Curvas IPR y TDH básicas

### Lo que viene en FASE 2:
- ⏳ Pérdidas por fricción REALES (Darcy-Weisbach)
- ⏳ Número de Reynolds y régimen de flujo
- ⏳ Factor de fricción según Moody
- ⏳ Validación de velocidad (erosión)

### Lo que viene en FASE 3:
- ⏳ Punto de operación (intersección IPR-TDH)
- ⏳ Validación de bomba seleccionada
- ⏳ Curva de demanda de presión
- ⏳ Gráfica combinada IPR + TDH + Bomba
- ⏳ Warnings y recomendaciones

---

## 🔧 Solución de Problemas

### Problema: No veo Installation Controls

**Solución:**
1. Asegúrate de marcar ☑ "Enable IPR Analysis"
2. No debe estar activo "Comparison Mode"
3. Refresca la página (F5)

### Problema: Dropdown de tuberías vacío

**Solución:**
1. Verifica que backend esté corriendo
2. Abre consola del navegador (F12)
3. Busca errores de red
4. Verifica: http://localhost:5000/api/tubing-catalog

### Problema: TDH parece muy alto/bajo

**Causas comunes:**
- ❌ Nivel fluido mayor que profundidad intake
- ❌ Presión de casing negativa
- ❌ Gradiente incorrecto (revisar °API y % agua)

**Verificar:**
```
TDH mínimo ≈ (Profundidad - Nivel)
Si tu TDH < esto → Revisa presión de casing
```

---

## 📊 Interpretación de Resultados

### Rangos Típicos

**TDH Total:**
```
Bajo:     < 800 m   (pozo poco profundo)
Normal:   800-1500 m (mayoría de casos)
Alto:     1500-2500 m (pozo profundo)
Muy alto: > 2500 m   (requiere bombas especiales)
```

**Velocidad del Fluido (FASE 2):**
```
Muy baja:   < 0.5 m/s  (puede haber deposición)
Ideal:      0.5-2.0 m/s ✅
Aceptable:  2.0-3.0 m/s
Alto:       3.0-5.0 m/s (riesgo erosión)
Muy alto:   > 5.0 m/s ❌ (no recomendado)
```

---

## 📚 Referencia Rápida

### Unidades del Sistema

| Parámetro | Unidad | Rango Típico |
|-----------|--------|--------------|
| Profundidad | metros | 500-3000 m |
| Presión | bar | 0-200 bar |
| Caudal | m³/día | 50-500 m³/d |
| Temperatura | °C | 40-120 °C |
| Densidad | kg/m³ | 800-1100 kg/m³ |
| Viscosidad | cp | 0.5-100 cp |

### Fórmulas Principales (FASE 1)

```python
# Gradiente del fluido
densidad_mezcla = densidad_oil * (1 - fw) + densidad_water * fw
gradiente = densidad_mezcla * 0.0981  # bar/m

# TDH
H_elevación = profundidad_intake - nivel_fluido
H_presión = (P_superficie - P_casing) / gradiente
H_fricción = k * Q²  # Simplificado
TDH = H_elevación + H_presión + H_fricción
```

---

## 🎓 Mejores Prácticas

### ✅ DO (Hacer):
- Usa datos reales de pruebas de pozo
- Considera presión de casing disponible
- Selecciona tubería según caudal esperado
- Verifica que nivel fluido < profundidad intake
- Actualiza condición de tubería según edad

### ❌ DON'T (No hacer):
- No uses valores por defecto sin verificar
- No ignores la presión de casing
- No selecciones tubería muy pequeña (alta velocidad)
- No confundas presión de reservorio con presión de intake
- No uses °API extremos sin verificar

---

## 🆘 Soporte

Si tienes problemas:

1. **Revisa esta guía** completa
2. **Ejecuta pruebas:** `python test_fase1_simple.py`
3. **Verifica logs** en terminal del backend
4. **Inspecciona consola** del navegador (F12)
5. **Consulta documentación técnica:** FASE1_DOCUMENTACION.md

---

## 📝 Checklist de Configuración

Antes de confiar en los resultados, verifica:

- [ ] Backend corriendo sin errores
- [ ] Frontend conectado al backend
- [ ] IPR Analysis activado
- [ ] Método de IPR seleccionado
- [ ] Propiedades del fluido configuradas
- [ ] Profundidad de intake < profundidad total del pozo
- [ ] Nivel fluido < profundidad intake
- [ ] Tubería seleccionada del catálogo
- [ ] Presiones en rangos razonables
- [ ] Curvas IPR y TDH visibles

---

## 🎉 ¡Listo para Usar!

Ahora estás listo para diseñar instalaciones de BES considerando:
- ✅ Geometría del pozo
- ✅ Propiedades del fluido
- ✅ Selección de tubería
- ✅ Presiones del sistema

**¡Disfruta diseñando instalaciones más precisas!**

---

**Versión:** FASE 1 (Octubre 2025)  
**Próxima actualización:** FASE 2 - Pérdidas por fricción reales
