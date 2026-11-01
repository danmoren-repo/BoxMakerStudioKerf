# Divisores de largo y de ancho — diseño

Fecha: 2026-10-31
Estado: aprobado por Dani (aprobó diseño, plan y ejecución de corrido)
Rama: `divisiones-con-tab`

## Por qué

Dani cortó una caja de 100 × 100 × 80 mm en plywood de 2.75 mm, tapa
deslizante con soportes, con un divisor de largo y uno de alto. Quedaron
cuatro compartimentos, pero **a los dos de abajo no se llega**: el divisor
de alto es una placa que tapa todo el piso a media altura, y la caja sólo
abre por arriba. Media caja queda inservible.

No es un error de medidas: es que la pieza no tiene sentido en ninguna de
las cajas que hace BoxMaker. Todas abren por arriba. Un estante sólo
serviría en un mueble que abre de lado, y eso está fuera del proyecto
(ver `project_boxmaker`).

La corrección: los divisores pasan a ser siempre **de largo y de ancho**.
Los dos son placas verticales que van del piso hasta justo debajo de la
tapa y se cruzan entre sí, formando una rejilla en planta como la de una
caja de botellas. Todo compartimento queda abierto por arriba.

## Metas

- Reemplazar "Divisores de alto" por **"Divisores de ancho"** en la
  interfaz, en el código y en la documentación.
- Los divisores de ancho son placas verticales perpendiculares a los de
  largo: parten el ancho de la caja en filas, igual que los de largo
  parten el largo en columnas.
- Los dos tipos tienen la **misma altura** (del piso a la cara interior de
  la tapa) y se cruzan **a media madera**, uno ranurado desde arriba y el
  otro desde abajo.
- El modo "Fijos con cejilla" sigue funcionando para los dos tipos: los de
  largo clavan su cejilla en las paredes frontal y trasera, los de ancho
  en las laterales.
- Funciona en los cuatro tipos de tapa que hoy soportan divisores: con
  espigas, plana, deslizante (canal) y deslizante (soportes), más la
  bisagra simple.

## No-metas

- Divisores de alto / estantes, en ninguna forma, ni escondidos como
  opción avanzada (decisión de Dani: "nunca de alto").
- Posiciones a mano: los divisores se siguen repartiendo solos a
  distancias iguales (como hoy).
- Compatibilidad con el parámetro `heightDividers`. Desaparece. Si llega,
  se ignora, como cualquier parámetro desconocido. *(Mi decisión: la app
  no guarda estado entre sesiones y el nombre no viaja en el nombre del
  archivo SVG, así que no hay nada que migrar.)*
- Divisores en la tapa con bisagra doble. Es el trabajo siguiente, después
  de la agarradera de la tapa deslizante.

## Anti-metas (sería un fracaso aunque "funcione")

- Que quede cualquier manera de generar un compartimento sin acceso desde
  arriba. Es el bug que estamos matando.
- Que una caja sin divisores salga distinta a la de hoy, en cualquier tipo
  de tapa.
- Que el cruce a media madera quede flojo o haya que forzarlo: debe
  ajustar igual que los dedos de las esquinas con el kerf calibrado de
  Dani (plywood 3 mm, kerf 0.16 mm — ver `boxmaker_kerf_calibration`).
- Que una ranura de cejilla debilite un dedo de las uniones, un canal de
  tapa deslizante o un agujero de bisagra. Esto ya lo atajan `slotFits` y
  los mensajes de error de hoy; deben seguir atajándolo.

## Restricciones

- Ejes: X = largo, Y = ancho, Z = alto.
- Rama `divisiones-con-tab`, encima del trabajo de la cejilla que ya está
  en el árbol sin commitear.
- Sin dependencias nuevas, sin build step. Self-checks en `test.html`,
  corridos en el navegador.
- Textos y comentarios en español, con el tono de los existentes.
- Nada de commits automáticos.

## El cambio, pieza por pieza

### Las dos placas

Hoy `DIVIDER-L` mide ancho interior × alto interior (vertical) y
`DIVIDER-H` mide largo interior × ancho interior (acostada). A partir de
ahora:

| Pieza | Ancho de la pieza | Alto de la pieza | Posición |
|---|---|---|---|
| `DIVIDER-L1..n` | ancho interior | alto interior | repartidas a lo largo del eje X |
| `DIVIDER-W1..n` | largo interior | alto interior | repartidas a lo largo del eje Y |

Las dos son la misma clase de pieza, cambiando qué tramo interior usan
como ancho. La etiqueta pasa de `DIVIDER-H` a `DIVIDER-W` (de *width*)
para que no se confunda con el significado viejo.

### El cruce

Los dos se cruzan a media madera, como hoy, pero ahora el solape es en
altura y no en profundidad:

- Profundidad de la ranura de cruce: **la mitad del alto interior** (hoy
  es la mitad del ancho interior).
- El divisor de largo se ranura **desde su canto de abajo**; el de ancho,
  **desde su canto de arriba**. *(Mi decisión: la elección es arbitraria
  mientras sean cantos opuestos; se fija para que el resultado sea
  repetible.)*
- Ancho de la ranura: el grosor del material menos el kerf, igual que hoy.
- Cada divisor de largo lleva una ranura por cada divisor de ancho, y al
  revés.

### Las cejillas (modo "Fijos con cejilla")

- Divisor de largo → cejilla en cada extremo, hacia las paredes **frontal
  y trasera**. Sin cambios respecto de hoy.
- Divisor de ancho → cejilla en cada extremo, hacia las paredes
  **laterales**, a media altura. La ranura en la pared lateral pasa a ser
  un rectángulo vertical del grosor del material de ancho por el ancho de
  un dedo de alto — la misma forma que la de la pared frontal, no la
  horizontal del estante de hoy.
- Las dos cejillas de una pieza van a la misma altura, para que la pieza
  se vea igual por los dos lados (decisión de Dani, se mantiene).

### Qué se simplifica

La regla de choque que hoy elige la altura de la cejilla del divisor de
largo esquivando las ranuras de los estantes **ya no hace falta por ese
motivo**: las ranuras de cruce ahora son verticales y no compiten por la
altura. La cejilla va siempre a media altura, salvo que el recorte
superior de la tapa con bisagra se lo impida — ese caso se mantiene tal
cual está hoy. El mensaje de error `NO_TAB_ROOM` pierde su razón de ser.

### Qué validación nace

El conflicto se mueve de vertical a horizontal: ahora lo que puede chocar
es la **raíz de la cejilla** contra la **primera ranura de cruce**. Debe
quedar al menos un grosor de material entre las dos, lo que se traduce en
que cada compartimento debe medir al menos 1.5 veces el grosor del
material, en los dos ejes:

- largo interior ÷ (divisores de largo + 1) ≥ 1.5 × grosor
- ancho interior ÷ (divisores de ancho + 1) ≥ 1.5 × grosor

Es la misma forma que la comprobación que hoy se le hace al estante solo,
movida al eje que corresponde. El mensaje reusa `slotTooClose`.

La validación de hoy que exige que la mitad del ancho interior supere el
grosor pasa a exigir lo mismo de **la mitad del alto interior**, porque es
ahí donde entalla la ranura de cruce.

### La interfaz

- "Divisores de alto" → "Divisores de ancho", con la ayuda reescrita:
  parten el ancho en filas, se cruzan con los de largo a media madera.
- El selector "Tipo de divisor" no cambia.
- Los avisos de compartimento angosto pasan a hablar de largo y de ancho.

## Resuelto durante la implementación

- **El barrido de la tapa con bisagra:** el recorte superior se le sigue
  aplicando sólo al divisor de largo. Para los de ancho, si alguno cae
  dentro de la franja que barre la cola de la tapa, sale un error pidiendo
  menos divisores de ancho, en vez de recortarle el canto y debilitarlo.
- **Las dos funciones de dibujo sí se unificaron** en `buildDividerPoints`,
  con un parámetro que dice desde qué canto se entalla la ranura.
- **`NO_TAB_ROOM` se conserva**, con texto nuevo: sigue haciendo falta un
  error para cuando el alto interior no da para la cejilla, o cuando el
  recorte de la bisagra se la come.

## Lo que queda al builder

- Cómo repartir el trabajo entre `dividers.js` y cada tipo de caja: el
  criterio de hoy (toda la geometría de divisores vive en `dividers.js`,
  cada caja pone las ranuras en coordenadas de su pared) se mantiene.
- Si conviene unificar las dos funciones que dibujan las placas en una
  sola con un parámetro de canto, ahora que las dos piezas son iguales
  salvo el canto que se ranura.
- Verificar el recorte superior de la tapa con bisagra sobre los divisores
  de ancho: hoy sólo se le aplica a los de largo. La tapa gira sobre el
  canto trasero, así que el barrido queda en una franja al fondo de la
  caja; hay que comprobar si algún divisor de ancho cae en esa franja y,
  si cae, aplicarle el mismo recorte.
- Los nombres internos (`widthDividers`, `DIVIDER-W`, `divider-slot-w`).
