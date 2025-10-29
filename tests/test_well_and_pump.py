import pytest

from well_performance import calculate_ipr
import equipment_selection


def test_calculate_ipr_basic():
    well_data = {'presion_reservorio': 2000, 'pi': 1.0}
    curve = calculate_ipr(well_data)
    assert isinstance(curve, dict)
    assert 'curve' in curve
    points = curve['curve']
    assert len(points) >= 1
    # El primer punto con q=0 debe tener pwf == presion_reservorio
    assert points[0]['pwf'] == 2000


def test_get_pump_performance_curves_real():
    # Cargamos los catálogos reales desde el Excel incluido en el repo
    equipment_selection.load_catalogs()
    catalogs = equipment_selection.get_pump_catalog()
    assert isinstance(catalogs, list)
    assert len(catalogs) >= 1

    pump_id = catalogs[0].get(equipment_selection.COL_PUMP_ID, catalogs[0].get('Tipo'))
    curves = equipment_selection.get_pump_performance_curves(pump_id)
    assert 'head' in curves and 'bhp' in curves and 'efficiency' in curves
    # Deben generarse 21 puntos según la especificación
    assert len(curves['head']) == 21
