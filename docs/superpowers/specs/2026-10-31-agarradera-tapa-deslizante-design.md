# Agarradera de la tapa deslizante — diseño

Fecha: 2026-10-31
Estado: aprobado por Dani (aprobó diseño, plan y ejecución de corrido)
Rama: `divisiones-con-tab`

## Por qué

La tapa deslizante sale hoy como un rectángulo liso, a ras de la cara
exterior del frente. Cerrada, no sobresale nada: no hay de dónde agarrarla
para sacarla. Dani lo pidió directo: "debería tener una pequeña agarradera
hacia afuera para poder deslizarla con facilidad".

## Metas

- La tapa deslizante sale con una **lengüeta redondeada** que sobresale del
  canto delantero, más allá de la cara exterior del frente.
- Vale para los dos métodos: canal grabado y soportes pegados.
- Es la **misma manija que ya lleva la tapa con bisagra**: mismos
  parámetros, mismos valores por defecto, mismo aspecto. La caja se ve
  pareja sin importar qué tapa se elija.

## No-metas

- Perilla pegada, agujero para el dedo, o cualquier otra forma de agarre.
  La lengüeta sobresaliente es la que pidió Dani.
- Poder apagarla. *(Mi decisión: la manija de la tapa con bisagra tampoco
  se puede apagar, y poner un interruptor para cada adorno llena la
  interfaz. Si Dani la quiere opcional, es agregar una casilla como la de
  la agarradera de la tapa plana.)*
- Muesca a juego en ninguna pared: la lengüeta sobresale al aire, no entra
  en nada. En la tapa con bisagra sí hace falta la muesca, porque ahí la
  tapa cierra a ras entre las paredes; acá no.

## Anti-metas (sería un fracaso aunque "funcione")

- Que la lengüeta estorbe al deslizar: tiene que quedar siempre por fuera
  de la caja, nunca dentro del recorrido.
- Que se pueda pedir una lengüeta más ancha que la tapa, o tan ancha que
  no deje material a los costados: eso sale como error, no como pieza rota.
- Que cambie la tapa con bisagra, que ya usa estas mismas funciones.

## Restricciones

- Ejes: X = largo (izquierda–derecha), Y = ancho (frente–fondo, la
  dirección en que desliza la tapa), Z = alto.
- Sin dependencias nuevas, sin build step, textos en español.
- Nada de commits automáticos.

## La geometría

La tapa deja de ser un rectángulo liso y pasa a dibujarse punto por punto,
como ya se hace con la tapa de la bisagra:

- La lengüeta va **centrada en el canto delantero** de la tapa, que en
  coordenadas de pieza es `y = 0`, y sobresale hacia afuera (`y` negativo)
  — la misma convención que la manija de la bisagra, para que las dos
  piezas se vean iguales en la plancha.
- **Ancho:** `handleWidth`, 20 mm por defecto.
- **Profundidad:** `handleDepth`, grosor + 5 mm por defecto.
- **Esquinas de la punta:** redondeadas con radio 2 mm, con la función
  `roundedTabTip` que ya existe. Sólo se redondea la punta; la base, donde
  la lengüeta se funde con el canto recto, no es esquina.

Se reutilizan tal cual `handleWidthFor`, `handleDepthFor`,
`handleCornerRadiusFor` y `roundedTabTip`, exportadas por `hinged-box.js`.

## Validaciones

- Ancho y profundidad mayores que 0 (mismos mensajes que la bisagra).
- La lengüeta debe dejar material a los dos costados de la tapa: si
  `handleWidth` más dos grosores no cabe en el ancho de la tapa, sale
  error.

## Lo que el usuario tiene que saber

La caja cerrada mide lo que dice "Exterior", **más la profundidad de la
manija hacia el frente**. Eso va dicho en la ayuda del campo y en el
README: es la diferencia entre que la caja entre o no en un hueco justo.

## Lo que queda al builder

- Si conviene mover las funciones de manija de `hinged-box.js` a
  `shared.js`, ahora que las usan tres tipos de tapa. No es necesario para
  que esto funcione.
