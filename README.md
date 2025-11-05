Proyecto: API de Cálculo y Diseño BES

Este repositorio contiene el backend de la aplicación de Ingeniería de Aplicación para el diseño de equipos BES. Esta API, construida en Python con Flask, sirve como el motor de cálculo y validación, y está diseñada para ser consumida por una interfaz de usuario (Front-End).

## 🌟 FASE 1 COMPLETADA - Installation Design (Octubre 2025)

### Nuevas Funcionalidades

- ✅ **Catálogo de Tuberías API**: 5 tamaños estándar (2-3/8" a 4-1/2")
- ✅ **Parámetros de Instalación**: Profundidad intake, nivel fluido, presiones
- ✅ **Cálculo de TDH Mejorado**: Considera presión de casing y propiedades reales del fluido
- ✅ **Componente React InstallationControls**: Interfaz completa para diseño
- ✅ **Endpoint `/api/tubing-catalog`**: Acceso al catálogo de tuberías

### Documentación Nueva

- **[GUIA_USO_FASE1.md](GUIA_USO_FASE1.md)** - 🎓 Guía de usuario paso a paso
- **[FASE1_DOCUMENTACION.md](FASE1_DOCUMENTACION.md)** - 📚 Documentación técnica completa
- **[FASE1_RESUMEN.md](FASE1_RESUMEN.md)** - 📋 Resumen ejecutivo
- **[ROADMAP_3_FASES.md](ROADMAP_3_FASES.md)** - 🗺️ Plan de desarrollo en 3 fases

### Próximas Fases

- **FASE 2**: Pérdidas por fricción reales (Darcy-Weisbach, Moody, Reynolds)
- **FASE 3**: Punto de operación, validación de diseño, curva de demanda de presión

---

Resumen de cambios recientes
- Auto-detección de hojas y mapeo dinámico de columnas al cargar `coeficientes NOVOMET.xlsx`.
- Nuevo endpoint GET `/api/column-mapping` que devuelve el mapeo detectado.
- Mejor manejo de errores: endpoints de curvas y validación devuelven 404 cuando el equipo no se encuentra.
- Suite de tests (`pytest`) añadida y validada (tests básicos para IPR y curvas).
- Sincronización de puntos de operación entre backend y frontend (tablas, gráficas y exportaciones); detalles en `docs/operating-point-synchronization.md`.

Estructura del Proyecto

`/proyecto-bes-api/`
- `venv/`                     (entorno virtual)
- `app.py`                    (Servidor API Principal - Flask)
- `well_performance.py`       (Módulo de Cálculo: IPR)
- `hydraulic_calculations.py` (Módulo de Cálculos Hidráulicos) ⭐ ACTUALIZADO FASE 1
- `gas_effects.py`            (Módulo de Efectos de Gas)
- `equipment_selection.py`    (Carga de catálogos y generación de curvas)
- `engineering_validation.py` (Validaciones de Ingeniería)
- `tubing_catalog.py`         ⭐ NUEVO FASE 1 (Catálogo de tuberías)
- `coeficientes NOVOMET.xlsx` (Archivo de catálogos; opcional)
- `requirements.txt`          (Dependencias)
- `run.bat`                   (Script para iniciar el servidor)
- `CHANGELOG.md`              (Resumen de cambios recientes)
- `tests/`                    (Pruebas unitarias pytest)
- `test_fase1_simple.py`      ⭐ NUEVO FASE 1 (Pruebas de instalación)
- `frontend/`                 (Aplicación React)
  - `src/components/`
    - `InstallationControls.tsx` ⭐ NUEVO FASE 1

Guía de Configuración Inicial

1) Crear y activar el entorno virtual (PowerShell):

```powershell
python -m venv venv
.\venv\Scripts\activate
```

2) Instalar dependencias:

```powershell
pip install -r requirements.txt
```

3) (Opcional) Colocar `coeficientes NOVOMET.xlsx` en la carpeta del proyecto. Si no está presente o las hojas no coinciden, el sistema cargará catálogos dummy para pruebas.

Cómo ejecutar el servidor

```powershell
python app.py
```

El servidor arrancará en http://127.0.0.1:5000 (modo debug durante desarrollo).

Endpoints principales

- GET /api/catalogs
  - Devuelve listados completos de bombas y motores (cargados desde el Excel o dummy).

- GET /api/column-mapping
  - Devuelve el mapeo de columnas detectado (y crea `data/column_mapping.json`). Útil para verificar que las columnas y coeficientes fueron reconocidos correctamente.

- POST /api/calculate_conditions
  - Body: JSON con `well_data`. Devuelve IPR, system_head_curve y correcciones por gas.

- POST /api/validate_design
  - Body: JSON con `well_data` y `selected_equipment` (pump_id, motor_id, etc.).
  - Devuelve validaciones de ingeniería y curvas de rendimiento. Si un `pump_id` o `motor_id` no existe, devuelve HTTP 404 con mensaje de error.

Notas sobre `equipment_selection.py`

- Ahora detecta automáticamente las hojas del Excel (ej.: `BOMBA`, `MOTOR`) y busca columnas de coeficientes `hpoly*` (head) y `npoly*` (power). Si detecta un mapeo válido, lo guarda en `data/column_mapping.json`.
- Si el archivo Excel no está disponible o no contiene las hojas esperadas, se cargan catálogos dummy para permitir pruebas rápidas.

Testing

Ejecutar la suite de tests con `pytest`:

```powershell
.\venv\Scripts\python.exe -m pytest -q
```

Hay tests básicos para:
- `calculate_ipr()` (pozo)
- `get_pump_performance_curves()` (usando catálogos dummy)
- comportamiento ante bombas inexistentes y mapeo de columnas

Roadmap / Siguientes pasos (Fase 1)

1. Definir criterios de aceptación para la Fase 1 (APIs que deben estar completas, cálculos que deben coincidir con la ingeniería).
2. Implementar fórmulas de validación en `engineering_validation.py` (reemplazar stubs por reglas reales).
3. Añadir más pruebas unitarias y tests de integración.
4. Añadir CI (GitHub Actions) para ejecutar tests en cada push.
5. Exponer endpoints adicionales para filtros y paginación de catálogos si el front lo requiere.

Soporte y notas

Si querés que adapte la detección de columnas a un formato distinto del Excel, puedo:
- generar automáticamente `data/column_mapping.json` y proponerte los nombres que usaré, o
- actualizar `equipment_selection.py` para aceptar un mapping manual en un archivo JSON.

Gracias — seguimos con la Fase 1 cuando quieras. 