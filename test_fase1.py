# Script de prueba para FASE 1
# Verifica que el endpoint de tuberías funciona correctamente

import requests
import json

def test_tubing_catalog():
    """Prueba el endpoint del catálogo de tuberías"""
    print("=" * 60)
    print("PRUEBA: Catálogo de Tuberías API")
    print("=" * 60)
    
    try:
        response = requests.get('http://localhost:5000/api/tubing-catalog')
        
        if response.status_code == 200:
            data = response.json()
            
            print("\n✅ Endpoint funcionando correctamente")
            print(f"Status Code: {response.status_code}")
            print(f"Success: {data.get('success')}")
            
            print("\n📋 Catálogo de Tuberías:")
            print("-" * 60)
            
            for tubing in data.get('catalog', []):
                print(f"\n  {tubing['nombre']}")
                print(f"    OD: {tubing['od_inch']}\" ({tubing['od_mm']} mm)")
                print(f"    ID: {tubing['id_mm']} mm")
                print(f"    Peso: {tubing['peso_lb_ft']} lb/ft")
                print(f"    Descripción: {tubing['descripcion']}")
            
            print("\n🔧 Opciones de Rugosidad:")
            print("-" * 60)
            
            for condition, roughness in data.get('roughness_options', {}).items():
                condition_name = condition.replace('_', ' ').title()
                print(f"  {condition_name}: {roughness} mm")
            
            print("\n" + "=" * 60)
            print("✅ PRUEBA EXITOSA - FASE 1 funcionando correctamente")
            print("=" * 60)
            
        else:
            print(f"\n❌ Error: Status Code {response.status_code}")
            print(response.text)
            
    except requests.exceptions.ConnectionError:
        print("\n❌ Error: No se puede conectar al servidor")
        print("Asegúrate de que el backend esté corriendo:")
        print("  python app.py")
    except Exception as e:
        print(f"\n❌ Error inesperado: {e}")


def test_tdh_calculation():
    """Prueba el cálculo de TDH con datos de prueba"""
    print("\n" + "=" * 60)
    print("PRUEBA: Cálculo de TDH")
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
    
    print("\n📋 Parámetros de prueba:")
    print("-" * 60)
    print(f"  Profundidad Intake: {well_data['profundidad_intake']} m")
    print(f"  Nivel Fluido: {well_data['nivel_fluido_dinamico']} m")
    print(f"  Presión Superficie: {well_data['presion_superficie']} bar")
    print(f"  Presión Casing: {well_data['presion_casing']} bar")
    print(f"  Tubería ID: {well_data['tubing_id_mm']} mm")
    
    # Importar módulo de cálculos
    try:
        import sys
        sys.path.append('.')
        import hydraulic_calculations
        
        # Calcular propiedades del fluido
        fluid_props = hydraulic_calculations.calculate_fluid_properties(well_data)
        
        print("\n🔬 Propiedades del Fluido:")
        print("-" * 60)
        print(f"  Densidad: {fluid_props['densidad']:.2f} kg/m³")
        print(f"  Gradiente: {fluid_props['gradiente']:.5f} bar/m")
        print(f"  Viscosidad: {fluid_props['viscosidad']} cp")
        
        # Calcular TDH para varios caudales
        print("\n📊 TDH vs Caudal:")
        print("-" * 60)
        print(f"{'Caudal (m³/d)':<15} {'TDH (m)':<15}")
        print("-" * 30)
        
        for q in [0, 50, 100, 150, 200, 250, 300]:
            tdh = hydraulic_calculations.calculate_tdh_basic(well_data, q)
            print(f"{q:<15} {tdh:<15.2f}")
        
        print("\n" + "=" * 60)
        print("✅ CÁLCULO DE TDH EXITOSO")
        print("=" * 60)
        
    except ImportError as e:
        print(f"\n⚠️  No se pudo importar módulo: {e}")
        print("Ejecuta este script desde la raíz del proyecto")
    except Exception as e:
        print(f"\n❌ Error en cálculo: {e}")


if __name__ == "__main__":
    print("\n🚀 Iniciando pruebas de FASE 1...\n")
    
    # Prueba 1: Endpoint API
    test_tubing_catalog()
    
    # Prueba 2: Cálculo de TDH
    test_tdh_calculation()
    
    print("\n✅ Todas las pruebas completadas\n")
