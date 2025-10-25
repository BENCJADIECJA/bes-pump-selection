# 🛠️ PROYECTO: Sistema de Diseño de Instalación BES
## Implementación en 3 Fases

---

## 📋 Visión General del Proyecto

Este proyecto agrega capacidades de **diseño de instalación completo** a la aplicación de análisis de bombas BES (Bombeo Electrosumergible), permitiendo a los ingenieros diseñar instalaciones completas considerando:

- ✅ Análisis IPR (Inflow Performance Relationship)
- ✅ Diseño de instalación (profundidad, tubería, presiones)
- ✅ Cálculo de TDH (Total Dynamic Head) con pérdidas reales
- ✅ Punto de operación (intersección IPR-TDH)
- ✅ Selección y validación de equipos

---

## 🎯 Objetivos Principales

### Fase Actual → Fase Final

```
ANTES (Solo Análisis de Bomba):
- Ver curvas de rendimiento de bombas
- Ajustar frecuencia y etapas
- Comparar bombas

DESPUÉS (Diseño Completo):
- Análisis completo del pozo (IPR)
- Diseño de instalación (profundidad, tubería)
- Cálculo de demanda del sistema (TDH)
- Punto de operación (Q, TDH)
- Validación de diseño
- Curva de demanda de presión
```

---

## 📅 Roadmap de Implementación

### ✅ **FASE 1: Parámetros de Instalación y TDH Básico**
**Estado:** COMPLETADO ✅  
**Fecha:** Octubre 24, 2025

**Implementado:**
- [x] Catálogo de tuberías estándar (API 5CT)
- [x] Componente InstallationControls en frontend
- [x] Campos de profundidad de intake
- [x] Selector de tubería con OD/ID en mm
- [x] Selector de condición de tubería (rugosidad)
- [x] Campos de presión (superficie y casing)
- [x] Cálculo básico de TDH considerando presión de casing
- [x] Endpoint API para catálogo de tuberías

**Detalles:** Ver [FASE1_DOCUMENTACION.md](FASE1_DOCUMENTACION.md)

---

### 🚧 **FASE 2: Pérdidas por Fricción Realistas**
**Estado:** PENDIENTE  
**Estimado:** Próxima implementación

**Por implementar:**
- [ ] Cálculo de Número de Reynolds
- [ ] Factor de fricción (diagrama de Moody)
  - Laminar: f = 64/Re
  - Turbulento: Colebrook-White (iterativo)
- [ ] Ecuación de Darcy-Weisbach para pérdidas
- [ ] Actualizar `calculate_system_head_curve()` con fricción real
- [ ] Cálculo de velocidad del fluido (Q/A)
- [ ] Validación de velocidad (erosión/corrosión)
  - Warning si v > 3 m/s (recomendado)
  - Error si v > 5 m/s (límite API)
- [ ] Gráfica de velocidad vs caudal

**Fórmulas a implementar:**

#### Número de Reynolds
```
Re = (ρ * v * D) / μ

Donde:
- ρ = densidad del fluido (kg/m³)
- v = velocidad (m/s)
- D = diámetro interno (m)
- μ = viscosidad dinámica (Pa·s)
```

#### Factor de Fricción
```
Flujo Laminar (Re < 2300):
  f = 64 / Re

Flujo Turbulento (Re > 4000):
  1/√f = -2 * log₁₀((ε/D)/3.7 + 2.51/(Re*√f))
  (Ecuación de Colebrook-White - iterativa)
```

#### Pérdidas por Fricción
```
ΔP_fricción = f * (L/D) * (ρ * v²/2)  [Pa]

Convertir a metros:
H_fricción = ΔP_fricción / (ρ * g)  [m]
```

**Archivos a modificar:**
- `hydraulic_calculations.py`: Nuevas funciones de fricción
- `InstallationControls.tsx`: Mostrar velocidad calculada
- `CurvePlot.tsx`: Agregar línea de velocidad

---

### 🎯 **FASE 3: Punto de Operación y Validación**
**Estado:** PENDIENTE  
**Estimado:** Después de FASE 2

**Por implementar:**
- [ ] Función para encontrar intersección IPR-TDH
  - Algoritmo de búsqueda binaria o Newton-Raphson
- [ ] Cálculo del punto de operación real
- [ ] Validación de bomba seleccionada
  - ¿Puede generar el TDH requerido en Q_operación?
  - ¿Opera dentro de rango recomendado?
- [ ] Curva de demanda de presión
  - Presión en cada punto de la instalación
  - Presión en intake, discharge, superficie
- [ ] Visualización combinada en gráfica
  - Curva IPR (Pwf vs Q)
  - Curva TDH (TDH vs Q)
  - Curva de Bomba (Head vs Q)
  - Punto de operación marcado
- [ ] Tabla de resumen del diseño
- [ ] Warnings y validaciones
  - Bomba undersized/oversized
  - Velocidad fuera de rango
  - Presiones excedidas

**Componentes nuevos:**
- `OperatingPointCalculator.tsx`: Muestra punto de operación
- `DesignSummary.tsx`: Tabla resumen con validaciones
- `PressureProfile.tsx`: Perfil de presiones en la instalación

**Funciones a crear:**

#### Encontrar Punto de Operación
```python
def find_operating_point(ipr_curve, tdh_curve):
    """
    Encuentra la intersección entre IPR y TDH.
    
    Args:
        ipr_curve: Lista de {"caudal": Q, "pwf": Pwf}
        tdh_curve: Lista de {"caudal": Q, "tdh": TDH}
    
    Returns:
        {
            "caudal": Q_op,
            "pwf": Pwf_op,
            "tdh": TDH_op
        }
    """
```

#### Calcular Curva de Demanda de Presión
```python
def calculate_pressure_demand_curve(well_data, q_operating):
    """
    Calcula presiones en diferentes puntos de la instalación.
    
    Returns:
        {
            "p_intake": presión en intake,
            "p_discharge": presión en discharge de bomba,
            "p_superficie": presión en superficie,
            "profile": [
                {"profundidad": z, "presion": p}
            ]
        }
    """
```

#### Validar Diseño
```python
def validate_design(operating_point, pump_curve, limits):
    """
    Valida que el diseño sea adecuado.
    
    Returns:
        {
            "valid": bool,
            "warnings": [],
            "errors": [],
            "recommendations": []
        }
    """
```

---

## 🏗️ Arquitectura del Sistema

### Flujo de Datos Completo (Post-FASE 3)

```
┌─────────────────────────────────────────────────────────────┐
│                      FRONTEND (React)                        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ IPR Controls │  │ Installation │  │ Pump Selector    │  │
│  │              │  │ Controls     │  │                  │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────────┘  │
│         │                  │                  │              │
│         └──────────────────┴──────────────────┘              │
│                            │                                 │
│                   ┌────────▼─────────┐                       │
│                   │  API Call        │                       │
│                   └────────┬─────────┘                       │
└────────────────────────────┼─────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                      BACKEND (Flask)                         │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌───────────────────┐  ┌──────────────────┐                │
│  │ well_performance  │  │ hydraulic_calcs  │                │
│  │  • calculate_ipr  │  │  • calc_friction │                │
│  │                   │  │  • calc_tdh      │                │
│  └─────────┬─────────┘  └────────┬─────────┘                │
│            │                      │                          │
│            └──────────┬───────────┘                          │
│                       ▼                                      │
│          ┌────────────────────────┐                          │
│          │ engineering_validation │                          │
│          │  • find_op_point       │                          │
│          │  • validate_design     │                          │
│          └────────────┬───────────┘                          │
│                       │                                      │
│                       ▼                                      │
│          ┌────────────────────────┐                          │
│          │ equipment_selection    │                          │
│          │  • get_pump_curves     │                          │
│          └────────────────────────┘                          │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Estructura de Módulos Python

```
proyecto-bes-api/
│
├── app.py                         # Servidor Flask (endpoints)
├── well_performance.py            # Cálculos de IPR
├── hydraulic_calculations.py     # Cálculos hidráulicos (TDH, fricción)
├── gas_effects.py                # Efectos de gas (futuro)
├── equipment_selection.py        # Catálogos y selección de equipos
├── engineering_validation.py     # Validaciones y punto de operación
├── tubing_catalog.py             # Catálogo de tuberías ✅ FASE 1
│
└── frontend/
    └── src/
        └── components/
            ├── IPRControls.tsx            # Controles de IPR
            ├── InstallationControls.tsx   # Controles de instalación ✅ FASE 1
            ├── PumpSelector.tsx           # Selector de bombas
            ├── CurvePlot.tsx             # Gráficas
            ├── OperatingPointCalculator.tsx  # FASE 3
            ├── DesignSummary.tsx            # FASE 3
            └── PressureProfile.tsx          # FASE 3
```

---

## 📊 Visualizaciones Planeadas

### Gráfica Principal (FASE 3)
```
         Head/Pressure (m)
              ▲
              │
          TDH │     ╱╲
              │    ╱  ╲ Curva TDH (System Head)
              │   ╱    ╲
              │  ╱      ╲
   Operating  │ ╱    ●   ╲╲  Curva Bomba (Pump Head)
     Point →  │╱    ╱ │   ╲╲
              ├────────┼────╲╲──────
              │╲       │     ╲╲
              │ ╲      │      ╲╲
              │  ╲     │       ╲╲
          Pwf │   ╲    │        ╲╲  Curva IPR
              │    ╲   │         ╲
              │     ╲  │
              │      ╲ │
              └───────┴┴───────────────────▶
                   Q_op         Caudal (m³/d)
```

### Tabla de Resumen (FASE 3)
```
┌─────────────────────────────────────────────────┐
│         DESIGN SUMMARY & VALIDATION             │
├─────────────────────────────────────────────────┤
│                                                 │
│  Operating Point:                               │
│    • Flow Rate: 150.5 m³/d                     │
│    • TDH Required: 845.2 m                     │
│    • Pwf: 45.3 bar                             │
│                                                 │
│  Pump Performance @ Operating Point:            │
│    • Head Developed: 862.5 m ✅                │
│    • BHP Required: 28.5 hp                     │
│    • Efficiency: 62.3%                         │
│                                                 │
│  Fluid Velocity:                                │
│    • In Tubing: 1.85 m/s ✅                    │
│    • Reynolds: 45,200 (Turbulent)              │
│                                                 │
│  Friction Losses:                               │
│    • Total: 45.8 m                             │
│    • Per 100m: 3.05 m                          │
│                                                 │
│  Validation:                                    │
│    ✅ Pump can handle required TDH             │
│    ✅ Velocity within safe range               │
│    ⚠️  Operating at 62% efficiency (consider   │
│       higher efficiency pump)                   │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## 🔧 Parámetros del Sistema

### Unidades Adoptadas
| Parámetro | Unidad | Sistema |
|-----------|--------|---------|
| Presión | bar | Métrico |
| Caudal | m³/día | Métrico |
| Profundidad | metros | Métrico |
| Diámetro (display) | pulgadas | Imperial |
| Diámetro (cálculo) | mm | Métrico |
| Temperatura | °C | Métrico |
| Densidad | kg/m³ | Métrico |
| Viscosidad | cp | Oilfield |
| Rugosidad | mm | Métrico |

### Rangos de Validación
| Parámetro | Mín | Máx | Recomendado |
|-----------|-----|-----|-------------|
| Velocidad fluido | 0.5 m/s | 5 m/s | 1-3 m/s |
| Reynolds | 2,300 | 1,000,000 | > 4,000 |
| Profundidad intake | 100 m | 5,000 m | 1,000-2,500 m |
| Presión superficie | 0 bar | 100 bar | 5-20 bar |
| Presión casing | 0 bar | 100 bar | 0-30 bar |

---

## 📚 Referencias Técnicas

### Ecuaciones Fundamentales

**IPR (Vogel):**
```
Q/Q_max = 1 - 0.2*(Pwf/Pr) - 0.8*(Pwf/Pr)²
```

**TDH:**
```
TDH = H_static + H_pressure + H_friction
    = (Depth_intake - Level_fluid) 
      + (P_surface - P_casing)/gradient 
      + friction_losses
```

**Darcy-Weisbach:**
```
H_friction = f * (L/D) * (v²/2g)
```

**Colebrook-White:**
```
1/√f = -2*log₁₀((ε/D)/3.7 + 2.51/(Re*√f))
```

### Normas y Estándares
- API 5CT: Especificaciones de tubing
- API RP 11S: Sizing and Selection of ESP Systems
- ISO 17078: Petroleum and natural gas industries — Drilling and production equipment

---

## 🚀 Instalación y Uso

### Prerrequisitos
```bash
# Backend
Python 3.8+
Flask
pandas
numpy
openpyxl

# Frontend
Node.js 16+
React 18+
TypeScript
Vite
```

### Instalación

```bash
# Clonar repositorio
git clone <repo-url>
cd proyecto-bes-api

# Backend
pip install -r requirements.txt

# Frontend
cd frontend
npm install
```

### Ejecución

```bash
# Terminal 1: Backend
python app.py
# → http://localhost:5000

# Terminal 2: Frontend
cd frontend
npm run dev
# → http://localhost:5173
```

---

## 📝 Log de Cambios

### v1.1.0 - FASE 1 (2025-10-24)
- ✅ Agregado catálogo de tuberías estándar
- ✅ Componente InstallationControls
- ✅ Cálculo básico de TDH con presión de casing
- ✅ Endpoint API para tuberías

### v1.0.0 - Versión Base
- Análisis de curvas de bombas
- Modo multifrecuencia
- Comparador de bombas
- Análisis IPR básico

---

## 🤝 Contribuciones

Este proyecto está en desarrollo activo. Las contribuciones son bienvenidas, especialmente para:
- Mejorar cálculos hidráulicos
- Agregar validaciones adicionales
- Optimizar interfaz de usuario
- Documentación técnica

---

## 📧 Contacto

Para preguntas o sugerencias sobre el proyecto, contactar al equipo de desarrollo.

---

## 📜 Licencia

[Definir licencia del proyecto]

---

**Última actualización:** Octubre 24, 2025  
**Versión actual:** FASE 1 COMPLETADA ✅  
**Próximo hito:** FASE 2 - Pérdidas por Fricción Realistas
