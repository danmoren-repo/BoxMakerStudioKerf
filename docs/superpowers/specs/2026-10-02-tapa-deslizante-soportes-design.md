# Tapa deslizante con soportes pegados — diseño

Fecha: 2026-10-02
Estado: diseño aprobado con Dani en conversación; pendiente su revisión de este documento

## Qué se construye

Un segundo método para la tapa deslizante. El método actual ("Canal
grabado") vacía un canal en las paredes; en las pruebas de Dani con
plywood de 3 mm, vaciar ~1.5 mm por lado debilita demasiado la pared.
Funciona en otros materiales, así que se conserva tal cual.

El método nuevo ("Soportes pegados") no graba nada:

- La caja es una **caja cerrada normal** (espigas en todas las juntas,
  paredes a su grosor completo), salvo FRONT, que es más bajo para dejar
  entrar la tapa.
- **TOP** es la tapa de la caja cerrada con una **ventana** cortada: al
  sacar la tapa deslizante se ve el interior.
- Dos piezas nuevas, **SUPPORT 1 y SUPPORT 2**, rectángulos lisos que se
  pegan por dentro de cada lateral, apoyados sobre BOTTOM. Su canto de
  arriba es el riel.
- La **tapa** entra por el frente, desliza entre los dos laterales
  apoyada sobre los soportes, y queda sujeta por arriba por el marco de
  la ventana de TOP.

Se originó del archivo de Dani `EjemploSVG/boxmaker-100x150x80-t3
deslizante option b.svg` (boceto a mano en Inkscape). Del boceto se tomó
la idea y la lista de piezas; las medidas del boceto no cuadraban entre sí
(ver "Lectura del boceto") y se recalcularon todas.

## Decisiones tomadas (con Dani)

1. **Dónde va la tapa:** bajo TOP, entre los laterales, apoyada en el canto
   superior de los soportes (opción A de la conversación).
2. **Soportes tipo forro:** placas de alto completo apoyadas en BOTTOM, no
   tiras angostas. Así la altura del riel sale exacta al pegarlos, sin
   medir ni usar plantilla.
3. **Marco de la ventana:** automático = grosor del material + 4.5 mm,
   medido desde la cara interior de cada pared, igual en los 4 lados. Se
   puede escribir a mano (casilla "Automático", como la profundidad del
   canal). El grosor del material cuenta porque el soporte ocupa ese
   espacio; los 4.5 mm son margen de seguridad.
4. **Modo "medidas interiores":** el espacio útil se mide **entre
   soportes**, no entre paredes.
5. **Canal grabado es el default** y no cambia en nada (ni geometría ni
   código).
6. **Archivo aparte** para el método nuevo; `sliding-box.js` no se toca.
7. **Rama de trabajo:** `tapa-deslizante-soportes`, creada desde `main`.

## Lectura del boceto

Caja 100 × 150 × 80, material de 3 mm. Lo que trae el SVG de Dani:

| Pieza | Medida en el boceto | Comentario |
|---|---|---|
| BOTTOM | 94 × 144 + espigas | Igual que caja cerrada |
| TOP | 94 × 144 + espigas en 4 cantos, ventana 85 × 135 (marco 4.5) | Copia de BOTTOM con ventana |
| LEFT / RIGHT | 150 × 80, juntas en 4 cantos | Laterales de caja cerrada |
| BACK | 100 × 80, juntas en 4 cantos | Fondo de caja cerrada |
| FRONT | 100 × ~76, canto superior liso | Más bajo para la entrada de la tapa |
| LID | ~96.6 × 155 | Rectángulo liso |
| Support1 / 2 | ~83.7 × 135 | Rectángulos lisos |

Inconsistencias que obligaron a recalcular: entre la cara inferior de TOP
(77 mm) y el canto de FRONT (76 mm) quedaba 1 mm, donde no pasa una tapa
de 3 mm; la tapa (96.6) era más ancha que el espacio entre laterales
(94); los soportes (83.7 de alto) no caben en un lateral de 74 mm de alto
interior; TOP llevaba espigas en el canto delantero, donde FRONT ya no
llega.

## Geometría

### Nomenclatura

Símbolos usados en el código (y en este documento sólo junto a su nombre):

| Símbolo | Significado |
|---|---|
| `t` | grosor del material de la caja |
| `tl` | grosor de la tapa (puede ser otro material; por defecto `t`) |
| `h` | holgura de deslizamiento (default 0.2 mm, el mismo campo del canal grabado) |
| `m` | marco de la ventana, medido desde la cara interior de la pared |
| `Lo, Wo, Ho` | largo, ancho y alto exteriores |
| `spanX = Lo − 2t` | espacio entre laterales |
| `spanY = Wo − 2t` | espacio entre FRONT y BACK |

Ejes: X = largo (izquierda–derecha), Y = ancho (frente–fondo, dirección
en que desliza la tapa), Z = alto.

### Alto

`Ho` es la altura total de la caja: de la cara de abajo de BOTTOM a la
cara de arriba de TOP. LEFT, RIGHT y BACK miden `Ho`, como en la caja
cerrada (a diferencia del canal grabado, aquí nada sobresale por encima
de la tapa).

Alturas derivadas, desde el piso:

| Cota | Fórmula |
|---|---|
| Cara inferior de TOP | `Ho − t` |
| Cara superior de la tapa | `Ho − t − h` |
| Cara inferior de la tapa = canto de los soportes = canto de FRONT (`railTop`) | `Ho − t − h − tl` |
| Alto de FRONT (`frontHeight`) | `railTop` |
| Alto de cada soporte (`supportHeight`) | `railTop − t` |
| Alto útil (`innerHeight`) | `supportHeight` |

La holgura va por encima de la tapa (entre la tapa y TOP). La tapa
apoya directo sobre los soportes.

### Dimensiones exteriores

- Modo "exteriores": `Lo, Wo, Ho` = lo que escribe el usuario.
- Modo "interiores" (útil entre soportes):
  - `Lo = largo + 4t` (2 paredes + 2 soportes)
  - `Wo = ancho + 2t`
  - `Ho = alto + 2t + tl + h` (BOTTOM + TOP + tapa + holgura)

`outerDimensions` de `shared.js` sólo suma `2t` al largo, así que el
módulo nuevo calcula estas tres cotas por su cuenta.

### Piezas

| Pieza | Cuerpo | Cantos |
|---|---|---|
| BOTTOM | `spanX × spanY` | macho en los 4, como caja cerrada |
| LEFT / RIGHT | `spanY × Ho` | caja cerrada: hembra arriba (TOP) y abajo (BOTTOM), macho hacia BACK en todo el alto; macho hacia FRONT sólo en el alto de FRONT |
| BACK | `Lo × Ho` | caja cerrada: hembra en los 4 |
| FRONT | `Lo × frontHeight` | canto superior liso; hembra abajo y a los lados |
| TOP | `spanX × (spanY + t)` | macho hacia LEFT, RIGHT y BACK; **canto delantero liso**, alargado `t` para quedar a ras de la cara exterior de FRONT. Lleva la ventana |
| SUPPORT 1, SUPPORT 2 | `spanY × supportHeight` | 4 cantos lisos |
| LID | `(spanX − 2h) × (spanY − h + t)` | 4 cantos lisos |

Juntas verticales:
- LEFT/RIGHT ↔ BACK: tramo `spanZ = Ho − 2t`, desde `t`.
- LEFT/RIGHT ↔ FRONT: tramo `spanZFront = frontHeight − 2t`, desde `t`
  (mismo criterio que el canal grabado: el último grosor bajo el canto
  liso de FRONT queda sin junta).
- Los dos laterales son espejo uno del otro respecto a cuál canto mira a
  FRONT (mismo motivo que en `sliding-box.js`: FRONT es más bajo que BACK,
  así que sus juntas miden distinto). El ajuste de `jointStart` para la
  arista `right` se hace igual que allí.
- TOP ↔ laterales: la junta cubre `spanY`, desplazada `t` desde el canto
  delantero de TOP (el tramo alargado sobre FRONT queda liso). TOP ↔ BACK:
  junta de caja cerrada sobre `spanX`.

Detalle estético conocido, igual que en el canal grabado: en cada esquina
delantera superior queda un hueco de `t × t × (Ho − frontHeight)`, porque
el lateral termina en la cara interior de FRONT por encima de FRONT. No
afecta el armado ni el deslizamiento.

### Ventana de TOP

En coordenadas de TOP (x desde la cara interior de LEFT, y desde el canto
delantero de TOP):

- `x` de `m` a `spanX − m` → ancho `spanX − 2m`
- `y` de `t + m` a `t + spanY − m` → fondo `spanY − 2m`

Es un corte pasante (`kind: 'hole'`, capa de corte), compensado de kerf
como `holeFeature` / `crossHoleFeature`: se dibuja `kerf/2` más chico por
lado para que, cortado, mida la medida nominal.

Marco automático: `m = t + 4.5`. Manual: el valor escrito, bueno o malo
(la validación lo juzga).

### Cuánto agarra la tapa

- Bajo el marco, por lado: `m − h`.
- Sobre cada soporte, por lado: `t − h`.
- Tramo delantero del marco (sobre la ranura de entrada, sujeto sólo por
  sus puntas): ancho `t + m`, largo libre `spanX`.

### Divisores

Los divisores existentes se adaptan al espacio útil entre soportes:

- Estantes (divisores de alto): ancho `spanX − 2t` en vez de `spanX`.
- Divisores de largo: sin cambio de tamaño (`spanY × innerHeight`); se
  reparten en `spanX − 2t`.
- `dividerHeight = innerHeight` (= alto de los soportes).
- Avisos de compartimentos angostos sobre `spanX − 2t`.

### Ejemplo de referencia

Exteriores 100 × 150 × 80, `t = 3`, `tl = 3`, `h = 0.2`, marco automático
(`m = 7.5`):

| Valor | Resultado |
|---|---|
| `spanX × spanY` | 94 × 144 |
| `railTop` = alto de FRONT | 73.8 |
| SUPPORT 1 y 2 | 144 × 70.8 |
| LID | 93.6 × 146.8 |
| TOP (cuerpo) | 94 × 147 |
| Ventana | 79 × 129 |
| Agarre bajo el marco / sobre el soporte | 7.3 / 2.8 por lado |
| Tramo delantero del marco | 10.5 de ancho, 94 de largo |
| Espacio útil | 88 × 144 × 70.8 |

Mismo resultado en modo "interiores" pidiendo 88 × 144 × 70.8.

## Modelo de datos

Parámetros nuevos (sólo cuentan con `lidType: 'sliding'`):

| Parámetro | Valores | Default |
|---|---|---|
| `slideMethod` | `'groove'` \| `'supports'` | `'groove'` |
| `windowFrame` | número (mm) | `t + 4.5` |
| `windowFrameAuto` | booleano | `true` |

Se reusan `lidThickness` (vía `lidThicknessFor` de `sliding-box.js`) y
`slideClearance`.

`buildSlidingSupportBox(params)` devuelve la misma forma que
`buildSlidingBox` (`panels, joints, errors, warnings, outer, inner, lid`),
sin `groove` ni `realOuterHeight`, y con:

```
supports: { width: spanY, height: supportHeight, count: 2 }
window:   { width: spanX − 2m, depth: spanY − 2m, frame: m }
```

Sin `realOuterHeight`: el alto exterior ya es el real (nada sobresale por
encima de TOP), y así la interfaz no muestra "alto real con reborde".

## Interfaz

- Dentro de los campos de "Deslizante", un selector:
  `Método del riel:  ● Canal grabado   ○ Soportes pegados`
- "Profundidad del canal" sólo con *Canal grabado*.
- "Marco de la ventana" + casilla *Automático* sólo con *Soportes
  pegados*. Con la casilla marcada el campo se deshabilita y muestra el
  valor automático (mismo patrón que `grooveDepth` / `grooveAuto`).
- "Grosor de la tapa" y "Holgura" se muestran con los dos métodos.
- `app.js` elige el generador: `sliding` + `supports` →
  `buildSlidingSupportBox` y su `autoTabWidth`.
- Nota bajo el dibujo (en lugar de la nota de canales): "Pega SUPPORT 1 y
  2 por dentro de LEFT y RIGHT, apoyados sobre BOTTOM, antes de cerrar la
  caja con TOP."
- Sufijo del archivo descargado: `-deslizante-soportes`.

## Validaciones

### Errores (no se generan piezas)

1. Los básicos de siempre (`validateBasics`, kerf ≥ grosor, espigas vs
   kerf) sobre los tramos `spanX`, `spanY`, `spanZ`, `spanZFront`.
2. Grosor de tapa ≤ 0; holgura negativa.
3. `h ≥ t`: la tapa ya no se apoya sobre los soportes.
4. `m − h ≤ 0`: el marco no sujeta la tapa; se caería por la ventana.
5. `spanX − 2m ≤ 0` o `spanY − 2m ≤ 0`: el marco se come la ventana.
6. `supportHeight ≤ 0` o `spanZFront ≤ 0`: la caja es demasiado baja para
   su tapa, o FRONT no deja sitio para sus espigas.
7. `spanX ≤ 2t` (no queda espacio entre soportes) o `spanY ≤ 0`.
8. Validación de divisores existente.

Todos los errores de geometría se juntan en un solo lote, como en el
canal grabado.

### Avisos (se generan piezas)

1. **Tramo delantero del marco angosto:** `t + m < spanX / 20`. Con el
   ejemplo (10.5 frente a 4.7) no avisa; con una caja de 300 mm de largo
   en 3 mm sí. Texto: el tramo sobre la entrada de la tapa queda sujeto
   sólo por sus puntas y puede quebrarse; sube el marco.
2. Holgura 0: la tapa entra a presión.
3. Holgura > 0.5: la tapa baila.
4. Tapa larga para su grosor (`lado menor / tl > 60`): se pandea.
5. Avisos comunes de juntas (`commonWarnings`) y de divisores.

## Módulos

| Archivo | Cambio |
|---|---|
| `js/boxes/sliding-support-box.js` | **Nuevo.** `slidingSupportHeights`, `windowFrameFor`, `autoTabWidth`, `buildSlidingSupportBox`, validación y avisos propios |
| `js/boxes/sliding-box.js` | Sin cambios. Se importa `lidThicknessFor` |
| `js/core/panel.js` | Sin cambios esperados; si hace falta un helper de agujero rectangular compensado, se agrega aquí junto a `holeFeature` |
| `js/ui/app.js` | Selección de generador, mostrar/ocultar campos, valor automático del marco, nota de armado, sufijo |
| `index.html` | Selector de método y campo de marco |
| `test.html` | Bloque nuevo de pruebas |
| `README.md` | Descripción del método y número de pruebas |

Reparto de trabajo (CLAUDE.md del proyecto): Claude escribe plan y revisa;
la construcción repetitiva/larga puede ir a Codex vía `codex-rescue`, y
todo lo que vuelva se revisa antes de aceptarlo.

## Pruebas

### Self-checks (`test.html`)

1. **Ejemplo de referencia:** las cotas de la tabla salen exactas (FRONT
   73.8, soportes 144 × 70.8, tapa 93.6 × 146.8, TOP 94 × 147, ventana 79 ×
   129 nominal y `79 − kerf` dibujada).
2. **Juntas:** macho/hembra comparten segmentación y géneros opuestos;
   espigas caen en ranuras; contornos cerrados, sin puntos duplicados,
   sin cruces.
3. **Modo interiores:** pedir 88 × 144 × 70.8 da el mismo resultado que el
   ejemplo.
4. **Errores:** cada uno de la lista se dispara con su caso y no devuelve
   piezas.
5. **Avisos:** cada uno se dispara con su caso; el ejemplo de referencia
   no dispara ninguno.
6. **Divisores:** estantes de `spanX − 2t` (88 en el ejemplo), divisores
   de largo de `spanY × innerHeight`.
7. **Barrido:** combinaciones de medidas, grosores, holguras y marcos sin
   `NaN` ni excepciones.
8. **Regresión del canal grabado:** `slideMethod` ausente o `'groove'`
   produce exactamente las mismas piezas que antes del cambio.
9. **Interfaz:** el selector muestra/oculta los campos correctos y el
   generador correcto se usa según el método.

### Prueba física

Dani corta el ejemplo de referencia en plywood de 3 mm (kerf 0.16 mm, su
caso calibrado) y confirma: la caja cierra con espigas como la cerrada,
los soportes quedan a la altura al apoyarlos en BOTTOM, la tapa entra por
el frente y desliza sin trabarse ni bailar, y el marco aguanta.

## Fuera de alcance

- Agarradera o muesca para tirar de la tapa (el canal grabado tampoco la
  tiene).
- Soportes tipo tira o pegados por fuera.
- Cerrar el hueco estético de las esquinas delanteras superiores.
- Marco de ventana distinto por lado.
