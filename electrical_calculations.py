"""Calculos eléctricos y de eficiencia para el sistema BES."""

from __future__ import annotations

import math
from typing import Dict, Iterable, List, Optional, Sequence, Tuple

import hydraulic_calculations

from equipment_selection import (
    get_cable_specs,
    get_motor_specs,
    get_pump_performance_curves,
)

SQRT_3 = 1.73205
HYDRAULIC_POWER_CONSTANT = 0.00011354  # Constante provista en especificación


class ElectricalComputationError(Exception):
    """Error específico para cálculos eléctricos."""


def _interpolate_series(xs: Sequence[float], ys: Sequence[float], target: float) -> Optional[float]:
    if not xs or not ys or len(xs) != len(ys):
        return None

    if target <= xs[0]:
        return ys[0]
    if target >= xs[-1]:
        return ys[-1]

    for idx in range(len(xs) - 1):
        x1, x2 = xs[idx], xs[idx + 1]
        if x2 == x1:
            continue
        if x1 <= target <= x2 or x2 <= target <= x1:
            y1, y2 = ys[idx], ys[idx + 1]
            fraction = (target - x1) / (x2 - x1)
            return y1 + fraction * (y2 - y1)
    return None


def _extract_series(points: Iterable[dict], x_key: str, y_key: str) -> Tuple[List[float], List[float]]:
    xs: List[float] = []
    ys: List[float] = []
    for item in points or []:
        x_val = item.get(x_key)
        y_val = item.get(y_key)
        if x_val is None or y_val is None:
            continue
        try:
            xs.append(float(x_val))
            ys.append(float(y_val))
        except (TypeError, ValueError):
            continue
    return xs, ys


def _find_operating_point(
    pump_head_points: Sequence[dict],
    demand_points: Sequence[dict],
    pump_bhp_points: Sequence[dict],
    pump_eff_points: Optional[Sequence[dict]] = None
) -> Optional[Dict[str, float]]:
    pump_q, pump_head = _extract_series(pump_head_points, 'caudal', 'valor')
    demand_q, demand_head = _extract_series(demand_points, 'caudal', 'tdh')
    bhp_q, bhp_values = _extract_series(pump_bhp_points, 'caudal', 'valor')
    demand_pip_q, demand_pip = _extract_series(demand_points, 'caudal', 'pip')
    demand_pwf_q, demand_pwf = _extract_series(demand_points, 'caudal', 'pwf')
    demand_level_q, demand_level = _extract_series(demand_points, 'caudal', 'nivel')
    fluid_level_q, fluid_level = _extract_series(demand_points, 'caudal', 'fluid_level_m')
    submergence_q, submergence_vals = _extract_series(demand_points, 'caudal', 'sumergencia_m')
    eff_q, eff_values = _extract_series(pump_eff_points, 'caudal', 'valor') if pump_eff_points else ([], [])

    if not pump_q or not demand_q:
        return None

    def demand_head_at(q: float) -> Optional[float]:
        return _interpolate_series(demand_q, demand_head, q)

    for idx in range(len(pump_q) - 1):
        q1, q2 = pump_q[idx], pump_q[idx + 1]
        if q2 == q1:
            continue

        pump_head1 = pump_head[idx]
        pump_head2 = pump_head[idx + 1]
        demand_head1 = demand_head_at(q1)
        demand_head2 = demand_head_at(q2)

        if demand_head1 is None or demand_head2 is None:
            continue

        diff1 = pump_head1 - demand_head1
        diff2 = pump_head2 - demand_head2

        if diff1 == 0:
            operating_q = q1
            head_value = pump_head1
        elif diff1 * diff2 < 0:
            fraction = diff1 / (diff1 - diff2)
            operating_q = q1 + fraction * (q2 - q1)
            head_value = _interpolate_series(pump_q, pump_head, operating_q)
        else:
            continue

        if head_value is None:
            continue

        bhp_value = _interpolate_series(bhp_q, bhp_values, operating_q)
        eff_value = _interpolate_series(eff_q, eff_values, operating_q) if eff_q else None
        pip_value = _interpolate_series(demand_pip_q, demand_pip, operating_q) if demand_pip_q else None
        pwf_value = _interpolate_series(demand_pwf_q, demand_pwf, operating_q) if demand_pwf_q else None
        level_value = _interpolate_series(fluid_level_q, fluid_level, operating_q) if fluid_level_q else None
        sumergencia_value = _interpolate_series(submergence_q, submergence_vals, operating_q) if submergence_q else None

        return {
            'q_m3d': operating_q,
            'head_m': head_value,
            'pump_bhp_hp': bhp_value if bhp_value is not None else 0.0,
            'pump_efficiency': eff_value,
            'pip_bar': pip_value,
            'pwf_bar': pwf_value,
            'fluid_level_m': level_value,
            'sumergencia_m': sumergencia_value,
            'nivel_reservorio_ref_m': _interpolate_series(demand_level_q, demand_level, operating_q) if demand_level_q else None
        }
    return None


def _ensure_fraction(value: Optional[float]) -> Optional[float]:
    if value is None:
        return None
    if value > 1.5:  # Interpretar valores en %
        return value / 100.0
    return value


def _calculate_motor_section(
    motor_id: str,
    motor_specs: Dict[str, float],
    pump_bhp_hp: float,
    freq_hz: float
) -> Dict[str, Optional[float]]:
    if pump_bhp_hp is None:
        raise ElectricalComputationError('No se proporcionó potencia hidráulica de bomba (BHP).')

    motor_eff = _ensure_fraction(motor_specs.get('eff'))
    cos_fi = _ensure_fraction(motor_specs.get('cos_fi_nom'))
    motor_hp_nom = motor_specs.get('hp_nom')
    motor_volt_nom = motor_specs.get('volt_nom')
    motor_hz_nom = motor_specs.get('hz_nom')
    motor_type = (motor_specs.get('tipo_motor') or '').upper()

    if not motor_eff or motor_eff <= 0:
        raise ElectricalComputationError('Eficiencia de motor inválida o faltante.')
    if not cos_fi or cos_fi <= 0:
        raise ElectricalComputationError('Factor de potencia (cos φ) inválido o faltante.')
    if not motor_volt_nom:
        raise ElectricalComputationError('Voltaje nominal de motor faltante.')
    if not motor_hp_nom:
        raise ElectricalComputationError('HP nominal de motor faltante.')
    if not motor_hz_nom or motor_hz_nom <= 0:
        raise ElectricalComputationError('Frecuencia nominal de motor faltante.')

    fef_base = freq_hz / motor_hz_nom
    if motor_type == 'PM':
        fef = fef_base * 2
    else:
        fef = fef_base

    v_op = motor_volt_nom * fef
    p_motor_kw = (pump_bhp_hp / motor_eff) * 0.7457
    i_motor = (p_motor_kw * 1000.0) / (v_op * cos_fi * SQRT_3)
    p_motor_desarrollada_hp = motor_hp_nom * fef
    motor_load_percent = (pump_bhp_hp / p_motor_desarrollada_hp) * 100.0 if p_motor_desarrollada_hp else None

    s_motor_kva = p_motor_kw / cos_fi

    return {
        'P_motor_kW': p_motor_kw,
        'I_motor': i_motor,
        'V_op': v_op,
        'Motor_Load_Percent': motor_load_percent,
        'S_motor_kVA': s_motor_kva,
        'PF_motor': cos_fi,
        'motor_type': motor_type,
        'fef': fef
    }


def _calculate_cable_losses(
    cable_config: Dict[str, float],
    temps: Dict[str, float],
    current_a: float
) -> Dict[str, Optional[float]]:
    if current_a is None:
        raise ElectricalComputationError('Corriente del motor no calculada, no es posible evaluar pérdidas de cable.')

    def resistance_for_segment(specs_id: str, length_m: float, temp_c: float) -> float:
        specs = get_cable_specs(specs_id)
        if not specs:
            raise ElectricalComputationError(f"No se encontró especificación para cable '{specs_id}'.")
        r_20c = float(specs['r_ohm_km_20c'])
        temp_coeff = float(specs['temp_coeff'])
        r_oper = r_20c * (1 + temp_coeff * (temp_c - 20.0))
        return (r_oper / 1000.0) * max(length_m, 0.0)

    r_mle = resistance_for_segment(cable_config['mle_tipo_id'], cable_config['mle_longitud'], temps['intake'])
    r_fondo = resistance_for_segment(cable_config['fondo_tipo_id'], cable_config['fondo_longitud'], temps['intake'])
    r_superficie = resistance_for_segment(cable_config['superficie_tipo_id'], cable_config['superficie_longitud'], temps['superficie'])

    r_total = r_mle + r_fondo + r_superficie
    p_perdida_kw = (3.0 * (current_a ** 2) * r_total) / 1000.0
    v_perdida = current_a * r_total

    return {
        'R_total': r_total,
        'P_perdida_kW': p_perdida_kw,
        'V_perdida_cable': v_perdida
    }


def _calculate_surface_section(
    p_motor_kw: float,
    p_perdida_kw: float,
    s_motor_kva: float,
    pf_motor: float
) -> Dict[str, Optional[float]]:
    p_superficie_kw = p_motor_kw + p_perdida_kw
    q_superficie_kvar = math.sqrt(max(s_motor_kva ** 2 - p_motor_kw ** 2, 0.0)) if s_motor_kva else 0.0
    s_superficie_kva = math.sqrt(p_superficie_kw ** 2 + q_superficie_kvar ** 2)
    pf_superficie = p_superficie_kw / s_superficie_kva if s_superficie_kva else None

    return {
        'P_superficie_kW': p_superficie_kw,
        'P_superficie_kVA': s_superficie_kva,
        'PF_superficie': pf_superficie,
        'Q_superficie_kVAR': q_superficie_kvar
    }


def _calculate_system_efficiency(
    well_data: Dict,
    operating_point: Dict[str, float],
    p_superficie_kw: float
) -> Optional[float]:
    if not operating_point or p_superficie_kw is None or p_superficie_kw <= 0:
        return None

    fluid_props = hydraulic_calculations.calculate_fluid_properties(well_data)
    sg = fluid_props['densidad'] / 1000.0 if fluid_props else 1.0

    q_m3d = operating_point.get('q_m3d')
    tdh_m = operating_point.get('head_m')

    if q_m3d is None or tdh_m is None:
        return None

    p_hidraulica_kw = q_m3d * tdh_m * sg * HYDRAULIC_POWER_CONSTANT

    return p_hidraulica_kw / p_superficie_kw if p_superficie_kw else None


def calculate_electrical_summary(
    well_data: Dict,
    pressure_curve: Dict,
    pump_config: Dict,
    motor_config: Dict,
    cable_config: Dict,
    configuracion_pozo: Dict,
    freq_hz: float,
    motor_id: Optional[str] = None
) -> Dict[str, Optional[float]]:
    result: Dict[str, Optional[float]] = {
        'P_motor_kW': None,
        'I_motor': None,
        'V_op': None,
        'Motor_Load_Percent': None,
        'P_perdida_kW': None,
        'V_superficie': None,
        'P_superficie_kW': None,
        'P_superficie_kVA': None,
        'PF_superficie': None,
        'Eff_Sistema': None,
        'metadata': {},
        'warnings': []
    }

    def _float_or_default(value, default=0.0):
        try:
            return float(value)
        except (TypeError, ValueError):
            return default

    def _int_or_default(value, default=0):
        try:
            return int(value)
        except (TypeError, ValueError):
            return default

    def _optional_float(value) -> Optional[float]:
        try:
            return float(value)
        except (TypeError, ValueError):
            return None

    pump_id = pump_config.get('pump_id')
    stages = _int_or_default(pump_config.get('stages') or pump_config.get('stages_count'), 0)
    if not pump_id:
        result['warnings'].append('No se proporcionó pump_id, se omiten cálculos eléctricos.')
        return result

    try:
        pump_curves = get_pump_performance_curves(
            pump_id,
            freq_hz=freq_hz,
            stages=stages,
            motor_id=motor_id
        )
    except Exception as exc:
        result['warnings'].append(f'Error obteniendo curvas de bomba: {exc}')
        return result

    operating_point = _find_operating_point(
        pump_curves.get('head', []),
        pressure_curve.get('curve', []) if isinstance(pressure_curve, dict) else pressure_curve,
        pump_curves.get('bhp', []),
        pump_curves.get('efficiency', [])
    )

    if not operating_point:
        result['warnings'].append('No se encontró punto de operación bomba vs demanda.')
        return result

    pump_bhp_hp = operating_point.get('pump_bhp_hp')
    motor_id = motor_id or motor_config.get('motor_id')
    motor_specs = get_motor_specs(motor_id) if motor_id else None

    if not motor_specs:
        result['warnings'].append('Motor no encontrado en catálogo; se omiten cálculos eléctricos.')
        return result

    if not motor_specs.get('is_complete', True):
        result['warnings'].append('Datos de placa del motor incompletos; resultados pueden ser aproximados.')

    try:
        motor_section = _calculate_motor_section(motor_id, motor_specs, pump_bhp_hp, freq_hz)
    except ElectricalComputationError as exc:
        result['warnings'].append(str(exc))
        return result

    profundidad_intake_value = _optional_float(well_data.get('profundidad_intake'))
    profundidad_intake = profundidad_intake_value if profundidad_intake_value is not None else 0.0
    t_superficie = _float_or_default(configuracion_pozo.get('temp_superficie_grad'), 15.0)
    gradiente_temp = _float_or_default(configuracion_pozo.get('gradiente_temp'), 0.0425)
    t_ambiente_superficie = _float_or_default(configuracion_pozo.get('temp_ambiente_superficie'), 25.0)

    temps = {
        'intake': t_superficie + gradiente_temp * profundidad_intake,
        'superficie': t_ambiente_superficie
    }

    required_cable_keys = ['mle_tipo_id', 'mle_longitud', 'fondo_tipo_id', 'superficie_tipo_id', 'superficie_longitud']
    missing_cable_keys = [key for key in required_cable_keys if key not in cable_config]
    if missing_cable_keys:
        result['warnings'].append(
            'Faltan parámetros de cable: ' + ', '.join(missing_cable_keys)
        )
        return result

    mle_longitud = _float_or_default(cable_config.get('mle_longitud'), 0.0)
    superficie_longitud = _float_or_default(cable_config.get('superficie_longitud'), 0.0)
    fondo_longitud = max(profundidad_intake - mle_longitud, 0.0)

    cable_lengths = {
        'mle_tipo_id': cable_config.get('mle_tipo_id'),
        'mle_longitud': mle_longitud,
        'fondo_tipo_id': cable_config.get('fondo_tipo_id'),
        'fondo_longitud': fondo_longitud,
        'superficie_tipo_id': cable_config.get('superficie_tipo_id'),
        'superficie_longitud': superficie_longitud
    }

    try:
        cable_section = _calculate_cable_losses(cable_lengths, temps, motor_section['I_motor'])
    except ElectricalComputationError as exc:
        result['warnings'].append(str(exc))
        return result

    surface_section = _calculate_surface_section(
        motor_section['P_motor_kW'],
        cable_section['P_perdida_kW'],
        motor_section['S_motor_kVA'],
        motor_section['PF_motor']
    )

    pump_eff_value = _optional_float(operating_point.get('pump_efficiency'))
    pip_value = _optional_float(operating_point.get('pip_bar'))
    pwf_value = _optional_float(operating_point.get('pwf_bar'))
    fluid_level_value = _optional_float(operating_point.get('fluid_level_m'))
    sumergencia_value = _optional_float(operating_point.get('sumergencia_m'))

    operating_point['pump_efficiency'] = pump_eff_value
    operating_point['pip_bar'] = pip_value
    operating_point['pwf_bar'] = pwf_value
    operating_point['fluid_level_m'] = fluid_level_value

    if sumergencia_value is None and profundidad_intake_value is not None and fluid_level_value is not None:
        sumergencia_value = max(profundidad_intake_value - fluid_level_value, 0.0)

    operating_point['sumergencia_m'] = sumergencia_value

    v_superficie = motor_section['V_op'] + cable_section['V_perdida_cable']
    eff_sistema = _calculate_system_efficiency(
        well_data,
        operating_point,
        surface_section['P_superficie_kW']
    )

    energy_index = None
    try:
        op_flow = float(operating_point.get('q_m3d')) if operating_point else None
    except (TypeError, ValueError):
        op_flow = None

    surface_power_kw = surface_section.get('P_superficie_kW')
    depth_intake_m = profundidad_intake_value if profundidad_intake_value and profundidad_intake_value > 0 else None

    if surface_power_kw and op_flow and op_flow > 0 and depth_intake_m:
        try:
            energy_index = (float(surface_power_kw) / op_flow / float(depth_intake_m)) * 1000.0
        except (TypeError, ValueError, ZeroDivisionError):
            energy_index = None

    result.update({
        'P_motor_kW': motor_section['P_motor_kW'],
        'I_motor': motor_section['I_motor'],
        'V_op': motor_section['V_op'],
        'Motor_Load_Percent': motor_section['Motor_Load_Percent'],
        'P_perdida_kW': cable_section['P_perdida_kW'],
        'V_superficie': v_superficie,
        'P_superficie_kW': surface_section['P_superficie_kW'],
        'P_superficie_kVA': surface_section['P_superficie_kVA'],
        'PF_superficie': surface_section['PF_superficie'],
        'Eff_Sistema': eff_sistema,
        'Energy_Index': energy_index
    })

    result['metadata'] = {
        'operating_point': operating_point,
        'motor_type': motor_section['motor_type'],
        'fef': motor_section['fef'],
        'temps': temps,
        'cable_resistance_ohm': cable_section['R_total']
    }

    return result