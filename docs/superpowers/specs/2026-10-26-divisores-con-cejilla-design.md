# Divisores fijos con cejilla — diseño

Fecha: 2026-10-26
Estado: borrador final, pendiente de aprobación de Dani
Rama: `divisiones-con-tab`

## Por qué

Hoy los divisores (ver `2026-09-25-divisores-internos-design.md`) solo
encajan entre sí a media madera y van sueltos dentro de la caja. Si no se
pegan, se mueven; y un divisor de alto (estante) sin divisores de largo no
tiene nada que lo sostenga a su altura. Dani quiere poder armar la caja
pegando **solo paredes y tapas**, y que los divisores queden fijos por el
propio ensamble.

La idea: cada divisor lleva **una sola cejilla** (tab) en cada extremo que
entra en una **ranura pasante** en la pared de la caja. La cejilla hace de
guía (ubica el divisor exacto) y de soporte (lo sostiene sin pegamento).

## Metas

- Nueva opción para escoger el tipo de divisor: **"Sueltos"** (lo de hoy,
  sin ningún cambio) o **"Fijos con cejilla"** (lo nuevo).
- Con "Fijos con cejilla", cada divisor sale con una cejilla por extremo y
  la pared correspondiente sale con su ranura.
- Estética uniforme: la cejilla mide lo mismo que un dedo de las uniones
  (finger joints) de la caja, y su punta queda al ras de la cara exterior.

## No-metas

- Tamaño o posición de cejilla ajustable a mano (se calcula solo —
  decisión de Dani).
- Cejilla en otra altura que no sea la media (decisión de Dani: media
  altura por estética).
- Más de una cejilla por extremo.
- Cambiar el mecanismo de cruce a media madera entre divisores.

## Anti-metas (sería un fracaso aunque "funcione")

- Que cambie cualquier caja con divisores "Sueltos" o sin divisores: deben
  salir idénticas a hoy (mismos paneles, mismas medidas).
- Que la cejilla quede floja o haya que forzarla: debe ajustar igual que
  los dedos de las esquinas con el kerf calibrado de Dani (plywood 3 mm,
  kerf 0.16 mm).
- Que una ranura toque o debilite una unión, una ranura de tapa deslizante,
  una bisagra o cualquier otro corte de la pared.
- Que la caja no se pueda armar físicamente en el orden descrito abajo.

## Restricciones

- Corte láser: la ranura en la pared es pasante, así que la punta de la
  cejilla se ve por fuera. Dani lo aceptó explícitamente.
- Con cejillas en ambos extremos, el divisor ya no entra después de armar
  la caja: se arma junto con las paredes (Dani lo aceptó).
- Aplica a todos los tipos de caja que hoy aceptan divisores: simple
  (`simple-box.js`, tapa con espigas y plana con/sin agarradera),
  deslizante (`sliding-box.js`), deslizante con soportes
  (`sliding-support-box.js`) y bisagra (`hinged-box.js`).

## Lo que decidió Dani

| Decisión | Resuelto |
|---|---|
| Convivencia con lo actual | Selector para escoger "Sueltos" o "Fijos con cejilla"; quedan las dos funcionalidades. |
| Altura de la cejilla | A media altura del divisor, por estética. |
| Tamaño | Automático, del mismo ancho que un dedo de las uniones de la caja. |
| Visible por fuera | Aceptado. |
| Orden de armado | Divisores junto con las paredes; solo se pegan paredes y tapas. |

## Geometría

Ejes de la caja: X = largo, Y = ancho, Z = alto. `t` = grosor del
material. `spanX`, `spanY`, `dividerHeight`, `xᵢ`, `zⱼ` como en el spec de
divisores internos. El divisor se apoya sobre la cara interior de la base.

### DIVIDER-L (divisor de largo, plano vertical YZ)

- Extremos: borde `u = 0` (hacia FRONT) y borde `u = spanY` (hacia BACK).
- Cada extremo lleva una cejilla rectangular que sobresale `t` (punta al
  ras de la cara exterior de la pared).
- Ancho de la cejilla (a lo largo de Z) = `wL`: el ancho real de un
  segmento de la unión vertical de las esquinas de la caja
  (`joints.z.width` en la simple; ver "Llamadas mías" para las cajas con
  más de un tramo vertical).
- Centrada a media altura del divisor: `dividerHeight / 2`.
- Kerf: la cejilla se dibuja `kerf` más ancha (medio kerf por lado), igual
  que un dedo macho en `finger-joint.js`. La profundidad (`t`) no se
  compensa, igual que los dedos.

**Choque con las muescas de cruce:** el borde `u = 0` ya lleva las muescas
donde cruzan los estantes (en `zⱼ`). Con un número impar de estantes, uno
cae justo a media altura, encima de donde iría la cejilla delantera. Ver
"Choque cejilla / muesca".

### DIVIDER-H (divisor de alto / estante, plano horizontal XY)

- Extremos: borde `x = 0` (hacia LEFT) y `x = spanX` (hacia RIGHT). Sus
  muescas de cruce están en el borde trasero y en `xᵢ` interiores, así que
  esos extremos están libres y no hay choque.
- Cejilla que sobresale `t`, centrada en el punto medio del borde
  (`spanY / 2`) — el equivalente a "media altura" para una pieza acostada.
- Ancho de la cejilla (a lo largo de Y) = `wH`: el ancho real de un
  segmento de la unión de las paredes laterales con la base
  (`joints.y.width`).
- Mismo criterio de kerf que arriba.

### Ranuras en las paredes

Rectángulo pasante del tamaño nominal de la cejilla, compensado de kerf
como hembra (se dibuja `kerf` más chico en cada dimensión; sirve
`rectHoleFeature` de `panel.js`).

- **FRONT y BACK:** una ranura por cada DIVIDER-L, de `t` (en X) × `wL`
  (en Z), centrada en `x = t + xᵢ` (`2t + xᵢ` en la caja con soportes) y en la altura de la cejilla (media
  altura del divisor, medida desde la cara interior de la base).
- **LEFT y RIGHT:** una ranura por cada estante, de `wH` (en Y) × `t` (en
  Z), centrada a lo ancho de la pared y en la altura `t + zⱼ` del estante.

El builder debe verificar el centro de cada ranura contra el centro de su
cejilla en coordenadas 3D por tipo de caja (cada caja tiene su base y su
alto de pared; la deslizante tiene el frente más bajo).

## Validaciones nuevas (solo en modo "Fijos con cejilla")

Errores (impiden generar):
- Una ranura queda a menos de `t` de cualquier otro corte de la pared
  (dedos de las orillas, ranura de tapa deslizante, hueco de bisagra,
  marco de soporte, etc.).
- La cejilla no cabe en su borde dejando al menos `t` de material a cada
  lado (p. ej. divisor muy bajo para un dedo ancho).
- No hay ninguna altura libre para la cejilla del divisor de largo (ver "Choque cejilla / muesca").

Avisos: los actuales de compartimentos angostos se mantienen.

## Interfaz

- Selector nuevo en la sección de divisores: "Sueltos" (default) /
  "Fijos con cejilla". Visible solo si hay al menos un divisor.
- Parámetro nuevo, p. ej. `dividerMode: 'loose' | 'tabbed'`, default
  `'loose'`; un valor ausente equivale a `'loose'`.
- Una línea de ayuda corta para el modo fijo: "Arma los divisores junto
  con las paredes; solo pega paredes y tapas."

## Orden de armado previsto

1. Arma la cuadrícula: divisores de largo y estantes cruzados a media
   madera.
2. Ponla sobre la base.
3. Coloca FRONT y BACK metiendo las cejillas de los divisores de largo.
4. Coloca LEFT y RIGHT metiendo las cejillas de los estantes; los dedos de
   las esquinas entran por su lado abierto.
5. Pega paredes y base; luego la tapa como siempre.

Se valida con un corte de prueba de Dani antes de hacer merge.

## Pruebas

En `test.html` (self-checks existentes):
- Con modo "Sueltos" o sin divisores, todas las cajas salen idénticas a
  hoy (incluye `test/golden-finger-80.json`).
- Por cada tipo de caja: cada cejilla tiene su ranura, con el mismo
  centro y tamaño nominal en 3D.
- El ancho de la cejilla es igual al segmento de unión elegido.
- Compensación de kerf: cejilla `+kerf`, ranura `−kerf`.
- Las validaciones nuevas disparan en los casos límite.

## Llamadas mías (Claude) — Dani puede corregirlas

- **Los estantes también llevan cejilla**, hacia LEFT/RIGHT. Así un
  estante queda sostenido a su altura aunque no haya divisores de largo.
- **Un solo ancho de cejilla por tipo de divisor**, para que todos los
  DIVIDER-L sigan siendo la misma pieza. Cuando el frente y el fondo
  tienen tramos verticales de distinto alto, se usa el segmento de la
  unión vertical **del frente**, que es la que se ve en el lado principal.
  Ojo con el nombre en cada caja: en `sliding-box.js` es `joints.z` (el
  fondo es `joints.zBack`); en `sliding-support-box.js` es
  `joints.zFront` (ahí `joints.z` es el fondo).
- La cejilla no lleva compensación de kerf en su profundidad, igual que
  los dedos de las esquinas.
- **Caja deslizante con soportes:** los divisores se miden entre los dos
  SUPPORT (`usableX = spanX − 2t`), no entre LEFT y RIGHT. Por eso:
  - Las ranuras de FRONT/BACK van en `x = 2t + xᵢ`, no en `t + xᵢ`.
  - La cejilla del estante sobresale `2t` en vez de `t`. Atraviesa una
    ranura en el SUPPORT y otra alineada en LEFT/RIGHT, y la punta queda
    al ras por fuera, igual que en las demás cajas. Las dos ranuras
    ayudan a pegar cada SUPPORT exactamente en su lugar. En esta caja, el
    armado empieza pegando cada SUPPORT a su pared lateral (con un estante
    puesto como guía de alineación) antes del paso 4.
- **Caja con bisagra:** la tapa se monta durante el paso 4 (sus pernos
  pasan por las paredes laterales antes de pegarlas, como ya exige el
  spec de bisagra). El texto de ayuda de esta caja lo dice.
- **"Media altura"** se mide sobre el alto total del divisor. Si la
  cejilla choca con el recorte superior de la bisagra (`dividerTopCut`),
  se aplica la misma regla de choque con las muescas (ver "Choque cejilla / muesca").

## Choque cejilla / muesca (decisión de Dani)

Pasa siempre con un número impar de estantes, y también con un número
par en cajas bajas: con 2 estantes en H/3 y 2H/3, chocan cuando
H/6 < (ancho de cejilla + t)/2.

**Regla: las dos cejillas del divisor de largo se mueven juntas** (la
delantera y la trasera, a la misma altura) a la altura libre más cercana
al centro, y las ranuras de FRONT y BACK se mueven con ellas. Así el
divisor se ve igual por delante y por detrás.

- Una altura `c` es libre si la banda `[c − wL/2 − t, c + wL/2 + t]` (la
  cejilla más `t` de material a cada lado) queda dentro del borde
  (`0..dividerHeight`) y no se cruza con ninguna muesca nominal
  (`zⱼ ± t/2`) ni con el recorte superior de la bisagra, si lo hay.
- Si la media altura es libre, se usa la media altura (el caso normal).
- Si no, se usa la `c` libre más cercana a `dividerHeight / 2`. En un
  empate (arriba y abajo a la misma distancia) se escoge la de abajo,
  porque sostiene mejor.
- Si no hay ninguna `c` libre, sale un error que pide menos estantes o
  una caja más alta.
- Todos los divisores de largo comparten la misma `c`, así que siguen
  siendo la misma pieza.

## Lo que queda al builder

- Nombres de funciones y cómo se reparte el código entre `dividers.js` y
  cada tipo de caja.
- Cómo se pasan las ranuras como `features` a cada pared.
- Redacción exacta de los mensajes de error.
