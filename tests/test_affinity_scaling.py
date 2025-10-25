import math
import pandas as pd
import equipment_selection


def test_affinity_scaling_simple_case():
    # Guardar estado antiguo
    old_catalog = equipment_selection.PUMP_CATALOG
    old_cols_head = getattr(equipment_selection, 'COLS_PUMP_HEAD', None)
    old_cols_bhp = getattr(equipment_selection, 'COLS_PUMP_BHP', None)
    old_col_id = equipment_selection.COL_PUMP_ID

    try:
        # Crear catálogo sintético con coeficientes simples
        equipment_selection.COL_PUMP_ID = 'id'
        df = pd.DataFrame([
            {
                'id': 'SYN1',
                equipment_selection.COL_PUMP_MIN_Q: 10,
                equipment_selection.COL_PUMP_MAX_Q: 10,
                'rpm': 1000,
                'hpoly0': 2.0,  # H_raw = 2.0
                'hpoly1': 0.0,
                'npoly0': 5.0,  # P_raw = 5.0
                'npoly1': 0.0,
            }
        ])

        equipment_selection.PUMP_CATALOG = df
        equipment_selection.COLS_PUMP_HEAD = ['hpoly0', 'hpoly1']
        equipment_selection.COLS_PUMP_BHP = ['npoly0', 'npoly1']

        # Llamamos con freq=50 Hz y stages=2
        curves = equipment_selection.get_pump_performance_curves('SYN1', freq_hz=50.0, stages=2)

        # Verificamos puntos
        q0 = curves['head_raw'][0]['caudal']
        raw_h = curves['head_raw'][0]['valor']
        scaled_h = curves['head'][0]['valor']

        raw_p = curves['bhp_raw'][0]['valor']
        scaled_p = curves['bhp'][0]['valor']

        # RPM operativa y cat
        rpm_oper = 50.0 * 60.0
        rpm_cat = 1000.0

        expected_h_scale = 2.0 * 2 * ((rpm_oper / rpm_cat) ** 2)
        expected_p_scale = 5.0 * 2 * ((rpm_oper / rpm_cat) ** 3)
        # The code now converts scaled power to HP by *1.34/1000
        expected_p_scale_hp = expected_p_scale * 1.34 / 1000.0

        assert math.isclose(raw_h, 2.0, rel_tol=1e-9)
        assert math.isclose(raw_p, 5.0, rel_tol=1e-9)
        assert math.isclose(scaled_h, expected_h_scale, rel_tol=1e-9)
        # scaled_p is returned in HP after the conversion
        assert math.isclose(scaled_p, expected_p_scale_hp, rel_tol=1e-9)

    finally:
        # Restaurar estado
        equipment_selection.PUMP_CATALOG = old_catalog
        if old_cols_head is not None:
            equipment_selection.COLS_PUMP_HEAD = old_cols_head
        if old_cols_bhp is not None:
            equipment_selection.COLS_PUMP_BHP = old_cols_bhp
        equipment_selection.COL_PUMP_ID = old_col_id
