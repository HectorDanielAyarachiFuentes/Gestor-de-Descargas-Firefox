# Reglas Obligatorias del Proyecto (Gestor de Descargas Firefox)

1. **Lectura Previa Obligatoria:**
   - La IA DEBE consultar [.agents/AGENTS.md](file:///c:/Users/Ramoncito/.antigravity-ide/Gestor-de-Descargas-Firefox/.agents/AGENTS.md) y [.agents/ARCHITECTURE.md](file:///c:/Users/Ramoncito/.antigravity-ide/Gestor-de-Descargas-Firefox/.agents/ARCHITECTURE.md) antes de analizar código o aplicar cambios.
   - Utilizar el mapa de responsabilidades para ir directamente al archivo correspondiente y ahorrar tokens.

2. **Actualización Obligatoria de Documentación (Living Docs):**
   - Cada vez que se realice un cambio en CSS, JS, HTML o Manifest, la IA debe actualizar de manera síncrona los documentos en la carpeta `.agents/` para que reflejen el nuevo estado del proyecto.

3. **Prevención de Regresiones en Listas y Flexbox:**
   - Todo elemento hijo en listas con scroll (`.queue-list`, `.popup-history`, etc.) debe tener `flex-shrink: 0; min-height: min-content;` para que flexbox jamás los aplaste verticalmente.
   - Envolvitorios de título y contador (`.queue-title-wrapper`) nunca deben usar `justify-content: space-between`.
