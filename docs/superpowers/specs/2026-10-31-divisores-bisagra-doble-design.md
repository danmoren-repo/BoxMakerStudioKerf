# Divisores en la tapa con bisagra doble — diseño

Fecha: 2026-10-31
Estado: aprobado por Dani (aprobó diseño, plan y ejecución de corrido)
Rama: `divisiones-con-tab`

## Por qué

La tapa con bisagra doble nunca soportó divisores, ni en `main`:
`hinged-double-box.js` no menciona la palabra ni una vez. Los campos de
divisores siguen visibles en la interfaz con esa tapa elegida y aceptan
números, y la caja sale sin divisores y sin ninguna advertencia. Quien no
cuente las piezas corta la caja creyendo que lleva divisiones.

Es el último de los tres pendientes que Dani ordenó el 2026-10-31, después
de la rejilla de divisores y de la agarradera de la tapa deslizante.

## Metas

- La tapa con bisagra doble acepta divisores de largo y de ancho, sueltos
  o fijos con cejilla, igual que los otros cuatro tipos de tapa.
- Ningún divisor traba el giro de las dos mitades de la tapa.
- **Arreglar la franja barrida de la bisagra simple**, que quedó mal: el
  umbral que compara la posición de un divisor contra el barrido usa el
  hundimiento vertical del recorte en vez de su alcance horizontal.

## No-metas

- Cambiar la bisagra doble en nada que no sean los divisores.
- Inventar una geometría de divisor distinta para esta tapa.

## Anti-metas

- Que un divisor quede bajo el recorrido de una mitad de la tapa y la
  trabe al abrir. Es exactamente el problema que esta tapa tiene que
  esquivar.
- Que cambie cualquier caja de los otros cuatro tipos de tapa.

## La geometría, y por qué es el espejo de la bisagra simple

En la **bisagra simple** el eje va de izquierda a derecha, pegado al
fondo. La cola de la tapa barre una franja a lo ancho del fondo. Los
divisores de **largo** llegan hasta la pared trasera, así que se les
recorta la esquina superior; los de **ancho** se comprueban contra la
franja y, si caen dentro, sale error.

En la **bisagra doble** el eje de cada mitad va de adelante hacia atrás,
pegado a su lateral. Cada mitad barre una franja a lo largo de su lateral.
Entonces todo se invierte: los divisores de **ancho** son los que llegan
hasta los dos laterales y se les recorta la esquina superior; los de
**largo** son los que se comprueban contra las dos franjas.

Las medidas del recorte son las mismas que ya usa la bisagra simple:
`width = 2 × pivotInset`, `depth = pivotInset − grosorTapa/2`, con
`pivotInset = margen de material + radio del agujero`. En la bisagra doble
ese `pivotInset` ya está, implícito, en `postCenterX`.

### El choque de cantos, y cómo se resuelve

Una placa se entalla desde un canto para cruzar a la otra, y el recorte de
esquina vive en el canto de arriba. Hoy el divisor de largo se entalla
desde abajo y el de ancho desde arriba, así que el recorte de esquina sólo
cabe en el de largo. En la bisagra doble hace falta justo al revés.

La solución no es permitir muescas y recortes en el mismo canto — es
**intercambiar desde qué canto se entalla cada placa**. El cruce a media
madera sólo necesita que sean cantos opuestos; cuál es cuál da igual. Así
que `buildDividerPanels` recibe un parámetro nuevo que dice a cuál de las
dos placas se le recortan las esquinas, y la otra pasa a entallarse desde
arriba. Sin ese parámetro, todo queda como está hoy.

### El arreglo de la bisagra simple

El barrido de la cola es un sector de círculo de radio `pivotInset`
centrado en el eje. Horizontalmente llega desde la cara interior de la
pared hasta `2 × pivotInset` hacia adentro; verticalmente baja
`pivotInset − grosorTapa/2`. El recorte de esquina ya usa esas dos
medidas bien. La comprobación de la franja, en cambio, compara una
posición **horizontal** contra la medida **vertical**. Con los valores por
defecto (grosor 3, espiga 3, holgura 0.5) el alcance horizontal real es
8.74 mm y el umbral usado es 2.87: un divisor entre esas dos medidas pasa
la validación y queda igual bajo la tapa.

Se corrige usando el alcance horizontal en los dos tipos de bisagra.

## Restricciones

- Ejes: X = largo, Y = ancho, Z = alto.
- Sin dependencias nuevas, sin build step, textos en español.
- Nada de commits automáticos.

## Lo que queda al builder

- Las paredes frontal y trasera de esta tapa llevan dos postes, dos
  agujeros de bisagra y la muesca central de las lengüetas. Todos son
  obstáculos para las ranuras de cejilla y hay que pasárselos a `slotFits`
  como ya se hace en la bisagra simple.
- En esas paredes, `y = 0` es el canto superior de la **pared**, con los
  postes en `y` negativo, aunque la pieza declare una altura que los
  incluye. Las ranuras se sitúan contra el alto de pared, no contra el
  alto declarado.
