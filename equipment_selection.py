# --- equipment_selection.py ---
# Módulo de Gestión de Catálogos de Equipos
# -----------------------------------------

import pandas as pd
import numpy as np # Importamos numpy para manejo de tipos

# =================================================================
# --- CONFIGURACION DE CATALOGOS ---
# =================================================================
# Por favor, asegúrate de que estos nombres coincidan EXACTAMENTE
# con tu archivo Excel (mayúsculas, minúsculas, plurales).

# --- NOMBRES DE ARCHIVO Y HOJAS ---
EXCEL_FILE_NAME = 'coeficientes NOVOMET.xlsx'
# Podemos intentar varias alternativas (el archivo real usa 'BOMBA' y 'MOTOR')
PUMP_SHEET_CANDIDATES = ['Bombas', 'BOMBA', 'Bomba', 'Bombas ']
MOTOR_SHEET_CANDIDATES = ['Motor', 'MOTOR', 'Motor ', 'MOTOR']

def find_sheet_name(xls, candidates):
    """Devuelve el nombre de hoja existente a partir de una lista de candidatos (case-insensitive)."""
    sheets_lower = {s.lower(): s for s in xls.sheet_names}
    for c in candidates:
        if c is None:
            continue
        if c.lower() in sheets_lower:
            return sheets_lower[c.lower()]
    # Si no encontramos por candidatos, devolvemos la primera hoja probable
    if len(xls.sheet_names) > 0:
        return xls.sheet_names[0]
    return None

# --- CONFIGURACION DE COLUMNAS (HOJA 'Bombas') ---
# Valores por defecto / candidatos: intentaremos detectar la columna real en el Excel
PUMP_ID_CANDIDATES = ['Tipo', 'Bomba', 'Tipo bomba', 'Tipo de bomba']
PUMP_MIN_Q_CANDIDATES = ['Q mín', 'min', 'Min', 'q_min', 'min q', 'min.']
PUMP_MAX_Q_CANDIDATES = ['Q máx', 'max', 'Max', 'q_max', 'max q', 'max.']

# Coeficientes para Altura (Head) normalmente en este archivo aparecen como hpoly0..hpoly10
PUMP_HEAD_PREFIXES = ['hpoly', 'C-H-', 'h_poly']
# Coeficientes para Potencia (BHP) aparecen como npoly0..npoly9 o C-P-
PUMP_BHP_PREFIXES = ['npoly', 'C-P-']
# Coeficientes para Eficiencia (si existen)
PUMP_EFF_CANDIDATES = ['C-E-A', 'C-E-B', 'C-E-C', 'eff_a', 'eff_b', 'eff_c']

# --- ATENCIÓN: VERIFICAR ESTOS NOMBRES ---
# Lista de 11 coeficientes para Altura (Head) (Polinomio Grado 10)
# H = C0 + C1*Q + C2*Q^2 + ... + C10*Q^10
# (He adivinado los nombres, por favor, ajústalos a tu Excel)
COLS_PUMP_HEAD = [
    'C-H-0', 'C-H-1', 'C-H-2', 'C-H-3', 'C-H-4', 'C-H-5', 
    'C-H-6', 'C-H-7', 'C-H-8', 'C-H-9', 'C-H-10'
]

# Lista de 10 coeficientes para Potencia (BHP) (Polinomio Grado 9)
# P = C0 + C1*Q + C2*Q^2 + ... + C9*Q^9
# (He adivinado los nombres, por favor, ajústalos a tu Excel)
COLS_PUMP_BHP = [
    'C-P-0', 'C-P-1', 'C-P-2', 'C-P-3', 'C-P-4', 
    'C-P-5', 'C-P-6', 'C-P-7', 'C-P-8', 'C-P-9'
]

# Coeficientes para Eficiencia (Asumido Grado 2: A*Q^2 + B*Q + C)
# (Mantenido de la captura anterior, por favor confirma si es correcto)
COLS_PUMP_EFF = ['C-E-A', 'C-E-B', 'C-E-C'] 

# --- CONFIGURACION DE COLUMNAS (HOJA 'Motor') ---
MOTOR_ID_CANDIDATES = ['Tipo motor', 'Tipo', 'id', 'Descripción']
MOTOR_HP_CANDIDATES = ['HP NOM', 'HP', 'hp', 'HP NOM.']
MOTOR_AMPS_CANDIDATES = ['AMP NOM', 'AMP NOM', 'AMP.TEORICO', 'AMP.NOM', 'AMP NOM']
MOTOR_VOLTAGE_CANDIDATES = ['VOLT NOM', 'VOLT', 'voltaje', 'VOLTAGE']
# (Próximamente) Columnas de coeficientes de motor:
# COL_MOTOR_TEMP_COEFFS = 'temp_curva_coeffs'
# ...etc.
# =================================================================


# --- Variables Globales ---
PUMP_CATALOG = None
MOTOR_CATALOG = None

# Variables de columna (valores por defecto para compatibilidad)
COL_PUMP_ID = 'Tipo'
COL_PUMP_MIN_Q = 'Q mín'
COL_PUMP_MAX_Q = 'Q máx'
COL_MOTOR_ID = 'id'
COL_MOTOR_HP = 'hp'
COL_MOTOR_AMPS = 'amperaje_max'
COL_MOTOR_VOLTAGE = 'voltaje'

def pick_column(columns, candidates, default=None):
    """Escoge la primera columna que exista en la lista `columns` entre los `candidates` (case-insensitive)."""
    cols_lower = {c.lower(): c for c in columns}
    for cand in (candidates or []):
        if cand is None:
            continue
        if cand.lower() in cols_lower:
            return cols_lower[cand.lower()]
    return default

def calculate_polynomial(coeffs, q):
    """
    Calcula el valor de un polinomio para un 'q' dado.
    Asume que coeffs es una lista [C0, C1, C2, ...]
    Retorna C0 + C1*q + C2*q^2 + ...
    """
    total = 0
    for i, c in enumerate(coeffs):
        total += c * (q ** i)
    return total

def load_catalogs():
    """
    Carga los catálogos de equipos (bombas, motores) desde un archivo Excel.
    """
    global PUMP_CATALOG, MOTOR_CATALOG
    
    try:
        print(f"Intentando cargar '{EXCEL_FILE_NAME}'...")
        xls = pd.ExcelFile(EXCEL_FILE_NAME)
        pump_sheet = find_sheet_name(xls, PUMP_SHEET_CANDIDATES)
        motor_sheet = find_sheet_name(xls, MOTOR_SHEET_CANDIDATES)
        print(f"  Hoja detectada para bombas: '{pump_sheet}'")
        print(f"  Hoja detectada para motores: '{motor_sheet}'")
        PUMP_CATALOG = pd.read_excel(EXCEL_FILE_NAME, sheet_name=pump_sheet)
        MOTOR_CATALOG = pd.read_excel(EXCEL_FILE_NAME, sheet_name=motor_sheet)

        # --- LIMPIEZA DE DATOS ---
        PUMP_CATALOG = PUMP_CATALOG.replace({np.nan: None})
        MOTOR_CATALOG = MOTOR_CATALOG.replace({np.nan: None})

        # --- MAPEO DINÁMICO DE COLUMNAS ---
        global COL_PUMP_ID, COL_PUMP_MIN_Q, COL_PUMP_MAX_Q
        global COL_MOTOR_ID, COL_MOTOR_HP, COL_MOTOR_AMPS, COL_MOTOR_VOLTAGE
        global COLS_PUMP_HEAD, COLS_PUMP_BHP, COLS_PUMP_EFF

        # Detectar columnas de id, min y max para bombas
        COL_PUMP_ID = pick_column(PUMP_CATALOG.columns, PUMP_ID_CANDIDATES, default=PUMP_CATALOG.columns[0])
        COL_PUMP_MIN_Q = pick_column(PUMP_CATALOG.columns, PUMP_MIN_Q_CANDIDATES, default=COL_PUMP_MIN_Q)
        COL_PUMP_MAX_Q = pick_column(PUMP_CATALOG.columns, PUMP_MAX_Q_CANDIDATES, default=COL_PUMP_MAX_Q)

        # Detectar columnas de motor
        COL_MOTOR_ID = pick_column(MOTOR_CATALOG.columns, MOTOR_ID_CANDIDATES, default=MOTOR_CATALOG.columns[0])
        COL_MOTOR_HP = pick_column(MOTOR_CATALOG.columns, MOTOR_HP_CANDIDATES, default=COL_MOTOR_HP)
        COL_MOTOR_AMPS = pick_column(MOTOR_CATALOG.columns, MOTOR_AMPS_CANDIDATES, default=COL_MOTOR_AMPS)
        COL_MOTOR_VOLTAGE = pick_column(MOTOR_CATALOG.columns, MOTOR_VOLTAGE_CANDIDATES, default=COL_MOTOR_VOLTAGE)

        # Detectar coeficientes de polinomio para bombas (hpoly0..hpoly10, npoly0..npoly9)
        hcols = [c for c in PUMP_CATALOG.columns if any(c.lower().startswith(pref) for pref in PUMP_HEAD_PREFIXES)]
        pcols = [c for c in PUMP_CATALOG.columns if any(c.lower().startswith(pref) for pref in PUMP_BHP_PREFIXES)]

        # Si no encontramos, intentar buscar 'hpoly'/'npoly' de forma más laxa
        if not hcols:
            hcols = [c for c in PUMP_CATALOG.columns if 'hpoly' in c.lower() or c.lower().startswith('h') and 'poly' in c.lower()]
        if not pcols:
            pcols = [c for c in PUMP_CATALOG.columns if 'npoly' in c.lower() or c.lower().startswith('n') and 'poly' in c.lower()]

        # Ordenamos por el número final si es posible
        def sort_poly_cols(cols, prefix_candidates):
            def keyfn(col):
                import re
                m = re.search(r"(\d+)$", col)
                if m:
                    return int(m.group(1))
                return 0
            return sorted(cols, key=keyfn)

        COLS_PUMP_HEAD = sort_poly_cols(hcols, PUMP_HEAD_PREFIXES) if hcols else COLS_PUMP_HEAD
        COLS_PUMP_BHP = sort_poly_cols(pcols, PUMP_BHP_PREFIXES) if pcols else COLS_PUMP_BHP

        # Intentar detectar coeficientes de eficiencia
        eff_cols = [c for c in PUMP_CATALOG.columns if any(ec.lower() in c.lower() for ec in PUMP_EFF_CANDIDATES)]
        if eff_cols:
            # Tomar hasta 3 columnas encontradas
            COLS_PUMP_EFF = eff_cols[:3]

        print(f"Catálogos reales cargados exitosamente desde '{EXCEL_FILE_NAME}'.")
        print(f"  - {len(PUMP_CATALOG)} bombas cargadas.")
        print(f"  - {len(MOTOR_CATALOG)} motores cargados.")

        # Guardar mapeo de columnas detectado para revisión
        try:
            mapping = {
                'pump_sheet': pump_sheet,
                'motor_sheet': motor_sheet,
                'pump_id_col': COL_PUMP_ID,
                'pump_min_q_col': COL_PUMP_MIN_Q,
                'pump_max_q_col': COL_PUMP_MAX_Q,
                'pump_head_coeffs': COLS_PUMP_HEAD,
                'pump_bhp_coeffs': COLS_PUMP_BHP,
                'pump_eff_coeffs': COLS_PUMP_EFF,
                'motor_id_col': COL_MOTOR_ID,
                'motor_hp_col': COL_MOTOR_HP,
                'motor_amps_col': COL_MOTOR_AMPS,
                'motor_voltage_col': COL_MOTOR_VOLTAGE
            }
            import os, json
            os.makedirs('data', exist_ok=True)
            with open(os.path.join('data', 'column_mapping.json'), 'w', encoding='utf-8') as fh:
                json.dump(mapping, fh, ensure_ascii=False, indent=2)
        except Exception:
            pass

    except FileNotFoundError:
        print(f"ERROR: No se encontró el archivo '{EXCEL_FILE_NAME}'. Asegúrese de que esté en la carpeta del proyecto.")
        raise
    except Exception as e:
        print(f"ERROR al leer '{EXCEL_FILE_NAME}': {e}")
        print("Asegúrese de que la librería 'openpyxl' esté instalada y que las hojas/columnas sean correctas.")
        raise

    # NOTE: Se ha removido la carga de catálogos dummy. El archivo Excel con coeficientes
    # debe estar presente y correctamente formado. Si la lectura falla, se levantará
    # una excepción para que el fallo sea evidente durante el desarrollo y despliegue.


def get_pump_catalog():
    """Devuelve el catálogo completo de bombas."""
    if PUMP_CATALOG is None:
        load_catalogs()
    return PUMP_CATALOG.to_dict(orient='records')

def get_motor_catalog():
    """Devuelve el catálogo completo de motores."""
    if MOTOR_CATALOG is None:
        load_catalogs()
    return MOTOR_CATALOG.to_dict(orient='records')


def get_column_mapping():
    """Devuelve el último mapeo de columnas detectado (cargando catálogos si es necesario)."""
    if PUMP_CATALOG is None or MOTOR_CATALOG is None:
        load_catalogs()

    return {
        'pump_sheet': None,
        'motor_sheet': None,
        'pump_id_col': COL_PUMP_ID,
        'pump_min_q_col': COL_PUMP_MIN_Q,
        'pump_max_q_col': COL_PUMP_MAX_Q,
        'pump_head_coeffs': COLS_PUMP_HEAD,
        'pump_bhp_coeffs': COLS_PUMP_BHP,
        'pump_eff_coeffs': COLS_PUMP_EFF,
        'motor_id_col': COL_MOTOR_ID,
        'motor_hp_col': COL_MOTOR_HP,
        'motor_amps_col': COL_MOTOR_AMPS,
        'motor_voltage_col': COL_MOTOR_VOLTAGE
    }

def get_pump_performance_curves(pump_id, freq_hz: float = 50.0, stages: int = 300, n_points: int = 300):
    """
    Calcula las curvas de rendimiento (TDH, BHP, Eff) para una bomba específica
    usando sus coeficientes polinómicos.
    """
    if PUMP_CATALOG is None:
        load_catalogs()
        
    try:
        # Usamos la variable de configuración para buscar por ID
        pump_data = PUMP_CATALOG[PUMP_CATALOG[COL_PUMP_ID] == str(pump_id)].iloc[0]
    except IndexError:
        print(f"ERROR: No se encontró la bomba con id '{pump_id}' (buscando en columna '{COL_PUMP_ID}').")
        return {"error": f"Bomba con id '{pump_id}' no encontrada."}
    except KeyError:
        print(f"ERROR: La columna ID de bomba '{COL_PUMP_ID}' no existe en el Excel.")
        return {"error": f"Configuración incorrecta: Columna '{COL_PUMP_ID}' no encontrada."}
        
    try:
        # Usamos las variables de configuración para obtener los valores
        min_q = float(pump_data.get(COL_PUMP_MIN_Q) or 0)
        max_q = float(pump_data.get(COL_PUMP_MAX_Q) or 3000)
        
        # Leemos las LISTAS de coeficientes
        h_coeffs = [float(pump_data.get(col) or 0) for col in COLS_PUMP_HEAD]
        p_coeffs = [float(pump_data.get(col) or 0) for col in COLS_PUMP_BHP]
        e_coeffs = [float(pump_data.get(col) or 0) for col in COLS_PUMP_EFF] # A, B, C

    except (ValueError, TypeError) as e:
        print(f"ERROR: Alguna columna de caudal o coeficiente no es numérica para la bomba {pump_id}. Error: {e}")
        return {"error": "Datos no numéricos en el catálogo para esta bomba."}
    except KeyError as e:
        print(f"ERROR: No se encontró la columna: {e}. Revisa la configuración de listas (COLS_...).")
        return {"error": f"Configuración incorrecta: Columna {e} no encontrada."}
    
    # --- LÓGICA DE CÁLCULO REAL (Polinomios de alto grado) ---
    
    # Detectar RPM nominal de catálogo una sola vez
    rpm_cat = None
    try:
        for key in ('rpm', 'RPM', 'Rpm', 'rpm_nom', 'rpm_cat'):
            if key in pump_data.keys():
                rpm_cat = pump_data.get(key)
                break
        rpm_cat = float(rpm_cat) if rpm_cat is not None else None
    except Exception:
        rpm_cat = None

    # RPM operativo (Hz * 60)
    rpm_oper = float(freq_hz) * 60.0 if freq_hz is not None else None
    
    # Factor de velocidad para caudal (Q es proporcional a la velocidad)
    if rpm_oper and rpm_cat and rpm_cat > 0:
        speed_factor_q = rpm_oper / float(rpm_cat)
    else:
        # Si no hay información de rpm, asumimos factor 1
        speed_factor_q = 1.0
    
    # Devolvemos las curvas escaladas (compatibilidad hacia atrás) y
    # también las versiones "raw" (polinomio sin escalar) para trazabilidad.
    curves = {"head": [], "bhp": [], "efficiency": [], "head_raw": [], "bhp_raw": [], "efficiency_raw": []}
    
    # Definimos las funciones polinómicas
    def poly_head(q):
        # H = C0 + C1*Q + C2*Q^2 + ... + C10*Q^10
        # Aplicar polinomio base
        base_h = calculate_polynomial(h_coeffs, q)

        # Factor por etapas y por velocidad^2
        stage_factor = float(stages) if stages is not None else 1.0
        if rpm_oper and rpm_cat and rpm_cat > 0:
            speed_factor = (rpm_oper / float(rpm_cat)) ** 2
        else:
            # Si no hay información de rpm, asumimos factor 1 y avisamos
            speed_factor = 1.0

        return base_h * stage_factor * speed_factor
    
    def poly_bhp(q):
        # P = C0 + C1*Q + C2*Q^2 + ... + C9*Q^9
        base_p = calculate_polynomial(p_coeffs, q)

        stage_factor = float(stages) if stages is not None else 1.0
        if rpm_oper and rpm_cat and rpm_cat > 0:
            speed_factor_p = (rpm_oper / float(rpm_cat)) ** 3
        else:
            speed_factor_p = 1.0

        # Aplicar escalado por etapas y afinidad (velocidad^3)
        scaled_p = base_p * stage_factor * speed_factor_p

        # Conversión final a HP: según indicación, multiplicar por 1.34 y dividir por 1000
        # (se mantiene 'base_p' como raw para trazabilidad)
        try:
            bhp_in_hp = float(scaled_p) * 1.34 / 1000.0
        except Exception:
            bhp_in_hp = scaled_p

        return bhp_in_hp

    def poly_eff(q):
        # No hay coeficientes para eficiencia: calcularla por definición:
        # Eficiencia = (Q * TDH) / (6570 * PBHP)
        # Aquí usamos TDH y PBHP escalados (las funciones poly_head/poly_bhp
        # devuelven ya los valores escalados y convertidos a HP respectivamente).
        try:
            tdhi = poly_head(q)
            bhpi = poly_bhp(q)  # this returns HP (after conversion)
            if bhpi and float(bhpi) != 0:
                return (q * tdhi) / (6570.0 * float(bhpi))
            return 0.0
        except Exception:
            return 0.0

    # Generar curvas desde Q=0 hasta donde TDH sea 0
    # Primero encontramos el punto donde TDH = 0 usando el caudal BASE (sin escalar)
    q_max_tdh_zero_base = max_q  # valor por defecto
    
    # Buscar el caudal BASE donde TDH se hace 0 usando búsqueda iterativa
    # Empezamos desde Q=0 y avanzamos hasta encontrar TDH <= 0
    step_search = max_q / 1000.0  # Pasos pequeños para búsqueda precisa
    for q_test_base in np.arange(0, max_q * 2, step_search):
        head_test = poly_head(q_test_base)
        if head_test <= 0:
            q_max_tdh_zero_base = q_test_base
            break
    
    # Generar curvas desde 0 hasta q_max_tdh_zero con la cantidad de puntos especificada
    # n_points ya viene como parámetro (por defecto 300)
    step = q_max_tdh_zero_base / float(n_points - 1) if n_points > 1 else 0
    if step == 0:
        step = 1.0  # Evitar división por cero

    for i in range(n_points):
        q_base = step * i  # Caudal base (sin escalar) - empezar desde 0
        q_scaled = q_base * speed_factor_q  # Caudal escalado según frecuencia

        # Calculamos los valores reales usando las funciones
        # Calculamos valores raw (polinomio) y escalados
        # (las funciones poly_head/poly_bhp ya devuelven valores escalados,
        #  así que para obtener el raw usamos directamente el polinomio)
        base_h = calculate_polynomial(h_coeffs, q_base)
        base_p = calculate_polynomial(p_coeffs, q_base)

        # Valores escalados (las funciones aplican etapas/factor según parámetros)
        head_val = poly_head(q_base)
        bhp_val = poly_bhp(q_base)  # returned in HP

        # Si el TDH es negativo, detener la generación de puntos
        if head_val < 0:
            break

        # Calculamos eficiencia usando la fórmula solicitada
        # efficiency (escalada) usando TDH escalada y PBHP en HP
        try:
            eff_val = (q_scaled * head_val) / (6570.0 * float(bhp_val)) if bhp_val and float(bhp_val) != 0 else 0.0
        except Exception:
            eff_val = 0.0

        # efficiency_raw: usar polinomios raw convertidos a HP (sin etapas/afinidad)
        try:
            base_p_hp = float(base_p) * 1.34 / 1000.0 if base_p is not None else 0.0
            eff_raw_val = (q_base * base_h) / (6570.0 * base_p_hp) if base_p_hp != 0 else 0.0
        except Exception:
            eff_raw_val = 0.0

        # Agregamos los puntos a las curvas usando Q ESCALADO para el eje X
        # (manteniendo la clave 'valor' para compatibilidad)
        curves["head"].append({"caudal": q_scaled, "valor": head_val})
        curves["bhp"].append({"caudal": q_scaled, "valor": bhp_val})
        curves["efficiency"].append({"caudal": q_scaled, "valor": eff_val})

        # Y guardamos también las versiones raw para trazabilidad
        curves["head_raw"].append({"caudal": q_base, "valor": base_h})
        curves["bhp_raw"].append({"caudal": q_base, "valor": base_p})
        curves["efficiency_raw"].append({"caudal": q_base, "valor": eff_raw_val})

    # Agregar información del rango de operación recomendado (escalado según frecuencia)
    curves["operating_range"] = {
        "min_q": min_q * speed_factor_q,
        "max_q": max_q * speed_factor_q
    }

    return curves

def get_motor_performance_curves(motor_id):
    """
    Calcula las curvas de rendimiento (Amps, Eff, PF, Temp) para un motor.
    """
    if MOTOR_CATALOG is None:
        load_catalogs()
        
    try:
        # Usamos la variable de configuración
        motor_data = MOTOR_CATALOG[MOTOR_CATALOG[COL_MOTOR_ID] == str(motor_id)].iloc[0]
    except IndexError:
        print(f"ERROR: No se encontró el motor con id '{motor_id}' (buscando en columna '{COL_MOTOR_ID}').")
        return {"error": f"Motor con id '{motor_id}' no encontrado."}
    except KeyError:
        print(f"ERROR: La columna ID de motor '{COL_MOTOR_ID}' no existe en el Excel.")
        return {"error": f"Configuración incorrecta: Columna '{COL_MOTOR_ID}' no encontrada."}
        
    try:
        # Usamos las variables de configuración
        max_hp = float(motor_data.get(COL_MOTOR_HP) or 100) 
        amperaje_max = float(motor_data.get(COL_MOTOR_AMPS) or 30)
        
    except (ValueError, TypeError):
        print(f"ERROR: Columnas '{COL_MOTOR_HP}' o '{COL_MOTOR_AMPS}' no son numéricas para el motor {motor_id}.")
        return {"error": "Datos de potencia no numéricos en el catálogo."}
    except KeyError as e:
        print(f"ERROR: No se encontró la columna de motor: {e}. Revisa la configuración.")
        return {"error": f"Configuración incorrecta: Columna {e} no encontrada."}

    # --- Lógica de Ejemplo (AQUÍ IRÁN LOS POLINOMIOS DEL MOTOR) ---
    # (Aún necesitamos los coeficientes del motor para implementar esto)
    curves = {"amperaje": [], "efficiency": [], "power_factor": [], "temperature": []}
    
    for load_percent in range(0, 111, 10): # 0% a 110% de carga
        load_hp = max_hp * (load_percent / 100.0)
        curves["amperaje"].append({"carga_hp": load_hp, "valor": amperaje_max * (load_percent / 100.0)})
        curves["efficiency"].append({"carga_hp": load_hp, "valor": 90 - 0.01 * (load_percent - 90)**2}) 
        curves["power_factor"].append({"carga_hp": load_hp, "valor": 0.85 + (load_percent / 1000.0)})
        curves["temperature"].append({"carga_hp": load_hp, "valor": 100 + load_percent * 1.5})
        
    return curves
