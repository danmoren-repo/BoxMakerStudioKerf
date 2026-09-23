# Tapa con bisagra — diseño

Fecha: 2026-09-22
Estado: aprobado, en revisión de mecanismo

**Revisión 2026-09-23:** el mecanismo de giro cambió. La primera versión (un
disco de ~4× el grosor, viviendo dentro de un entalle tallado en la esquina
trasera de la tapa) se implementó, se revisó y se corrigió en tres rondas
distintas — y aun así no era lo que Dani pedía. Dani mandó un SVG de
referencia: una pestaña **cuadrada maciza**, del **mismo grosor que el
material** (no 4×), que sale de los **cantos laterales** de la tapa (no del
trasero) cerca de la esquina — el canto trasero, el eje de la bisagra, queda
limpio. Esta sección y las de geometría más abajo reflejan ese mecanismo
corregido. La manija y el resto del diseño (parámetros generales, capas SVG,
patrón de módulos) no cambian.

## Qué se construye

Un cuarto tipo de tapa para BoxMaker: una tapa que queda unida a la caja por una
bisagra hecha del mismo material, sin varilla ni pieza aparte. Gira sobre el
canto trasero, como la tapa de un baúl, y se abre hasta que su cara interior
choca contra la cara exterior de la pared trasera — ese choque es el tope, no
hay que diseñar uno.

Es el segundo de los dos tipos de tapa pedidos. Reutiliza la máquina de
contornos interiores (`panel.features`) que introdujo la tapa deslizante,
sumando un tipo de feature nuevo para agujeros pasantes.

## Decisiones tomadas

| Decisión | Resuelto |
|---|---|
| Mecanismo de giro | Espiga cuadrada maciza integral (mismo material que la tapa), sin varilla aparte |
| Tamaño de la espiga | Igual al grosor del material — no un diámetro aparte |
| Cuántas espigas | Dos, una cerca de cada esquina trasera |
| De qué canto de la tapa salen | De los cantos **laterales** (izquierdo/derecho) de la tapa, no del trasero — el trasero (el eje de giro) queda limpio, sin entalle |
| Dónde encajan | En los laterales de la caja (no en el fondo) — es el único par de paredes cuyo agujero queda con el eje horizontal correcto |
| Tipo de agujero | Redondo, cerrado, rodeado de material por todos lados — hay que enhebrar la espiga antes de pegar ese lateral |
| Holgura del agujero | Generosa, todo del mismo material, sin varilla — se acepta algo de juego |
| Tope de apertura | Ninguno diseñado: la tapa pega contra la pared trasera al abrir del todo |
| Manija | Pestaña rectangular de esquinas redondeadas que sobresale del canto delantero de la tapa, encajando en una muesca a juego en la pared frontal |
| Parámetros de bisagra | Se proponen valores por defecto y se calibran cortando una prueba física, como el kerf y la holgura de la deslizante |

## Geometría

### Nomenclatura

- Ejes: X = largo, Y = ancho (frente→fondo), Z = alto. z = 0 es la cara
  inferior de la base.
- `t` grosor del material · `tl` grosor de la tapa (propio, default = `t`).
- `Lo`, `Wo`, `Ho` dimensiones exteriores. `Ho` es la distancia de la cara
  inferior de la base a la cara superior de la tapa cerrada — misma
  convención que las otras tapas.
- `ps` tamaño de la espiga — lado del cuadrado macizo, default = `t` (el
  grosor del material, no un diámetro aparte).
- `hc` holgura del agujero sobre la espiga · `dh = √(ps² + tl²) + hc`
  diámetro del agujero — ver más abajo por qué es la diagonal y no `ps`
  directo · `em` margen mínimo de material alrededor de cualquier corte.
- `hw`, `hd`, `hr` ancho, profundidad y radio de esquina de la manija.

### Por qué el lateral es más alto que el frente y el fondo

La espiga es plana: vive exactamente a la altura de la tapa (`tl` de grosor),
justo donde la tapa cierra. Para que el agujero quede cerrado —con material
por encima, no abierto al canto— la pared que lo recibe tiene que llegar más
alto que el nivel donde cierra la tapa, en esa esquina.

Frente y fondo no tienen este problema: la tapa se apoya encima de su canto,
no atraviesa nada ahí. Por eso solo cambian los laterales, y solo en la
esquina trasera — el resto del lateral sigue a la altura normal.

### Alturas

- Frente y fondo: `Ho − tl` (la tapa se apoya encima, a ras).
- Radio del agujero: `rh = dh / 2`, con `dh = √(ps² + tl²) + hc` (ver
  "Espiga y poste" — el agujero tiene que ser bastante más grande que el
  lado de la espiga, no apenas un poco más).
- Altura del centro del agujero, medida desde el piso: `zh = Ho − tl/2` — a
  media altura de la tapa cerrada, para que la espiga entre derecho.
- Altura del poste del lateral (lo que sobresale por encima de `Ho − tl`):
  `pp = tl/2 + rh + em`.
- Altura total del lateral en la esquina trasera: `Ho − tl + pp = Ho − tl/2 +
  rh + em`.
- El resto del lateral (fuera de la zona del poste) queda a `Ho − tl`, igual
  que el frente y el fondo.

### Planta

Igual que la caja actual: frente y fondo abarcan X completo, laterales
embutidos en Y. Interior: `Lo − 2t` × `Wo − 2t`.

### Espiga y poste

- La espiga es un **cuadrado macizo de lado `ps`**, cortado del mismo
  material de la tapa — no un disco, no vive dentro de ningún entalle. Sale
  directo del canto **lateral** de la tapa (izquierdo o derecho, el que le
  toca a cada esquina), no del canto trasero. El canto trasero —el eje de
  giro— queda intacto, sin ninguna muesca ni recorte.
- Posición a lo largo del canto lateral: pegada a la esquina trasera, con un
  margen `em` entre el canto más trasero de la tapa y el borde exterior de
  la espiga — el mismo margen que ya se usa para "material mínimo alrededor
  de un corte", reusado acá como separación mínima para que quede una tira
  de material entre la esquina y la espiga, no una esquina de filo.
- El eje de giro (el canto trasero) corre en la misma dirección en que la
  espiga sale de la tapa — así que, al abrir y cerrar la tapa, la espiga no
  se traslada: **gira en el lugar**, dentro del agujero. Vista de frente
  (mirando por el eje de giro, el plano que ve el agujero), la sección de la
  espiga es un rectángulo de `ps` × `tl` — no `ps` × `ps`, porque una
  dimensión es el ancho dibujado en el plano de la tapa y la otra es el
  grosor de la tapa, que puede ser distinto de `ps` si `tl` se ajusta a
  mano.
- Por eso el agujero **no puede ser del tamaño de la espiga más un poco**:
  al girar, la sección rectangular de la espiga barre un círculo cuyo radio
  es la mitad de su propia diagonal. Un agujero justo al lado `ps` (o a
  `tl`) trabaría la bisagra a mitad de camino. De ahí `dh = √(ps² + tl²) +
  hc` — el diámetro mínimo para que la espiga gire libre, más la holgura de
  siempre.
- El poste ocupa, en el canto superior del lateral, una franja cerca de la
  esquina trasera de ancho `dh + 2·em` (el agujero más margen a cada lado)
  — misma fórmula que antes, con el `dh` nuevo (más chico) puesto adentro.
- El agujero es un círculo de diámetro `dh`, centrado en esa franja, a altura
  `zh`.

### Manija

- Pestaña rectangular de esquinas redondeadas (radio `hr`), ancho `hw`,
  centrada en el canto delantero de la tapa, que sobresale `hd` más allá de
  ese canto.
- `hd` por defecto ya no es un número fijo: es `t + 5` — crece con el
  grosor del material para que siempre quede cómoda de agarrar con los
  dedos (3 mm de material → 8 mm de salida). Sigue siendo un campo que se
  puede ajustar a mano.
- La pared frontal lleva una muesca a juego —mismo ancho `hw`, misma
  posición centrada, profundidad `hd`— cortada hacia adentro desde su canto
  superior.
- Cerrada la caja, la pestaña de la tapa asoma a través de la muesca de la
  pared: queda accesible desde afuera para levantar la tapa, y de paso hace
  de tope para que la tapa no se cuele hacia adentro de la caja.

### Ejemplo de referencia

80 × 80 × 80 exteriores, `t = 3`, `tl = 3`, `ps = 3`, `hc = 1`, `em = 2`:

| | |
|---|---|
| Suelo a tapa | 80 |
| Frente y fondo | 80 × 77 |
| Lateral, fuera del poste | 74 × 77 |
| Lateral, altura en la esquina del poste | 74 × 83.12 |
| Espiga | cuadrado macizo de 3 × 3 mm, saliendo del canto lateral |
| Agujero | diámetro 5.24 mm (√(3² + 3²) + 1), centro a 78.5 mm de altura |
| Manija | 20 × 8 mm, esquinas de radio 2 |

## Modelo de datos

Nuevo tipo de feature, al lado de `pocketFeature` (que sigue igual):

```js
export function holeFeature({ id, cx, cy, diameter, kerf, layer = 'cut' }) {
  // círculo aproximado por polígono (48 lados), con compensación de kerf:
  // el corte pasante agranda el radio en kerf/2 para que el diámetro
  // terminado dé la medida nominal.
}
```

- `layer: 'cut'` — a diferencia del canal de la tapa deslizante, este es un
  corte pasante, así que **sí lleva compensación de kerf** (el canal grabado
  de la deslizante no la lleva, porque no es un corte pasante).
- El círculo se dibuja como polígono de 48 lados: el resto del renderizado
  (capas, `layout()`, bounding box) ya trabaja con listas de puntos, y así no
  hace falta enseñarle a dibujar arcos.
- `panelOutline()` no cambia: sigue siendo el contorno exterior de un único
  camino cerrado. Pero la tapa y los laterales de esta caja **no** usan el
  sistema de cantos con género (`edges`) para construir ese contorno — la
  espiga, el poste y la manija son bultos locales sobre un canto, no un
  canto entero con un patrón de espigas. Se arma el contorno a mano, como ya
  se hizo para la tapa de la tapa deslizante. La espiga, al ser un cuadrado
  macizo pegado a un canto por lo demás recto (sin entalle, sin agujero en
  la tapa), es un bulto simple — el mismo tipo de injerto que ya usa la
  manija en su propio canto, no el caso de "hueco con isla adentro" que
  hacía falta antes para el disco dentro de su entalle.

## Salida SVG

Dos grupos, igual que la tapa deslizante: `id="cut"` (`#000000`) e
`id="engrave"` (`#e5484d`) — pero acá los dos agujeros de bisagra van en el
grupo de **corte**, no de grabado, porque son pasantes.

## Parámetros de interfaz

`lidType` gana la opción `hinged`. Con ella elegida:

| Campo | Default | Comportamiento |
|---|---|---|
| Grosor de la tapa | = grosor del material | Casilla "igual que el material", como en la deslizante |
| Tamaño de la espiga | `t` (el grosor del material) | A mano, se calibra cortando |
| Holgura del agujero | 1 mm | A mano, se calibra cortando |
| Ancho de la manija | 20 mm | A mano |
| Profundidad de la manija | `t + 5` mm | A mano |

Otros cambios de interfaz, mismo patrón que la deslizante: sufijo de archivo
`-bisagra`, nota fija bajo el preview explicando que los agujeros de bisagra
son pasantes y necesitan enhebrarse antes de pegar los laterales.

## Validaciones

### Errores

| Condición | Mensaje |
|---|---|
| `tl <= 0` | El grosor de la tapa debe ser mayor que 0. |
| `ps <= 0` | El tamaño de la espiga debe ser mayor que 0. |
| `hc < 0` | La holgura del agujero no puede ser negativa. |
| `hw <= 0` o `hw` no cabe entre las dos espigas | La manija debe tener un ancho mayor que 0 y no puede chocar con las espigas de bisagra. |
| `hd <= 0` | La profundidad de la manija debe ser mayor que 0. |

### Avisos

| Condición | Aviso |
|---|---|
| Poco material alrededor del agujero (`em` efectivo bajo) | La pared puede reventar al enhebrar la espiga. |
| `hc` muy chica | La bisagra va a quedar dura, puede no girar. |
| `hc` muy grande | La bisagra va a quedar floja, con bamboleo notorio. |
| Manija muy ancha respecto al frente disponible | Puede quedar muy cerca de las espigas de bisagra. |
| Los dos postes de bisagra no caben sin superponerse (el ancho del lateral, `spanY`, chico frente a `2 · (dh + 2·em)`) | Los postes de las dos esquinas traseras se pisan: baja el tamaño de espiga, la holgura, o el margen. |

Se mantienen los errores y avisos actuales (dimensiones, kerf vs grosor,
espigas de junta vs kerf).

## Módulos

- `js/boxes/hinged-box.js` — nuevo, siguiendo el patrón de `sliding-box.js`.
- `js/core/panel.js` — nueva función `holeFeature()` al lado de
  `pocketFeature()`.
- `js/render/svg-render.js` — el agujero de bisagra cae en el grupo de
  corte, no en el de grabado; sin cambios estructurales más allá de eso.
- `js/ui/app.js` — elige builder según `lidType`, muestra/oculta el bloque
  de campos, sufijo de archivo.
- `index.html`, `css/styles.css` — radio y campos nuevos.
- `test.html` — checks nuevos.

Etiquetas de pieza en inglés como hoy: `BOTTOM`, `FRONT`, `BACK`, `LEFT`,
`RIGHT`, `LID`.

## Pruebas

### Self-checks (`test.html`)

1. `buildHingedBox` con parámetros válidos no produce errores.
2. Suelo a tapa = alto pedido.
3. Los laterales miden `Ho − tl` fuera de la zona del poste, y `Ho − tl/2 +
   rh + em` en la esquina trasera.
4. El agujero de cada lateral queda centrado en `zh = Ho − tl/2`.
5. El agujero no atraviesa el canto superior del poste (hay material `em`
   por encima).
6. El agujero (`dh`) es más grande que la diagonal de la espiga
   (`√(ps² + tl²)`), con holgura positiva — si no, la espiga se traba al
   girar.
7. La espiga de cada esquina trasera de la tapa sale del canto lateral que
   le toca (no del trasero), es un cuadrado macizo de lado `ps`, y su
   centro (en coordenadas absolutas de la caja) coincide con el centro del
   agujero de su lateral.
8. La manija de la tapa y la muesca de la pared frontal tienen el mismo
   ancho y quedan alineadas en X.
9. El agujero de bisagra lleva compensación de kerf; el canal de la tapa
   deslizante (si se corre ese test en la misma sesión) sigue sin llevarla.
10. El contorno de corte de cada pieza sigue siendo un único camino cerrado.
11. Se mantienen los checks actuales de la caja base.
12. **Regresión dura**: la caja cerrada de 80×80×80 en 3 mm con kerf 0.16
    genera exactamente la misma geometría que antes del cambio.

### Prueba física

1. Cupón de calibración: una espiga y un agujero de prueba en un retazo
   chico, para ajustar el tamaño de la espiga y la holgura antes de
   cortar una caja completa.
2. Caja chica completa (~60×60×40 en 3 mm) con la bisagra ya calibrada.
3. Anotar el tamaño de espiga y la holgura que funcionaron, como se hizo
   con el kerf (0.16) y la holgura de la deslizante (0.2).

## Fuera de alcance

- Tope de apertura diseñado a un ángulo específico (collar, escalón).
- Bisagra con varilla separada (dowel o metal).
- Bisagra tipo piano (varias espigas repartidas).
- Generar el cupón de calibración desde la aplicación.
- Bisagra en un lateral en vez de en el fondo (se obtiene intercambiando
  largo y ancho, igual que en la deslizante).
