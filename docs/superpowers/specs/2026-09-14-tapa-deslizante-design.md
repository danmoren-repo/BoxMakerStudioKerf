# Tapa deslizante — diseño

Fecha: 2026-09-14
Estado: aprobado por Dani, listo para plan de implementación

## Qué se construye

Un tercer tipo de tapa para BoxMaker: una tapa que corre dentro de un canal
vaciado en las paredes, entrando por el frente. El canal no se corta de lado a
lado — se marca en el SVG como capa aparte para grabar con láser o fresar con
router, y el usuario decide con qué herramienta lo hace.

Es el primero de dos tipos de tapa pedidos. La tapa con bisagra de pin queda
para un ciclo posterior y reutilizará la misma maquinaria de contornos
interiores que se introduce acá.

## Decisiones tomadas

| Decisión | Resuelto |
|---|---|
| Canal grabado vs. ranura pasante | Grabado/fresado, marcado en capa aparte |
| Paredes con canal | Laterales **y fondo** — la tapa queda metida en el fondo |
| Grosor de la tapa | Parámetro propio, por defecto copia el del material |
| Profundidad del canal | Auto = mitad de la pared, tope 6 mm, con casilla desmarcable |
| Holgura de deslizamiento | Parámetro propio, default 0.2 mm, independiente del kerf |
| Dónde va la holgura | Encima de la tapa, para que suelo→tapa dé la cota exacta |
| Dirección de entrada | Fija por el frente |
| Enfoque interno | Extensión mínima: features con capa + módulo nuevo |

## Geometría

### Nomenclatura

- Ejes: X = largo, Y = ancho (frente→fondo), Z = alto. z = 0 es la cara
  inferior de la base.
- `t` grosor del material · `tl` grosor de la tapa · `p` profundidad del canal
  · `h` holgura de deslizamiento · `kerf`, `tabWidth` como hoy.
- `Lo`, `Wo`, `Ho` dimensiones exteriores.

### Definición de la cota de alto

`Ho` es la distancia de la cara inferior de la base a la **cara superior de la
tapa**, con la tapa apoyada en el piso del canal. Las paredes laterales y el
fondo sobresalen por encima de esa cota. Es la definición que pidió Dani: "de
suelo a tapa por fuera".

### Dimensiones exteriores

- Modo exteriores: `Lo = L`, `Wo = W`, `Ho = H`.
- Modo interiores: `Lo = L + 2t`, `Wo = W + 2t`, `Ho = H + t + tl`.

El alto en modo interiores suma base y tapa, no dos grosores como las otras
tapas: por debajo de la tapa no hay nada más.

### Alturas derivadas

- Piso del canal: `zg = Ho − tl`
- Techo del canal: `zg + tl + h = Ho + h`
- Altura de laterales y fondo: `hw = Ho + h + t`
- Altura del frente: `hf = zg = Ho − tl`
- Interior útil de alto: `hi = Ho − tl − t`
- Reborde por encima de la cara superior de la tapa: `h + t`

La holgura va **encima** de la tapa: la tapa apoya en el piso del canal, así
que suelo→tapa da `Ho` exacto y el reborde crece `h`. La alternativa (holgura
debajo) daría reborde exacto y cota `Ho − h`; se descartó porque la cota que
Dani quiere exacta es la de suelo a tapa.

### Planta

Igual que la caja actual: frente y fondo abarcan X completo y se apoyan en
y ∈ [0, t] y [Wo−t, Wo]; laterales embutidos en Y, ancho `Wo − 2t`, en
x ∈ [0, t] y [Lo−t, Lo]. Interior: `Lo − 2t` × `Wo − 2t`.

### Canales

Los tres en z ∈ [`zg`, `zg + tl + h`], profundidad `p`:

- **Laterales**: en la cara interior de cada lateral, de punta a punta de la
  pieza (toda su anchura `Wo − 2t`). Sin extremos, así que no hay esquinas
  internas que redondear.
- **Fondo**: ciego. Ancho en X = ancho de tapa + `2h`, centrado. Equivale a
  `Lo − 2t + 2p`, lo que deja un margen de exactamente `t − p` hasta cada
  canto exterior del fondo — el mismo espesor de pared que queda detrás de los
  canales laterales.

El canal del fondo se mete `p` en la zona donde apoya el canto de cada
lateral. Es intencional: las esquinas traseras de la tapa viven en los tres
canales a la vez. Donde esa zona coincide con una ranura de espiga del fondo,
el canal queda sobre un hueco y simplemente no hay nada que vaciar. No
debilita la junta.

**Corregido 2026-09-16.** El párrafo anterior razonaba sobre el material del
fondo y se olvidaba de lo que llena ese hueco: la espiga del lateral, que
asoma ahí a grosor completo. El canal del lateral recorre el cuerpo de la
pieza, no sus espigas, así que esa espiga no está rebajada y puede tapar el
sitio por el que tiene que pasar la esquina trasera de la tapa. Lo que salva a
la caja es que la junta lateral↔fondo arranca sin espiga (`startsSolid`): bajo
el canto superior queda un tramo entero sin material asomado. La condición es
exacta —el canto superior de esa junta cae justo en `grooveTop`— y es:

    tramo de la junta del fondo ≥ tl + h

Con tapa del mismo grosor que la pared y espiga automática el tramo mide unos
`3t` y sobra. Muerde con tapa gruesa sobre pared fina (10 mm de tapa sobre
3 mm de pared) y con anchos de espiga manuales pequeños. **Es un error de
generación, no un aviso**: la tapa no entra, y el dibujo no lo delata.

La condición se mide en la pieza, no en el dibujo. La espiga macho se **dibuja**
un kerf más ancha para que, comido el medio kerf a cada lado, quede en la medida
nominal; así que en el SVG la espiga asoma medio kerf dentro de la banda del
canal y eso no es material, es la compensación. Medir el polígono dibujado y
llamarlo interferencia daría por mala toda junta del repo, empezando por la caja
de 80×80×80 que se cortó y encajó perfecta. Lo que sí se avisa es un margen
positivo pero **menor que un kerf**: pasa, pero del orden del error de la propia
máquina, así que va a rozar.

El ancho de espiga no es palanca ilimitada: `computeSegments` nunca baja de
cinco tramos con `startsSolid`, así que el tramo tiene techo en `spanZBack / 5`.
Con holguras grandes puede hacer falta mover también el grosor de la tapa o la
holgura; el mensaje de error nombra las tres.

### Tapa

- Agarre real en cada canal: `e = p − h`
- Ancho (X): `Lo − 2t + 2e`
- Profundo (Y): `Wo − 2t + e + t` — el canto delantero sobresale un grosor
  completo y tapa el canto del frente; ese canto no entra en canal, no lleva
  holgura.
- Rectángulo liso: sin espigas y sin canal.

### Juntas

- Base ↔ cuatro paredes: sin cambios.
- Fondo ↔ laterales: junta vertical sobre `hw`, con el margen macizo actual
  (`jointStart = t`, `jointSpan = hw − 2t`).
- Frente ↔ laterales: junta vertical sobre `hf` (`jointStart = t`,
  `jointSpan = hf − 2t`). El canto del lateral queda liso desde `hf − t`
  hacia arriba.
- Cantos superiores de laterales, fondo y frente: lisos.
- Géneros: se mantiene la convención actual — frente y fondo hembra,
  laterales macho en los cantos verticales, base macho.

Las juntas verticales tienen ahora dos alturas distintas (`hf` y `hw`), así
que la segmentación y las validaciones de espiga se calculan por junta, no
una sola vez.

El ancho de espiga automático se calcula, como hoy, desde el tramo de junta
más corto. Para esta caja ese tramo es `hf − 2t`, la junta frente↔lateral —
nunca `hw − 2t`.

### Ejemplo de referencia

80 × 80 × 80 exteriores, `t = 3`, `tl = 3`, `p = 1.5`, `h = 0.2`:

| | |
|---|---|
| Suelo a tapa | 80 |
| Laterales y fondo | 80 × 83.2 (laterales 74 × 83.2) |
| Frente | 80 × 77 |
| Base | 74 × 74 |
| Tapa | 76.6 × 78.3 |
| Canal | piso 77, techo 80.2, profundidad 1.5 |
| Canal del fondo, ancho | 77.0, de x = 1.5 a x = 78.5 |
| Interior útil | 74 × 74 × 74 |

## Modelo de datos

Una pieza gana una lista opcional de contornos interiores:

```js
panel.features = [
  { id: 'groove', layer: 'engrave', kind: 'pocket', depth: p, points: [...] }
]
```

- `panelOutline()` no cambia: el contorno exterior sigue siendo un único
  camino cerrado de líneas rectas.
- Las piezas sin features salen idénticas a hoy.
- `layer` admite `'engrave'` y `'cut'`. La tapa deslizante sólo usa
  `'engrave'`; `'cut'` queda disponible para los agujeros de pin de la bisagra
  sin volver a tocar el modelo.

## Salida SVG

Tres grupos:

- `id="cut"`, trazo `#000000` — contornos de las seis piezas.
- `id="engrave"`, trazo `#e5484d` — los tres canales, a medida terminada.
- `id="labels"` — como hoy.

Ambos grupos de geometría van con `fill="none"`, `stroke-width` 0.2, y con
`inkscape:groupmode="layer"` e `inkscape:label` ("Corte" / "Grabado") para que
Inkscape los muestre como capas con nombre. LightBurn reparte por color al
importar, así que cada uno cae en su propia capa.

**El canal se dibuja a medida terminada, sin compensación de kerf.** El kerf
compensa un corte pasante, donde el haz come material a ambos lados de la
línea; un vaciado retira exactamente el área marcada. Aplicar kerf al canal lo
dejaría mal dimensionado.

## Parámetros de interfaz

`lidType` gana la opción `sliding`. Con ella elegida aparecen tres campos
dentro del bloque de Tapa, y desaparecen con cualquier otra tapa:

| Campo | Default | Comportamiento |
|---|---|---|
| Grosor de la tapa | = grosor del material | Casilla "igual que el material" marcada; mientras lo esté, sigue al material |
| Profundidad del canal | `min(t/2, 6)` | Casilla "automática" marcada, campo apagado mostrando el valor |
| Holgura de deslizamiento | 0.2 | Siempre a mano; es el número que se calibra cortando |

Otros cambios de interfaz:

- El resumen muestra el alto real entre paréntesis: `Exterior 80 × 80 × 80
  (alto real con reborde: 83.2)`. Sólo con tapa deslizante.
- Debajo del preview, nota fija: los rectángulos rojos se vacían a `p` mm de
  profundidad, no son cortes pasantes.
- Nombre de archivo: sufijo `-deslizante`.
- Resto del formulario sin cambios.

## Validaciones

### Errores

| Condición | Mensaje |
|---|---|
| `tl <= 0` | El grosor de la tapa debe ser mayor que 0. |
| `h < 0` | La holgura no puede ser negativa. |
| `p <= 0` | La profundidad del canal debe ser mayor que 0. |
| `p >= t` | El canal atraviesa la pared. |
| `h >= p` | La tapa no llega a agarrarse en el canal. |
| `hf <= 0` | La caja es más baja que su propia tapa. |
| `hf − 2t <= 0` | El frente no deja pared entre la base y el canal para las espigas. |

Se mantienen los errores actuales: `spanX`/`spanY` no positivos, `kerf >= t`,
espigas demasiado finas frente al kerf.

### Avisos

| Condición | Aviso |
|---|---|
| `t − p < 1.5` | Queda poca pared detrás del canal; puede reventar al meter la tapa. |
| `h === 0` | La tapa entra a presión, no desliza. |
| `h > 0.5` | La tapa va a bailar en el canal. |
| `min(ancho, profundo de tapa) / tl > 60` | La tapa va a pandear en el medio. |
| `t < 2` | El reborde sobre el canal vale un grosor y queda frágil. |

Se mantienen los avisos actuales.

## Módulos

- `js/boxes/shared.js` — **nuevo**. `outerDimensions`, `autoTabWidth`,
  segmentación de juntas, validaciones y avisos comunes. Extraído de
  `simple-box.js` sin cambio de comportamiento.
- `js/boxes/simple-box.js` — caja cerrada y tapa plana, importando de
  `shared.js`.
- `js/boxes/sliding-box.js` — **nuevo**. La caja deslizante.
- `js/core/panel.js` — construcción de features además del contorno.
- `js/render/svg-render.js` — segundo grupo de capa; `layout()` traslada las
  features con la misma delta que el contorno; el bounding box se sigue
  calculando sólo desde el contorno.
- `js/ui/app.js` — elige builder según `lidType`, muestra/oculta el bloque,
  resumen ampliado, sufijo de archivo.
- `index.html`, `css/styles.css` — radio y campos nuevos.
- `test.html` — checks nuevos.

Etiquetas de pieza en inglés como hoy: `BOTTOM`, `FRONT`, `BACK`, `LEFT`,
`RIGHT`, `LID`. Orden en la hoja, espejando el de la caja actual: `BOTTOM`,
`FRONT`, `LEFT`, `LID`, `BACK`, `RIGHT`.

## Pruebas

### Self-checks (`test.html`)

1. `buildSlidingBox` con parámetros válidos no produce errores.
2. Suelo a tapa = alto pedido.
3. `hf = Ho − tl` y `hw = Ho + h + t`.
4. Modo interiores: el hueco real coincide con lo pedido en los tres ejes.
5. Ningún canal atraviesa su pared (`p < t` en toda feature).
6. Los tres canales comparten exactamente el mismo rango en Z.
7. Agarre `e > 0`, y el canal del fondo es más ancho que la tapa.
8. El canal del fondo deja margen `t − p` a cada canto exterior.
9. Las espigas del frente caen dentro de `hf` y encajan en las ranuras de los
   laterales pese a la junta más corta.
10. El contorno de corte sigue siendo un único camino cerrado; ninguna feature
    se cuela en la capa de corte.
11. Se mantienen los checks actuales — nada más fino que el kerf, sin
    contornos que se doblen sobre sí mismos, esquinas del frente macizas.
12. **Regresión dura**: la caja cerrada de 80 × 80 × 80 en 3 mm con kerf 0.16
    genera exactamente la misma geometría que antes del cambio.

### Prueba física

1. Revisar el SVG en LightBurn: negro y rojo en capas distintas, nada rojo en
   corte.
2. Cupón de calibración: una tira de retazo de ~60 mm con el canal grabado y
   otra del grosor de la tapa, para ajustar la holgura sin gastar una caja.
3. Caja chica completa (~60 × 60 × 40 en 3 mm) con la holgura ya calibrada.
4. Anotar la holgura que funcionó, como se hizo con el kerf 0.16.

## Fuera de alcance

- Generar el cupón de calibración desde la aplicación.
- Compensación de radio de fresa (*dogbone*) en las puntas del canal del
  fondo. En láser las esquinas salen vivas; con fresa quedan redondeadas y las
  esquinas traseras de la tapa pueden no asentar del todo. Se resuelve el día
  que se ataque el router en serio, porque depende del diámetro de fresa.
- Tirador o muesca para el dedo en la tapa.
- Tapa deslizante entrando por un lateral: se obtiene intercambiando largo y
  ancho.
- Tapa con bisagra de pin.
