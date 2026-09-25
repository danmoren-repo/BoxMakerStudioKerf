# Divisores internos — diseño

Fecha: 2026-09-25
Estado: aprobado con Dani

## Qué se construye

Dos campos nuevos, "Divisores de largo" y "Divisores de alto" (número
entero, 0 por default), disponibles para las 4 tapas por igual (con
espigas, plana, deslizante, con bisagra). Reparten el interior de la
caja en compartimentos, repartidos a distancias iguales — sin control de
posición individual.

- **Divisor de largo**: pieza vertical que parte la caja en columnas a
  lo largo del eje Largo. `N` divisores de largo dan `N + 1` columnas.
- **Divisor de alto**: pieza horizontal, como un estante, que parte la
  caja en capas apiladas a lo largo del eje Alto. `M` divisores de alto
  dan `M + 1` capas.

Si se usan los dos tipos a la vez, cada divisor de largo se cruza con
cada divisor de alto y el total de compartimentos es `(N+1) × (M+1)`. En
cada cruce, ambas piezas llevan una ranura a media madera para encajar
entre sí — igual que una rejilla de botellero, pero en 3D (columnas +
capas) en vez de solo en el piso.

Se originó del archivo de referencia que Dani mandó (`EjemploSVG/Uno.svg`,
`Dos divisores.svg`, `2 y 3.svg`, generados por otra herramienta,
"BoxDesigner"). Se analizó la geometría exacta (coordenadas, no solo la
forma a ojo): esos tres archivos resultaron ser el mismo mecanismo con
1/0, 1/1 y 3/2 divisores de largo/alto respectivamente — de ahí sale la
cuenta de 2, 4 y 12 compartimentos que describió Dani.

## Decisiones tomadas

| Decisión | Resuelto |
|---|---|
| Cantidad vs. posición | Solo cantidad por eje; reparto automático a distancias iguales. Sin UI de posición individual (decisión explícita de Dani). |
| Alcance por tapa | Las 4 tapas por igual, incluida la tapa plana con agarradera activada. |
| Unión con las paredes exteriores | Ninguna — sueltos a presión, cortados al tamaño exacto del hueco (sin espigas hacia Bottom/Front/Back/Left/Right). |
| Tamaño exterior de cada divisor (bordes sin ranura) | Medida nominal exacta, sin compensación de kerf — mismo criterio ya usado en este proyecto para TOP-INSERT y la tapa plana: el margen natural del kerf alcanza. Se aparta a propósito del archivo de referencia, que los dibuja un kerf más grandes; no hay razón para inventar aquí una tercera convención de borde además de "con espiga" y "liso". |
| Ranura de cruce (ancho `t`, dentro de cada divisor) | Sí lleva compensación de kerf, con el mismo criterio que una arista hembra en `finger-joint.js`: la ranura se dibuja `kerf` más angosta, así el corte del láser la deja en su ancho nominal. |
| Grosor de los divisores | El mismo grosor de material `t` de toda la caja — sin parámetro nuevo. |
| Alto disponible para el divisor de largo | El mismo `inner.height` que ya calcula cada tipo de caja hoy (varía por tapa: la deslizante tiene el frente más bajo, por ejemplo) — sin fórmula nueva. |

## Geometría

### Nomenclatura

- `t`, `kerf` — existentes.
- `spanX`, `spanY` — hueco interno en largo/ancho, ya calculados por
  cada caja (`Lo − 2t`, `Wo − 2t`).
- `dividerHeight` — alto interno libre para el divisor de largo (piso
  hasta el canto de abajo de la tapa). Es el mismo valor que cada caja
  ya devuelve como `inner.height`; se le pasa como parámetro a
  `dividers.js`, no se recalcula ahí.
- `lengthDividers` (`Nc`) — cantidad de divisores de largo. Entero ≥ 0,
  default 0.
- `heightDividers` (`Ns`) — cantidad de divisores de alto. Entero ≥ 0,
  default 0.

### Las dos piezas

**DIVIDER-L** (divisor de largo) — rectángulo de `spanY × dividerHeight`.
Todos los `Nc` divisores de largo son la pieza idéntica repetida: como
cada uno atraviesa la caja de punta a punta en alto, cruza a los `Ns`
divisores de alto sin importar en qué columna esté. Si `Ns > 0`, lleva
`Ns` ranuras, una por cada divisor de alto:

- Cada ranura se abre desde el borde `u = 0` (el lado que da hacia la
  pared delantera) hacia adentro hasta `u = spanY / 2`.
- Ancho de la ranura (eje `v`, alineado con `dividerHeight`): banda de
  `t` mm centrada en `v = zⱼ`, compensada de kerf como una arista
  hembra (`v ∈ [zⱼ − t/2 + kerf/2, zⱼ + t/2 − kerf/2]`).
- `zⱼ = j · dividerHeight / (Ns + 1)`, para `j = 1..Ns`.

**DIVIDER-H** (divisor de alto) — rectángulo de `spanX × spanY`. Los
`Ns` divisores de alto son también la misma pieza repetida: cada uno
cubre el piso entero, así que cruza a los `Nc` divisores de largo sin
importar en qué capa esté. Si `Nc > 0`, lleva `Nc` ranuras, una por cada
divisor de largo:

- Cada ranura se abre desde el borde opuesto (`v = spanY`, el lado que
  da hacia la pared trasera) hacia adentro hasta `v = spanY / 2`.
- Ancho de la ranura (eje `u`, alineado con `spanX`): banda de `t` mm
  centrada en `u = xᵢ`, compensada de kerf igual que arriba
  (`u ∈ [xᵢ − t/2 + kerf/2, xᵢ + t/2 − kerf/2]`).
- `xᵢ = i · spanX / (Nc + 1)`, para `i = 1..Nc`.

Las dos piezas abren su ranura desde lados **opuestos** de la medida que
comparten (`spanY`) a propósito: así, en cualquier cruce, lo que a una
le falta es justo lo que a la otra le sobra, y encajan a media madera
sin importar cuántas columnas o capas haya. Ese es el mismo patrón que
se ve en los tres archivos de referencia, verificado por coordenadas.

Con `Ns = 0` o `Nc = 0` (solo un tipo de divisor), la pieza sale como
rectángulo liso sin ranuras — igual que `Uno.svg`.

### Ejemplo de referencia

Caja de 150×50×120 mm exteriores, `t = 3`, `kerf = 0.1`, con
`Nc = 3`, `Ns = 2` (el caso "2 y 3", 12 compartimentos):

| Medida | Valor |
|---|---|
| `spanX`, `spanY` | 144 × 44 |
| `dividerHeight` (caja con espigas) | 114 |
| DIVIDER-L: tamaño de pieza | 44 × 114 |
| DIVIDER-L: posiciones de ranura (`zⱼ`) | 38, 76 |
| DIVIDER-H: tamaño de pieza | 144 × 44 |
| DIVIDER-H: posiciones de ranura (`xᵢ`) | 36, 72, 108 |
| Profundidad de cada ranura | 22 (`spanY / 2`) |
| Ancho de cada ranura, compensado | `3 − 0.1 = 2.9` |

## Validaciones

### Errores

| Condición | Mensaje |
|---|---|
| `lengthDividers` o `heightDividers` no es entero ≥ 0 | La cantidad de divisores debe ser un número entero de 0 en adelante. |
| Ambos tipos activos y la ranura no deja profundidad de sobra: `spanY / 2 <= t` | El ancho interior de {spanY} mm es demasiado angosto para cruzar divisores de largo y de alto: la ranura no deja material suficiente. |

### Avisos

| Condición | Aviso |
|---|---|
| Compartimento de largo angosto: `spanX / (Nc + 1) < 3t` | Los compartimentos de largo quedan de X mm, muy angostos para el grosor de material. |
| Compartimento de alto angosto: `dividerHeight / (Ns + 1) < 3t` | Los compartimentos de alto quedan de X mm, muy angostos para el grosor de material. |

Se mantienen los errores y avisos actuales (dimensiones, kerf vs grosor,
espigas de junta vs kerf) sin cambios.

## Qué NO cambia

- Ninguna caja sin divisores (`Nc = Ns = 0`, el default) cambia en nada:
  mismos paneles, mismas medidas, mismo comportamiento que hoy.
- No hay unión de los divisores a las paredes exteriores ni entre ellos
  más que la ranura de cruce — no hay pestillo, cola de milano, ni
  ningún mecanismo de retención adicional.
- No hay control de posición individual por divisor (decisión explícita
  de Dani) ni holgura calibrable aparte para el ajuste a presión.

## Módulos

- `js/boxes/dividers.js` (nuevo) — `buildDividers({ spanX, spanY,
  dividerHeight, t, kerf, lengthDividers, heightDividers })`: calcula
  posiciones, arma las piezas DIVIDER-L/DIVIDER-H con sus ranuras (como
  contornos propios, construidos a mano igual que `pocketFeature`/
  `holeFeature` en `panel.js` — no pasa por `edgeProfile`, porque una
  ranura puntual en medio de un borde no es el mismo problema que una
  hilera de espigas parejas) y valida/avisa según la tabla de arriba.
  No toca `finger-joint.js` ni `panel.js`.
- `js/boxes/simple-box.js`, `js/boxes/sliding-box.js`,
  `js/boxes/hinged-box.js` — cada uno llama a `buildDividers()` después
  de armar sus paneles propios, pasándole su `spanX`/`spanY` y el alto
  interior que ya calcula (`inner.height` o el valor equivalente antes
  de armar el objeto de retorno), y agrega los paneles y avisos
  resultantes.
- `js/ui/app.js` / `index.html` — dos campos numéricos nuevos ("Divisores
  de largo", "Divisores de alto"), visibles siempre, se leen en
  `readParams()` y se agregan al resumen de compartimentos.

## Qué falta (futuro, no en este feature)

- Posición individual por divisor.
- Holgura de ajuste a presión calibrable.
- Divisores diagonales o en ángulo.
