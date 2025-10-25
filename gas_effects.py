# --- gas_effects.py ---
# Módulo de Cálculo de Efectos de Gas
# -----------------------------------

def get_gas_corrections(well_data):
    """
    Modela y corrige los cálculos por presencia de gas libre en la
    entrada de la bomba (intake).
    
    Args:
        well_data (dict): Datos del pozo, incluyendo GOR, presión de burbuja, etc.
    
    Returns:
        dict: Un diccionario con los factores de corrección o advertencias.
    """
    print("Calculando efectos de gas...")
    
    # --- Lógica de Ejemplo (Debe ser reemplazada por la ingeniería real) ---
    # Aquí iría la lógica para:
    # 1. Calcular el gas libre en la entrada de la bomba.
    # 2. Determinar si se necesita un separador de gas.
    # 3. Calcular el impacto en el rendimiento de la bomba (corrección de head/caudal).
    
    gor = well_data.get('gor', 100)
    presion_intake = well_data.get('presion_intake_estimada', 500)
    presion_burbuja = well_data.get('presion_burbuja', 600)
    
    if presion_intake < presion_burbuja:
        gas_libre_estimado = (gor * (presion_burbuja / presion_intake)) # Simplificación extrema
        
        if gas_libre_estimado > 100: # Asumiendo un 10% de gas libre
             return {
                 "advertencia": "Alto volumen de gas libre detectado.",
                 "factor_correccion_head": 0.95, # Reducción de head del 5%
                 "gas_libre_percent": 10
             }
    
    return {
        "advertencia": "Gas disuelto. No se esperan efectos significativos.",
        "factor_correccion_head": 1.0,
        "gas_libre_percent": 0
    }

