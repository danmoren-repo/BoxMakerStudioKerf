# CLAUDE.md — BoxMaker

## Reparto con Codex

El plugin de Codex está instalado. El trabajo se reparte así.

Te quedas tú (Claude):
- Entender el problema y preguntar lo que falte.
- Planear los pasos antes de tocar archivos.
- Decidir la arquitectura y los límites de cada cambio.
- Revisar todo lo que vuelva de Codex.

Se le pasa a Codex, con el subagente codex-rescue y sin esperar a que
te lo pida:
- Construcción repetitiva y larga.
- Refactors grandes que tocan muchos archivos.
- Errores atorados que ya se intentaron una vez.

Reglas fijas:
- Nada de lo que vuelve de Codex se da por bueno sin revisar.
- Si Codex falla dos veces en la misma tarea, la tarea regresa a ti.
- Delegar no es desentenderse: dime qué pediste y qué volvió.

Si se agotan los créditos de Codex, sigo trabajando yo solo, tanto como orquestador como ejecutor, sin depender de Codex.
