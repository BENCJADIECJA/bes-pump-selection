# --- well_performance.py ---
# Módulo de Cálculo de Rendimiento de Pozo (IPR)
# ---------------------------------------------
# UNIDADES MÉTRICAS:
# - Presión: bar
# - Caudal: m³/d
# - Longitud: m
# - Permeabilidad: mD
# - Viscosidad: cp

import math
from copy import deepcopy

def calculate_fluid_gradient(grado_api, agua_porcentaje, gravedad_especifica_agua=1.0):
    """
    Calcula el gradiente del fluido mezcla (petróleo + agua) en bar/m
    
    Args:
        grado_api (float): Grado API del petróleo (típico: 10-40)
        agua_porcentaje (float): Porcentaje de agua en la mezcla (0-100)
        gravedad_especifica_agua (float): Gravedad específica del agua (típico: 1.0-1.1)
    
    Returns:
        float: Gradiente del fluido en bar/m
    
    Fórmulas:
        - Densidad petróleo (g/cm³) = 141.5 / (131.5 + °API)
        - Densidad agua = gravedad_especifica_agua * 1.0 g/cm³
        - Densidad mezcla = densidad_oil * (1 - fw) + densidad_water * fw
        - Gradiente (bar/m) = densidad_mezcla * 9.81 / 100000
    """
    # Densidad del petróleo según API
    densidad_oil = 141.5 / (131.5 + grado_api)  # g/cm³
    
    # Densidad del agua (basada en gravedad específica)
    densidad_water = gravedad_especifica_agua  # g/cm³
    
    # Fracción de agua (0 a 1)
    fraccion_agua = agua_porcentaje / 100.0
    
    # Densidad de la mezcla
    densidad_mezcla = densidad_oil * (1 - fraccion_agua) + densidad_water * fraccion_agua  # g/cm³
    
    # Gradiente en bar/m
    # 1 g/cm³ * 9.81 m/s² = 9810 Pa/m = 0.0981 bar/m
    gradiente = densidad_mezcla * 0.0981  # bar/m
    
    return gradiente


def pressure_to_level(presion_bar, presion_referencia_bar, gradiente_bar_per_m):
    """
    Convierte una diferencia de presión a nivel de fluido en metros
    
    Args:
        presion_bar (float): Presión en bar
        presion_referencia_bar (float): Presión de referencia (típicamente presión de reservorio)
        gradiente_bar_per_m (float): Gradiente del fluido en bar/m
    
    Returns:
        float: Nivel de fluido en metros desde la referencia
    """
    if gradiente_bar_per_m == 0:
        return 0
    
    diferencia_presion = presion_referencia_bar - presion_bar
    nivel_m = diferencia_presion / gradiente_bar_per_m
    
    return nivel_m

def calculate_ipr(well_data):
    """
    Calcula los puntos de la curva de IPR (Inflow Performance Relationship)
    basado en los datos del pozo y el método seleccionado.
    
    Args:
        well_data (dict): Diccionario con los datos del pozo.
                          Campos requeridos según el método:
                          - method: 'vogel', 'fetkovich', 'darcy', 'linear'
                          - presion_reservorio (bar): Presión estática del reservorio
                          - presion_burbuja (bar): Presión de burbuja (para Vogel)
                          - pi (m³/d/bar): Índice de productividad (para Linear/Fetkovich)
                          - permeabilidad (mD): Permeabilidad (para Darcy)
                          - espesor (m): Espesor de la formación (para Darcy)
                          - radio_drenaje (m): Radio de drenaje (para Darcy)
                          - radio_pozo (m): Radio del pozo (para Darcy)
                          - viscosidad (cp): Viscosidad del fluido (para Darcy)
                          - factor_volumen (m³/m³): Factor volumétrico (para Darcy)
                          - skin: Factor de daño (para Darcy)
                          - q_test (m³/d): Caudal de prueba (para Vogel/Fetkovich)
                          - pwf_test (bar): Presión de fondo fluyente de prueba (para Vogel/Fetkovich)
    
    Returns:
        dict: {
            'method': método usado,
            'curve': lista de puntos [{"caudal": q, "pwf": pwf}],
            'q_max': caudal máximo teórico,
            'parameters': parámetros calculados
        }
    """
    print("Calculando IPR...")
    
    method = well_data.get('method', 'linear').lower()
    pr = well_data.get('presion_reservorio', 150)  # bar
    
    if method == 'vogel':
        return calculate_ipr_vogel(well_data)
    elif method == 'fetkovich':
        return calculate_ipr_fetkovich(well_data)
    elif method == 'darcy':
        return calculate_ipr_darcy(well_data)
    else:  # linear por defecto
        return calculate_ipr_linear(well_data)


def calculate_ipr_linear(well_data):
    """
    IPR Lineal: Pwf = Pr - (Q / PI)
    Válido para flujo monofásico sobre presión de burbuja.
    UNIDADES: Pr(bar), PI(m³/d/bar), Q(m³/d)
    """
    pr = well_data.get('presion_reservorio', 150)  # bar
    pi = well_data.get('pi', 5.0)  # m³/d/bar
    n_points = well_data.get('n_points', 50)
    
    # Parámetros del fluido
    grado_api = well_data.get('grado_api', 30)  # °API
    agua_porcentaje = well_data.get('agua_porcentaje', 0)  # %
    gravedad_especifica_agua = well_data.get('gravedad_especifica_agua', 1.0)  # SG
    
    # Calcular gradiente del fluido
    gradiente = calculate_fluid_gradient(grado_api, agua_porcentaje, gravedad_especifica_agua)  # bar/m
    
    q_max = pr * pi  # m³/d
    
    ipr_curve = []
    for i in range(n_points + 1):
        q = (q_max / n_points) * i
        pwf = pr - (q / pi)
        
        if pwf < 0:
            pwf = 0
        
        # Calcular nivel de fluido
        nivel = pressure_to_level(pwf, pr, gradiente)
            
        ipr_curve.append({
            "caudal": round(q, 2), 
            "pwf": round(pwf, 2),
            "nivel": round(nivel, 2)
        })
        
        if pwf == 0:
            break
    
    return {
        'method': 'Linear (Darcy)',
        'curve': ipr_curve,
        'q_max': round(q_max, 2),
        'parameters': {
            'pi': pi,
            'pr': pr,
            'gradiente': round(gradiente, 5),
            'grado_api': grado_api,
            'agua_porcentaje': agua_porcentaje
        }
    }


def calculate_ipr_vogel(well_data):
    """
    IPR de Vogel compuesta (Standing) con soporte para reservorios saturados y sub-saturados.
    UNIDADES: Pr(bar), Pb(bar), Q(m³/d)
    """
    pr = well_data.get('presion_reservorio', 150)
    pb = well_data.get('presion_burbuja', pr * 0.8)
    q_test = well_data.get('q_test', None)
    pwf_test = well_data.get('pwf_test', None)
    n_points = well_data.get('n_points', 50)

    grado_api = well_data.get('grado_api', 30)
    agua_porcentaje = well_data.get('agua_porcentaje', 0)
    gravedad_especifica_agua = well_data.get('gravedad_especifica_agua', 1.0)

    gradiente = calculate_fluid_gradient(grado_api, agua_porcentaje, gravedad_especifica_agua)
    pi_default = well_data.get('pi', 5.0)

    saturated_reservoir = pr <= pb
    ipr_curve = []
    productivity_index = pi_default

    if saturated_reservoir:
        if q_test is not None and pwf_test is not None:
            ratio = pwf_test / pr if pr else 0
            productivity_ratio = 1 - 0.2 * ratio - 0.8 * (ratio ** 2)
            if productivity_ratio > 0:
                q_max = q_test / productivity_ratio
            else:
                q_max = q_test * 2
            denom = pr - pwf_test
            if denom > 0:
                productivity_index = q_test / denom
        else:
            q_max = pr * pi_default * 0.8

        for i in range(n_points + 1):
            pwf = pr * (1 - i / n_points)
            if pwf < 0:
                pwf = 0

            ratio = pwf / pr if pr else 0
            q = q_max * (1 - 0.2 * ratio - 0.8 * (ratio ** 2))
            if q < 0:
                q = 0

            nivel = pressure_to_level(pwf, pr, gradiente)
            ipr_curve.append({
                "caudal": round(q, 2),
                "pwf": round(pwf, 2),
                "nivel": round(nivel, 2)
            })

        method_label = 'Vogel (Bifásico - Saturado)'
        q_max_output = q_max
    else:
        j_value = None
        if q_test is not None and pwf_test is not None:
            if pwf_test >= pb:
                denom = pr - pwf_test
                if denom > 0:
                    j_value = q_test / denom
            else:
                denom = (pr - pb) + (pb / 1.8) * (
                    1 - 0.2 * (pwf_test / pb) - 0.8 * ((pwf_test / pb) ** 2)
                ) if pb else None
                if denom and denom > 0:
                    j_value = q_test / denom

        if j_value is None or j_value <= 0:
            j_value = pi_default

        productivity_index = j_value
        pb_safe = pb if pb > 0 else 1e-6
        q_bubble = j_value * (pr - pb)

        for i in range(n_points + 1):
            pwf = pr * (1 - i / n_points)
            if pwf < 0:
                pwf = 0

            if pwf >= pb:
                q = j_value * (pr - pwf)
            else:
                ratio = pwf / pb_safe
                q_vogel_part = (j_value * pb_safe / 1.8) * (
                    1 - 0.2 * ratio - 0.8 * (ratio ** 2)
                )
                q = q_bubble + q_vogel_part

            if q < 0:
                q = 0

            nivel = pressure_to_level(pwf, pr, gradiente)
            ipr_curve.append({
                "caudal": round(q, 2),
                "pwf": round(pwf, 2),
                "nivel": round(nivel, 2)
            })

        q_vogel_aof = (j_value * pb_safe / 1.8)
        q_max_output = q_bubble + q_vogel_aof
        method_label = 'Vogel (Bifásico - Compuesta)'

    q_max_output = max(q_max_output, 0)

    return {
        'method': method_label,
        'curve': ipr_curve,
        'q_max': round(q_max_output, 2),
        'parameters': {
            'pr': pr,
            'pb': pb,
            'q_test': q_test,
            'pwf_test': pwf_test,
            'gradiente': round(gradiente, 5),
            'grado_api': grado_api,
            'agua_porcentaje': agua_porcentaje,
            'productivity_index': round(productivity_index, 5)
        }
    }


def calculate_ipr_fetkovich(well_data):
    """
    IPR de Fetkovich: Q = C * (Pr^n - Pwf^n)
    Donde C y n son constantes empíricas.
    Válido para flujo en yacimientos con baja permeabilidad.
    UNIDADES: Pr(bar), Q(m³/d)
    """
    pr = well_data.get('presion_reservorio', 150)  # bar
    q_test = well_data.get('q_test', None)  # m³/d
    pwf_test = well_data.get('pwf_test', None)  # bar
    n = well_data.get('n_exponent', 1.0)  # Exponente (típicamente 0.5 a 1.0)
    n_points = well_data.get('n_points', 50)
    
    # Parámetros del fluido
    grado_api = well_data.get('grado_api', 30)  # °API
    agua_porcentaje = well_data.get('agua_porcentaje', 0)  # %
    gravedad_especifica_agua = well_data.get('gravedad_especifica_agua', 1.0)  # SG
    
    # Calcular gradiente del fluido
    gradiente = calculate_fluid_gradient(grado_api, agua_porcentaje, gravedad_especifica_agua)  # bar/m
    
    # Calcular constante C de datos de prueba
    if q_test and pwf_test:
        c = q_test / ((pr ** n) - (pwf_test ** n)) if (pr ** n - pwf_test ** n) > 0 else 0.001
    else:
        # Estimación si no hay datos
        pi_estimate = well_data.get('pi', 5.0)  # m³/d/bar
        c = pi_estimate / pr
    
    ipr_curve = []
    for i in range(n_points + 1):
        pwf = pr * (1 - i / n_points)
        
        if pwf < 0:
            pwf = 0
        
        # Ecuación de Fetkovich
        q = c * ((pr ** n) - (pwf ** n))
        
        if q < 0:
            q = 0
        
        # Calcular nivel de fluido
        nivel = pressure_to_level(pwf, pr, gradiente)
            
        ipr_curve.append({
            "caudal": round(q, 2), 
            "pwf": round(pwf, 2),
            "nivel": round(nivel, 2)
        })
    
    q_max = c * (pr ** n)
    
    return {
        'method': 'Fetkovich (Empírico)',
        'curve': ipr_curve,
        'q_max': round(q_max, 2),
        'parameters': {
            'c': c,
            'n': n,
            'pr': pr,
            'q_test': q_test,
            'pwf_test': pwf_test,
            'gradiente': round(gradiente, 5),
            'grado_api': grado_api,
            'agua_porcentaje': agua_porcentaje
        }
    }


def calculate_ipr_darcy(well_data):
    """
    IPR basado en Ecuación de Darcy (flujo radial estacionario):
    Q = (0.543 * k * h * (Pr - Pwf)) / (μ * Bo * (ln(re/rw) + S))
    Válido para flujo monofásico en estado estacionario.
    UNIDADES: Q(m³/d), k(mD), h(m), re(m), rw(m), Pr(bar), μ(cp), Bo(m³/m³)
    Constante 0.543 para unidades métricas (vs 7.08 para campo)
    """
    pr = well_data.get('presion_reservorio', 150)  # bar
    k = well_data.get('permeabilidad', 100)  # mD
    h = well_data.get('espesor', 15)  # m (equiv. ~50 ft)
    re = well_data.get('radio_drenaje', 300)  # m (equiv. ~1000 ft)
    rw = well_data.get('radio_pozo', 0.15)  # m (equiv. ~0.5 ft)
    mu = well_data.get('viscosidad', 1.0)  # cp
    bo = well_data.get('factor_volumen', 1.2)  # m³/m³
    skin = well_data.get('skin', 0)
    n_points = well_data.get('n_points', 50)
    
    # Parámetros del fluido
    grado_api = well_data.get('grado_api', 30)  # °API
    agua_porcentaje = well_data.get('agua_porcentaje', 0)  # %
    gravedad_especifica_agua = well_data.get('gravedad_especifica_agua', 1.0)  # SG
    
    # Calcular gradiente del fluido
    gradiente = calculate_fluid_gradient(grado_api, agua_porcentaje, gravedad_especifica_agua)  # bar/m
    
    # Constante de la ecuación de Darcy (sistema métrico)
    # Q(m³/d) = 0.543 * k(mD) * h(m) * ΔP(bar) / [μ(cp) * Bo(m³/m³) * (ln(re/rw) + S)]
    const = (0.543 * k * h) / (mu * bo * (math.log(re / rw) + skin))
    
    q_max = const * pr
    
    ipr_curve = []
    for i in range(n_points + 1):
        pwf = pr * (1 - i / n_points)
        
        if pwf < 0:
            pwf = 0
        
        q = const * (pr - pwf)
        
        if q < 0:
            q = 0
        
        # Calcular nivel de fluido
        nivel = pressure_to_level(pwf, pr, gradiente)
            
        ipr_curve.append({
            "caudal": round(q, 2), 
            "pwf": round(pwf, 2),
            "nivel": round(nivel, 2)
        })
    
    # Calcular PI
    pi = const
    
    return {
        'method': 'Darcy (Radial)',
        'curve': ipr_curve,
        'q_max': round(q_max, 2),
        'parameters': {
            'pi': round(pi, 4),
            'k': k,
            'h': h,
            're': re,
            'rw': rw,
            'mu': mu,
            'bo': bo,
            'skin': skin,
            'gradiente': round(gradiente, 5),
            'grado_api': grado_api,
            'agua_porcentaje': agua_porcentaje
        }
    }


def scale_ipr_curve(ipr_data, caudal_scale=1.0, scenario_key=None):
    """Create a scaled copy of an IPR curve applying a multiplicative factor to flow."""
    if not ipr_data or not isinstance(ipr_data, dict):
        return None

    try:
        scale = float(caudal_scale)
    except (TypeError, ValueError):
        scale = 1.0

    if scale <= 0:
        scale = 1.0

    scenario_ipr = deepcopy(ipr_data)

    original_curve = ipr_data.get('curve', [])
    scaled_curve = []
    for point in original_curve:
        if not isinstance(point, dict):
            continue

        caudal = point.get('caudal', 0)
        try:
            scaled_caudal = float(caudal) * scale
        except (TypeError, ValueError):
            scaled_caudal = 0.0

        scaled_point = dict(point)
        scaled_point['caudal'] = round(scaled_caudal, 2)
        scaled_curve.append(scaled_point)

    scenario_ipr['curve'] = scaled_curve

    if 'q_max' in scenario_ipr:
        try:
            scenario_ipr['q_max'] = round(float(scenario_ipr['q_max']) * scale, 2)
        except (TypeError, ValueError):
            pass

    parameters = dict(ipr_data.get('parameters', {})) if isinstance(ipr_data.get('parameters'), dict) else {}
    parameters['scenario_caudal_scale'] = round(scale, 4)
    scenario_ipr['parameters'] = parameters

    scenario_ipr['scenario'] = {
        'key': scenario_key,
        'caudal_scale': round(scale, 4)
    }

    return scenario_ipr


