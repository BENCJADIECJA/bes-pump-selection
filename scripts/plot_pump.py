import os
import sys
import pathlib
import argparse

# Ensure project root is on sys.path so local imports work when run as a script
PROJECT_ROOT = str(pathlib.Path(__file__).resolve().parents[1])
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np
import equipment_selection


def plot_pump(pump_id, freq_hz=50.0, stages=300, n_points=101, out_path=None):
    equipment_selection.load_catalogs()
    # find pump
    df = equipment_selection.PUMP_CATALOG
    try:
        pump_row = df[df[equipment_selection.COL_PUMP_ID] == str(pump_id)].iloc[0]
    except Exception:
        raise SystemExit(f"Pump '{pump_id}' not found in catalog")

    # Determine max Q: prefer 'maxmax' field if present, else configured max Q column
    max_q = None
    for key in ('maxmax', 'max_max', 'MAXMAX', 'maxMax'):
        if key in pump_row.keys():
            max_q = pump_row.get(key)
            break
    if max_q is None:
        max_q = pump_row.get(equipment_selection.COL_PUMP_MAX_Q)
    try:
        max_q = float(max_q)
    except Exception:
        # fallback to reasonable default
        max_q = float(pump_row.get(equipment_selection.COL_PUMP_MAX_Q) or 3000)

    q_min = 0.0
    q_max = max_q

    # Read coefficients
    h_coeffs = [float(pump_row.get(col) or 0) for col in equipment_selection.COLS_PUMP_HEAD]
    p_coeffs = [float(pump_row.get(col) or 0) for col in equipment_selection.COLS_PUMP_BHP]

    # helper polynomial evaluator (reuse project's function)
    calc_poly = equipment_selection.calculate_polynomial

    # rpm nominal detection
    rpm_cat = None
    for key in ('rpm', 'RPM', 'Rpm', 'rpm_nom', 'rpm_cat'):
        if key in pump_row.keys():
            rpm_cat = pump_row.get(key)
            break
    try:
        rpm_cat = float(rpm_cat) if rpm_cat is not None else None
    except Exception:
        rpm_cat = None

    rpm_oper = float(freq_hz) * 60.0 if freq_hz is not None else None

    q_vals = np.linspace(q_min, q_max, int(n_points))
    head_vals = []
    bhp_vals = []
    eff_vals = []

    for q in q_vals:
        base_h = calc_poly(h_coeffs, q)
        base_p = calc_poly(p_coeffs, q)

        stage_factor = float(stages) if stages is not None else 1.0
        if rpm_oper and rpm_cat and rpm_cat > 0:
            speed_factor_h = (rpm_oper / float(rpm_cat)) ** 2
            speed_factor_p = (rpm_oper / float(rpm_cat)) ** 3
        else:
            speed_factor_h = 1.0
            speed_factor_p = 1.0

        head_scaled = base_h * stage_factor * speed_factor_h
        p_scaled = base_p * stage_factor * speed_factor_p
        # convert to HP as in equipment_selection
        try:
            bhp_hp = float(p_scaled) * 1.34 / 1000.0
        except Exception:
            bhp_hp = p_scaled

        # efficiency: Q*TDH/(6570*PBHP)  (PBHP in HP)
        try:
            eff = (q * head_scaled) / (6570.0 * float(bhp_hp)) if bhp_hp and float(bhp_hp) != 0 else 0.0
        except Exception:
            eff = 0.0

        head_vals.append(head_scaled)
        bhp_vals.append(bhp_hp)
        eff_vals.append(eff)

    # Plot: single axes with secondary y-axis
    fig, ax1 = plt.subplots(figsize=(10, 6))

    # Head on primary y-axis
    line_head, = ax1.plot(q_vals, head_vals, color='tab:blue', label='Head (scaled)', linewidth=2)
    ax1.set_xlabel('Caudal (Q)')
    ax1.set_ylabel('Head', color='tab:blue')
    ax1.tick_params(axis='y', labelcolor='tab:blue')
    ax1.grid(True, linestyle='--', alpha=0.3)

    # BHP and Efficiency on secondary y-axis
    ax2 = ax1.twinx()
    line_bhp, = ax2.plot(q_vals, bhp_vals, color='tab:red', label='BHP (HP)', linewidth=2)
    line_eff, = ax2.plot(q_vals, [e * 100.0 for e in eff_vals], color='tab:green', label='Efficiency (%)', linewidth=2, linestyle='--')
    ax2.set_ylabel('BHP (HP) / Efficiency (%)', color='tab:red')
    ax2.tick_params(axis='y', labelcolor='tab:red')

    # Combine legends
    lines = [line_head, line_bhp, line_eff]
    labels = [l.get_label() for l in lines]
    ax1.legend(lines, labels, loc='upper right')

    fig.suptitle(f'Pump {pump_id} curves (freq={freq_hz}Hz, stages={stages})  Q range: {q_min} to {q_max}')
    plt.tight_layout()

    if out_path is None:
        out_path = os.path.join('data', f'{str(pump_id).lower()}_curves.png')
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    plt.savefig(out_path, dpi=150)
    print('Saved plot to', out_path)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Plot pump curves for any pump id')
    parser.add_argument('pump_id', help='Pump id (as in catalog)')
    parser.add_argument('--freq', type=float, default=50.0, help='Frequency in Hz')
    parser.add_argument('--stages', type=int, default=300, help='Number of stages')
    parser.add_argument('--points', type=int, default=101, help='Number of points to evaluate')
    parser.add_argument('--out', type=str, default=None, help='Output file path for PNG')

    args = parser.parse_args()
    plot_pump(args.pump_id, freq_hz=args.freq, stages=args.stages, n_points=args.points, out_path=args.out)
