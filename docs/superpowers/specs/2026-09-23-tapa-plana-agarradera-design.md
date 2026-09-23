# Tapa plana con agarradera — diseño

Fecha: 2026-09-23
Estado: aprobado con Dani (mecanismo simplificado del vástago)

## Qué se construye

Una opción nueva, opcional, para la tapa "Plana" ya existente: una casilla
"Agarradera" que, al marcarla, agrega una perilla redonda armada en el
centro de la tapa. Sin marcarla, la tapa plana se comporta exactamente
igual que hoy — esto no es un tipo de tapa nuevo, es un agregado opcional
al que ya existe.

Se originó de un archivo de referencia (`EjemploSVG/Tapa plana con
agarradera.svg`, generado por otra herramienta, "BoxDesigner") que Dani
mandó como ejemplo. Ese archivo trae, además de la agarradera, una caja
completa con divisores internos — eso queda fuera de este feature, es
material para otro más adelante.

Se analizó la geometría exacta del archivo de referencia (coordenadas,
arcos y radios, no solo la forma a ojo) antes de diseñar la versión
propia. Esa referencia resultó ser:

- Una tapa de dos capas: una exterior (del tamaño de siempre, apoyada
  sobre las paredes) y un inserto liso pegado por debajo, del tamaño
  exacto del hueco interno de la caja.
- Un agujero en forma de cruz cortado cerca del centro de cada capa.
- Una perilla armada de DOS piezas en forma de domo (medio círculo), cada
  una con un vástago rectangular por debajo, que se encastran entre sí a
  90° (una especie de unión "media madera" en cruz) y bajan juntas,
  ajustadas a presión, a través de los dos agujeros en cruz. El domo,
  más ancho que el agujero, queda apoyado arriba y no puede pasar.

Dani eligió replicar el mecanismo completo (no una versión reducida a un
simple agujero o muesca), con una simplificación propia: en el original
el vástago tiene DOS escalones de ancho distinto (uno para cada capa);
acá se usa un solo ancho de vástago constante, repetido igual en las dos
capas — más simple de construir, mismo principio.

## Decisiones tomadas

| Decisión | Resuelto |
|---|---|
| Alcance | Opción opcional sobre la tapa "Plana" existente, no un tipo de tapa nuevo |
| Divisores internos del archivo de referencia | Fuera de alcance — se ignoran, quedan para otro feature |
| Esquinas redondeadas de la tapa/inserto (vistas en la referencia) | Rectas — mismo estilo que el resto de BoxMaker, sin geometría nueva solo por estética |
| Holgura extra para que el inserto entre en el hueco interno | Ninguna — el inserto mide exactamente `spanX × spanY` (el hueco interno real); el margen natural que deja el kerf al cortar alcanza |
| Vástago de la perilla | Ancho constante (una sola medida de agujero en cruz para las dos capas), en vez de los dos escalones del original |
| Assembler de la perilla | Dos piezas en domo que se cruzan a 90° con una ranura de media altura cada una — mismo principio que el original, adaptado al vástago de ancho único |

## Geometría

### Nomenclatura

Nueva, específica de este feature (para no mezclarse con `handleWidth`/
`handleDepth`, que ya nombran la manija de la bisagra):

- `t` — grosor del material (existente).
- `Lo`, `Wo` — largo/ancho exteriores de la caja (existentes).
- `spanX = Lo − 2t`, `spanY = Wo − 2t` — hueco interno real (existentes).
- `gd` (`gripDiameter`) — diámetro del domo de la perilla. Parámetro
  nuevo, sin fórmula automática (no se deriva del grosor del material,
  es un tamaño de agarre a criterio — igual que `handleWidth` de la
  bisagra, que tampoco sigue una fórmula). Default 30 mm.
- `gs` (`gripStemSpan`) — ancho del vástago/agujero en cruz (de brazo a
  brazo opuesto, igual en las dos direcciones — el agujero es una cruz
  simétrica, un "+"). Parámetro nuevo. Default 16 mm.
- `R = gd / 2` — radio del domo.
- `D = 2t` — profundidad del vástago (una espesor de material por cada
  capa que atraviesa: la tapa exterior y el inserto).
- `EDGE_MARGIN` — se reutiliza la misma constante ya definida en
  `hinged-box.js` (2 mm), importada, no duplicada.

El ancho de la ranura de encastre y el ancho de cada brazo del agujero en
cruz siempre es `t` (el grosor del material) — no son campos nuevos,
mismo principio ya usado en la bisagra (la espiga es del mismo grosor que
el material).

### Las dos capas de la tapa

- **TOP** (existente, sin cambios de tamaño: `Lo × Wo`, apoyada sobre las
  paredes igual que hoy). Con la agarradera activada, se le agrega un
  agujero en cruz centrado (`Lo/2, Wo/2`), brazos de `gs` mm, grosor de
  brazo `t`.
- **TOP-INSERT** (nueva): rectángulo liso de `spanX × spanY` — el hueco
  interno exacto, sin holgura extra (ver tabla de decisiones). Se pega
  por debajo de TOP, centrado, así que su agujero en cruz (centrado en
  `spanX/2, spanY/2`) queda alineado con el de TOP. Mismas medidas de
  agujero que TOP: brazos `gs`, grosor `t`.

Las dos capas usan el mismo mecanismo de agujero ya probado para los
agujeros redondos de la bisagra: un lazo cerrado independiente
(`features`, `kind: 'hole'`), no un contorno con un canal tallado hacia
adentro. Es la misma técnica de bajo riesgo, solo que con una forma de
cruz en vez de un círculo — evita por completo la topología de
"polígono con agujero" que costó tres rondas de arreglos en el diseño
original de la bisagra simple.

### La perilla (HANDLE-A y HANDLE-B)

Cada pieza es un domo (medio círculo, radio `R`, 180°) con un vástago
rectangular de ancho `gs` y profundidad `D` colgando de su base. Las dos
piezas son idénticas en su silueta exterior; lo único que cambia entre
ellas es dónde y cómo se corta la ranura de encastre.

Altura total de cada pieza (de la punta del domo al fondo del vástago):
`H = R + D`. El plano de unión entre las dos piezas queda a la mitad de
esa altura total, medido en la pared de la ranura (`x = ±t/2`, no en el
centro `x=0`) — mismo criterio que el archivo de referencia, que hace
que las dos piezas terminen exactamente al ras (mismo canto inferior,
misma punta) en vez de calzar con un escalón.

Con `R > D` (el caso normal: el domo suele ser más grande que dos
grosores de material), ese plano de unión cae **por encima** de la línea
base, dentro de la zona del domo — no dentro del vástago. Esto obliga a
que una de las dos ranuras se abra a través de la curva del domo, no solo
del vástago recto:

- **HANDLE-A** — ranura recta simple: se abre en el canto libre de abajo
  (el fondo del vástago, una línea recta ya existente) y sube hasta el
  plano de unión. Solo son líneas rectas, sin ningún cálculo de arco —
  igual de simple que cualquier otro bulto/muesca ya construido en este
  proyecto.
- **HANDLE-B** — ranura que se abre en la punta del domo: como la punta
  es una curva, no una línea recta, hace falta un cálculo (cerrado,
  exacto, sin iteración) para saber dónde las dos paredes de la ranura
  (en `x = ±t/2`) cruzan esa curva: `y = −√(R² − (t/2)²)` medido desde la
  línea base. Ese punto reemplaza un tramo chico del arco por las dos
  paredes rectas de la ranura — mismo tipo de construcción de arco por
  tramos que ya usa `handleCapPoints` en `hinged-box.js` para la punta
  redondeada de la manija de la bisagra, solo que acá el arco se parte en
  dos mitades en vez de recortarse en una punta.

Las dos ranuras miden `t` de ancho y llegan al mismo plano de unión, así
que las dos piezas quedan exactamente al ras al armarlas — ninguna sobra
ni falta material en la costura.

### Ejemplo de referencia

Caja 80×80×80 exteriores, `t = 3`, `gd = 30`, `gs = 16` (valores por
defecto):

| Medida | Valor |
|---|---|
| `spanX`, `spanY` (tamaño del inserto) | 74 × 74 |
| `R` (radio del domo) | 15 |
| `D` (profundidad del vástago) | 6 |
| `H` (altura total de cada pieza) | 21 |
| Plano de unión (desde la línea base, negativo = hacia la punta) | −4.5 (dentro del domo) |
| HANDLE-A: ranura desde `y=6` hasta `y=−4.5` | 10.5 mm de largo, 3 mm de ancho |
| HANDLE-B: ranura desde `y≈−14.9248` (cruce con el arco) hasta `y=−4.5` | ≈10.4248 mm de largo, 3 mm de ancho |
| Reborde del domo apoyado sobre la tapa (`(gd−gs)/2`) | 7 mm por lado |

## Validaciones

### Errores

| Condición | Mensaje |
|---|---|
| `gd <= 0` | El diámetro de la perilla debe ser mayor que 0. |
| `gs <= 0` | El ancho del agujero en cruz debe ser mayor que 0. |
| La ranura no deja material a los costados dentro del vástago: `gs <= t + 2·EDGE_MARGIN` | El vástago de la perilla es demasiado angosto para el grosor de material: no queda pared a los costados de la ranura. |
| El domo no sobresale lo suficiente del agujero: `gd <= gs + 2·EDGE_MARGIN` | La perilla es demasiado chica (o el agujero demasiado ancho): el domo no alcanza a apoyarse sobre la tapa. |
| El agujero no entra en el inserto con margen: `gs + 2·EDGE_MARGIN >= min(spanX, spanY)` | El material es demasiado grueso, o la perilla demasiado ancha, para una caja de este tamaño: el agujero no cabe dentro del hueco interno. |

### Avisos

| Condición | Aviso |
|---|---|
| Reborde del domo chico: `(gd − gs) / 2 < 5` | El reborde de la perilla va a quedar angosto: puede costar agarrarla. |

Se mantienen los errores y avisos actuales (dimensiones, kerf vs grosor,
espigas de junta vs kerf) sin cambios.

## Qué NO cambia

- El resto de la tapa plana (tamaño de TOP, paredes acortadas un grosor,
  todo lo demás) sigue exactamente igual que hoy cuando la casilla está
  desmarcada.
- Ningún otro tipo de tapa (con espigas, deslizante, con bisagra, con
  bisagra doble) se toca.
- Sin holgura calibrable nueva para el inserto (decisión tomada arriba).
- Sin esquinas redondeadas (decisión tomada arriba).
- Sin refuerzo, pestillo ni ningún mecanismo de cierre — es una perilla
  para agarrar y levantar la tapa, nada más.

## Módulos

- `js/boxes/simple-box.js` — se extiende `buildBox()` para agregar,
  cuando `lidType === 'flat'` y la agarradera está activada, el agujero
  en cruz de TOP y las tres piezas nuevas (TOP-INSERT, HANDLE-A,
  HANDLE-B).
- `js/boxes/lid-grip.js` (nuevo) — la geometría propia de la perilla
  (HANDLE-A/HANDLE-B) y del agujero en cruz, que `simple-box.js` importa
  y usa solo cuando `lidType === 'flat'` y la agarradera está activada.
  Mismo patrón de separación que `hinged-box.js`/`hinged-double-box.js`:
  no engordar `simple-box.js` con geometría que no comparte con la tapa
  con espigas.
- `js/core/panel.js` — sin cambios (`holeFeature` ya resuelve el patrón
  de agujero independiente; el agujero en cruz reusa ese mismo patrón,
  con su propia forma en vez de un círculo).
- `js/ui/app.js` / `index.html` — casilla "Agarradera" y campos de
  diámetro/ancho de agujero, visibles solo con tapa "Plana" seleccionada.

## Qué falta (futuro, no en este feature)

- Divisores internos (del archivo de referencia, explícitamente fuera de
  alcance acá).
- Esquinas redondeadas, si en algún momento se pide como estilo aparte.
