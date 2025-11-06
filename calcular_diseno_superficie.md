Tarea: Generar función para Cálculo de Diseño de Equipos de Superficie

Contexto de Integración y UI/UX:

Principio de UI/UX: El diseño del UI/UX se mantiene tal y como se viene trabajando actualmente (Frontend React con API Python), tal como se define en el archivo README.md del proyecto.

Implementación: Esta función de Python está destinada a ser un endpoint en el back-end (Flask/Python) que es consumido por un componente de front-end (React), según la arquitectura descrita en README.md.

Crear una función en Python llamada calcular_diseno_superficie que determine el TAP de transformador requerido y el tamaño (kVA) del VSD.

Principio de Diseño Clave:
Este es un cálculo de diseño estático, no un cálculo de operación dinámica. Se basa en:

Los datos de placa del motor (peor escenario de corriente).

La frecuencia máxima del escenario optimista (F_max).

El voltaje de salida configurado por el usuario para el VSD a esa F_max (ej. 460V), para asegurar un margen de modulación.

La arquitectura del sistema es:
VSD -> Filtro LC -> Transformador Elevador -> (Punto de Medición) -> Cable de Pozo -> Motor

Entradas de la Función:

La función debe aceptar un diccionario principal datos_diseno:

datos_diseno = {
    "motor_placa": {
        "v_nom": 2300.0,    # Voltaje nominal (Placa)
        "i_nom": 40.0,      # Corriente nominal (Placa)
        "pf_nom": 0.85,     # Factor de Potencia (Placa)
        "f_nom": 60.0       # Frecuencia nominal (Placa)
    },
    "cable_seleccionado": {
        "r_total_ohms": 12.5 # Resistencia total del cable a Temp. Op.
    },
    "config_diseno_usuario": {
        "tipo_accionamiento": "vsd", # Puede ser "vsd" o "tablero"
        
        # --- Opciones para VSD ---
        "f_max_operativa": 62.0,   # Frec. máx. del escenario optimista
        "v_vsd_out_configurada": 460.0, # Voltaje VSD set por usuario a F_max (ej. 460V)
        
        # --- Opciones para Tablero ---
        "f_red": 50.0, # Frecuencia de la red (ej. 50Hz o 60Hz)
        "margen_tension_tablero": 10.0 # Margen de tensión (ej. 10%)
    },
    "catalogo_equipos": {
        "vsd": {
            "eficiencia": 0.97,
            "pf_entrada": 0.96
        },
        "filtro_lc": {
            "resistencia_r": 0.005,  # Ohms (lado baja)
            "inductancia_l": 0.0001 # Henrys (lado baja)
        },
        "transformador": {
            "v_primario_nom": 480.0,
            "v_secundario_nom": 2400.0,
            "impedancia_z_porc": 5.75
        }
    }
}



Lógica de Cálculo (Pasos a seguir):

Paso A: Calcular Demanda en Superficie (Salida del Trafo)

Objetivo: Calcular V_superficie_req y P_superficie_kw (lo que se necesita a la salida del trafo).

motor = datos_diseno["motor_placa"]

cable = datos_diseno["cable_seleccionado"]

config = datos_diseno["config_diseno_usuario"]

Determinar la frecuencia de operación base para el cálculo

if config["tipo_accionamiento"] == "vsd":

    f_operacion = config["f_max_operativa"]

elif config["tipo_accionamiento"] == "tablero":

    f_operacion = config["f_red"]

else:

    raise ValueError("Tipo de accionamiento no reconocido.")

I_motor_op = motor["i_nom"] # Base de cálculo: Corriente de placa

V_motor_op = motor["v_nom"] * (f_operacion / motor["f_nom"])

V_drop_cable = I_motor_op * cable["r_total_ohms"] # Caída escalar

V_superficie_req = V_motor_op + V_drop_cable # Tensión requerida en salida trafo

P_motor_kw = (motor["v_nom"] * I_motor_op * motor["pf_nom"] * 1.732) / 1000 # Potencia motor a I_nom

P_cable_loss_kw = 3 * (I_motor_op**2) * cable["r_total_ohms"] / 1000

P_superficie_kw = P_motor_kw + P_cable_loss_kw # Potencia activa en salida trafo

Paso B: Calcular Suministro y Equipos de Superficie (Condicional)

Objetivo: Calcular el TAP y sizing de VSD según el tipo de accionamiento.

trafo = datos_diseno["catalogo_equipos"]["transformador"]

ratio_nominal = trafo["v_secundario_nom"] / trafo["v_primario_nom"]

if config["tipo_accionamiento"] == "vsd":

    # --- Lógica VSD (Pasos B, C, D anteriores) ---

    filtro = datos_diseno["catalogo_equipos"]["filtro_lc"]

    I_vsd_out_aprox = I_motor_op * ratio_nominal

    V_vsd_out_actual = config["v_vsd_out_configurada"]

    X_l_filtro = 2 * 3.14159 * f_operacion * filtro["inductancia_l"]

    Z_filtro = (filtro["resistencia_r"]**2 + X_l_filtro**2)**0.5

    V_drop_filtro = I_vsd_out_aprox * Z_filtro

    V_trafo_in_real = V_vsd_out_actual - V_drop_filtro

    # Cálculo de TAP para VSD

    ratio_trafo_final = V_superficie_req / V_trafo_in_real

    v_sec_equivalente_calc = ratio_trafo_final * trafo["v_primario_nom"]

    tap_porc_calculado = (v_sec_equivalente_calc / trafo["v_secundario_nom"]) * 100

    # Sizing de VSD

    vsd_catalogo = datos_diseno["catalogo_equipos"]["vsd"]

    P_filtro_loss_kw = (I_vsd_out_aprox**2 * filtro["resistencia_r"]) / 1000

    P_trafo_loss_kw = P_superficie_kw * (1.0 - 0.98) # Asumir 98% eficiencia trafo

    P_vsd_out_kw = P_superficie_kw + P_filtro_loss_kw + P_trafo_loss_kw

    P_vsd_in_kw = P_vsd_out_kw / vsd_catalogo["eficiencia"]

    kva_vsd_req = P_vsd_in_kw / vsd_catalogo["pf_entrada"]

    # Curva V/Hz

    Punto_1 = (f1=0.0, v1=0.0)

    Punto_2 = (f2=5.0, v2=config["v_vsd_out_configurada"] * 0.10)

    Punto_6 = (f6=f_operacion, v6=config["v_vsd_out_configurada"])

    # ... (Interpolar Puntos 3, 4, 5)

elif config["tipo_accionamiento"] == "tablero":

    # --- Lógica Tablero ---

    v_tap_requerido = V_superficie_req * (1 + (config["margen_tension_tablero"] / 100.0))

    # Calcular ratio y % de TAP equivalente

    ratio_trafo_final = v_tap_requerido / trafo["v_primario_nom"]

    v_sec_equivalente_calc = v_tap_requerido

    tap_porc_calculado = (v_sec_equivalente_calc / trafo["v_secundario_nom"]) * 100

    # Setear valores VSD/Filtro a N/A o None

    V_drop_filtro = 0

    V_trafo_in_real = trafo["v_primario_nom"] # Asume entrada nominal

    kva_vsd_req = None

    curva_v_hz_6_puntos = None

    I_vsd_out_aprox = I_motor_op * ratio_nominal # Corriente en primario (aprox)

Salida de la Función:

La función debe devolver un diccionario con todos los resultados del diseño:

{
  "calculos_demanda_pozo": {
    "v_motor_op_v": V_motor_op,
    "v_drop_cable_v": V_drop_cable,
    "v_superficie_req_v": V_superficie_req,
    "p_motor_kw": P_motor_kw,
    "p_cable_loss_kw": P_cable_loss_kw,
    "p_superficie_kw": P_superficie_kw,
    "i_motor_op_a": I_motor_op
  },
  "calculos_suministro_superficie": {
    "tipo_accionamiento": config["tipo_accionamiento"],
    "frecuencia_calculo_hz": f_operacion,
    "v_vsd_out_actual_v": V_vsd_out_actual if config["tipo_accionamiento"] == "vsd" else None,
    "v_drop_filtro_v": V_drop_filtro,
    "v_trafo_in_real_v": V_trafo_in_real,
    "i_vsd_out_aprox_a": I_vsd_out_aprox
  },
  "transformador_calculado": {
    "ratio_trafo_final": ratio_trafo_final,
    "v_sec_equivalente_calc_v": v_sec_equivalente_calc,
    "tap_porcentaje_calculado": tap_porc_calculado
  },
  "vsd_calculado": {
    "kva_vsd_req": kva_vsd_req,
    "p_vsd_out_kw": P_vsd_out_kw if config["tipo_accionamiento"] == "vsd" else None,
    "curva_v_hz_6_puntos": curva_v_hz_6_puntos if config["tipo_accionamiento"] == "vsd" else None
  },
  "warnings": []
}


Implementación (2025-11-06)
---------------------------

- La lógica descrita arriba está implementada en `surface_design.py` como `calcular_diseno_superficie(datos_diseno)`.
- El endpoint Flask disponible es `POST /api/surface-design` y retorna `{ "success": True, "result": {...} }` o errores 400/500.
- Validaciones automáticas:
    - Se verifica que las secciones requeridas existan (`motor_placa`, `cable_seleccionado`, `config_diseno_usuario`, `catalogo_equipos`).
    - Todos los parámetros críticos deben ser numéricos y `> 0`, excepto `margen_tension_tablero` que acepta valores `>= 0`.
    - Cuando las entradas producen tensiones no válidas (por ejemplo VSD con caída de filtro mayor al voltaje configurado) los resultados afectados se devuelven como `None` y se añade un warning.

Detalles adicionales implementados:

- `r_total_ohms` representa la suma de resistencias de MLE, cable de potencia y cable de superficie (ida y vuelta) y se usa directamente en la caída de tensión.
- Para tablero se reescala el voltaje del motor usando la frecuencia objetivo (por ejemplo llevar placa de 60 Hz a operación en 50 Hz).
- La curva V/Hz siempre contiene seis puntos:
    - Si `f_operacion > 5 Hz`, se usa una rampa 0–5 Hz que llega al 10 % del voltaje configurado y luego una interpolación lineal hasta `f_operacion`.
    - Si `f_operacion <= 5 Hz`, se devuelven seis puntos equiespaciados con relación lineal simple (se añade un warning informativo).
- La eficiencia de transformador se fija en 98 % (para parametrizar después); el resto de pérdidas proviene de filtro y cable.
- Los warnings acumulados se exponen en la clave `warnings` para que el front end pueda mostrarlos al usuario.

