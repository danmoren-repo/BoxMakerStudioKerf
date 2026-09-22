# BoxMaker

## Qué es

BoxMaker es una herramienta web estática que genera el plano de corte (SVG) para una caja de seis paneles con juntas de espiga (finger joints / tabs) para cortar en una láser CO2. Se le dan las dimensiones, el grosor del material y el kerf, y calcula automáticamente el ancho de las espigas y la geometría de cada panel. Es solo HTML/CSS + JavaScript con ES modules nativos: no hay build step ni backend.

## Cómo usarlo en local

**Importante:** no funciona abrir `index.html` haciendo doble clic (una URL `file://`). Los ES modules nativos están bloqueados por las reglas CORS del navegador cuando el archivo se abre directamente desde el disco. Hace falta levantar un pequeño servidor web local.

Desde la carpeta del proyecto:

```bash
node dev-server.mjs
```

`dev-server.mjs` es un servidor estático de ~30 líneas incluido en el repo; solo sirve los archivos de esta carpeta y no se publica en producción. La alternativa clásica es `python3 -m http.server 8000`, que hace lo mismo (en carpetas sincronizadas como OneDrive a veces falla por permisos, y por eso el proyecto trae el suyo).

Luego abre http://localhost:8000 en el navegador.

## Los parámetros

| Campo | Default | Consejo práctico |
|---|---|---|
| Largo (mm) | 200 | Dimensión en X. |
| Ancho (mm) | 150 | Dimensión en Y. |
| Alto (mm) | 80 | Dimensión en Z. |
| Medidas: Exteriores / Interiores | Exteriores | "Exteriores" = la caja terminada mide esto por fuera. "Interiores" = el espacio útil dentro mide esto (BoxMaker suma el grosor del material a cada lado). |
| Tapa: Con espigas / Plana / Deslizante / Con bisagra | Con espigas | "Con espigas": la tapa encaja dentro como el resto de las piezas. "Plana": un rectángulo liso que se apoya sobre el canto de las paredes; el alto total y el espacio interior no cambian. "Deslizante": la tapa corre dentro de un canal vaciado en laterales y fondo. "Con bisagra": la tapa queda unida por una bisagra hecha del mismo material — dos espigas en el canto trasero encajan en un agujero en cada lateral — y gira sobre el canto trasero hasta pegar contra el fondo. Las cuatro paredes miden lo mismo que con la tapa plana, salvo un poste que sobresale en la esquina trasera de cada lateral para dejarle material alrededor al agujero. |
| Diámetro de la espiga (mm) | 4× el grosor | Solo con tapa con bisagra. El disco que hace de eje de la bisagra. Con "Automático" marcada sigue al grosor del material. |
| Holgura del agujero (mm) | 1 | Solo con tapa con bisagra. Cuánto más grande se dibuja el agujero que la espiga, para que gire sin trabarse. Se calibra con una prueba antes de cortar la caja: dura si es poca, bamboleante si es mucha. |
| Ancho de la manija (mm) | 20 | Solo con tapa con bisagra. Ancho de la lengüeta que sobresale del canto delantero de la tapa y de la muesca a juego en la pared frontal. |
| Profundidad de la manija (mm) | 6 | Solo con tapa con bisagra. Cuánto sobresale la lengüeta más allá del perímetro de la caja. |
| Grosor de la tapa (mm) | el del material | Solo con tapa deslizante. Con la casilla "Igual que el material" marcada copia el grosor de las paredes. Desmárcala para una caja de 10 mm con tapa de 3, o una tapa de acrílico sobre caja de madera. |
| Profundidad del canal (mm) | la mitad de la pared, máximo 6 | Solo con tapa deslizante. Cuánto muerde el canal hacia dentro de la pared. Con "Automática" marcada es la mitad del grosor, con tope de 6 mm para no fresar de más en maciza gruesa. Nunca puede llegar al grosor completo: atravesaría la pared. |
| Holgura de deslizamiento (mm) | 0.2 | Solo con tapa deslizante. Cuánto más alto se dibuja el canal que la tapa para que corra sin trabarse. Es un número aparte del kerf a propósito: el kerf compensa un corte pasante y el canal es un vaciado, así que recalibrar uno no debe mover el otro. Calíbrala con un recorte antes de cortar la caja entera. |
| Grosor del material (mm) | 3 | El espesor real de tu plancha (MDF, contrachapado, acrílico, etc.). |
| Kerf (mm) | 0.15 | Es el ancho que se come el láser al cortar. Se calibra con un corte de prueba. Referencia orientativa: MDF 3 mm ≈ 0.10–0.20 mm, acrílico ≈ 0.15–0.25 mm. Debe ser siempre menor que el grosor del material. |
| Auto (ancho de espiga) | activado | Cuando está activo, calcula el ancho de la espiga (tab) por ti con la regla de abajo. Desactívalo para fijar un valor manual. |
| Ancho de espiga / tab (mm) | 18 (solo se usa si Auto está apagado) | Con Auto activo se ignora este valor y se recalcula. |

**Regla del ancho de espiga automático** (`autoTabWidthFromSpans` en `js/boxes/shared.js`, que cada tipo de caja llama con sus propias aristas): aproximadamente 3 veces el grosor del material, nunca por debajo de 6 mm, y siempre lo bastante pequeño para que la arista más corta de la caja quede con al menos 3 segmentos de espiga.

## Cómo se corta

El SVG exportado está en milímetros reales: el `width`/`height` del SVG llevan el sufijo `mm` y el `viewBox` repite los mismos números, así que 1 unidad = 1 mm al abrirlo en Inkscape, LightBurn o software equivalente — no hace falta reescalar nada.

El archivo tiene estos grupos:
- **`#cut`** (negro): los trazos de corte de cada panel (lo que la láser debe cortar de lado a lado).
- **`#engrave`** (rojo): solo con tapa deslizante. Los tres canales por donde corre la tapa. **Esto no se corta: se vacía** a la profundidad indicada en el resumen, con grabado láser, con fresa en un CNC o a mano. Si mandas este grupo a corte pasante, arruinas las tres piezas.
- **`#labels`**: el nombre de cada panel (BOTTOM, FRONT, LEFT, etc.), pensado solo como referencia visual para armar la caja. Este grupo hay que apagarlo o borrarlo antes de cortar, porque si no la láser grabaría (engraving) ese texto sobre el material.

Los grupos van con nombre de capa de Inkscape (*Corte* y *Grabado*), y LightBurn los reparte en capas distintas al importar porque llevan colores distintos.

Con un material nuevo, lo primero es hacer un corte de prueba en cartón para calibrar el valor de kerf antes de cortar la pieza final.

## Cómo está hecho

- `js/core/` — geometría pura (segmentación de juntas, kerf, puntos de un panel). No sabe nada sobre "cajas": son funciones matemáticas reutilizables.
- `js/boxes/` — los tipos de caja concretos: `simple-box.js` (caja cerrada y tapa plana), `sliding-box.js` (tapa deslizante), `hinged-box.js` (tapa con bisagra) y `shared.js` con lo que todos comparten.
- `js/render/` — convierte la geometría en el SVG final (layout en la hoja, unidades en mm, exportación del archivo).
- `js/ui/` — conecta el formulario HTML con todo lo anterior: lee los parámetros, recalcula en vivo y genera el nombre del archivo al descargar.

Está separado así para que un futuro tipo de caja (por ejemplo una con tapa de bisagra) pueda reusar `js/core` sin tocarlo.

## Verificación

Con el servidor local corriendo, abre http://localhost:8000/test.html. Es una página de self-checks que corre en el navegador y muestra una lista con cada prueba en verde (✔) o rojo (✘). Actualmente son **62 checks** (los de geometría compartida corren sobre los tres tipos de tapa que la comparten, más un bloque propio para la tapa con bisagra): cubren desde que `buildBox` no produzca errores con parámetros válidos, la segmentación de juntas, que las espigas macho encajen exactamente en las ranuras hembra, el efecto del kerf, el modo de medidas interiores, el ancho de espiga automático, hasta un barrido de combinaciones de parámetros para asegurarse de que nada produzca `NaN`.

Seis de esos checks vigilan específicamente las esquinas, que es donde este tipo de generador se rompe: que ninguna pieza tenga material más fino que el kerf (sería incortable), que las esquinas de las tapas frontales queden macizas, que una ranura que llega al borde lo haga sin dejar una lengüeta de medio kerf, que ningún contorno se doble sobre sí mismo (una línea recorrida dos veces = el láser cortando dos veces sobre el mismo sitio), que ninguna esquina quede sujeta por un puente de material más fino que el kerf (se caería al cortar), y que ninguna espiga del lateral invada la esquina por donde tiene que entrar la tapa deslizante (la tapa se quedaría a medio camino).

## Deploy a Cloudflare Pages

1. Conecta este repositorio en Cloudflare Pages.
2. Framework preset: **None**.
3. Build command: (vacío).
4. Build output directory: `/`.

No hace falta ninguna variable de entorno ni backend: es un sitio 100% estático.

## Qué falta (v2)

- Divisores internos.
- Vista 3D.
- Nesting automático de los paneles en la hoja.
- Split del plano por tamaño de la cama del láser.
- Unidades en pulgadas.
- Compensación de radio de fresa (*dogbone*) en las puntas del canal del fondo, para cortar la tapa deslizante en un router CNC.
- Generar el cupón de calibración de la holgura desde la propia aplicación.
- Tirador o muesca para el dedo en la tapa deslizante.
- Tope de apertura diseñado a un ángulo específico en la tapa con bisagra.
- Bisagra con varilla separada (dowel o metal) en vez de espiga integral.
