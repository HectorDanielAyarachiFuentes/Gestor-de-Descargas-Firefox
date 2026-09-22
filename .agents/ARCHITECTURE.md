# Arquitectura y Funcionamiento del Gestor de Descargas

Este documento detalla la arquitectura completa de la extensión **Gestor de Descargas para Firefox** (Manifest V3), explicando el flujo de datos, la estructura de directorios, el motor de reglas y los componentes de interfaz.

---

## 1. Visión General del Sistema

El objetivo de la extensión es organizar automáticamente todos los archivos que el usuario descarga en Firefox en subcarpetas inteligentes dentro de su carpeta de descargas (`Descargas/PDFs/`, `Descargas/Imágenes/`, `Descargas/Código/`, etc.), según el tipo de archivo, dominio de origen, nombre o reglas personalizadas.

Además, proporciona una interfaz moderna utilizable tanto como **popup emergente flotante** como en la **barra lateral de Firefox (Sidebar Pro)**, y una zona de arrastrar y soltar (Drag & Drop) para encolar imágenes de cualquier sitio web y descargarlas por lotes.

```
┌────────────────────────────────────────────────────────────────────────┐
│                          NAVEGADOR FIREFOX                             │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
       ┌───────────────────────────┼───────────────────────────┐
       ▼                           ▼                           ▼
┌──────────────┐          ┌─────────────────┐        ┌──────────────────┐
│ PÁGINAS WEB  │          │ POPUP / SIDEBAR │        │ PÁGINA DE AJUSTES│
│ (Content     │          │ (popup.html)    │        │ (options.html)   │
│  Script)     │          │                 │        │                  │
│              │          │ - Descargas     │        │ - Creador reglas │
│ - Drag&Drop  │          │ - Cola Imágenes │        │ - Categorías     │
│   de medios  │          │ - Historial     │        │ - Historial full │
└──────┬───────┘          └────────┬────────┘        └────────┬─────────┘
       │                           │                          │
       │ Mensajes / Storage        │ Mensajes / Storage       │ Storage
       └───────────────────┬───────┴──────────────────────────┘
                           ▼
              ┌─────────────────────────┐
              │     BACKGROUND (MV3)    │
              │     (background.js)     │
              │                         │
              │ - onDeterminingFilename │
              │ - rules-engine.js       │
              │ - contextMenus          │
              │ - notifications.js      │
              └────────────┬────────────┘
                           ▼
              ┌─────────────────────────┐
              │   storage.local (Disco) │
              │                         │
              │ - Reglas                │
              │ - Historial             │
              │ - Configuración         │
              └─────────────────────────┘
```

---

## 2. Flujo de Intercepción de Descargas

Cuando Firefox inicia cualquier descarga, el script en segundo plano ([`js/background.js`](file:///c:/Users/Ramoncito/.antigravity-ide/Gestor-de-Descargas-Firefox/js/background.js)) intercepta el evento a través de la API `browser.downloads.onDeterminingFilename`:

1. **Verificación de Organización:** Si `autoOrganize` está deshabilitado (`false`), la descarga procede sin modificaciones hacia la carpeta por defecto de Firefox.
2. **Prioridad 1 — Carpeta Forzada Próxima (`forceNextDownload`):**
   - Si el usuario activó "Forzar próxima descarga a carpeta" desde el popup, la descarga se dirige a dicha carpeta.
   - Si la opción "Solo para la próxima descarga" estaba marcada, el flag se limpia inmediatamente tras su uso.
3. **Prioridad 2 — Reglas Personalizadas (`customRules`):**
   - Se evalúan las reglas creadas por el usuario en orden de prioridad.
   - Criterios soportados: extensión de archivo, dominio de descarga, o coincidencia de texto en el nombre.
4. **Prioridad 3 — Categorías por Defecto ([`js/rules-engine.js`](file:///c:/Users/Ramoncito/.antigravity-ide/Gestor-de-Descargas-Firefox/js/rules-engine.js)):**
   - Si ninguna regla personalizada coincide, se examina la extensión del archivo.
   - Se clasifica en una de las 20 categorías predefinidas (`PDFs`, `Imágenes`, `Videos`, `Audio`, `Comprimidos`, `Documentos`, `Hojas de Cálculo`, `Presentaciones`, `Programas`, `Diseño`, `Código`, `Libros`, `3D`, `Fuentes`, etc.).
   - Se verifica que la categoría esté habilitada por el usuario en `defaultCategories`.
5. **Determinación del Nombre Final:**
   - Se genera la ruta relativa: `Subcarpeta/archivo.ext`.
   - Se responde a `suggest({ filename: rutaFinal, conflictAction: 'uniquify' })`.
6. **Registro en Historial y Notificación:**
   - La descarga finalizada se registra en `downloadHistory` con metadatos (fecha, tamaño, carpeta de destino, URL).
   - Si las notificaciones están activadas, se muestra una alerta visual informando la carpeta donde se guardó.

---

## 3. Estructura de Carpetas y Archivos

```
Gestor-de-Descargas-Firefox/
├── manifest.json              # Configuración Manifest V3 (Gecko)
├── AGENTS.md                  # Guía rápida para Agentes de IA y buenas prácticas
├── ARCHITECTURE.md            # Este documento explicativo
├── _locales/                  # Sistema de Internacionalización (i18n)
│   ├── es/messages.json       # Textos en Español
│   └── en/messages.json       # Textos en Inglés
├── assets/                    # Iconos y recursos gráficos
├── css/                       # Hojas de estilo modulares
│   ├── popup.css              # Estilos del Popup y de la Barra Lateral (Container Queries)
│   ├── options.css            # Estilos de la página de opciones
│   └── welcome.css            # Estilos de la pantalla de bienvenida
├── js/                        # Lógica modular en JavaScript (ES Modules)
│   ├── background.js          # Service worker / background script de intercepción
│   ├── constants.js           # Constantes y claves de almacenamiento
│   ├── content-script.js      # Inyección en páginas web para capturar imágenes
│   ├── notifications.js       # Notificaciones nativas
│   ├── options.js             # Controlador principal de la página de opciones
│   ├── options-rules.js       # Gestor del CRUD de reglas personalizadas
│   ├── options-history.js     # Gestor del historial detallado y exportaciones
│   ├── options-ui.js          # Control de pestañas y modales en opciones
│   ├── popup.js               # Controlador de interfaz del popup y barra lateral
│   ├── rules-engine.js        # Motor de resolución de carpetas por extensión
│   ├── storage.js             # Envoltorio seguro para storage.local
│   ├── theme-manager.js       # Detección y cambio de tema claro/oscuro
│   └── utils.js               # Funciones auxiliares (formateo de bytes, rutas, etc.)
└── pages/                     # Vistas HTML
    ├── popup.html             # Vista dual: Popup emergente y Barra Lateral
    ├── options.html           # Vista de Configuración avanzada
    └── welcome.html           # Vista de Bienvenida en primera instalación
```

---

## 4. Diseño de la Interfaz de Usuario (Dual Mode)

El archivo [`pages/popup.html`](file:///c:/Users/Ramoncito/.antigravity-ide/Gestor-de-Descargas-Firefox/pages/popup.html) está diseñado con una arquitectura responsiva única que se adapta automáticamente mediante la URL:

1. **Modo Popup (`popup.html?mode=popup`):**
   - Invocado al hacer clic en el botón de la barra de herramientas.
   - Ancho compacto fijo (~375px), optimizado para operaciones rápidas.
2. **Modo Barra Lateral (`popup.html?mode=sidebar`):**
   - Invocado en la barra lateral nativa de Firefox (`sidebar_action`).
   - Ancho elástico (desde ~260px hasta pantalla completa).
   - Se activan métricas PRO (`pro-stats-grid`) y las listas aprovechan el alto completo de la ventana (`max-height: calc(100vh - 220px)`).

### Cabecera Minimalista (Single-Row):
- En anchos compactos y barra lateral, la cabecera se mantiene en **una sola fila de ~38px** (logo + `Gestor de Descargas` + `PRO` a la izquierda, y el interruptor ON/OFF a la derecha).
- Se eliminan la división en 2 pisos y los textos redundantes para maximizar el área visible de descargas.

### Pestañas del Popup:
- **Pestaña 1: Descargas:** Interruptor maestro ON/OFF, indicadores KPI de organización, herramienta de "Forzar próxima descarga a carpeta", y vista previa de descargas recientes.
- **Pestaña 2: Imágenes:** Zona Drag & Drop interactiva, selector de destino (Reglas automáticas vs Carpeta personalizada), y Cola de Descargas con descarga individual o masiva ("Descargar Todas" / "Vaciar Cola").
- **Pestaña 3: Historial:** Buscador instantáneo, contador de descargas organizadas, y botones rápidos para abrir archivo o abrir la carpeta contenedora.
- **Pestaña 4: Ajustes:** Accesos directos a "Abrir Configuración Avanzada" y "Abrir Gestor en Pestaña", y consejos de compatibilidad (ej. visualizador de PDFs integrado de Firefox).

---

## 5. Esquema de Almacenamiento (`browser.storage.local`)

Las claves principales definidas en [`js/constants.js`](file:///c:/Users/Ramoncito/.antigravity-ide/Gestor-de-Descargas-Firefox/js/constants.js) son:

| Clave | Tipo | Descripción |
| :--- | :--- | :--- |
| `autoOrganize` | `boolean` | Estado global de la organización automática. |
| `customRules` | `Array<Rule>` | Lista de reglas definidas por el usuario `{ id, name, matchType, value, folder, enabled }`. |
| `defaultCategories` | `Object` | Mapa de categorías booleanas activas `{ pdf: true, images: true, ... }`. |
| `forceNextDownload` | `Object` | Configuración temporal `{ enabled, folder, once }`. |
| `downloadHistory` | `Array<Item>` | Registro de descargas procesadas `{ id, filename, folder, date, size, url }`. |
| `downloadQueue` | `Array<Item>` | Elementos en cola de descarga pendientes de confirmación. |
| `notifications` | `boolean` | Si se muestran notificaciones nativas tras una descarga. |

---

## 6. Mantenimiento y Extensibilidad

* Para **agregar una nueva categoría de archivos**, edita [`js/rules-engine.js`](file:///c:/Users/Ramoncito/.antigravity-ide/Gestor-de-Descargas-Firefox/js/rules-engine.js) añadiendo las extensiones deseadas y sus claves en `_locales/es/messages.json`.
* Para **modificar estilos responsivos**, consulta la sección 2 de [`AGENTS.md`](file:///c:/Users/Ramoncito/.antigravity-ide/Gestor-de-Descargas-Firefox/AGENTS.md) para garantizar que las tarjetas en flexbox mantengan `flex-shrink: 0; min-height: min-content;`.
