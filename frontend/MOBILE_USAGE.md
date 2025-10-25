# 📱 BES Pump Performance Curves - Uso Móvil y Desktop

## ✨ Características Implementadas

### 🖥️ **Diseño Fullscreen**
- **Fondo blanco** completamente limpio
- **Ocupa toda la pantalla** sin márgenes ni bordes
- **Optimizado para escritorio y móvil**

### 📐 **Diseño Responsive Completo**
- ✅ Adaptable a cualquier tamaño de pantalla
- ✅ Optimizado para tablets
- ✅ Optimizado para smartphones
- ✅ Soporte landscape y portrait
- ✅ Elementos táctiles de tamaño óptimo (44px mínimo)

### 📊 **Interfaz Adaptativa**
- **Desktop**: Pestañas con texto completo e iconos
- **Móvil**: Pestañas solo con iconos grandes para mejor navegación
- **Grids responsive**: Los controles se reorganizan en columnas según el espacio

---

## 📲 Cómo Anclar en Escritorio (Windows)

### **Opción 1: Chrome/Edge - Crear Acceso Directo**
1. Abre la aplicación en Chrome o Edge
2. Haz clic en el menú (⋮) → **Más herramientas** → **Crear acceso directo**
3. ✅ Marca la casilla **"Abrir como ventana"**
4. Haz clic en **Crear**
5. El icono aparecerá en tu escritorio y barra de tareas

### **Opción 2: Anclar a la Barra de Tareas**
1. Sigue los pasos de la Opción 1
2. Haz clic derecho en el icono del escritorio
3. Selecciona **"Anclar a la barra de tareas"**

### **Opción 3: PWA Instalable (Recomendado)**
1. En Chrome/Edge, busca el ícono de instalación (⊕) en la barra de direcciones
2. Haz clic en **"Instalar BES Pumps"**
3. La aplicación se instalará como una app nativa
4. Podrás abrirla desde el menú inicio o escritorio

---

## 📱 Cómo Usar en Dispositivos Móviles

### **iOS (iPhone/iPad)**

#### **Agregar a la Pantalla de Inicio**
1. Abre Safari y navega a la aplicación
2. Toca el botón **Compartir** (⬆️)
3. Desplázate y toca **"Agregar a pantalla de inicio"**
4. Personaliza el nombre si lo deseas
5. Toca **"Agregar"**
6. El icono aparecerá en tu pantalla de inicio

#### **Usar en Modo Fullscreen**
- Al abrir desde la pantalla de inicio, se abrirá **sin barra de navegación**
- Funciona como una app nativa

### **Android**

#### **Agregar a la Pantalla de Inicio**
1. Abre Chrome y navega a la aplicación
2. Toca el menú (⋮) → **"Agregar a la pantalla de inicio"**
3. O busca el banner de instalación que aparece automáticamente
4. Toca **"Instalar"**
5. El icono aparecerá en tu launcher

#### **PWA Completa**
- Android detecta automáticamente que es una PWA
- Se instalará con todas las capacidades de una app nativa
- Aparecerá en el cajón de aplicaciones

---

## 🎨 Optimizaciones Móviles Implementadas

### **Controles Táctiles**
- ✅ Todos los botones tienen **44px mínimo** de altura
- ✅ Espaciado generoso entre elementos táctiles
- ✅ Feedback visual mejorado en hover/touch

### **Pestañas Adaptativas**
```
Desktop: 📊 Combined System | ⚡ Efficiency | 📈 Head | 🔋 BHP
Móvil:   📊               | ⚡            | 📈      | 🔋
```

### **Texto Escalable**
- Usa `clamp()` para ajustar automáticamente según pantalla
- Títulos: `clamp(1.5rem, 4vw, 2.5rem)`
- Textos: `clamp(0.85rem, 2vw, 1rem)`

### **Gráficos Responsive**
- ✅ Ancho 100% del contenedor
- ✅ Scroll horizontal en gráficos si es necesario
- ✅ Altura adaptativa (600px desktop, 400px móvil, 350px móvil pequeño)
- ✅ `useResizeHandler={true}` en Plotly

### **Landscape Mode**
- ✅ Optimizado para modo horizontal en móviles
- ✅ Reducción de espaciados para aprovechar altura
- ✅ Títulos más compactos

---

## 🖨️ Impresión Optimizada

La aplicación incluye estilos de impresión que:
- Ocultan controles y pestañas
- Solo imprimen los gráficos
- Evitan quiebres de página en gráficos

**Para imprimir:**
- Ctrl+P (Windows/Linux)
- Cmd+P (Mac)
- Selecciona orientación **Landscape** para mejor vista

---

## 🌐 URLs y Modos

### **Acceso Directo a Modos**
```
Normal:          http://localhost:5173/
Single Pump:     http://localhost:5173/?mode=single
System Design:   http://localhost:5173/?mode=design
Comparison:      http://localhost:5173/?mode=comparison
```

---

## 🔧 Resolución de Problemas

### **El texto se ve muy pequeño en móvil**
- Asegúrate de que el viewport está configurado correctamente
- Verifica en `index.html`: `<meta name="viewport" content="width=device-width, initial-scale=1.0">`

### **Los gráficos no se ajustan**
- Limpia la caché del navegador
- Recarga con Ctrl+F5 (Windows) o Cmd+Shift+R (Mac)

### **La app no se puede instalar en móvil**
- Verifica que estés usando HTTPS (requerido para PWA)
- En desarrollo, `localhost` funciona sin HTTPS
- Chrome/Edge son los navegadores más compatibles

### **Los controles se superponen en pantallas pequeñas**
- Usa orientación **portrait** en móviles
- Si usas landscape, algunos elementos pueden necesitar scroll

---

## 💡 Consejos de Uso

### **Mejor Experiencia en Desktop**
1. Instala como PWA para ventana dedicada
2. Usa pantalla completa (F11)
3. Ancla a la barra de tareas para acceso rápido

### **Mejor Experiencia en Móvil**
1. Agrega a pantalla de inicio
2. Usa en orientación **vertical (portrait)**
3. Navega por las pestañas deslizando
4. Usa zoom táctil en gráficos si es necesario

### **Mejor Experiencia en Tablet**
1. Funciona perfectamente en ambas orientaciones
2. Landscape muestra más contenido
3. Los controles se organizan en 2-3 columnas automáticamente

---

## 📊 Características PWA

### **Capacidades Offline** (Futuro)
- Service Worker puede agregarse para modo offline
- Los gráficos visitados se guardan en caché

### **Actualizaciones Automáticas**
- La PWA se actualiza automáticamente cuando hay cambios
- No necesitas reinstalar

### **Notificaciones** (Futuro)
- Potencial para alertas de diseño
- Recordatorios de revisión de bombas

---

## 🎯 Estado Actual

✅ **Implementado:**
- Diseño fullscreen con fondo blanco
- 100% responsive (móvil, tablet, desktop)
- Sistema de pestañas adaptativo
- Gráficos responsive con Plotly
- Media queries completas
- Manifest.json para PWA
- Metadatos mobile-friendly
- Accesibilidad mejorada
- Estilos de impresión
- Touch-friendly (44px mínimo)

🚀 **Listo para usar en:**
- ✅ Windows Desktop (anclable)
- ✅ macOS Desktop (anclable)
- ✅ Linux Desktop (anclable)
- ✅ iOS (iPhone/iPad)
- ✅ Android (Smartphones/Tablets)
- ✅ Chrome, Edge, Safari, Firefox

---

## 📞 Soporte

Para problemas específicos de plataforma:
- **Desktop**: Verifica que usas Chrome/Edge más reciente
- **iOS**: Requiere Safari 11.1+
- **Android**: Requiere Chrome 67+

**¡La aplicación está completamente optimizada para usarse en cualquier dispositivo! 🎉**
