# --- engineering_validation.py ---
# Módulo de Validación de Ingeniería (Ejes, Voltaje, Temp.)
# ---------------------------------------------------------

def validate_full_design(well_data, selected_equipment):
    """
    Orquestador principal de todas las validaciones de ingeniería.
    Toma los datos del pozo y el equipo seleccionado y ejecuta
    todas las comprobaciones.
    
    Args:
        well_data (dict): Datos del pozo.
        selected_equipment (dict): IDs del equipo seleccionado.
    
    Returns:
        dict: Un reporte de validación con el estado de cada chequeo.
    """
    print(f"Validando diseño con equipo: {selected_equipment}")
    
    results = {}
    
    # --- Aquí se llamarían a todas las funciones de validación ---
    
    results['shaft_stress'] = validate_shaft_stress(selected_equipment)
    results['protector_thrust'] = validate_protector_thrust(selected_equipment)
    results['voltage_drop'] = calculate_voltage_drop(well_data, selected_equipment)
    results['motor_cooling'] = calculate_motor_cooling(well_data, selected_equipment)
    results['motor_temperature'] = calculate_motor_temperature(well_data, selected_equipment)
    
    # Chequeo general
    all_ok = all(result['status'] == 'OK' for result in results.values())
    results['overall_status'] = 'OK' if all_ok else 'REQUIERE REVISION'
    
    return results

# --- Funciones de Validación Específicas (Implementación aproximada) ---
import math
import equipment_selection


def _find_motor_data(motor_id):
    """Busca la fila del motor en el catálogo y la retorna como dict (o None)."""
    motors = equipment_selection.get_motor_catalog()
    for m in motors:
        # Buscar por la columna detectada o por claves comunes
        mid = m.get(equipment_selection.COL_MOTOR_ID) or m.get('Tipo motor') or m.get('Descripción')
        if mid == motor_id:
            return m
    return None


def validate_shaft_stress(selected_equipment):
    """
    Estima el esfuerzo torsional en el eje basándose en la potencia requerida por la bomba
    y la potencia nominal del motor. Regresa dict con status: OK / ADVERTENCIA / ERROR.

    Supuestos/Notas:
    - Usa la curva BHP de la bomba calculada por `get_pump_performance_curves`.
    - Si falta información (RPM, diámetro de eje), la comprobación básica compara BHP requerida
      contra HP nominal del motor (umbral del 90%).
    - Si se dispone de diámetro del eje y RPM, calcula esfuerzo de corte aproximado.
    """
    pump_id = selected_equipment.get('pump_id')
    motor_id = selected_equipment.get('motor_id')

    try:
        pump_curves = equipment_selection.get_pump_performance_curves(pump_id)
        if isinstance(pump_curves, dict) and 'error' in pump_curves:
            return {"status": "ERROR", "mensaje": pump_curves['error']}

        # Elegimos el punto de trabajo medio (índice medio)
        bhp_points = pump_curves.get('bhp', [])
        if not bhp_points:
            return {"status": "ERROR", "mensaje": "No se encuentran curvas de BHP para la bomba."}

        mid_idx = len(bhp_points) // 2
        required_bhp = float(bhp_points[mid_idx]['valor'] or 0)

        motor_data = _find_motor_data(motor_id)
        motor_hp = None
        motor_rpm = None
        shaft_diameter = None
        if motor_data:
            # Intentar leer campos comunes
            motor_hp = motor_data.get(equipment_selection.COL_MOTOR_HP) or motor_data.get('HP NOM') or motor_data.get('HP')
            motor_rpm = motor_data.get('RPM NOM') or motor_data.get('rpm') or motor_data.get('RPM')
            shaft_diameter = motor_data.get('Diámetro') or motor_data.get('DIAM M') or motor_data.get('Diámetro eje')

        # Si no hay motor_hp, no podemos comparar
        if motor_hp is None:
            return {"status": "ADVERTENCIA", "mensaje": "No se encontró potencia del motor; no se puede validar esfuerzo de eje."}

        motor_hp = float(motor_hp)

        # Comprobación sencilla: la BHP requerida no debe exceder el 90% de la HP nominal
        if required_bhp > motor_hp * 0.9:
            status = "ADVERTENCIA"
            mensaje = f"BHP requerida ({required_bhp:.2f}) supera 90% de HP motor ({motor_hp:.2f})."
        else:
            status = "OK"
            mensaje = f"BHP requerida ({required_bhp:.2f}) dentro de la capacidad del motor ({motor_hp:.2f})."

        # Si tenemos RPM y diámetro, calcular esfuerzo torsional aproximado
        if motor_rpm and shaft_diameter:
            try:
                rpm = float(motor_rpm)
                # Interpretar diámetro: si es muy grande asumimos mm, convertir a metros
                d_val = float(shaft_diameter)
                if d_val > 0 and d_val > 50:  # probable mm
                    d_m = d_val / 1000.0
                else:
                    d_m = d_val

                # Convertir required_bhp (asumimos HP) a Watts
                power_w = required_bhp * 745.7
                torque_nm = power_w * 60.0 / (2.0 * math.pi * rpm)

                # Torsional shear stress for solid circular shaft: tau = 16*T/(pi*d^3)
                tau_pa = 16.0 * torque_nm / (math.pi * (d_m ** 3))
                tau_mpa = tau_pa / 1e6

                # Límite aproximado de esfuerzo cortante (por ejemplo, 40 MPa para acero común)
                allowed_mpa = 40.0
                mensaje += f" Esfuerzo torsional estimado: {tau_mpa:.1f} MPa."
                if tau_mpa > allowed_mpa:
                    status = "ERROR"
                    mensaje += f" Excede límite de diseño (~{allowed_mpa} MPa)."
            except Exception:
                # No detenemos la validación por fallo de parseo de campos
                pass

        return {"status": status, "mensaje": mensaje}

    except Exception as e:
        return {"status": "ERROR", "mensaje": str(e)}


def validate_protector_thrust(selected_equipment):
    """
    Estima el empuje axial aproximado usando la altura (head) de la bomba y el caudal.
    Regresa ADVERTENCIA si se excede un umbral conservador.
    """
    pump_id = selected_equipment.get('pump_id')
    try:
        pump_curves = equipment_selection.get_pump_performance_curves(pump_id)
        if isinstance(pump_curves, dict) and 'error' in pump_curves:
            return {"status": "ERROR", "mensaje": pump_curves['error']}

        head_points = pump_curves.get('head', [])
        if not head_points:
            return {"status": "ERROR", "mensaje": "No se encuentran curvas de altura para la bomba."}

        mid_idx = len(head_points) // 2
        head_val = float(head_points[mid_idx]['valor'] or 0)

        # Empuje axial aproximado: F = rho * g * A * h_effective (simplificado)
        # Asumimos área de pistón pequeña; en lugar de cálculo exacto usamos umbral de head
        if head_val > 2000:  # umbral conservador (unidades dependientes del catálogo)
            return {"status": "ADVERTENCIA", "mensaje": f"Altura de bomba alta ({head_val:.1f}). Revise empuje axial."}

        return {"status": "OK", "mensaje": f"Altura de bomba ({head_val:.1f}) dentro de límites razonables."}

    except Exception as e:
        return {"status": "ERROR", "mensaje": str(e)}


def calculate_voltage_drop(well_data, equipment):
    """
    Calcula una estimación de caída de voltaje en base a la corriente estimada, longitud de cable
    y resistencia por km del conductor. Retorna un dict con status.
    """
    try:
        cable_length_m = float(well_data.get('cable_length_m', 1000))
        # Resistividad típica por km para cobre ~ 0.018 ohm/km por mm2 depende; usamos ejemplo de 0.2 ohm/km
        R_ohm_per_km = float(well_data.get('cable_resistance_ohm_per_km', 0.2))

        # Obtener corriente estimada desde curva del motor (último punto)
        motor_id = equipment.get('motor_id')
        motor_curves = equipment_selection.get_motor_performance_curves(motor_id)
        amps = None
        if isinstance(motor_curves, dict) and 'amperaje' in motor_curves:
            amps_list = motor_curves['amperaje']
            if amps_list:
                amps = float(amps_list[-1]['valor'] or 0)

        if amps is None or amps <= 0:
            # Valor por defecto conservador
            amps = float(well_data.get('estimated_current_a', 100))

        motor_data = _find_motor_data(motor_id)
        voltage = None
        if motor_data:
            voltage = motor_data.get(equipment_selection.COL_MOTOR_VOLTAGE) or motor_data.get('VOLT NOM')
        if voltage is None:
            voltage = float(well_data.get('supply_voltage_v', 2300))

        R_total = R_ohm_per_km * (cable_length_m / 1000.0)
        v_drop = amps * R_total
        v_drop_pct = (v_drop / float(voltage)) * 100.0

        if v_drop_pct > 5.0:
            return {"status": "ADVERTENCIA", "mensaje": f"Caída de voltaje estimada {v_drop_pct:.1f}% (>5%)."}
        return {"status": "OK", "mensaje": f"Caída de voltaje estimada {v_drop_pct:.1f}% (<5%)."}

    except Exception as e:
        return {"status": "ERROR", "mensaje": str(e)}


def calculate_motor_cooling(well_data, equipment):
    """
    Estima la velocidad anular y comprueba si es suficiente para refrigeración del motor.
    Usa `annular_velocity_m_s` en `well_data` si está disponible o un valor por defecto.
    """
    try:
        velocidad_anular = float(well_data.get('annular_velocity_m_s', well_data.get('velocidad_anular', 1.5)))
        if velocidad_anular < 0.3:
            return {"status": "ADVERTENCIA", "mensaje": f"Velocidad anular baja: {velocidad_anular:.2f} m/s. Considere shroud."}
        return {"status": "OK", "mensaje": f"Velocidad anular estimada: {velocidad_anular:.2f} m/s."}
    except Exception as e:
        return {"status": "ERROR", "mensaje": str(e)}


def calculate_motor_temperature(well_data, equipment):
    """
    Estima la temperatura de operación del motor usando la temperatura de fondo y la carga.
    """
    try:
        temp_fondo = float(well_data.get('temp_reservorio', well_data.get('temp_fondo', 100)))
        # Estimamos carga a partir de la relación BHP/motor HP si es posible
        pump_id = equipment.get('pump_id')
        motor_id = equipment.get('motor_id')
        pump_curves = equipment_selection.get_pump_performance_curves(pump_id)
        motor = _find_motor_data(motor_id)
        motor_hp = float(motor.get(equipment_selection.COL_MOTOR_HP) or motor.get('HP NOM') or 100)

        bhp_points = pump_curves.get('bhp', []) if isinstance(pump_curves, dict) or pump_curves else []
        required_bhp = 0.0
        if bhp_points:
            required_bhp = float(bhp_points[len(bhp_points)//2]['valor'] or 0)

        load_percent = min(200.0, (required_bhp / motor_hp) * 100.0) if motor_hp > 0 else 100.0

        # Temperatura estimada = fondo + aumento por carga (ej: 0.3°C por % de carga)
        temp_est = temp_fondo + (load_percent * 0.3)
        temp_limite = float(motor.get('T.MAX') or 250)

        if temp_est > temp_limite:
            return {"status": "ERROR", "mensaje": f"Temperatura estimada {temp_est:.1f}°C excede límite {temp_limite}°C."}
        return {"status": "OK", "mensaje": f"Temperatura estimada {temp_est:.1f}°C (< {temp_limite}°C)."}

    except Exception as e:
        return {"status": "ERROR", "mensaje": str(e)}

