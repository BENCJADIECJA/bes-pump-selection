import sys
import os
import argparse
import json

# Asegurarnos de que el directorio raíz del proyecto esté en sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import equipment_selection


def choose_pump_interactive(pumps, col_id):
    # Muestra la lista y permite elegir por índice o por texto
    print("Introduce el número de la bomba o su nombre (parcial) y pulsa Enter. Vacío = 1.)")
    while True:
        choice = input('Seleccionar (índice o texto): ').strip()
        if choice == '':
            return pumps[0]
        if choice.isdigit():
            idx = int(choice) - 1
            if 0 <= idx < len(pumps):
                return pumps[idx]
            print(f"Índice fuera de rango. Ingrese entre 1 y {len(pumps)}")
            continue

        # Búsqueda por texto (subcadena, case-insensitive)
        matches = [p for p in pumps if p.get(col_id) and choice.lower() in str(p.get(col_id)).lower()]
        if len(matches) == 1:
            return matches[0]
        if len(matches) > 1:
            print('Se encontraron varias coincidencias:')
            for i, m in enumerate(matches, 1):
                print(f"  {i}. {m.get(col_id)}")
            print('Introduce el número relativo de la coincidencia para seleccionar, o vuelve a buscar.')
            sub = input('Seleccionar coincidencia (número) o ENTER para cancelar: ').strip()
            if sub.isdigit():
                si = int(sub) - 1
                if 0 <= si < len(matches):
                    return matches[si]
            continue

        print('No se encontraron coincidencias. Vuelve a intentarlo.')


def select_pump(pumps, col_id, selector):
    # selector puede ser None (interactive), número (1-based) o nombre/substring
    if selector is None:
        return choose_pump_interactive(pumps, col_id)

    s = str(selector).strip()
    if s.isdigit():
        idx = int(s) - 1
        if 0 <= idx < len(pumps):
            return pumps[idx]
        raise IndexError(f"Índice fuera de rango: {s}")

    # buscar exacto primero
    for p in pumps:
        val = p.get(col_id)
        if val is None:
            continue
        if str(val).lower() == s.lower():
            return p

    # luego substring
    matches = [p for p in pumps if p.get(col_id) and s.lower() in str(p.get(col_id)).lower()]
    if len(matches) == 1:
        return matches[0]
    if len(matches) > 1:
        # devolver la primera coincidencia si se llama desde CLI
        return matches[0]

    raise ValueError(f"No se encontró bomba con selector: {selector}")


def format_point(pt):
    return f"Q={pt['caudal']:.3f} -> {pt.get('label','valor')}={pt['valor']:.3f}"


def main():
    parser = argparse.ArgumentParser(description='Mostrar curvas de una bomba del catálogo')
    parser.add_argument('--select', '-s', help='Índice (1-based) o nombre/parcial de la bomba a seleccionar')
    parser.add_argument('--points', '-p', type=int, default=7, help='Cuántos puntos mostrar (por defecto 7)')
    parser.add_argument('--save', help='Ruta opcional para guardar las curvas en JSON')
    parser.add_argument('--plot', help='Ruta opcional para guardar una gráfica PNG de las curvas')
    parser.add_argument('--freq', type=float, default=50.0, help='Frecuencia de operación en Hz (por defecto 50 Hz)')
    parser.add_argument('--stages', type=int, default=300, help='Número de etapas (por defecto 300)')
    args = parser.parse_args()

    equipment_selection.load_catalogs()
    pumps = equipment_selection.get_pump_catalog()
    print(f"Bombas encontradas: {len(pumps)}\n")

    col_id = equipment_selection.COL_PUMP_ID
    for i, p in enumerate(pumps[:20], 1):
        display = p.get(col_id) or p.get('nom') or '—'
        print(f"{i}. {display}")

    if not pumps:
        print("No hay bombas en el catálogo.")
        return 1

    try:
        chosen = select_pump(pumps, col_id, args.select)
    except Exception as e:
        print('No se pudo seleccionar la bomba:', e)
        return 2

    pump_id = chosen.get(col_id)
    print(f"\nSeleccionando bomba: {pump_id}\n")

    curves = equipment_selection.get_pump_performance_curves(pump_id, freq_hz=args.freq, stages=args.stages)
    if isinstance(curves, dict) and 'error' in curves:
        print('Error al obtener curvas:', curves['error'])
        return 3

    # Mostrar puntos solicitados
    n = max(1, min(len(curves['head']), args.points))
    print('Curva de Altura (primeros {} puntos):'.format(n))
    for pt in curves['head'][:n]:
        print(f"  Q={pt['caudal']:.3f} -> H={pt['valor']:.3f} m")

    print('\nCurva de Potencia (BHP) (primeros {} puntos):'.format(n))
    for pt in curves['bhp'][:n]:
        print(f"  Q={pt['caudal']:.3f} -> BHP={pt['valor']:.3f} hp")

    print('\n(Eficiencia en los mismos puntos):')
    for pt in curves['efficiency'][:n]:
        print(f"  Q={pt['caudal']:.3f} -> Eff={pt['valor']:.3f} %")

    if args.save:
        out = {
            'pump_id': pump_id,
            'curves': curves
        }
        try:
            with open(args.save, 'w', encoding='utf-8') as fh:
                json.dump(out, fh, ensure_ascii=False, indent=2)
            print(f"\nCurvas guardadas en: {args.save}")
        except Exception as e:
            print('Error al guardar archivo:', e)

    if args.plot:
        try:
            # Crear directorio si no existe
            os.makedirs(os.path.dirname(args.plot) or '.', exist_ok=True)
            # Importar matplotlib localmente para no imponer la dependencia si no se usa
            import matplotlib
            matplotlib.use('Agg')
            import matplotlib.pyplot as plt

            qs = [p['caudal'] for p in curves['head']]
            hs = [p['valor'] for p in curves['head']]
            ps = [p['valor'] for p in curves['bhp']]
            es = [p['valor'] for p in curves['efficiency']]

            # Raw polynomials for overlay
            hs_raw = [p['valor'] for p in curves.get('head_raw', [])]
            ps_raw = [p['valor'] for p in curves.get('bhp_raw', [])]
            es_raw = [p['valor'] for p in curves.get('efficiency_raw', [])]

            fig, ax1 = plt.subplots(figsize=(10, 6))
            ax1.plot(qs, hs, '-o', color='tab:blue', label='Head (scaled)')
            if hs_raw:
                ax1.plot(qs, hs_raw, '--', color='tab:blue', alpha=0.6, label='Head (raw)')
            ax1.set_xlabel('Q')
            ax1.set_ylabel('Head (m)', color='tab:blue')
            ax1.tick_params(axis='y', labelcolor='tab:blue')

            ax2 = ax1.twinx()
            ax2.plot(qs, ps, '-s', color='tab:red', label='BHP (scaled)')
            if ps_raw:
                ax2.plot(qs, ps_raw, '--', color='tab:red', alpha=0.6, label='BHP (raw)')
            ax2.set_ylabel('BHP (hp)', color='tab:red')
            ax2.tick_params(axis='y', labelcolor='tab:red')

            # Optional: plot efficiency on a third axis as percentage
            ax3 = ax1.twinx()
            ax3.spines['right'].set_position(('outward', 60))
            ax3.plot(qs, es, '-^', color='tab:green', label='Efficiency (scaled)')
            if es_raw:
                ax3.plot(qs, es_raw, '--', color='tab:green', alpha=0.6, label='Efficiency (raw)')
            ax3.set_ylabel('Efficiency', color='tab:green')
            ax3.tick_params(axis='y', labelcolor='tab:green')

            # Legends
            lines, labels = ax1.get_legend_handles_labels()
            l2, l2l = ax2.get_legend_handles_labels()
            l3, l3l = ax3.get_legend_handles_labels()
            ax1.legend(lines + l2 + l3, labels + l2l + l3l, loc='upper right')

            plt.title(f"Curvas bomba {pump_id}")
            fig.tight_layout()
            plt.savefig(args.plot, dpi=150)
            plt.close(fig)
            print(f"\nGráfica guardada en: {args.plot}")
        except Exception as e:
            print('Error al generar la gráfica:', e)

    return 0


if __name__ == '__main__':
    raise SystemExit(main())
