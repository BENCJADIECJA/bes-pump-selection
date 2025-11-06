"""Cálculos de diseño para equipos de superficie.

Este módulo implementa la función ``calcular_diseno_superficie`` descrita en
``calcular_diseno_superficie.md``. La función prepara los datos requeridos para
seleccionar TAP de transformador y dimensionamiento de VSD/tablero en la etapa
estática de diseño.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

SQRT_3 = 1.73205


class SurfaceDesignError(ValueError):
    """Error de validación para el cálculo de diseño de superficie."""


@dataclass
class VHzPoint:
    frecuencia_hz: float
    voltaje_v: float

    def as_dict(self) -> Dict[str, float]:
        return {"f": self.frecuencia_hz, "v": self.voltaje_v}


def _require_section(data: Dict[str, Any], key: str) -> Dict[str, Any]:
    try:
        section = data[key]
    except KeyError as exc:
        raise SurfaceDesignError(f"Falta la sección requerida '{key}'.") from exc
    if not isinstance(section, dict):
        raise SurfaceDesignError(f"La sección '{key}' debe ser un diccionario.")
    return section


def _require_positive(value: Optional[float], name: str) -> float:
    if value is None:
        raise SurfaceDesignError(f"Falta el valor requerido '{name}'.")
    try:
        numeric = float(value)
    except (TypeError, ValueError) as exc:
        raise SurfaceDesignError(f"El valor '{name}' debe ser numérico.") from exc
    if numeric <= 0:
        raise SurfaceDesignError(f"El valor '{name}' debe ser mayor a cero.")
    return numeric


def _require_non_negative(value: Optional[float], name: str) -> float:
    if value is None:
        raise SurfaceDesignError(f"Falta el valor requerido '{name}'.")
    try:
        numeric = float(value)
    except (TypeError, ValueError) as exc:
        raise SurfaceDesignError(f"El valor '{name}' debe ser numérico.") from exc
    if numeric < 0:
        raise SurfaceDesignError(f"El valor '{name}' debe ser mayor o igual a cero.")
    return numeric


def _build_vhz_curve(f_operacion: float, v_vsd_out: float, warnings: List[str]) -> List[Dict[str, float]]:
    if f_operacion <= 0 or v_vsd_out <= 0:
        return []

    puntos: List[VHzPoint] = []
    f_rampa = 5.0

    if f_operacion <= f_rampa:
        warnings.append(
            "F_operacion <= 5 Hz; se construye curva V/Hz lineal sin rampa dedicada."
        )
        step = f_operacion / 5 if f_operacion > 0 else 0
        frecuencias = [step * idx for idx in range(6)]
        for freq in frecuencias:
            voltage = v_vsd_out * (freq / f_operacion) if f_operacion else 0.0
            puntos.append(VHzPoint(freq, voltage))
        return [p.as_dict() for p in puntos]

    # Punto 1 y 2 definidos explícitamente
    puntos.append(VHzPoint(0.0, 0.0))
    puntos.append(VHzPoint(f_rampa, v_vsd_out * 0.10))

    delta_freq = f_operacion - f_rampa
    for ratio in (0.25, 0.50, 0.75):
        freq = f_rampa + delta_freq * ratio
        voltage = _interpolate_voltage(freq, f_operacion, v_vsd_out)
        puntos.append(VHzPoint(freq, voltage))

    puntos.append(VHzPoint(f_operacion, v_vsd_out))

    return [p.as_dict() for p in puntos]


def _interpolate_voltage(freq: float, f_operacion: float, v_vsd_out: float) -> float:
    """Interpolación lineal con rampa 0-5 Hz al 10 % de tensión nominal."""
    if f_operacion <= 0:
        return 0.0

    f_rampa = 5.0
    if freq <= 0:
        return 0.0
    if f_operacion <= f_rampa:
        return v_vsd_out * (freq / f_operacion)

    if freq <= f_rampa:
        return v_vsd_out * 0.10 * (freq / f_rampa)

    slope = (v_vsd_out - v_vsd_out * 0.10) / (f_operacion - f_rampa)
    return v_vsd_out * 0.10 + slope * (freq - f_rampa)


def calcular_diseno_superficie(datos_diseno: Dict[str, Any]) -> Dict[str, Any]:
    """Calcula el diseño de equipos de superficie para VSD o tablero."""
    if not isinstance(datos_diseno, dict):
        raise SurfaceDesignError("'datos_diseno' debe ser un diccionario.")

    warnings: List[str] = list(datos_diseno.get("warnings") or [])

    motor = _require_section(datos_diseno, "motor_placa")
    cable = _require_section(datos_diseno, "cable_seleccionado")
    config = _require_section(datos_diseno, "config_diseno_usuario")
    catalogo = _require_section(datos_diseno, "catalogo_equipos")

    tipo_accionamiento = str(config.get("tipo_accionamiento", "")).lower()
    if tipo_accionamiento not in {"vsd", "tablero"}:
        raise SurfaceDesignError("Tipo de accionamiento no reconocido. Use 'vsd' o 'tablero'.")

    v_nom = _require_positive(motor.get("v_nom"), "motor_placa.v_nom")
    i_nom = _require_positive(motor.get("i_nom"), "motor_placa.i_nom")
    pf_nom = _require_positive(motor.get("pf_nom"), "motor_placa.pf_nom")
    f_nom = _require_positive(motor.get("f_nom"), "motor_placa.f_nom")

    f_operacion: float
    v_vsd_out_actual: Optional[float]

    if tipo_accionamiento == "vsd":
        f_operacion = _require_positive(config.get("f_max_operativa"), "config_diseno_usuario.f_max_operativa")
        v_vsd_out_actual = _require_positive(
            config.get("v_vsd_out_configurada"),
            "config_diseno_usuario.v_vsd_out_configurada"
        )
    else:
        f_operacion = _require_positive(config.get("f_red"), "config_diseno_usuario.f_red")
        v_vsd_out_actual = None

    r_total_ohms = _require_positive(cable.get("r_total_ohms"), "cable_seleccionado.r_total_ohms")

    v_motor_op = v_nom * (f_operacion / f_nom)
    v_drop_cable = i_nom * r_total_ohms
    v_superficie_req = v_motor_op + v_drop_cable

    p_motor_kw = (v_nom * i_nom * pf_nom * SQRT_3) / 1000.0
    p_cable_loss_kw = (3.0 * (i_nom ** 2) * r_total_ohms) / 1000.0
    p_superficie_kw = p_motor_kw + p_cable_loss_kw

    trafo = _require_section(catalogo, "transformador")
    v_primario_nom = _require_positive(trafo.get("v_primario_nom"), "catalogo_equipos.transformador.v_primario_nom")
    v_secundario_nom = _require_positive(trafo.get("v_secundario_nom"), "catalogo_equipos.transformador.v_secundario_nom")

    ratio_nominal = v_secundario_nom / v_primario_nom

    p_vsd_out_kw: Optional[float] = None
    p_vsd_in_kw: Optional[float] = None
    kva_vsd_req: Optional[float] = None
    v_drop_filtro: float = 0.0
    v_trafo_in_real: Optional[float] = v_primario_nom
    i_vsd_out_aprox = i_nom * ratio_nominal
    ratio_trafo_final: Optional[float] = None
    v_sec_equivalente_calc: Optional[float] = None
    tap_porc_calculado: Optional[float] = None
    curva_v_hz_6_puntos: Optional[List[Dict[str, float]]] = None

    if tipo_accionamiento == "vsd":
        filtro = _require_section(catalogo, "filtro_lc")
        vsd_catalogo = _require_section(catalogo, "vsd")

        resistencia_filtro = _require_positive(filtro.get("resistencia_r"), "catalogo_equipos.filtro_lc.resistencia_r")
        inductancia_l = _require_positive(filtro.get("inductancia_l"), "catalogo_equipos.filtro_lc.inductancia_l")

        x_l_filtro = 2 * math.pi * f_operacion * inductancia_l
        z_filtro = math.hypot(resistencia_filtro, x_l_filtro)
        v_drop_filtro = i_vsd_out_aprox * z_filtro
        v_trafo_in_real = v_vsd_out_actual - v_drop_filtro

        if v_trafo_in_real <= 0:
            warnings.append("El cálculo del TAP resultó en tensión de entrada al transformador <= 0 V.")
            v_trafo_in_real = None

        if v_trafo_in_real:
            ratio_trafo_final = v_superficie_req / v_trafo_in_real
            v_sec_equivalente_calc = ratio_trafo_final * v_primario_nom
            tap_porc_calculado = (v_sec_equivalente_calc / v_secundario_nom) * 100.0

        eficiencia_vsd = _require_positive(vsd_catalogo.get("eficiencia"), "catalogo_equipos.vsd.eficiencia")
        pf_entrada = _require_positive(vsd_catalogo.get("pf_entrada"), "catalogo_equipos.vsd.pf_entrada")

        p_filtro_loss_kw = (i_vsd_out_aprox ** 2 * resistencia_filtro) / 1000.0
        p_trafo_loss_kw = p_superficie_kw * 0.02  # 98 % eficiencia asumida
        p_vsd_out_kw = p_superficie_kw + p_filtro_loss_kw + p_trafo_loss_kw
        p_vsd_in_kw = p_vsd_out_kw / eficiencia_vsd
        kva_vsd_req = p_vsd_in_kw / pf_entrada

        curva_v_hz_6_puntos = _build_vhz_curve(f_operacion, v_vsd_out_actual, warnings)

    else:  # tablero
        margen = _require_non_negative(
            config.get("margen_tension_tablero"),
            "config_diseno_usuario.margen_tension_tablero"
        )
        v_tap_requerido = v_superficie_req * (1.0 + margen / 100.0)
        ratio_trafo_final = v_tap_requerido / v_primario_nom
        v_sec_equivalente_calc = v_tap_requerido
        tap_porc_calculado = (v_sec_equivalente_calc / v_secundario_nom) * 100.0
        curva_v_hz_6_puntos = None
        v_vsd_out_actual = None

    if ratio_trafo_final is None:
        warnings.append("No fue posible calcular un TAP válido con los parámetros proporcionados.")

    resultado = {
        "calculos_demanda_pozo": {
            "v_motor_op_v": v_motor_op,
            "v_drop_cable_v": v_drop_cable,
            "v_superficie_req_v": v_superficie_req,
            "p_motor_kw": p_motor_kw,
            "p_cable_loss_kw": p_cable_loss_kw,
            "p_superficie_kw": p_superficie_kw,
            "i_motor_op_a": i_nom,
        },
        "calculos_suministro_superficie": {
            "tipo_accionamiento": tipo_accionamiento,
            "frecuencia_calculo_hz": f_operacion,
            "v_vsd_out_actual_v": v_vsd_out_actual,
            "v_drop_filtro_v": v_drop_filtro,
            "v_trafo_in_real_v": v_trafo_in_real,
            "i_vsd_out_aprox_a": i_vsd_out_aprox,
        },
        "transformador_calculado": {
            "ratio_trafo_final": ratio_trafo_final,
            "v_sec_equivalente_calc_v": v_sec_equivalente_calc,
            "tap_porcentaje_calculado": tap_porc_calculado,
        },
        "vsd_calculado": {
            "kva_vsd_req": kva_vsd_req,
            "p_vsd_out_kw": p_vsd_out_kw if tipo_accionamiento == "vsd" else None,
            "curva_v_hz_6_puntos": curva_v_hz_6_puntos if tipo_accionamiento == "vsd" else None,
        },
        "warnings": warnings,
    }

    return resultado
