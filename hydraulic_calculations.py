# --- hydraulic_calculations.py ---
# Módulo de Cálculos Hidráulicos (TDH, Fricción)
# -----------------------------------------------
# UNIDADES MÉTRICAS:
# - Presión: bar
# - Caudal: m³/d
# - Longitud: m (metros)
# - Diámetro: mm (milímetros)

import math


def calculate_friction_loss_darcy(caudal_m3d, longitud_m, diametro_interno_mm, rugosidad_mm, densidad_kg_m3, viscosidad_cp):
    """
    Calcula las pérdidas por fricción usando la ecuación de Darcy-Weisbach.
    
    Args:
        caudal_m3d (float): Caudal en m³/día
        longitud_m (float): Longitud de tubería en metros
        diametro_interno_mm (float): Diámetro interno en mm
        rugosidad_mm (float): Rugosidad absoluta en mm
        densidad_kg_m3 (float): Densidad del fluido en kg/m³
        viscosidad_cp (float): Viscosidad dinámica en cP
    
    Returns:
        float: Pérdidas por fricción en bar
    """
    if caudal_m3d <= 0:
        return 0.0
    
    # Convertir unidades
    d_m = diametro_interno_mm / 1000.0  # mm -> m
    e_m = rugosidad_mm / 1000.0  # mm -> m
    area_m2 = math.pi * (d_m ** 2) / 4.0
    caudal_m3s = caudal_m3d / 86400.0  # m³/día -> m³/s
    velocidad_ms = caudal_m3s / area_m2 if area_m2 > 0 else 0
    
    # Viscosidad dinámica: 1 cP = 0.001 Pa·s
    mu_pas = viscosidad_cp * 0.001
    
    # Número de Reynolds
    Re = (densidad_kg_m3 * velocidad_ms * d_m) / mu_pas if mu_pas > 0 else 0
    
    # Rugosidad relativa
    epsilon = e_m / d_m if d_m > 0 else 0
    
    # Factor de fricción de Darcy usando aproximación de Swamee-Jain
    # (válida para Re > 4000 y 10^-6 < ε/D < 10^-2)
    if Re > 4000:  # Flujo turbulento
        # Fórmula de Swamee-Jain
        f = 0.25 / (math.log10(epsilon/3.7 + 5.74/(Re**0.9)) ** 2)
    elif Re > 2300:  # Zona de transición (aproximación)
        f = 0.032  # Valor aproximado en transición
    else:  # Flujo laminar (Re < 2300)
        f = 64.0 / Re if Re > 0 else 0.032
    
    # Ecuación de Darcy-Weisbach: ΔP = f * (L/D) * (ρ*v²/2)
    delta_p_pa = f * (longitud_m / d_m) * (densidad_kg_m3 * (velocidad_ms ** 2) / 2.0) if d_m > 0 else 0
    
    # Convertir Pa a bar (1 bar = 100,000 Pa)
    delta_p_bar = delta_p_pa / 100000.0
    
    return delta_p_bar


def calculate_fluid_properties(well_data):
    """
    Calcula las propiedades del fluido necesarias para cálculos hidráulicos.
    
    Args:
        well_data (dict): Datos del pozo con grado_api, agua_porcentaje, etc.
    
    Returns:
        dict: {
            'densidad': densidad en kg/m³,
            'gradiente': gradiente en bar/m,
            'viscosidad': viscosidad en cp (del input)
        }
    """
    grado_api = well_data.get('grado_api', 30)
    agua_porcentaje = well_data.get('agua_porcentaje', 0)
    gravedad_especifica_agua = well_data.get('gravedad_especifica_agua', 1.0)
    viscosidad_cp = well_data.get('viscosidad', 1.0)
    
    # Densidad del petróleo según API (g/cm³)
    densidad_oil_gcc = 141.5 / (131.5 + grado_api)
    
    # Densidad del agua (g/cm³)
    densidad_water_gcc = gravedad_especifica_agua
    
    # Fracción de agua (0 a 1)
    fraccion_agua = agua_porcentaje / 100.0
    
    # Densidad de la mezcla (g/cm³)
    densidad_mezcla_gcc = densidad_oil_gcc * (1 - fraccion_agua) + densidad_water_gcc * fraccion_agua
    
    # Convertir a kg/m³
    densidad_kg_m3 = densidad_mezcla_gcc * 1000.0
    
    # Gradiente en bar/m
    # 1 g/cm³ * 9.81 m/s² = 9810 Pa/m = 0.0981 bar/m
    gradiente_bar_m = densidad_mezcla_gcc * 0.0981
    
    return {
        'densidad': densidad_kg_m3,
        'gradiente': gradiente_bar_m,
        'viscosidad': viscosidad_cp
    }


def calculate_tdh_basic(well_data, caudal_m3d):
    """
    Calcula el TDH (Total Dynamic Head) básico para un caudal dado.
    
    FASE 1: Cálculo simplificado sin pérdidas por fricción detalladas.
    
    TDH = H_elevación + H_presión_neta + H_fricción_simplificada
    
    Args:
        well_data (dict): Diccionario con:
            - profundidad_intake (m): Profundidad de instalación de la bomba
            - nivel_fluido_dinamico (m): Nivel de fluido dinámico (desde superficie)
            - presion_superficie (bar): Presión deseada en superficie
            - presion_casing (bar): Presión en el anular (casing)
            - grado_api, agua_porcentaje, etc.
        caudal_m3d (float): Caudal en m³/día
    
    Returns:
        float: TDH total en metros
    """
    # Extraer datos de instalación
    profundidad_intake = well_data.get('profundidad_intake', 1500)  # m
    nivel_fluido = well_data.get('nivel_fluido_dinamico', 500)  # m desde superficie
    presion_superficie = well_data.get('presion_superficie', 10)  # bar
    presion_casing = well_data.get('presion_casing', 5)  # bar
    
    # Calcular propiedades del fluido
    fluid_props = calculate_fluid_properties(well_data)
    gradiente = fluid_props['gradiente']  # bar/m
    
    # 1. CARGA DE ELEVACIÓN
    # Distancia vertical que debe elevar el fluido
    h_elevacion = profundidad_intake - nivel_fluido  # m
    
    # 2. CARGA POR PRESIÓN NETA
    # La presión de casing ayuda a empujar el fluido hacia la bomba
    # La presión de superficie es la que debe vencer en cabezal
    presion_neta = presion_superficie - presion_casing  # bar
    h_presion_neta = presion_neta / gradiente  # m
    
    # 3. PÉRDIDAS POR FRICCIÓN (SIMPLIFICADAS PARA FASE 1)
    # Modelo simple: h_fricción = k * Q²
    # Este coeficiente será reemplazado en FASE 2 con cálculo real
    k_friccion = 0.0001  # Coeficiente empírico simplificado
    h_friccion = k_friccion * (caudal_m3d ** 2)
    
    # TDH TOTAL
    tdh_total = h_elevacion + h_presion_neta + h_friccion
    
    return tdh_total


def calculate_system_head_curve(well_data):
    """
    Calcula la curva de 'system head' o TDH vs Caudal.
    Esta es la carga total (TDH) que la bomba debe vencer para
    diferentes caudales.
    
    FASE 1: Implementación básica.
    FASE 2: Se agregará cálculo detallado de fricción.
    
    Args:
        well_data (dict): Diccionario con datos del pozo e instalación
    
    Returns:
        list: Lista de diccionarios [{"caudal": Q (m³/d), "tdh": TDH (m)}]
    """
    print("Calculando curva de TDH del sistema (FASE 1 - Básico)...")
    
    # Rango de caudales a evaluar (0 a 500 m³/d en incrementos)
    q_max = well_data.get('q_max_estimate', 500)  # m³/d
    n_points = well_data.get('n_points', 50)
    
    system_curve = []
    
    for i in range(n_points + 1):
        q = (q_max / n_points) * i  # m³/d
        tdh = calculate_tdh_basic(well_data, q)
        
        system_curve.append({
            "caudal": round(q, 2),
            "tdh": round(tdh, 2)
        })
    
    return system_curve


def calculate_pressure_demand_curve(well_data, ipr_data=None):
    """
    Calcula la curva de demanda de presión de la bomba (TDH vs Caudal).
    
    Esta curva muestra el TDH (Total Dynamic Head) que debe generar la bomba
    para diferentes caudales, usando la fórmula:
    
    TDH = PD + Tf + TP/MG - PIP/MG
    
    Donde:
    - PD (Pump Depth): Profundidad de la bomba (TVD) en metros
    - Tf (Tubing Friction): Pérdidas por fricción en tubería (metros)
    - TP (Tubing Pressure): Presión objetivo en superficie (bar)
    - PIP (Pump Intake Pressure): Presión de entrada a la bomba (bar)
      * IMPORTANTE: PIP = Pwf del IPR (varía con el caudal Q)
      * La PIP depende de la IPR del pozo
    - MG (Mixture Gradient): Gradiente de la mezcla (bar/m)
    
    La curva es CRECIENTE porque:
    - A mayor Q → menor PIP (del IPR) → mayor TDH
    - A mayor Q → mayores pérdidas por fricción Tf
    
    El punto de operación es donde esta curva intercepta la curva H-Q de la bomba.
    
    Args:
        well_data (dict): Datos del pozo e instalación
        ipr_data (dict): Datos del IPR calculado (REQUERIDO para obtener PIP)
    
    Returns:
        dict: {
            'curve': [{"caudal": Q, "tdh": TDH, "pip": PIP, ...}],
            'components': {...}
        }
    """
    print("Calculando curva de demanda de presión de la bomba...")
    
    # Extraer parámetros
    profundidad_bomba = well_data.get('profundidad_intake', 1500)  # m (PD)
    presion_superficie = well_data.get('presion_superficie', 10)  # bar (TP)
    presion_casing = well_data.get('presion_casing', 0)  # bar (Pcasing)
    
    # Parámetros de tubería para cálculo de fricción
    tubing_id_mm = well_data.get('tubing_id_mm', 62.0)  # Diámetro interno en mm
    tubing_roughness_mm = well_data.get('tubing_roughness_mm', 0.046)  # Rugosidad en mm
    tubing_length_m = profundidad_bomba  # Longitud de tubería = profundidad bomba
    
    # Calcular propiedades del fluido
    fluid_props = calculate_fluid_properties(well_data)
    gradiente = fluid_props['gradiente']  # bar/m (MG)
    densidad = fluid_props['densidad']  # kg/m³
    viscosidad = fluid_props['viscosidad']  # cP
    
    # Rango de caudales: DEBE COINCIDIR CON EL IPR
    if ipr_data and 'q_max' in ipr_data:
        q_max = ipr_data['q_max']  # m³/d del IPR calculado
    else:
        q_max = well_data.get('q_max_estimate', 500)  # m³/d
    
    n_points = well_data.get('n_points', 50)
    
    # Crear mapa de datos del IPR: PIP (Pwf) vs caudal
    # PIP = Pump Intake Pressure = Pwf del IPR
    # IMPORTANTE: Usar exactamente los MISMOS PUNTOS del IPR
    ipr_points = []
    if ipr_data and 'curve' in ipr_data:
        ipr_points = ipr_data['curve']
    
    pressure_curve = []
    
    # Usar exactamente los mismos puntos de caudal del IPR
    for point in ipr_points:
        q = point['caudal']  # m³/d (exactamente del IPR)
        
        # 1. Obtener PIP (Pump Intake Pressure) del IPR
        #    PIP = Pwf = Presión de fondo fluyente a este caudal
        pwf_bar = point['pwf']  # bar (del IPR)
        pip_bar = pwf_bar + presion_casing  # bar (sumar presión de casing)
        nivel_dinamico = point.get('nivel', 0)  # m (del IPR)
        
        # 2. PD: Profundidad de la bomba (Pump Depth)
        pd = profundidad_bomba  # m
        
        # 3. Tf: Pérdidas por fricción usando Darcy-Weisbach
        tf_bar = calculate_friction_loss_darcy(
            caudal_m3d=q,
            longitud_m=tubing_length_m,
            diametro_interno_mm=tubing_id_mm,
            rugosidad_mm=tubing_roughness_mm,
            densidad_kg_m3=densidad,
            viscosidad_cp=viscosidad
        )
        tf = tf_bar / gradiente  # Convertir de bar a metros
        
        # 4. TP: Presión en tubería en superficie (Tubing Pressure)
        tp_bar = presion_superficie  # bar
        tp_altura = tp_bar / gradiente  # m
        
        # 5. PIP: Presión de entrada a la bomba (del IPR)
        pip_altura = pip_bar / gradiente  # m
        
        # FORMULA TDH (Total Dynamic Head):
        # TDH = PD + Tf + TP/MG - PIP/MG
        tdh = pd + tf + tp_altura - pip_altura  # m
        
        # tf_bar ya está calculado arriba
        
        pressure_curve.append({
            "caudal": round(q, 2),
            "tdh": round(tdh, 2),  # m (TDH que debe dar la bomba)
            "pip": round(pip_bar, 2),  # bar (Presión de entrada = Pwf + Pcasing)
            "pwf": round(pwf_bar, 2),  # bar (Presión de fondo fluyente del IPR)
            "nivel": round(nivel_dinamico, 2),  # m (Nivel dinámico del fluido)
            "perdidas_friccion": round(tf_bar, 2),  # bar
            "pd": round(pd, 2),  # m (Profundidad de bomba)
            "tp_bar": round(tp_bar, 2)  # bar (Presión superficie)
        })
    
    return {
        'curve': pressure_curve,
        'components': {
            'p_surface_target': presion_superficie,
            'profundidad_bomba': profundidad_bomba,
            'gradiente': round(gradiente, 5),
            'p_casing': presion_casing
        }
    }


