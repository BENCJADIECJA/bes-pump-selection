"""
Script de prueba para verificar la curva de demanda de presión.
Verifica que la curva sea creciente (a mayor Q, mayor Head requerido).
"""

import well_performance
import hydraulic_calculations

# Datos de prueba
well_data = {
    'presion_reservorio': 150,  # bar
    'grado_api': 35,
    'agua_porcentaje': 30,
    'presion_burbujas': 80,  # bar
    'profundidad': 2000,  # m
    'profundidad_intake': 1500,  # m
    'nivel_fluido_dinamico': 500,  # m desde superficie
    'presion_superficie': 10,  # bar
    'presion_casing': 1,  # bar
    'ipr_method': 'vogel',
    'q_max_estimate': 400,
    'n_points': 20
}

print("=" * 80)
print("PRUEBA: Curva de Demanda de Presión")
print("=" * 80)

# 1. Calcular IPR
print("\n1. Calculando IPR...")
ipr_result = well_performance.calculate_ipr(well_data)
print(f"   Q_max: {ipr_result['q_max']:.2f} m³/d")
print(f"   Método: {ipr_result['method']}")

# 2. Calcular curva de demanda
print("\n2. Calculando curva de demanda de presión...")
demand_curve = hydraulic_calculations.calculate_pressure_demand_curve(well_data, ipr_result)

print("\n3. Verificando que la curva sea creciente:")
print("-" * 80)
print(f"{'Q (m³/d)':<12} {'Head (m)':<12} {'P_intake (bar)':<16} {'Fricción (bar)':<16} {'CRECE?':<10}")
print("-" * 80)

prev_head = None
for i, point in enumerate(demand_curve['curve']):
    if i % 5 == 0:  # Mostrar cada 5 puntos
        q = point['caudal']
        head = point['head_requerido']
        p_intake = point['p_intake']
        friction = point['perdidas_friccion']
        
        crece = ""
        if prev_head is not None:
            if head > prev_head:
                crece = "✓ SI"
            else:
                crece = "✗ NO"
        
        print(f"{q:<12.2f} {head:<12.2f} {p_intake:<16.2f} {friction:<16.4f} {crece:<10}")
        prev_head = head

print("-" * 80)

# 4. Verificar componentes
print("\n4. Componentes del sistema:")
print(f"   - Profundidad intake: {demand_curve['components']['profundidad_intake']} m")
print(f"   - Nivel de fluido: {demand_curve['components']['nivel_fluido']} m")
print(f"   - Presión superficie: {demand_curve['components']['p_surface_target']} bar")
print(f"   - Presión casing: {demand_curve['components']['p_casing']} bar")
print(f"   - Gradiente fluido: {demand_curve['components']['gradiente']:.5f} bar/m")

# 5. Análisis físico
print("\n5. Análisis físico:")
first_point = demand_curve['curve'][0]
last_point = demand_curve['curve'][-1]

print(f"\n   En Q = 0:")
print(f"   - Head requerido: {first_point['head_requerido']:.2f} m")
print(f"   - P_intake: {first_point['p_intake']:.2f} bar (máxima)")
print(f"   - Fricción: {first_point['perdidas_friccion']:.4f} bar (mínima)")

print(f"\n   En Q = {last_point['caudal']:.2f} m³/d:")
print(f"   - Head requerido: {last_point['head_requerido']:.2f} m")
print(f"   - P_intake: {last_point['p_intake']:.2f} bar (mínima)")
print(f"   - Fricción: {last_point['perdidas_friccion']:.4f} bar (máxima)")

delta_head = last_point['head_requerido'] - first_point['head_requerido']
print(f"\n   Δ Head (Q_max - Q_0): {delta_head:.2f} m")

if delta_head > 0:
    print("   ✓ La curva es CRECIENTE (correcto)")
else:
    print("   ✗ ERROR: La curva debería ser creciente")

print("\n" + "=" * 80)
print("CONCLUSIÓN:")
print("La curva de demanda muestra el HEAD (metros) que la bomba debe generar")
print("para diferentes caudales. Esta curva se intercepta con la curva de la bomba")
print("para encontrar el punto de operación del sistema.")
print("=" * 80)
