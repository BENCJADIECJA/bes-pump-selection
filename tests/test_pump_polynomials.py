import equipment_selection


def test_pump_polynomial_values_real():
    # Cargamos los catálogos reales desde el Excel incluido en el repo
    equipment_selection.load_catalogs()
    catalogs = equipment_selection.get_pump_catalog()
    assert len(catalogs) >= 1

    pump_id = catalogs[0].get(equipment_selection.COL_PUMP_ID)
    curves = equipment_selection.get_pump_performance_curves(pump_id)
    assert 'head' in curves and 'bhp' in curves and 'efficiency' in curves

    # Deben generarse 21 puntos
    assert len(curves['head']) == 21
    assert len(curves['bhp']) == 21
    assert len(curves['efficiency']) == 21

    # Verificamos que los valores devueltos sean numéricos
    assert isinstance(curves['head'][0]['valor'], (int, float))
    assert isinstance(curves['bhp'][0]['valor'], (int, float))
    assert isinstance(curves['efficiency'][0]['valor'], (int, float))
