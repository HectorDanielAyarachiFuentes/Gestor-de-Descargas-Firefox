# Guía para Agentes de IA (AGENTS.md)

Este documento contiene las **directrices obligatorias** para asistentes de Inteligencia Artificial (y desarrolladores) que trabajen en este repositorio. Su cumplimiento es estricto para evitar regresiones, mantener el código limpio y **optimizar al máximo el consumo de tokens**.

---

## 🚨 0. DIRECTRICES OBLIGATORIAS PARA LA IA

> [!IMPORTANT]
> ### REGLA 1: LECTURA PREVIA OBLIGATORIA (Pre-flight Read)
> Antes de responder preguntas técnicas sobre la arquitectura, proponer soluciones o modificar cualquier archivo, la IA **DEBE LEER PRIMERO ESTE ARCHIVO (`.agents/AGENTS.md`)** y consultar [`.agents/ARCHITECTURE.md`](file:///c:/Users/Ramoncito/.antigravity-ide/Gestor-de-Descargas-Firefox/.agents/ARCHITECTURE.md).
> - No comiences a inspeccionar archivos a ciegas sin antes haber revisado el *Mapa Rápido de Responsabilidades* de la Sección 1.
> - Respeta siempre las *Reglas Críticas de Estilo* de la Sección 2.

> [!IMPORTANT]
> ### REGLA 2: SINCRONIZACIÓN Y ACTUALIZACIÓN CONTINUA DE LA DOCUMENTACIÓN
> **CADA VEZ** que la IA o el desarrollador realice un cambio en la base de código (agregar/modificar estilos CSS, nuevas funciones JS, eventos en background, claves de almacenamiento en storage o cambios en el manifest), **ES OBLIGATORIO ACTUALIZAR INMEDIATAMENTE ESTOS ARCHIVOS:**
> 1. [`.agents/AGENTS.md`](file:///c:/Users/Ramoncito/.antigravity-ide/Gestor-de-Descargas-Firefox/.agents/AGENTS.md): Si cambian rangos de líneas, funciones principales, nuevas reglas de estilo o responsabilidades de archivos.
> 2. [`.agents/ARCHITECTURE.md`](file:///c:/Users/Ramoncito/.antigravity-ide/Gestor-de-Descargas-Firefox/.agents/ARCHITECTURE.md): Si cambia el flujo de datos, el esquema de `storage.local`, nuevos componentes de UI o la interacción entre scripts.
> 3. No des por finalizada una tarea sin haber reflejado las modificaciones en la carpeta `.agents/`.

---

## 1. Mapa Rápido de Responsabilidades (Dónde buscar según la tarea)

| Tarea / Funcionalidad | Archivos Clave |
| :--- | :--- |
| **Intercepción de descargas y carpetas automáticas** | [`js/background.js`](file:///c:/Users/Ramoncito/.antigravity-ide/Gestor-de-Descargas-Firefox/js/background.js), [`js/rules-engine.js`](file:///c:/Users/Ramoncito/.antigravity-ide/Gestor-de-Descargas-Firefox/js/rules-engine.js) |
| **Interfaz del Popup / Barra Lateral (UI)** | [`pages/popup.html`](file:///c:/Users/Ramoncito/.antigravity-ide/Gestor-de-Descargas-Firefox/pages/popup.html), [`css/popup.css`](file:///c:/Users/Ramoncito/.antigravity-ide/Gestor-de-Descargas-Firefox/css/popup.css), [`js/popup.js`](file:///c:/Users/Ramoncito/.antigravity-ide/Gestor-de-Descargas-Firefox/js/popup.js) |
| **Cola de imágenes (Drag & Drop en popup)** | [`js/popup.js`](file:///c:/Users/Ramoncito/.antigravity-ide/Gestor-de-Descargas-Firefox/js/popup.js) (funciones `handleDrop`, `renderQueueList`) |
| **Drag & Drop en páginas web** | [`js/content-script.js`](file:///c:/Users/Ramoncito/.antigravity-ide/Gestor-de-Descargas-Firefox/js/content-script.js) |
| **Página de Ajustes y Reglas Completas** | [`pages/options.html`](file:///c:/Users/Ramoncito/.antigravity-ide/Gestor-de-Descargas-Firefox/pages/options.html), [`css/options.css`](file:///c:/Users/Ramoncito/.antigravity-ide/Gestor-de-Descargas-Firefox/css/options.css), [`js/options*.js`](file:///c:/Users/Ramoncito/.antigravity-ide/Gestor-de-Descargas-Firefox/js/) |
| **Claves de almacenamiento (Storage)** | [`js/constants.js`](file:///c:/Users/Ramoncito/.antigravity-ide/Gestor-de-Descargas-Firefox/js/constants.js), [`js/storage.js`](file:///c:/Users/Ramoncito/.antigravity-ide/Gestor-de-Descargas-Firefox/js/storage.js) |
| **Traducciones y Textos (i18n)** | [`_locales/es/messages.json`](file:///c:/Users/Ramoncito/.antigravity-ide/Gestor-de-Descargas-Firefox/_locales/es/messages.json), [`_locales/en/messages.json`](file:///c:/Users/Ramoncito/.antigravity-ide/Gestor-de-Descargas-Firefox/_locales/en/messages.json) |
| **Manifest & Permisos** | [`manifest.json`](file:///c:/Users/Ramoncito/.antigravity-ide/Gestor-de-Descargas-Firefox/manifest.json) |

---

## 2. Reglas Críticas de Estilo y CSS (Prevenir Regresiones)

### ⚠️ Regla de Oro en Listas Flexibles (`.queue-list`, `.popup-history`, `.recent-preview-container`)
- **NUNCA** dejar hijos de flexbox vertical con `flex-shrink: 1` y `overflow: hidden;` cuando el contenedor tiene `max-height`.
- **SIEMPRE** aplicar a las tarjetas en listas desplazables:
  ```css
  flex-shrink: 0;
  min-height: min-content;
  ```
  *Motivo:* Si una lista contiene muchos elementos (ej: 23 descargas), flexbox encogerá las tarjetas hasta convertirlas en tiras aplastadas ilegibles si no tienen `flex-shrink: 0;`.

### ⚠️ Regla de Encabezados y Badges (`.queue-title-wrapper`)
- **NUNCA** usar `justify-content: space-between;` dentro de envoltorios de título + badge (ej: `Cola de Descargas` y `(3)`).
- **SIEMPRE** mantener el título y su contador juntos:
  ```css
  .queue-title-wrapper {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    width: auto;
  }
  ```

### ⚠️ Regla de Cabecera Minimalista (Single-Row Header)
- **NUNCA** permitir que la cabecera `.popup-header` se parta en 2 pisos (`flex-wrap: wrap;` o con `border-top` en `.header-right-group`).
- En pantallas estrechas (`< 370px` y `body.mode-sidebar`), ocultar `.status-badge` y `.header-actions` (`display: none !important;`) para mantener el logo, título y toggle switch en una **única fila horizontal limpia de ~38px**.
- Los accesos a pantalla completa / ajustes se encuentran organizados dentro de la pestaña `Ajustes`.

### 📱 Diseño Responsivo Dual (Popup vs Barra Lateral)
1. **Modo Popup:** `body.mode-popup` (fijado a ~375px de ancho).
2. **Modo Barra Lateral (Sidebar):** `body.mode-sidebar` (ancho variable, desde ~260px hasta ancho completo de pantalla).
3. **Container Queries:** Se utiliza `@container popup (max-width: 370px)` y `@container popup (max-width: 300px)` porque el contenedor principal tiene `container-type: inline-size; container-name: popup;`. Siempre mantener sincronizados los fallbacks en `@media (max-width: 370px)`.

---

## 3. Guía de Ahorro de Tokens para Agentes

1. **Evitar lecturas masivas:**
   - [`css/popup.css`](file:///c:/Users/Ramoncito/.antigravity-ide/Gestor-de-Descargas-Firefox/css/popup.css) tiene más de 2200 líneas. **No uses `view_file` sin rango de líneas**. Usa búsquedas por grep o rangos específicos (`view_file` con `StartLine` y `EndLine`).
   - [`js/popup.js`](file:///c:/Users/Ramoncito/.antigravity-ide/Gestor-de-Descargas-Firefox/js/popup.js) supera las 1200 líneas. Consulta el mapa de funciones abajo antes de inspeccionar código.
2. **Usa ediciones precisas:**
   - Usa `replace_file_content` con bloques concisos y exactos.

---

## 4. Mapa Interno de JavaScript

### [`js/popup.js`](file:///c:/Users/Ramoncito/.antigravity-ide/Gestor-de-Descargas-Firefox/js/popup.js)
- **Líneas ~1-100:** Inicialización, detección de modo (`?mode=sidebar` vs `?mode=popup`), listeners de pestañas.
- **Líneas ~101-280:** Estadísticas KPI (`updateKPIStats`), toggle de auto-organización, conmutación forzada de carpeta.
- **Líneas ~281-550:** Lógica de Forzar Carpeta próxima (`forceNextDownload`).
- **Líneas ~551-665:** Vista previa de descargas recientes (`recentDownloadsPreview`).
- **Líneas ~666-1070:** Lógica de Drag & Drop y Cola de Descargas (`handleDrop`, `processSingleQueueItem`, `downloadAllQueue`).
- **Líneas ~1071-1160:** Renderizado visual de la cola (`renderQueueList`).
- **Líneas ~1161-1284:** Historial de descargas local (`loadHistory`).

### [`js/background.js`](file:///c:/Users/Ramoncito/.antigravity-ide/Gestor-de-Descargas-Firefox/js/background.js)
- Escucha `browser.downloads.onDeterminingFilename` para sugerir rutas.
- Comprueba si hay una carpeta forzada activa (`forceNextDownload`).
- Aplica reglas personalizadas (`customRules`) y luego reglas por categoría (`rules-engine.js`).
- Gestiona menús contextuales (`contextMenus`) para guardar directamente a carpetas rápidas.

---

## 5. Pruebas y Despliegue en Firefox

1. Abrir `about:debugging#/runtime/this-firefox` en Firefox.
2. Clic en **"Cargar complemento temporal..."** (Load Temporary Add-on).
3. Seleccionar el archivo [`manifest.json`](file:///c:/Users/Ramoncito/.antigravity-ide/Gestor-de-Descargas-Firefox/manifest.json).
4. Para ver cambios tras editar archivos, pulsar el botón **"Recargar"** en la tarjeta de la extensión.
