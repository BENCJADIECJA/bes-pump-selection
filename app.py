# --- app.py ---
# Servidor Principal de la API (Flask)
# -------------------------------------

from flask import Flask, request, jsonify
from flask_cors import CORS  # Necesario para permitir la comunicación con el front-end (React)
from flask import send_file, make_response
import io
from copy import deepcopy

# Importamos nuestros módulos de cálculo
import well_performance
import hydraulic_calculations
import gas_effects
import equipment_selection
import engineering_validation
import tubing_catalog
import pump_coefficients
from pump_coefficients import PumpCoefficientError, PumpCoefficientValidationError
import electrical_calculations

app = Flask(__name__)
# Configuramos CORS para permitir peticiones desde nuestro front-end
CORS(app)

SCENARIO_ORDER = ['optimistic', 'conservative', 'pessimistic']
SCENARIO_CONFIG = {
    'optimistic': {
        'label': 'Optimistic',
        'description': 'Same base inputs; adjust manually via scenario overrides if desired.',
        'color': '#2ecc71'
    },
    'conservative': {
        'label': 'Conservative',
        'description': 'Base case using nominal reservoir and installation inputs.',
        'color': '#3498db'
    },
    'pessimistic': {
        'label': 'Pessimistic',
        'description': 'Same base inputs; adjust manually via scenario overrides if desired.',
        'color': '#e74c3c'
    }
}

@app.route('/api/calculate_conditions', methods=['POST'])
def calculate_conditions():
    """
    Etapa A: Cálculo de Condiciones.
    Recibe los datos del pozo y calcula el IPR, TDH y curva de demanda de presión.
    """
    try:
        payload = request.json or {}

        configuracion_pozo = payload.get('configuracion_pozo') or {}
        motor_config = payload.get('motor_config') or {}
        cable_config = payload.get('cable_config') or {}
        pump_config = payload.get('pump_config') or {}

        raw_well_data = payload.get('well_data')
        if isinstance(raw_well_data, dict):
            well_data = deepcopy(raw_well_data)
        else:
            well_data = deepcopy(payload)
            # Eliminar secciones extra agregadas en nueva especificación
            for section_key in ('configuracion_pozo', 'motor_config', 'cable_config', 'pump_config'):
                well_data.pop(section_key, None)

        sensitivity_overrides = payload.get('sensitivity_overrides')
        if sensitivity_overrides is None and isinstance(well_data, dict):
            sensitivity_overrides = well_data.pop('sensitivity_overrides', {}) or {}
        else:
            sensitivity_overrides = sensitivity_overrides or {}
        
        # Convertir rugosidad de string a valor numérico
        if 'tubing_roughness' in well_data:
            roughness_key = well_data['tubing_roughness']
            roughness_map = tubing_catalog.get_roughness_options()
            well_data['tubing_roughness_mm'] = roughness_map.get(roughness_key, 0.046)  # Default: acero nuevo
        
        def apply_override(target, override_data):
            if not isinstance(target, dict) or not isinstance(override_data, dict):
                return target

            q_override = override_data.get('q_test')
            pwf_override = override_data.get('pwf_test')

            if q_override is not None:
                target['q_test'] = q_override
            if pwf_override is not None:
                target['pwf_test'] = pwf_override

            return target

        def parse_frequency(value, default=None):
            try:
                freq = float(value)
                return freq if freq > 0 else default
            except (TypeError, ValueError):
                return default

        # 1. Calcular IPR (Aporte del pozo)
        base_well_data = deepcopy(well_data)

        ipr_base = well_performance.calculate_ipr(deepcopy(base_well_data))
        
        # 2. Calcular TDH (Carga Dinámica Total)
        system_head_curve = hydraulic_calculations.calculate_system_head_curve(deepcopy(base_well_data))

        # 3. Calcular curva de demanda de presión (Presión vs Caudal)
        # Pasamos el IPR para usar la presión de intake real en cada caudal
        pressure_demand_curve = hydraulic_calculations.calculate_pressure_demand_curve(
            deepcopy(base_well_data),
            ipr_base
        )
        
        # DEBUG: Imprimir primeros 3 puntos de la curva de demanda
        print("\n" + "="*80)
        print("DEBUG API - CURVA DE DEMANDA (primeros 3 puntos enviados al frontend):")
        print("="*80)
        for i, point in enumerate(pressure_demand_curve['curve'][:3]):
            print(f"Punto {i}: Q={point['caudal']:.1f} m3/d, TDH={point['tdh']:.2f} m, PIP={point['pip']:.2f} bar, Nivel={point.get('nivel', 'N/A')}")
        print("="*80 + "\n")

        base_freq_hz = parse_frequency(pump_config.get('frequency_hz'), 50.0)
        motor_id_selected = motor_config.get('motor_id')
        electrical_base = electrical_calculations.calculate_electrical_summary(
            well_data=deepcopy(base_well_data),
            pressure_curve=pressure_demand_curve,
            pump_config=pump_config,
            motor_config=motor_config,
            cable_config=cable_config,
            configuracion_pozo=configuracion_pozo,
            freq_hz=base_freq_hz or 50.0,
            motor_id=motor_id_selected
        )

        # 4. Construir escenarios de sensibilidad (optimista / conservador / pesimista)
        scenario_definitions = {}
        ipr_scenarios = {}
        pressure_demand_scenarios = {}
        scenario_electrical = {}

        if ipr_base:
            for key in SCENARIO_ORDER:
                config = SCENARIO_CONFIG.get(key, {})
                scenario_definitions[key] = {
                    'label': config.get('label', key.title()),
                    'description': config.get('description'),
                    'color': config.get('color')
                }

                override_data = sensitivity_overrides.get(key, {}) or {}

                if override_data:
                    scenario_definitions[key]['overrides'] = {
                        k: override_data.get(k)
                        for k in ('q_test', 'pwf_test', 'frequency_hz')
                        if override_data.get(k) is not None
                    }
                has_ipr_override = any(
                    override_data.get(field) is not None for field in ('q_test', 'pwf_test')
                )

                scenario_well_data = base_well_data
                if has_ipr_override:
                    scenario_input = deepcopy(base_well_data)
                    apply_override(scenario_input, override_data)
                    scenario_ipr = well_performance.calculate_ipr(deepcopy(scenario_input))
                    scenario_pressure_demand = hydraulic_calculations.calculate_pressure_demand_curve(
                        deepcopy(scenario_input),
                        scenario_ipr
                    )
                    scenario_well_data = scenario_input
                else:
                    scenario_ipr = deepcopy(ipr_base)
                    scenario_pressure_demand = deepcopy(pressure_demand_curve)

                scenario_freq = parse_frequency(override_data.get('frequency_hz'), base_freq_hz)
                scenario_electrical_data = electrical_calculations.calculate_electrical_summary(
                    well_data=deepcopy(scenario_well_data),
                    pressure_curve=scenario_pressure_demand,
                    pump_config=pump_config,
                    motor_config=motor_config,
                    cable_config=cable_config,
                    configuracion_pozo=configuracion_pozo,
                    freq_hz=scenario_freq or base_freq_hz or 50.0,
                    motor_id=motor_id_selected
                )

                ipr_scenarios[key] = {
                    'ipr': scenario_ipr,
                    'pressure_demand_curve': scenario_pressure_demand,
                    'electrical_data': scenario_electrical_data
                }
                pressure_demand_scenarios[key] = scenario_pressure_demand
                scenario_electrical[key] = scenario_electrical_data

        # 5. Aplicar correcciones por gas si es necesario
        gas_corrections = gas_effects.get_gas_corrections(well_data)

        return jsonify({
            "success": True,
            "ipr_data": ipr_base,
            "system_head_curve": system_head_curve,
            "pressure_demand_curve": pressure_demand_curve,
            "electrical_data": electrical_base,
            "gas_corrections": gas_corrections,
            "ipr_scenarios": ipr_scenarios,
            "pressure_demand_scenarios": pressure_demand_scenarios,
            "electrical_scenarios": scenario_electrical,
            "scenario_definitions": scenario_definitions,
            "scenario_order": SCENARIO_ORDER
        }), 200

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/validate_design', methods=['POST'])
def validate_design():
    """
    Etapa B: Validación del Diseño Completo.
    Recibe los datos del pozo + la configuración de equipo seleccionada por el ingeniero.
    Devuelve la validación completa y los puntos para las curvas de rendimiento.
    """
    try:
        data = request.json
        well_data = data.get('well_data')
        selected_equipment = data.get('selected_equipment') # IDs de bomba, motor, cable, etc.

        # 1. Validar el diseño completo
        validation_results = engineering_validation.validate_full_design(
            well_data, 
            selected_equipment
        )

        # 2. Obtener curvas de rendimiento del equipo seleccionado
        pump_curves = equipment_selection.get_pump_performance_curves(
            selected_equipment.get('pump_id')
        )
        if isinstance(pump_curves, dict) and 'error' in pump_curves:
            return jsonify({"success": False, "error": pump_curves['error']}), 404

        motor_curves = equipment_selection.get_motor_performance_curves(
            selected_equipment.get('motor_id')
        )
        if isinstance(motor_curves, dict) and 'error' in motor_curves:
            return jsonify({"success": False, "error": motor_curves['error']}), 404

        return jsonify({
            "success": True,
            "validation": validation_results,
            "performance_curves": {
                "pump": pump_curves,
                "motor": motor_curves
            }
        }), 200

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/catalogs', methods=['GET'])
def get_catalogs():
    """
    Endpoint para que el front-end obtenga la lista completa de equipos.
    """
    try:
        pumps = equipment_selection.get_pump_catalog()
        motors = equipment_selection.get_motor_catalog()
        cables = equipment_selection.get_cable_catalog()
        # ... otros catálogos (cables, protectores, etc.)

        return jsonify({
            "success": True,
            "catalogs": {
                "pumps": pumps,
                "motors": motors,
                "cables": cables
            }
        }), 200
    
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/api/column-mapping', methods=['GET'])
def column_mapping():
    """Devuelve el mapeo detectado de columnas para los catálogos cargados."""
    try:
        mapping = equipment_selection.get_column_mapping()
        return jsonify({"success": True, "mapping": mapping}), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/api/pumps', methods=['GET'])
def list_pumps():
    """Devuelve la lista simple de bombas (array) para uso del frontend."""
    try:
        pumps = equipment_selection.get_pump_catalog()
        return jsonify(pumps), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/pumps/<pump_id>/curves', methods=['GET'])
def pump_curves(pump_id):
    """Devuelve curvas de una bomba: raw y scaled. Parámetros query: freq (Hz), stages (int), points (int), plot (bool)."""
    try:
        freq = float(request.args.get('freq', 50.0))
        stages = int(request.args.get('stages', 300))
        points = int(request.args.get('points', 300))
        plot = request.args.get('plot', '0') in ('1', 'true', 'True')

        curves = equipment_selection.get_pump_performance_curves(pump_id, freq_hz=freq, stages=stages, n_points=points)
        if isinstance(curves, dict) and 'error' in curves:
            return jsonify({"success": False, "error": curves['error']}), 404

        if not plot:
            return jsonify({"success": True, "pump_id": pump_id, "curves": curves}), 200

        # Generar PNG en memoria con matplotlib
        try:
            import matplotlib
            matplotlib.use('Agg')
            import matplotlib.pyplot as plt

            qs = [p['caudal'] for p in curves['head']]
            hs = [p['valor'] for p in curves['head']]
            ps = [p['valor'] for p in curves['bhp']]
            es = [p['valor'] for p in curves['efficiency']]

            hs_raw = [p['valor'] for p in curves.get('head_raw', [])]
            ps_raw = [p['valor'] for p in curves.get('bhp_raw', [])]
            es_raw = [p['valor'] for p in curves.get('efficiency_raw', [])]

            fig, ax1 = plt.subplots(figsize=(10, 6))
            ax1.plot(qs, hs, '-o', color='tab:blue', label='Head (scaled)')
            if hs_raw:
                ax1.plot(qs, hs_raw, '--', color='tab:blue', alpha=0.6, label='Head (raw)')
            ax1.set_xlabel('Q')
            ax1.set_ylabel('Head (m)', color='tab:blue')
            ax1.tick_params(axis='y', labelcolor='tab:blue')

            ax2 = ax1.twinx()
            ax2.plot(qs, ps, '-s', color='tab:red', label='BHP (scaled)')
            if ps_raw:
                ax2.plot(qs, ps_raw, '--', color='tab:red', alpha=0.6, label='BHP (raw)')
            ax2.set_ylabel('BHP (hp)', color='tab:red')
            ax2.tick_params(axis='y', labelcolor='tab:red')

            ax3 = ax1.twinx()
            ax3.spines['right'].set_position(('outward', 60))
            ax3.plot(qs, es, '-^', color='tab:green', label='Efficiency (scaled)')
            if es_raw:
                ax3.plot(qs, es_raw, '--', color='tab:green', alpha=0.6, label='Efficiency (raw)')
            ax3.set_ylabel('Efficiency', color='tab:green')
            ax3.tick_params(axis='y', labelcolor='tab:green')

            lines, labels = ax1.get_legend_handles_labels()
            l2, l2l = ax2.get_legend_handles_labels()
            l3, l3l = ax3.get_legend_handles_labels()
            ax1.legend(lines + l2 + l3, labels + l2l + l3l, loc='upper right')

            plt.title(f"Curvas bomba {pump_id}")
            fig.tight_layout()

            buf = io.BytesIO()
            plt.savefig(buf, format='png', dpi=150)
            plt.close(fig)
            buf.seek(0)

            return send_file(buf, mimetype='image/png', as_attachment=False, download_name=f"{pump_id}_curves.png")

        except Exception as e:
            return jsonify({"success": False, "error": f"Error al generar gráfica: {e}"}), 500

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/api/catalogos/cables', methods=['GET'])
def get_power_cable_catalog():
    """Devuelve el catálogo de cables de potencia."""
    try:
        cables = equipment_selection.get_cable_catalog()
        return jsonify({"cables": cables}), 200
    except FileNotFoundError as exc:
        return jsonify({"success": False, "error": str(exc)}), 404
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500


@app.route('/api/tubing-catalog', methods=['GET'])
def get_tubing_catalog():
    """
    Devuelve el catálogo de tuberías de producción estándar.
    """
    try:
        catalog = tubing_catalog.get_tubing_catalog()
        roughness_options = tubing_catalog.get_roughness_options()
        
        return jsonify({
            "success": True,
            "catalog": catalog,
            "roughness_options": roughness_options
        }), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/api/pump_coefficients', methods=['GET'])
def list_pump_coefficients():
    try:
        result = pump_coefficients.list_pump_coefficients()
        return jsonify(result), 200
    except PumpCoefficientError as exc:
        return jsonify({"success": False, "error": str(exc)}), 500


@app.route('/api/pump_coefficients', methods=['POST'])
def create_pump_coefficient():
    try:
        payload = request.json or {}
        row = pump_coefficients.create_pump(payload)
        return jsonify({"success": True, "row": row}), 201
    except PumpCoefficientValidationError as exc:
        return jsonify({"success": False, "error": str(exc), "details": exc.errors}), 422
    except PumpCoefficientError as exc:
        return jsonify({"success": False, "error": str(exc)}), 400
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500


@app.route('/api/pump_coefficients/<pump_id>', methods=['PUT'])
def update_pump_coefficient(pump_id):
    try:
        payload = request.json or {}
        row = pump_coefficients.update_pump(pump_id, payload)
        return jsonify({"success": True, "row": row}), 200
    except PumpCoefficientValidationError as exc:
        return jsonify({"success": False, "error": str(exc), "details": exc.errors}), 422
    except PumpCoefficientError as exc:
        status = 404 if 'No se encontró' in str(exc) else 400
        return jsonify({"success": False, "error": str(exc)}), status
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500


@app.route('/api/pump_coefficients/<pump_id>', methods=['DELETE'])
def delete_pump_coefficient(pump_id):
    try:
        pump_coefficients.delete_pump(pump_id)
        return jsonify({"success": True}), 200
    except PumpCoefficientError as exc:
        status = 404 if 'No se encontró' in str(exc) else 400
        return jsonify({"success": False, "error": str(exc)}), status
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500


if __name__ == '__main__':
    # Cargamos los catálogos en memoria al iniciar la app
    equipment_selection.load_catalogs()
    print("Catálogos de equipos cargados.")
    # Ejecutamos la app en modo debug (para desarrollo)
    app.run(debug=True, port=5000)

