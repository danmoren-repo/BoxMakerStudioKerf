# Tapa con bisagra doble — diseño

Fecha: 2026-09-23
Estado: aprobado con Dani (mecanismo + simplificación del refuerzo)

## Qué se construye

Un quinto tipo de tapa para BoxMaker: la tapa de arriba se parte en dos mitades
iguales, cada una unida a la caja por su propia bisagra integral (mismo
mecanismo de espiga cuadrada que la tapa con bisagra ya implementada), pero
en vez de una sola tapa girando sobre el canto trasero, cada mitad gira sobre
un eje que corre de adelante hacia atrás, pegado a su propia pared lateral.
Las dos mitades se abren como dos alas hacia afuera y se encuentran en el
medio. Donde se encuentran, cada una lleva una lengüeta que sobresale tanto
por el frente como por el fondo, pasando por una muesca en cada una de esas
dos paredes — esa lengüeta hace de tirador y de tope a la vez.

Se originó de un archivo de referencia (`EjemploSVG/Ejemplo tapa a la
mitad.svg`, generado por otra herramienta) que Dani mandó como ejemplo, y de
una revisión geométrica exhaustiva de ese archivo (medidas, no nombres de
capa, porque la otra herramienta usa una convención de ejes distinta a la
nuestra). Reutiliza casi todos los parámetros y fórmulas de la tapa con
bisagra ya implementada — lo que cambia es dónde y cómo se usan, y que las
paredes frontal/trasera ya no se acortan (quedan a la altura completa, y las
mitades de la tapa encajan a ras, no apoyadas encima).

## Decisiones tomadas

| Decisión | Resuelto |
|---|---|
| Sigue siendo la tapa de arriba, partida en dos | Sí — no es un gabinete con puertas laterales, confirmado con Dani |
| Ajuste de las mitades | A ras con las paredes (paredes de altura completa), no apoyadas encima — Dani lo prefirió explícitamente sobre mantener el estilo "apoyada" de la bisagra simple |
| Mecanismo de giro | Mismo que la bisagra simple: espiga cuadrada maciza integral, sin varilla aparte |
| Cuántas espigas por mitad | Dos — una entra a la pared frontal, otra a la trasera (no a los laterales) |
| Eje de giro de cada mitad | Corre de adelante hacia atrás, pegado a la esquina de SU propio lateral (la mitad izquierda gira cerca del lateral izquierdo, la derecha cerca del derecho) |
| Dónde se encuentran las dos mitades | En el medio del largo de la caja, sin espiga ni bisagra ahí — el tope es la lengüeta, no un mecanismo de giro |
| Tirador/tope | Una lengüeta por mitad, en el canto donde se encuentran, que sobresale por el frente Y el fondo a la vez, pasando por una muesca en cada pared |
| Refuerzo redondeado de la lengüeta (visto en la referencia) | Omitido — esquinas simples, sin el "gusset" reforzado. Dani lo aprobó para no meter riesgo geométrico innecesario; si una pieza cortada se ve frágil ahí, se agrega después |
| Laterales (paredes izquierda/derecha) | Sin cambios especiales — paredes simples de altura completa, sin agujeros ni postes |

## Geometría

### Nomenclatura

Reutiliza la nomenclatura de la tapa con bisagra simple donde aplica:

- Ejes: X = largo, Y = ancho (frente→fondo), Z = alto. z = 0 es la cara
  inferior de la base.
- `t` grosor del material · `tl` grosor de cada mitad de la tapa (propio,
  default = `t`, mismo parámetro `lidThicknessFor` ya existente).
- `Lo`, `Wo`, `Ho` dimensiones exteriores.
- `ps` tamaño de la espiga (cuadrado macizo, default = `t`) · `hc` holgura
  del agujero · `dh = √(ps² + tl²) + hc` diámetro del agujero (mismas
  fórmulas y mismos parámetros ya implementados en `hinged-box.js`, se
  reutilizan tal cual — ver ese archivo para el porqué de la diagonal).
- `em` (`EDGE_MARGIN`) margen mínimo de material alrededor de cualquier
  corte, ya existente.
- `hw`, `hd` ancho y profundidad de la lengüeta (mismos parámetros que la
  manija de la bisagra simple, `handleWidthFor`/`handleDepthFor`, se
  reutilizan). `hw` es el ancho TOTAL de la muesca en cada pared — cada
  mitad aporta `hw / 2` desde su lado.

### Por qué las paredes frontal y trasera no se acortan

A diferencia de la bisagra simple (donde la tapa se apoya ENCIMA de paredes
acortadas un grosor), acá las dos mitades encajan A RAS con la abertura —
igual que cualquier panel que se apoyara sobre el canto en vez de adentro.
Por eso las paredes frontal y trasera quedan a la altura completa `Ho`, no
`Ho − tl`.

### Por qué de todas formas hace falta un poste

La espiga sigue siendo plana y viviendo a media altura de la mitad cerrada
(igual que antes). Con la pared YA a la altura completa, el canto superior
natural de la pared (`z = Ho`) casi alcanza esa altura — pero el agujero
(radio `rh`) generalmente se pasa un poco por encima de ese canto, porque
`rh` es mayor que `tl / 2` (la mitad del grosor de la puerta) casi siempre:
la diagonal `√(ps² + tl²)` ya es mayor que `tl` solo por el término `ps²`,
así que `rh` crece más rápido que `tl / 2`. Por eso sigue haciendo falta un
poste — mucho más bajo que el de la bisagra simple, porque acá solo cubre
esa diferencia, no el grosor entero de la tapa.

- Altura del centro del agujero medida desde el canto superior de la pared
  (que ya está a `Ho`), contando hacia abajo: `tl / 2`.
- Cuánto se pasa el agujero por encima del canto: `rh − tl / 2`.
- Altura del poste (lo que sobresale por encima del canto superior de la
  pared): `pp = (rh − tl / 2) + em`.
- Altura total de la pared frontal/trasera en cada esquina con poste:
  `Ho + pp`.
- El resto de la pared (fuera de los dos postes) queda a `Ho` liso.

### Planta

Igual que las demás cajas: base `Lo − 2t` × `Wo − 2t` por dentro. Cada mitad
de la tapa mide `(Lo − 2t) / 2` de ancho (X) por `Wo − 2t` de profundidad
(Y) — el ancho de la abertura interior partido en dos, y la profundidad
completa (a ras con el hueco, de canto a canto).

### Espiga y poste (en las paredes frontal y trasera)

- Cada pared (frontal y trasera) lleva DOS postes, uno cerca de cada
  extremo — no uno solo como en la bisagra simple.
- El poste ocupa, en el canto superior de la pared, una franja de ancho
  `dh + 2·em` (mismo `postWidth` ya usado), centrada en la posición del
  agujero que le toca.
- Posición del agujero a lo largo de la pared (medida desde el extremo más
  cercano): `em + rh` — misma fórmula que ya usa la bisagra simple para
  posicionar su agujero cerca de la esquina, reutilizada acá para
  posicionarlo cerca de CADA extremo de la pared frontal/trasera.
- El agujero es un círculo de diámetro `dh`, centrado en esa franja, a
  `tl / 2` del canto superior de la pared.
- Construcción: como la pared ya está a su altura completa, el poste es
  simplemente un bulto que sobresale por encima del canto superior — la
  misma técnica simple ya usada para la manija (un bulto sobre un canto
  recto), no la topología de "hueco dentro de polígono" que hizo falta
  para la espiga de la bisagra simple (esa complejidad venía de que la
  pared estaba acortada primero; acá no lo está).

### Espiga de cada mitad de la tapa

- Cada mitad es un rectángulo liso `(Lo − 2t) / 2` × `Wo − 2t`, con dos
  espigas cuadradas macizas (lado `ps`) pegadas por fuera: una en el canto
  que da al frente, otra en el que da al fondo — no en los cantos
  laterales.
- Posición a lo largo de esos cantos: `em + rh` desde el canto EXTERIOR de
  la mitad (el que está pegado a la pared lateral de la caja) — misma
  fórmula que la posición del agujero en la pared, para que el centro de
  la espiga coincida con el centro del agujero en coordenadas absolutas.
- Sin entalle, sin arco, sin hueco: es un cuadrado macizo pegado
  directamente al canto, igual que la espiga de la bisagra simple (que ya
  se rediseñó para ser así en vez de un disco dentro de un entalle).

### Lengüeta (tirador y tope)

- Cada mitad lleva una lengüeta en su canto INTERIOR (el que da hacia la
  otra mitad, donde se encuentran), de ancho `hw / 2` y que sobresale `hd`
  más allá TANTO del canto que da al frente COMO del canto que da al
  fondo — dos bultos simples, uno en cada uno de esos dos cantos, ambos
  ubicados en la misma franja X (pegados al canto interior de la mitad).
- Sin refuerzo redondeado en la base (decisión tomada arriba) — esquinas
  rectas simples. Sí se redondea la PUNTA de la lengüeta (radio `hr`,
  mismo parámetro `handleCornerRadiusFor` ya existente), igual que la
  manija de la bisagra simple, para mantener el mismo estilo visual.
- Las paredes frontal y trasera llevan, cada una, UNA muesca centrada en
  `Lo / 2`, de ancho `hw` (la suma de lo que aporta cada mitad) y
  profundidad `hd`, cortada hacia adentro desde su canto superior — misma
  idea que la muesca de la manija de la bisagra simple, solo que acá hace
  falta en las DOS paredes (frontal y trasera), no solo en una.
- Cerrada la caja, las dos lengüetas —una de cada mitad— asoman juntas por
  esa muesca: entre las dos forman el tirador, y como no hay ningún otro
  apoyo en el canto donde se encuentran las dos mitades, la lengüeta
  apoyada en el piso de la muesca es lo único que evita que esa mitad se
  caiga hacia adentro de la caja.

### Ejemplo de referencia

80 × 80 × 80 exteriores, `t = 3`, `tl = 3`, `ps = 3`, `hc = 1`, `em = 2`,
`hw = 20`, `hd = 8`, `hr = 2`:

| | |
|---|---|
| Suelo a canto superior de paredes frontal/trasera/laterales | 80 (altura completa, no acortada) |
| Laterales (izquierda/derecha) | 74 × 80, lisas |
| Frontal/trasera, fuera de los postes | 74 × 80 |
| Frontal/trasera, altura en cada poste | 74 × 83.1213 |
| Agujero | diámetro 5.2426 (√(3² + 3²) + 1), centro a `t/2` = 1.5 mm bajo el canto superior de la pared |
| Cada mitad de la tapa | 37 × 74 |
| Espiga | cuadrado macizo de 3 × 3 mm, a 4.6213 mm (`em + rh`) del canto exterior de cada mitad |
| Lengüeta | 10 × 8 mm por mitad (`hw/2` × `hd`), punta con radio 2 |
| Muesca en frontal/trasera | 20 × 8 mm, centrada en X = 40 |

## Modelo de datos

No hace falta ningún tipo de feature nuevo — reutiliza `holeFeature()` tal
cual está. Toda la geometría de este tipo de tapa se arma con la misma
técnica ya probada de "bulto o muesca simple sobre un canto recto" (la
usada para la manija y, después del rediseño, para la espiga de la bisagra
simple) — nunca la topología de "polígono con agujero" que hizo falta (y
dio tres rondas de arreglos) para el diseño original de la espiga en disco.
Eso es importante: significa que esta tapa nueva es más simple de construir
correctamente que la bisagra simple ya implementada, no más compleja, pese
a tener el doble de piezas móviles.

`panelOutline()` no cambia. Las paredes frontal/trasera y las dos mitades
de la tapa arman su contorno a mano, como ya hacen `buildFrontWall` y
`lidWithPegs` en `hinged-box.js`.

## Salida SVG

Dos grupos, igual que las otras tapas con bisagra: `id="cut"` (`#000000`) e
`id="engrave"` (`#e5484d`, sin usar acá) — los agujeros de bisagra van en
corte, no en grabado, igual que la bisagra simple.

## Parámetros de interfaz

`lidType` gana la opción `hingedDouble`. Reutiliza EXACTAMENTE los mismos
campos que la bisagra simple (tamaño de espiga, holgura del agujero, ancho
y profundidad de la manija/lengüeta) — mismos valores por defecto, mismo
comportamiento "Automático". No hay campos nuevos.

| Campo | Default | Comportamiento |
|---|---|---|
| Grosor de cada mitad | = grosor del material | Igual que la bisagra simple |
| Tamaño de la espiga | `t` | Igual que la bisagra simple |
| Holgura del agujero | 1 mm | Igual que la bisagra simple |
| Ancho de la lengüeta (total, entre las dos mitades) | 20 mm | Igual que la bisagra simple |
| Profundidad de la lengüeta | `t + 5` mm | Igual que la bisagra simple |

Otros cambios de interfaz, mismo patrón que las demás tapas: sufijo de
archivo (a definir, p.ej. `-bisagra-doble`), radio nuevo en el grupo de
Tapa.

## Validaciones

### Errores

Mismas reglas que la bisagra simple, adaptadas donde el ancho relevante ya
no es `Lo` sino la mitad:

| Condición | Mensaje |
|---|---|
| `tl <= 0` | El grosor de la tapa debe ser mayor que 0. |
| `ps <= 0` | El tamaño de la espiga debe ser mayor que 0. |
| `hc < 0` | La holgura del agujero no puede ser negativa. |
| `hw <= 0` | El ancho de la lengüeta debe ser mayor que 0. |
| `hd <= 0` | La profundidad de la lengüeta debe ser mayor que 0. |
| La lengüeta (`hw`) no deja pared a los costados de cada muesca: `hw + 2·em >= Lo` | La lengüeta es demasiado ancha para el frente: no deja pared a los costados. |
| Cada mitad de la tapa queda demasiado angosta para sus dos espigas: `(Lo − 2t) / 2 <= 0` o no le cabe la espiga | El material es demasiado grueso para una caja de este largo: no queda espacio para las dos mitades de la tapa. |

### Avisos

| Condición | Aviso |
|---|---|
| `hc` muy chica | La bisagra va a quedar dura, puede no girar. |
| `hc` muy grande | La bisagra va a quedar floja, con bamboleo notorio. |
| Poco material alrededor del agujero (material grueso) | Revisa el tamaño de espiga. |
| Los dos postes de una misma pared (frontal o trasera) no caben sin superponerse — caja corta | Los postes de las dos esquinas se pisan: baja el tamaño de espiga, la holgura, o el margen. |
| La lengüeta cerca del umbral de choque con los postes | Puede quedar muy cerca del borde. |

Se mantienen los errores y avisos actuales (dimensiones, kerf vs grosor,
espigas de junta vs kerf).

## Módulos

- `js/boxes/hinged-double-box.js` — nuevo, siguiendo el patrón de
  `hinged-box.js`. Importa y reutiliza directamente `pegSizeFor`,
  `hingeClearanceFor`, `EDGE_MARGIN`, `handleWidthFor`, `handleDepthFor`,
  `handleCornerRadiusFor`, `lidThicknessFor` desde `hinged-box.js` — no se
  duplican.
- `js/core/panel.js` — sin cambios (`holeFeature` ya existe).
- `js/render/svg-render.js` — sin cambios estructurales (mismo patrón de
  capas que la bisagra simple).
- `js/ui/app.js` — elige builder según `lidType`, muestra/oculta el bloque
  de campos (reutiliza el mismo bloque de campos que la bisagra simple,
  ver más abajo), sufijo de archivo.
- `index.html`, `css/styles.css` — radio nuevo. Los campos pueden
  reutilizar el mismo bloque `#hingedFields` si el radio de bisagra doble
  también lo muestra (a decidir en el plan de implementación: un solo
  bloque de campos compartido entre las dos variantes de bisagra, ya que
  los parámetros son idénticos).
- `test.html` — checks nuevos.

Etiquetas de pieza en inglés como hoy. Nombres de panel sugeridos:
`BOTTOM`, `FRONT`, `BACK`, `LEFT`, `RIGHT`, `LID-LEFT`, `LID-RIGHT`.

## Pruebas

### Self-checks (`test.html`)

1. `buildHingedDoubleBox` con parámetros válidos no produce errores.
2. Siete piezas (no seis): base, frontal, trasera, izquierda, derecha, dos
   mitades de tapa.
3. Suelo a canto superior de las paredes = alto pedido (`Ho`, sin acortar).
4. Cada mitad de la tapa mide `(Lo−2t)/2` × `(Wo−2t)`.
5. Las paredes frontal y trasera miden `Ho` fuera de los postes, y
   `Ho + pp` en cada uno de sus dos postes.
6. Cada pared frontal/trasera tiene DOS agujeros de bisagra, uno cerca de
   cada extremo, ambos centrados a `t/2` bajo su canto superior.
7. El agujero es más grande que la diagonal de la espiga, con holgura
   positiva (misma fórmula que la bisagra simple).
8. Cada mitad de la tapa lleva sus dos espigas en los cantos que dan al
   frente y al fondo (no en los laterales), centradas sobre el agujero
   que les toca en coordenadas absolutas.
9. El canto exterior de cada mitad (el que da a la pared lateral) queda
   limpio, sin nada injertado ahí.
10. Cada mitad lleva su lengüeta en el canto interior (el que da hacia la
    otra mitad), sobresaliendo por el frente y por el fondo a la vez.
11. Las paredes frontal y trasera tienen, cada una, una muesca centrada en
    `Lo/2` del ancho total `hw`.
12. El agujero de bisagra lleva compensación de kerf.
13. El contorno de corte de cada pieza sigue siendo un único camino
    cerrado, sin cruces, sin solapes colineares, sin aristas que rocen un
    vértice ajeno (misma batería de verificación usada en el rediseño de
    la bisagra simple).
14. Se mantienen los checks actuales de la caja base y de la bisagra
    simple, sin tocarlos.
15. **Regresión dura**: la caja cerrada de 80×80×80 en 3 mm con kerf 0.16
    genera exactamente la misma geometría que antes, y la bisagra simple
    (de un solo eje) tampoco cambia.

### Prueba física

1. Cupón de calibración: mismo criterio que la bisagra simple — una
   espiga y un agujero de prueba, para ajustar tamaño y holgura antes de
   cortar una caja completa.
2. Caja chica completa con las dos mitades ya calibradas, prestando
   atención especial a cómo quedan las dos lengüetas encontrándose en el
   medio (holgura entre las dos mitades, para que no rocen al abrir/cerrar
   pero tampoco quede un hueco grande).
3. Anotar los números que funcionaron.

## Fuera de alcance

- Refuerzo redondeado (gusset) en la base de la lengüeta — decisión
  tomada, ver arriba.
- Tope de apertura diseñado a un ángulo específico.
- Bisagra con varilla separada.
- Más de dos mitades (bisagra tipo persiana, varias hojas).
- Generar el cupón de calibración desde la aplicación.
- Un mecanismo de cierre/traba (la lengüeta es solo tirador y tope, no
  traba la tapa cerrada).
