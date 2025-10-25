# --- tubing_catalog.py ---
# Catálogo de Tuberías de Producción Estándar
# -------------------------------------------
# Datos según API 5CT y especificaciones comunes de la industria

TUBING_CATALOG = [
    {
        "nombre": 'Tbg 2-3/8"',
        "od_inch": 2.375,
        "od_mm": 60.3,
        "id_mm": 52.5,  # Típico para peso 4.6 lb/ft
        "peso_lb_ft": 4.6,
        "descripcion": "2-3/8 in OD - ID 52.5 mm"
    },
    {
        "nombre": 'Tbg 2-7/8"',
        "od_inch": 2.875,
        "od_mm": 73.0,
        "id_mm": 62.0,  # Típico para peso 6.5 lb/ft
        "peso_lb_ft": 6.5,
        "descripcion": "2-7/8 in OD - ID 62.0 mm"
    },
    {
        "nombre": 'Tbg 3-1/2"',
        "od_inch": 3.5,
        "od_mm": 88.9,
        "id_mm": 76.2,  # Típico para peso 9.3 lb/ft
        "peso_lb_ft": 9.3,
        "descripcion": "3-1/2 in OD - ID 76.2 mm"
    },
    {
        "nombre": 'Tbg 4"',
        "od_inch": 4.0,
        "od_mm": 101.6,
        "id_mm": 88.9,  # Típico para peso 11.0 lb/ft
        "peso_lb_ft": 11.0,
        "descripcion": "4 in OD - ID 88.9 mm"
    },
    {
        "nombre": 'Tbg 4-1/2"',
        "od_inch": 4.5,
        "od_mm": 114.3,
        "id_mm": 101.6,  # Típico para peso 12.75 lb/ft
        "peso_lb_ft": 12.75,
        "descripcion": "4-1/2 in OD - ID 101.6 mm"
    }
]

# Rugosidades típicas para diferentes materiales/condiciones (en mm)
TUBING_ROUGHNESS = {
    "acero_nuevo": 0.046,           # Acero comercial nuevo
    "acero_usado": 0.15,            # Acero con uso moderado
    "acero_corroido": 0.5,          # Acero con corrosión
    "acero_incrustado": 1.5,        # Acero con incrustaciones
    "revestido_interno": 0.01       # Tubing con revestimiento interno liso
}


def get_tubing_catalog():
    """
    Devuelve el catálogo completo de tuberías.
    
    Returns:
        list: Lista de diccionarios con especificaciones de tuberías
    """
    return TUBING_CATALOG


def get_tubing_by_name(nombre):
    """
    Busca una tubería específica por su nombre.
    
    Args:
        nombre (str): Nombre de la tubería (ej: 'Tbg 2-7/8"')
    
    Returns:
        dict: Especificaciones de la tubería, o None si no se encuentra
    """
    for tubing in TUBING_CATALOG:
        if tubing["nombre"] == nombre:
            return tubing
    return None


def get_roughness_options():
    """
    Devuelve las opciones de rugosidad disponibles.
    
    Returns:
        dict: Diccionario con opciones de rugosidad en mm
    """
    return TUBING_ROUGHNESS


def calculate_area(id_mm):
    """
    Calcula el área de flujo en m².
    
    Args:
        id_mm (float): Diámetro interno en mm
    
    Returns:
        float: Área en m²
    """
    import math
    radius_m = (id_mm / 1000.0) / 2.0
    area_m2 = math.pi * (radius_m ** 2)
    return area_m2


def calculate_velocity(caudal_m3d, id_mm):
    """
    Calcula la velocidad del fluido en la tubería.
    
    Args:
        caudal_m3d (float): Caudal en m³/día
        id_mm (float): Diámetro interno en mm
    
    Returns:
        float: Velocidad en m/s
    """
    area_m2 = calculate_area(id_mm)
    caudal_m3s = caudal_m3d / 86400.0  # Convertir de m³/día a m³/s
    velocity_ms = caudal_m3s / area_m2 if area_m2 > 0 else 0
    return velocity_ms
