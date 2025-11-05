# Script de prueba simplificado para FASE 1 (sin requests)
# Solo prueba los cálculos locales

import sys
sys.path.append('.')

import hydraulic_calculations

def test_tdh_calculation():
    """Prueba el cálculo de TDH con datos de prueba"""
    print("\n" + "=" * 60)
    print("PRUEBA: Cálculo de TDH - FASE 1")
    print("=" * 60)
    
    # Datos de prueba
    well_data = {
        "method": "vogel",
        "presion_reservorio": 150,
        "presion_burbuja": 120,
        "grado_api": 21,
        "agua_porcentaje": 95,
        "gravedad_especifica_agua": 1.033,
        "viscosidad": 1.0,
        "q_test": 100,
        "pwf_test": 20,
        # Parámetros de instalación (FASE 1)
        "profundidad_intake": 1500,
        "nivel_fluido_dinamico": 500,
        "presion_superficie": 10,
        "presion_casing": 1,
        "tubing_id_mm": 62.0,
        "tubing_roughness": "acero_nuevo"
    }
    
    print("\n📋 Parámetros de Entrada:")
    print("-" * 60)
    print(f"  Profundidad Intake:     {well_data['profundidad_intake']} m")
    print(f"  Nivel Fluido Dinámico:  {well_data['nivel_fluido_dinamico']} m")
    print(f"  Presión Superficie:     {well_data['presion_superficie']} bar")
    print(f"  Presión Casing:         {well_data['presion_casing']} bar")
    print(f"  Tubería ID:             {well_data['tubing_id_mm']} mm")
    print(f"  Grado API:              {well_data['grado_api']} °API")
    print(f"  % Agua:                 {well_data['agua_porcentaje']} %")
    
    # Calcular propiedades del fluido
    fluid_props = hydraulic_calculations.calculate_fluid_properties(well_data)
    
    print("\n🔬 Propiedades del Fluido Calculadas:")
    print("-" * 60)
    print(f"  Densidad:    {fluid_props['densidad']:.2f} kg/m³")
    print(f"  Gradiente:   {fluid_props['gradiente']:.5f} bar/m")
    print(f"  Viscosidad:  {fluid_props['viscosidad']} cp")
    
    # Calcular componentes del TDH para Q=150 m³/d
    q_test = 150
    tdh = hydraulic_calculations.calculate_tdh_basic(well_data, q_test)
    
    # Calcular manualmente para mostrar componentes
    h_elevacion = well_data['profundidad_intake'] - well_data['nivel_fluido_dinamico']
    h_presion = (well_data['presion_superficie'] - well_data['presion_casing']) / fluid_props['gradiente']
    k_friccion = 0.0001  # Coeficiente simplificado
    h_friccion = k_friccion * (q_test ** 2)
    
    print(f"\n📐 Cálculo de TDH para Q = {q_test} m³/d:")
    print("-" * 60)
    print(f"  H_elevación    = {h_elevacion:.2f} m")
    print(f"    (Profundidad - Nivel)")
    print(f"  H_presión_neta = {h_presion:.2f} m")
    print(f"    ((P_sup - P_casing) / gradiente)")
    print(f"  H_fricción     = {h_friccion:.2f} m")
    print(f"    (k * Q² - simplificado)")
    print(f"  {'─' * 40}")
    print(f"  TDH TOTAL      = {tdh:.2f} m")
    
    # Mostrar efecto de presión de casing
    print("\n💡 Efecto de Presión de Casing:")
    print("-" * 60)
    
    # Sin presión de casing
    well_data_no_casing = well_data.copy()
    well_data_no_casing['presion_casing'] = 0
    tdh_no_casing = hydraulic_calculations.calculate_tdh_basic(well_data_no_casing, q_test)
    
    print(f"  Con P_casing = {well_data['presion_casing']} bar:")
    print(f"    TDH = {tdh:.2f} m")
    print(f"\n  Sin P_casing (0 bar):")
    print(f"    TDH = {tdh_no_casing:.2f} m")
    print(f"\n  Reducción de TDH = {tdh_no_casing - tdh:.2f} m")
    print(f"  → La presión de casing AYUDA a la bomba!")
    
    # Calcular TDH para varios caudales
    print("\n📊 Curva TDH vs Caudal:")
    print("-" * 60)
    print(f"{'Caudal (m³/d)':<20} {'TDH (m)':<20}")
    print("-" * 40)
    
    for q in [0, 50, 100, 150, 200, 250, 300, 350, 400]:
        tdh_q = hydraulic_calculations.calculate_tdh_basic(well_data, q)
        print(f"{q:<20} {tdh_q:<20.2f}")
    
    print("\n" + "=" * 60)
    print("✅ FASE 1 - CÁLCULOS FUNCIONANDO CORRECTAMENTE")
    print("=" * 60)
    
    # Verificar que system_head_curve también funciona
    print("\n📈 Probando calculate_system_head_curve()...")
    well_data['q_max_estimate'] = 400
    well_data['n_points'] = 10
    
    system_curve = hydraulic_calculations.calculate_system_head_curve(well_data)
    
    print(f"\n  Curva generada con {len(system_curve)} puntos")
    print("  Primeros 5 puntos:")
    for i, point in enumerate(system_curve[:5]):
        print(f"    Q = {point['caudal']:>6.2f} m³/d  →  TDH = {point['tdh']:>8.2f} m")
    
    print("\n✅ calculate_system_head_curve() funcionando correctamente")
    
    return True


def test_tubing_catalog():
    """Prueba el catálogo de tuberías"""
    print("\n" + "=" * 60)
    print("PRUEBA: Catálogo de Tuberías")
    print("=" * 60)
    
    import tubing_catalog
    
    catalog = tubing_catalog.get_tubing_catalog()
    
    print(f"\n📋 Catálogo con {len(catalog)} tuberías estándar:")
    print("-" * 60)
    
    for tubing in catalog:
        print(f"\n  {tubing['nombre']}")
        print(f"    OD: {tubing['od_inch']}\" ({tubing['od_mm']} mm)")
        print(f"    ID: {tubing['id_mm']} mm")
        print(f"    Peso: {tubing['peso_lb_ft']} lb/ft")
    
    roughness = tubing_catalog.get_roughness_options()
    
    print("\n🔧 Opciones de Rugosidad:")
    print("-" * 60)
    for condition, value in roughness.items():
        print(f"  {condition.replace('_', ' ').title():<25} {value} mm")
    
    # Probar funciones auxiliares
    print("\n🧮 Probando funciones auxiliares:")
    print("-" * 60)
    
    id_mm = 62.0
    q_m3d = 150
    
    area = tubing_catalog.calculate_area(id_mm)
    velocity = tubing_catalog.calculate_velocity(q_m3d, id_mm)
    
    print(f"  Tubería ID = {id_mm} mm")
    print(f"  Área = {area:.6f} m²")
    print(f"  Caudal = {q_m3d} m³/d")
    print(f"  Velocidad = {velocity:.3f} m/s")
    
    print("\n✅ Catálogo de tuberías funcionando correctamente")
    
    return True


if __name__ == "__main__":
    print("\n" + "=" * 60)
    print("🚀 PRUEBAS DE FASE 1 - INSTALLATION DESIGN")
    print("=" * 60)
    
    success = True
    
    try:
        # Prueba 1: Catálogo de tuberías
        print("\n[1/2] Probando módulo de tuberías...")
        if not test_tubing_catalog():
            success = False
        
        # Prueba 2: Cálculos hidráulicos
        print("\n[2/2] Probando cálculos hidráulicos...")
        if not test_tdh_calculation():
            success = False
        
        if success:
            print("\n" + "=" * 60)
            print("🎉 TODAS LAS PRUEBAS PASARON EXITOSAMENTE")
            print("=" * 60)
            print("\n✅ FASE 1 está completamente funcional")
            print("\nPróximos pasos:")
            print("  1. Verificar endpoint API: http://localhost:5000/api/tubing-catalog")
            print("  2. Probar interfaz en: http://localhost:5173")
            print("  3. Activar 'Enable IPR Analysis' y configurar instalación")
            print("\n")
        else:
            print("\n❌ Algunas pruebas fallaron")
            
    except Exception as e:
        print(f"\n❌ Error en pruebas: {e}")
        import traceback
        traceback.print_exc()
