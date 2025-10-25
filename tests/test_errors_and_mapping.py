import equipment_selection


def test_missing_pump_returns_error():
    # Cargamos catálogos reales y pedimos una bomba inexistente
    equipment_selection.load_catalogs()
    res = equipment_selection.get_pump_performance_curves('NON_EXISTENT_PUMP')
    assert isinstance(res, dict)
    assert 'error' in res


def test_get_column_mapping_present():
    # Ensure catalogs loaded
    equipment_selection.load_catalogs()
    mapping = equipment_selection.get_column_mapping()
    assert isinstance(mapping, dict)
    # Check some expected keys
    assert 'pump_head_coeffs' in mapping
    assert 'pump_bhp_coeffs' in mapping
