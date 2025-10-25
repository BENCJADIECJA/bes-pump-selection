# CHANGELOG

## [Unreleased] - 2025-10-23
### Added
- Auto-detección de hojas y mapeo dinámico de columnas al cargar `coeficientes NOVOMET.xlsx`.
  - Detecta hojas de bombas y motores (ej.: 'BOMBA', 'MOTOR').
  - Detecta coeficientes `hpoly*` (head) y `npoly*` (power) automáticamente.
  - Guarda el mapeo en `data/column_mapping.json`.
- Nuevo endpoint GET `/api/column-mapping` que devuelve el mapeo detectado.
- Mejor manejo de errores en endpoints de curvas: devuelve HTTP 404 cuando no se encuentra el equipo seleccionado.
- Tests unitarios añadidos:
  - `tests/test_well_and_pump.py` (IPR básico y curvas de bomba con catálogos dummy).
  - `tests/test_errors_and_mapping.py` (caso de bomba inexistente y mapeo de columnas).
- `pytest` añadido a `requirements.txt`.

### Changed
- `equipment_selection.py` actualizado para ser más tolerante con nombres de columnas y hojas.
- `app.py` actualizado para validar errores de curva y exponer mapeo de columnas.

### Fixed
- Se solucionó la carga de catálogos cuando los nombres de hoja no coincidían exactamente (antes se cargaban catálogos dummy).

### How to test locally
1. Crear y activar el virtualenv (si no existe):

```powershell
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
```

2. Ejecutar el servidor:

```powershell
python app.py
```

3. Probar endpoints (ejemplos):

```powershell
curl.exe http://127.0.0.1:5000/api/catalogs
curl.exe http://127.0.0.1:5000/api/column-mapping
```

4. Ejecutar tests:

```powershell
.\venv\Scripts\python.exe -m pytest -q
```

---

_Created automatically during development session._
