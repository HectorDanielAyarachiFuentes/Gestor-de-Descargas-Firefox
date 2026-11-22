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
| **Iconos vectoriales y SVG estándar** | [`js/icons.js`](file:///c:/Users/Ramoncito/.antigravity-ide/Gestor-de-Descargas-Firefox/js/icons.js) |
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

### ⚠️ Regla del Panel de Desvío de Carpetas (`.route-panel`)
- **SIEMPRE** mantener una estructura limpia de 4 filas bien espaciadas dentro de `#force-idle-view`:
  1. **Cabecera (`.route-panel-header`):** Icono azul de carpeta + Título `Desviar a otra carpeta` + Subtítulo descriptivo.
  2. **Entrada de Carpeta (`.route-input-group`):** Input (`#forceFolderInput`) de 36px de alto y botón `Activar` (`.btn-route-action`) de 36px de alto, ambos con bordes redondeados de 8px.
  3. **Control de Duración (`.route-duration-row`):** Segmented control (`.route-duration-segmented`) con opciones explícitas `[ 1 Solo próxima ]` y `[ ∞ Múltiples descargas ]`. **NUNCA** volver al botón críptico `∞ Continuo` apretado al final de una lista.
  4. **Fila de Atajos a Ancho Completo (`.route-shortcuts-row`):** Ocupa el 100% del ancho de la tarjeta sin competir por espacio horizontal con botones externos.
- **SCROLL HORIZONTAL DE ATAJOS (`.route-chips-list`):**
  - El botón de añadir (`#w11AddRootFolderBtn`) debe estar fijado junto a la etiqueta (`.route-shortcuts-header: Atajos + [+]`) para que NUNCA sea empujado fuera de pantalla al acumularse atajos.
  - La lista `.route-chips-list` debe contar con `scrollbar-width: thin` y scrollbar estético de 3px para indicar visualmente el desbordamiento.
  - Cuenta con soporte en JS para desplazamiento horizontal fluido con la rueda del ratón (`wheel` event con `deltaY`).
- **BOTÓN DE CANCELAR HUD (`#cancelForceBtn`):** Usar siempre `data-i18n-title="cancelButton"` (no `data-i18n`) para preservar el icono SVG interior junto al `<span>Cancelar</span>`.

### ⚠️ Regla de Cabecera Minimalista (Single-Row Header)
- **NUNCA** permitir que la cabecera `.popup-header` se parta en 2 pisos (`flex-wrap: wrap;` o con `border-top` en `.header-right-group`).
- En pantallas estrechas (`< 370px` y `body.mode-sidebar`), ocultar `.status-badge`, `.brand-meta-row` y `.header-actions` (`display: none !important;`) para mantener el logo, título y toggle switch en una **única fila horizontal limpia de ~38px**.
- La versión de la app y el estado se ubican de forma sutil en la segunda fila (`.brand-meta-row`: `● Organización Activa · v1.2.7`), evitando saturar horizontalmente la primera fila para que el título `Gestor de Descargas` nunca se corte con elipsis (`Gestor de ...`).
- El botón de fijar a la barra lateral (`#openSidebar`) se mantiene accesible en la cabecera junto al toggle. Los accesos a pantalla completa / ajustes se encuentran organizados dentro de la pestaña `Ajustes`.

### 📱 Diseño Responsivo Dual (Popup vs Barra Lateral)
1. **Modo Popup:** `body.mode-popup` (fijado a ~395px de ancho para evitar truncamiento del título y colisión con controles).
2. **Modo Barra Lateral (Sidebar):** `body.mode-sidebar` (ancho variable, desde ~260px hasta ancho completo de pantalla).
3. **Container Queries:** Se utiliza `@container popup (max-width: 370px)` y `@container popup (max-width: 300px)` porque el contenedor principal tiene `container-type: inline-size; container-name: popup;`. Siempre mantener sincronizados los fallbacks en `@media (max-width: 370px)`.
4. **Transición y Cierre de Popup:** Al pulsar `#openSidebar` o `#openSidebarBtn`, se añade `.popup-closing-to-sidebar` al body para animar la salida del popup hacia la izquierda (deslizamiento + fade) y se cierra el popup con `window.close()` a los 220ms. Al pulsar `#openFullOptionsBtn` o `#openFullTabBtn`, el popup también se cierra automáticamente (`window.close()`) para no tapar la nueva pestaña abierta.

---

## 3. Guía de Ahorro de Tokens para Agentes

1. **Evitar lecturas masivas:**
   - [`css/popup.css`](file:///c:/Users/Ramoncito/.antigravity-ide/Gestor-de-Descargas-Firefox/css/popup.css) tiene más de 2200 líneas. **No uses `view_file` sin rango de líneas**. Usa búsquedas por grep o rangos específicos (`view_file` con `StartLine` y `EndLine`).
   - [`js/popup.js`](file:///c:/Users/Ramoncito/.antigravity-ide/Gestor-de-Descargas-Firefox/js/popup.js) supera las 1200 líneas. Consulta el mapa de funciones abajo antes de inspeccionar código.
2. **Usa ediciones precisas:**
   - Usa `replace_file_content` con bloques concisos y exactos.

---

## 4. Mapa Interno de JavaScript

### [`js/icons.js`](file:///c:/Users/Ramoncito/.antigravity-ide/Gestor-de-Descargas-Firefox/js/icons.js)
- Catálogo centralizado de iconos vectoriales SVG de alta definición (Lucide Standard 24x24): tipos de archivo coloreados (`getFileTypeSvg`), carpetas (`getFolderSvg`, `getFolderOpenSvg`), acciones de UI (`getRefreshSvg`, `getXSvg`, `getHardDriveSvg`, `getMaximizeSvg`, etc.).

### [`js/popup.js`](file:///c:/Users/Ramoncito/.antigravity-ide/Gestor-de-Descargas-Firefox/js/popup.js)
- **Líneas ~1-100:** Inicialización, detección de modo (`?mode=sidebar` vs `?mode=popup`), chips de destinos rápidos (`renderW11List`, `loadQuickFolders`, `showInlineInput`).
- **Líneas ~101-300:** Estadísticas KPI (`updateKPIStats`), toggle de auto-organización, listeners de pestañas.
- **Líneas ~301-440:** Lógica de Desvío Forzado (`forceNextDownload`), sincronización reactiva en tiempo real con `storage.onChanged`, HUD Radar de estado activo (`showActiveForceView`, `showIdleForceView` con `display: flex` para preservar el `gap` vertical).
- **Líneas ~431-500:** Detección de vista dual, `loadHistory` (3 descargas en popup para ajuste perfecto sin scroll, 8 en sidebar).
- **Líneas ~501-670:** Vista previa de descargas recientes enriquecida (`renderRecentDownloadsPreview` con apertura directa de archivo en el SO por clic en título, badges por extensión, píldora de carpeta, hora, tamaño y fallback SVG).
- **Líneas ~671-1070:** Lógica de Drag & Drop y Cola de Descargas (`handleDrop`, `processSingleQueueItem`, `downloadAllQueue`).
- **Líneas ~1071-1180:** Renderizado visual de la cola (`renderQueueList`).
- **Líneas ~1181-1350:** Historial de descargas local (`loadHistory`, filtrado y eliminación de archivos fantasma).

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
5. **Empaquetar para Mozilla Add-ons (AMO):**
   - Ejecutar `python package.py` para generar un archivo `gestor-descargas-vX.X.X.zip` limpio.
   - **NUNCA** comprimir la carpeta entera con `.git/` porque Mozilla detecta los hooks (`.sample`) como binarios sospechosos.
