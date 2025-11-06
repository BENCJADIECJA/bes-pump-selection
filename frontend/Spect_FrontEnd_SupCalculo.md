Tarea Especificación Lógica del Frontend (App.tsx)

Propósito Preparar el Payload para la API apicalcular_diseno_superficie

Este documento define la lógica que App.tsx debe implementar para ensamblar el payload datos_diseno, específicamente el objeto config_diseno_usuario.

El backend (calcular_diseno_superficie) espera que el frontend sea inteligente y le envíe la frecuencia de cálculo correcta en el campo f_max_operativa.

Fuentes de Datos (Estado de React)

El componente App.tsx debe tener acceso a las siguientes variables de estado

estado_tipo_accionamiento (string) vsd o tablero.

estado_sensitivity_activo (boolean) true si el modo Sensitivity está encendido.

estado_frecuencia_base (float) La frecuencia de la curva IPR base (ej. 58.5).

estado_frecuencia_optimista (float) La frecuencia del escenario optimistic (ej. 62.0).

estado_frecuencia_red (float) La frecuencia de red para tableros (ej. 50.0).

estado_v_vsd_configurada (float) El voltaje que el usuario configuró (ej. 460.0).

estado_margen_tablero (float) El margen de tensión para tableros (ej. 10.0).

Lógica de Decisión (Pseudocódigo para App.tsx)

Al presionar el botón Calcular Diseño, se debe ejecutar la siguiente lógica para construir el objeto config_diseno_usuario

 1. Declarar las variables que irán en el payload
let f_calculo_para_backend = 0.0;
let f_red_para_backend = 50.0;  Valor por defecto
let margen_para_backend = 0.0;
let v_vsd_para_backend = 0.0;

 2. Lógica de decisión principal
const tipo = estado_tipo_accionamiento;
const sensitivity_activo = estado_sensitivity_activo;

if (tipo === tablero) {
     --- CASO 1 TABLERO ---
     La frecuencia de cálculo es la de la red.
     Ignora Sensitivity y frecuencias de escenarios.
    f_calculo_para_backend = estado_frecuencia_red;
    f_red_para_backend = estado_frecuencia_red;
    margen_para_backend = estado_margen_tablero;
     v_vsd_out_configurada no es relevante, pero se puede enviar 0 o null
    v_vsd_para_backend = 0.0; 

} else if (tipo === vsd) {
     --- CASO 2 VSD ---
     La frecuencia de red y el margen no son relevantes
    f_red_para_backend = estado_frecuencia_red;  Se envía pero no se usa para el cálculo VSD
    margen_para_backend = 0.0;
    v_vsd_para_backend = estado_v_vsd_configurada;  Se usa el valor del input

    if (sensitivity_activo) {
         2a VSD con Sensitivity ACTIVO
         Usar la frecuencia del escenario optimista
        f_calculo_para_backend = estado_frecuencia_optimista;

    } else {
         2b VSD sin Sensitivity (Modo Base)
         Usar la frecuencia de la curva IPR base
        f_calculo_para_backend = estado_frecuencia_base;
    }
}

 3. Construir el objeto de configuración final
const config_diseno_usuario = {
    tipo_accionamiento tipo,
    
     Estos son los campos clave que el backend espera
    f_max_operativa f_calculo_para_backend,
    v_vsd_out_configurada v_vsd_para_backend,
    f_red f_red_para_backend,
    margen_tension_tablero margen_para_backend
};

 4. Ensamblar el payload completo y llamar a la API
const datos_diseno = {
    motor_placa { ... },  del estado de React
    cable_seleccionado { ... },  del estado de React
    config_diseno_usuario config_diseno_usuario,  El objeto que acabamos de construir
    catalogo_equipos { ... }  del estado de React
};

 axios.post('apicalcular_diseno_superficie', datos_diseno);


Conclusión

El prompt de backend (prompt_calculo_vsd.md) es correcto y no debe cambiarse. Esta especificación de frontend aclara cómo App.tsx debe prepararle los datos de manera inteligente, siguiendo exactamente la lógica que describiste.