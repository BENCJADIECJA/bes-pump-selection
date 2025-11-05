# Operating Point Synchronization

This note captures the logic that keeps the system operating-point values aligned across the backend, frontend tables, and charts.

## Entry Points
- Backend: `app.py` -> `/api/calculate_conditions` response exposes `electrical_data`, `electrical_scenarios`, `pressure_demand_curve`, and `pressure_demand_scenarios`.
- Frontend container: `frontend/src/App.tsx` holds helper `normalizeOperatingPoint` and the memoized operating-point maps used by plots and tables.

## Base Case
- The main electrical payload contains `metadata.operating_point` (flow, TDH, BHP, efficiency, pressures, level, submergence, frequency).
- `normalizeOperatingPoint` standardizes the payload into consistent numeric fields and fans out optional aliases (e.g., `q_m3d`, `head_m`, `pump_bhp_hp`).
- The React state `baseOperatingPoint` memoizes the normalized result and feeds it directly into every `CurvePlot` instance when no scenarios are active.

## Scenario Flow
1. `/api/calculate_conditions` delivers `electrical_scenarios[key]` objects per scenario. Each carries its own `metadata.operating_point`.
2. During scenario calculations the frontend builds `scenarioOperatingSummary`, which contains:
   - Hydraulically derived values (intersection-driven flow, TDH, Pwf, etc.).
   - Manual overrides (flow, Pwf, frequency) from `ScenarioSensitivityModal` when enabled.
   - Interpolated demand metrics (fluid level, submergence, friction) for annotation.
3. The summary now merges the backend electrical metadata:
   - We normalize `scenarioElectricalData[key].metadata.operating_point` and overlay any non-null fields onto the hydraulic summary.
   - This guarantees that the “System Operating Points” table, the electric comparison, and plot annotations read from the same merged values.
4. The memo `scenarioOperatingPointMap` composes two sources:
   - Normalized electrical metadata (`scenarioElectricalOperatingPoints`).
   - Summary metrics, which may include manual overrides or hydraulic fallbacks.
   The merge preserves backend values while letting user overrides replace individual metrics.
5. `activeOperatingPoint` selects the current scenario (or the base case) and hands it to every `CurvePlot`, ensuring charts, badges, and tables remain consistent.

## User Overrides
- Scenario overrides (`scenarioDisplayValues`) can lock flow/pwf/frequency.
- Locked values flow into `scenarioOperatingSummary`, overriding any hydraulic or backend fields and therefore propagating everywhere (tables + plots).
- When overrides are cleared, the memoized maps fall back to backend metadata, keeping a single source of truth.

## Export Behavior
- The operating-point export button reuses `scenarioOperatingSummary`, so the spreadsheet matches the on-screen tables.
- CSV rows include the merged metrics; blank or undefined values render as em-dash (`—`).

## Maintenance Notes
- Whenever the backend adds new metrics to `metadata.operating_point`, extend `normalizeOperatingPoint` and the summary merge to keep the data in sync.
- Dependencies to watch: `scenarioOperatingSummary` depends on `scenarioElectricalData` so future API responses trigger React recomputation automatically.
