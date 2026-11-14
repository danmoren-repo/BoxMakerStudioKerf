# Vista previa 3D de la caja armada — diseño

Fecha: 2026-11-13
Estado: **aprobado por Dani** (2026-11-13). Pendiente: el plan de implementación.
Rama: por crear (sugerida: `preview-3d`)

## Por qué

Hoy BoxMaker enseña las piezas planas, acomodadas en la plancha. Eso sirve
para cortar, pero no sirve para enseñar. Dani necesita mostrarle la caja a
dos personas distintas antes de que exista:

- **Al cliente**, para darle una idea visual de lo que va a recibir.
- **Al fabricante**, para que entienda cómo se arma.

Ninguna de las dos lee un plano de corte. Las dos entienden una caja.

Esta vista **no es para revisar errores de corte** — de eso ya se encarga
el SVG plano y las validaciones. Es una vista de presentación.

De los tres generadores que Dani revisó (Makorix SlipTop, MakerCase y
Vector Painter), eligió el aspecto y el comportamiento de **Vector
Painter**, repintado con los colores de Studio Kerf CR.

## Metas

- Una vista 3D de la caja armada, dentro de BoxMaker, en una pestaña al
  lado de la vista de piezas actual.
- Se gira arrastrando con el mouse, se hace **zoom con la rueda** y se
  desplaza. Se puede ver desde cualquier ángulo.
- Un control que **abre la caja** — levanta la tapa y separa las paredes —
  para entender el armado.
- Aspecto **Studio Kerf CR**: fondo crema, piezas color lámina, ámbar para
  la acción y teal para el grabado. Sin modo oscuro, sin gradientes, sin
  sombras en reposo.
- La geometría sale del **mismo contorno que se manda a cortar**. Una sola
  fuente de verdad.
- Funciona en **todos los tipos de caja** que BoxMaker ya hace: espigas,
  plana con agarradera, deslizante de canal, deslizante con soportes,
  bisagra simple y bisagra doble, con divisores y cejillas.
- El 3D **se carga solo cuando se abre la pestaña**, nunca antes.
- Botón para **bajar un PNG** de la vista actual. *(Mi decisión: sin esto,
  la vista solo sirve con Dani presente y su propósito declarado es
  enseñársela a dos personas que no están ahí. El link compartible
  resuelve lo mismo mejor, pero pertenece al proyecto de la mudanza al
  sitio. El PNG es el puente barato mientras tanto, y viaja por WhatsApp,
  que es el canal que Studio Kerf ya usa. Si Dani lo quiere fuera, se
  quita sin tocar nada más.)*
- Un panel chico con **dimensiones interiores y volumen** en tipografía
  mono. *(Mi decisión: Dani dijo que no le interesa pero que no se opone si
  es barato. Lo es — los números ya se calculan. Es la primera cosa que se
  corta si estorba.)*

## No-metas

- **Mudar BoxMaker al sitio de Studio Kerf.** Es el proyecto siguiente y
  ya se acordó el orden: primero el 3D.
- **Link compartible con los parámetros en la dirección.** Pertenece a la
  mudanza. El diseño no debe estorbarlo, pero no se construye aquí.
- **Vista de plancha animada** (las piezas acostadas como van al corte,
  interpolando hasta la caja armada). Vector Painter la tiene. *(Mi
  decisión: la vista 2D ya enseña eso, y la pose plana obligaría a
  arrastrar el acomodo del SVG al 3D. El control va de caja armada a caja
  abierta, nada más.)*
- **Medidas acotadas, cortes de sección, vistas ortogonales.** No es un
  visor CAD.
- **Cambiar el aspecto del resto de BoxMaker.** Solo el escenario 3D entra
  en colores Studio Kerf. Repintar la app entera es parte de la mudanza.
- **Rediseñar la bisagra.** La segunda opción de bisagra con oreja sigue
  siendo un proyecto aparte. El 3D dibuja la bisagra que exista hoy.
- **Cargar three.js desde un CDN.** Ver restricciones.

## Anti-metas (sería un fracaso aunque "funcione")

- **Que el 3D enseñe una caja que no corresponde a lo que sale del láser.**
  Es el peor resultado posible: un error silencioso y plausible, en una
  vista cuyo propósito es enseñársela al fabricante. Peor que no tener 3D.
- **Que existan dos fuentes de verdad de la geometría**, una para cortar y
  otra para ver, que puedan separarse con el tiempo.
- **Que la pantalla se vea naranja.** La guía de Studio Kerf es explícita:
  el ámbar se usa poco, solo en acciones. Un 3D con todas las uniones
  pintadas de ámbar incumple la marca.
- **Que abrir BoxMaker se vuelva lento** para quien solo quiere su SVG.

## Restricciones

1. **Sin empaquetador.** BoxMaker son módulos ESM sueltos que el navegador
   carga directo, igual que el sitio de Studio Kerf. No se introduce uno.
2. **Sin scripts de CDN.** El README del sitio lo dice y el sitio ya lo
   cumple: ni un script externo en `index.html`, y las fuentes se bajaron
   de Google Fonts a `assets/fonts/`. three.js va **dentro del repo**.
   Medido: three.js 0.180 pesa 339 KB en disco y **66 KB por la red** con
   brotli, que Cloudflare aplica solo. La versión r128 que usan Makorix y
   Vector Painter pesa el doble; no se usa.
3. **Cloudflare Pages, plan gratuito, sin paso de compilación.** Cloudflare
   sirve los archivos tal cual. Nada de lo que se construya aquí puede
   requerir un build.
4. **Nombres de color del sitio desde el primer día.** El escenario 3D usa
   `--ember`, `--engrave`, `--sheet`, `--sheet-deep`, `--ink`, `--paper`,
   con esos nombres exactos, en un archivo de variables aparte. El día de
   la mudanza se borra ese archivo, se carga `/styles.css` del sitio y
   todo sigue funcionando porque los nombres ya coinciden.
5. **Las pruebas actuales no se rompen.** Corren en `test.html` contra
   archivos dorados. El contorno de las piezas no cambia.

## Caminos considerados

El grueso del trabajo es igual en todos: extruir el contorno de cada pieza
al grosor del material, armar la escena, los controles, el aspecto y el
control de apertura. Lo único que cambia es **de dónde sale la información
de dónde va cada pieza y cómo está girada**, que hoy no existe en ninguna
parte porque para cortar plano no hace falta.

**Camino A — Módulo de colocación aparte.** Un archivo nuevo recibe la caja
terminada y, mirando el nombre de cada pieza y las medidas generales,
calcula dónde ponerla. No se toca nada probado. A cambio, tendría que
volver a deducir por fuera cosas que los constructores ya saben por dentro:
el milímetro extra de holgura que la tapa con soporte encolado recibió en
el commit `1d1d5c7` vive dentro de ese constructor. Un módulo externo no se
entera y pone la tapa fuera de sitio, sin que nada falle. Cada ajuste fino
futuro abre la misma grieta.

**Camino B — Cada constructor declara la pose de su pieza.** En el momento
en que el constructor crea una pieza, cuando ya tiene en la mano el alto de
pared, el grosor y las holguras, anota también dónde va y cómo está girada.
El 3D solo lee ese dato. Cuesta tocar los cinco constructores y sus
pruebas, pero la información queda escrita donde vive el conocimiento y no
puede desincronizarse. Regala además la pose explotada: se empuja cada
pieza hacia afuera en la dirección en que mira.

**Camino C — Isométrica en SVG, sin three.js.** Descartado: no se puede
girar de verdad ni hacer zoom con la rueda, que es un requisito explícito.

**Elegido por Dani: el camino B.** El A es más seguro hoy y más frágil para
siempre, y el modo en que falla es justo la anti-meta principal.

## Cómo funciona

### La pose de cada pieza

Cada pieza que devuelve un constructor gana un dato nuevo, su **pose**, con
cuatro campos. Origen en el centro de la caja, eje vertical hacia arriba,
todo en milímetros.

| Campo | Qué dice |
|---|---|
| **posición** | dónde va el centro de la pieza en la caja armada |
| **giro** | cómo está orientada |
| **grupo** | `cuerpo`, `tapa`, `divisor` o `saliente` |
| **apertura** | hacia dónde y cómo se mueve al abrir la caja |

*(Mi decisión: la apertura se declara, no se deduce. El diseño anterior
decía que cada pieza se corre "hacia afuera en la dirección en que mira", y
eso falla en piezas reales: las dos mitades de la perilla son planos
verticales cruzados a media madera, así que su normal es horizontal y
deducirla las saca de lado atravesando la tapa. Declararlo cuesta un campo
más en el contrato que escriben los cinco constructores, y es el único
momento barato para definirlo: tocarlos dos veces es tocar también sus
pruebas dos veces.)*

El **grupo** no es decoración: decide qué piezas cuentan para la prueba de
la caja envolvente y en qué momento se mueve cada una al abrir.

### La convención de cara interior

Esta es la parte del diseño que más fácil se rompe en silencio, así que se
fija aquí y no se deja a criterio de nadie.

En el corte plano todas las piezas se dibujan vistas desde la misma cara.
En 3D no: hay piezas **espejo a propósito**. Los dos laterales de la
deslizante de canal son espejos porque el canal va solo en la cara
interior, y el constructor trae un comentario largo advirtiendo que
equivocar el lado le presenta al frente la junta del fondo y **la caja no
monta**. Los laterales de la bisagra llevan poste y agujero asimétricos.

La convención: **la cara del contorno tal como está dibujado en el SVG es
la cara interior de la pieza.** Toda pose que gire una pieza debe dejar esa
cara mirando al interior de la caja. Se comprueba automáticamente (prueba 4).

Dos avisos más para quien construya:

- Los contornos están en coordenadas de SVG, donde el eje vertical crece
  **hacia abajo**. Al pasar a 3D hay que voltearlo.
- La extrusión crece en una sola dirección desde el plano del contorno.
  Conviene centrarla en el grosor, para que la posición declarada sea la
  del centro de la pieza y no la de una de sus caras.

### Las dos poses y el control de apertura

Solo hay dos poses: **armada** (la declarada) y **abierta**. Cada pieza
llega a la abierta siguiendo la trayectoria que declara su pose.

El control es **un solo deslizador de 0 a 100 %**. *(Mi decisión: Makorix
usa dos, uno para la tapa y otro para las paredes. Uno solo es más fácil
de entender y de explicarle a un cliente.)*

El movimiento va **escalonado por grupo**, para que se lea como una caja
que se abre y no como una explosión simultánea:

| Grupo | Qué contiene | Cuándo se mueve |
|---|---|---|
| `tapa` | TOP, TOP-INSERT, la tapa deslizante o abatible | del 0 % al 50 % |
| `saliente` | las mitades de la perilla, las manijas | con su tapa |
| `divisor` | divisores de largo y de ancho, y sus cejillas | del 20 % al 70 % |
| `cuerpo` | BOTTOM, FRONT, BACK, LEFT, RIGHT, SUPPORT 1/2 | del 30 % al 100 % |

*(Mi decisión sobre el reparto: los salientes viajan pegados a su tapa
porque son parte de ella, y los divisores salen antes que las paredes
porque es el orden real de desarme.)*

### Las trayectorias

**Decisión de Dani: realista donde importa.** La apertura no es un despiece
uniforme; cada pieza sigue el recorrido con el que de verdad se arma, en
las cajas donde ese recorrido no es obvio.

El campo `apertura` de la pose admite dos formas:

- **Recta** — una dirección y una distancia. Es el caso por defecto y
  cubre la mayoría de las piezas.
- **Giro** — un eje y un ángulo. Para las tapas abatibles.

Los casos que obligaron a esta decisión:

| Pieza | Recorrido | Por qué no sirve el recto hacia afuera |
|---|---|---|
| Tapa deslizante (canal y soportes) | sale **deslizando** a lo largo de su canal | está capturada entre los rieles; levantarla recto enseña un armado que no existe |
| Tapa de bisagra (simple y doble) | **gira** sobre su eje | no se separa de la caja, se abre |
| Mitades de la perilla | suben **rectas hacia arriba**, saliendo de la cruz de la tapa | son planos verticales cruzados: su normal es horizontal y deducirla las sacaría de lado atravesando la tapa |
| Todo lo demás | recto hacia afuera | el armado se entiende solo |

Una caja de espigas se entiende aunque las piezas salgan rectas. Una tapa
deslizante no, y es justo la que más hay que explicarle al fabricante.

### Los agujeros, los rebajes y los grabados

Las piezas traen **tres** clases de detalle, no dos. Confundirlas abre
huecos donde debería haber madera, o entierra piezas dentro de madera
maciza.

1. **Cortes pasantes** — los agujeros de la agarradera, las ranuras de los
   divisores. Atraviesan la madera y se restan de la pieza extruida.
2. **Rebajes** — los que llevan una profundidad declarada. El caso
   importante es **el canal de la tapa deslizante**: un rebaje de media
   madera en las caras interiores de los laterales y del fondo, y es lo que
   sostiene la tapa. No es decoración: la tapa se dibuja metida dentro de
   él.
3. **Grabado superficial** — sin profundidad. Se pinta sobre la cara en
   teal y no se resta.

*(Mi decisión sobre cómo se construye el rebaje, porque es la geometría más
delicada del proyecto y no quiero que nadie recurra a una librería de
operaciones booleanas, que la restricción 2 no contempla: una pieza con un
rebaje de profundidad `p` se arma como **dos extrusiones apiladas** — una
capa del contorno completo con grosor `grosor − p`, y encima una capa del
contorno menos el rectángulo del rebaje, con grosor `p`. Las dos son
extrusiones de un contorno con agujeros, que es exactamente la técnica que
ya hace falta para los pasantes. Sin dependencias nuevas y sin recortar
sólidos.)*

Tratar el canal como grabado no es una opción: el canto de la tapa quedaría
enterrado en madera maciza en toda caja deslizante de canal, que es
justamente el tipo cuyo armado es más difícil de explicarle al fabricante.

### Colores

| Qué | Color | Variable |
|---|---|---|
| Fondo del escenario | crema | `--ink` |
| Caras de las piezas | lámina | `--sheet` |
| Cantos cortados por el láser | lámina oscura | `--sheet-deep` |
| Contorno de cada pieza | café al 25 % | derivado de `--paper` |
| Pieza señalada con el mouse | ámbar | `--ember` |
| Grabados sobre las caras | teal | `--engrave` |

*(Mi decisión, y se aparta del mockup que Dani aprobó: en el mockup todas
las uniones iban pintadas de ámbar. A tamaño de caja completa eso deja la
pantalla naranja, que la guía de Studio Kerf prohíbe explícitamente. El
ámbar queda reservado para la acción — la pieza señalada — que es lo que su
propia gramática de color dice: ámbar es acción, teal es información. Los
cantos más oscuros bastan para que las uniones se lean, y además es verdad:
el láser quema el canto. Si Dani prefiere el ámbar del mockup, se cambia en
una línea.)*

El escenario **se mantiene crema aunque BoxMaker esté en modo oscuro**.
*(Mi decisión: es una vista de material, como una fotografía de la pieza.
Cambiarle el fondo según el tema la haría mentir sobre el color de la
madera, y la guía de Studio Kerf no tiene modo oscuro.)*

### Dónde vive en la interfaz

La zona de vista previa gana dos pestañas: **Piezas** (lo de hoy) y **3D**.
El motor 3D y three.js se cargan la primera vez que alguien abre la pestaña
3D, nunca al abrir la página.

Al hacer clic en una pieza se muestra su nombre. Le sirve al fabricante
para saber qué está viendo.

## Qué se prueba

Las pruebas actuales corren en `test.html` contra archivos dorados y no
cambian: el archivo dorado compara **solo los puntos** de cada pieza, así
que añadirle un campo de pose a los paneles no las toca.

Se añaden cuatro comprobaciones:

1. **Toda pieza tiene pose completa.** Ninguna se queda sin posición, giro,
   grupo ni apertura.
2. **La caja armada mide lo que dice medir.** La caja envolvente de las
   piezas **del grupo `cuerpo`** coincide con las dimensiones exteriores
   calculadas. *(Corregido: la versión anterior comparaba todas las piezas
   y habría fallado con geometría correcta en al menos tres tipos de caja —
   las mitades de la perilla sobresalen por encima de la tapa, las manijas
   sobresalen del frente, y la deslizante de canal expone un alto real con
   reborde distinto del alto exterior. Donde la caja declare ese alto real,
   la prueba se compara contra él.)*
3. **Ninguna pieza invade el espacio de otra.** Comprobación **aproximada**,
   por solapamiento de cajas envolventes entre piezas de grupos distintos,
   con tolerancia derivada del kerf. *(Corregido, y bajo la expectativa: la
   versión anterior pedía intersección real de sólidos y la declaraba "la
   que de verdad protege". No lo es, y además no es viable: los contornos
   ya traen compensación de kerf, así que todo diente macho invade el plano
   de su hembra; hay piezas que atraviesan a otras por diseño, como el
   poste de la bisagra o la cejilla del divisor; y una intersección exacta
   de sólidos no convexos en una página de pruebas sin dependencias sería
   más trabajo que todo el resto del proyecto. Lo que queda caza errores
   gruesos de colocación, que es lo que debe cazar.)*
4. **Toda pieza mira hacia donde debe.** Todo rebaje y todo grabado termina
   en la cara interior de su pieza. *(Nueva. Es la que protege de verdad
   contra la anti-meta principal: si una pose voltea un lateral de la
   deslizante, el canal queda por fuera y la caja no monta — pero se ve
   perfecta, mide exactamente lo que debe medir y no invade nada, o sea que
   pasa las otras tres sin despeinarse.)*

Se corren sobre una configuración representativa de cada tipo de caja, más
dos variantes de riesgo: divisores con cejilla y tapa plana con perilla.
*(Mi decisión: son las dos que meten piezas fuera del cuerpo y
atravesamientos por diseño.)*

**Lo que estas pruebas no pueden darte:** ninguna demuestra que el modelo
corresponda al corte. Cazan errores gruesos y el volteo de piezas. La
confianza final viene de mirar las seis cajas una vez, con el control de
apertura, y compararlas con el SVG.

## Qué queda a criterio de quien construya

- La organización de los archivos nuevos y los nombres internos.
- Cómo se vendoriza three.js y sus controles de órbita en el repo, y cómo
  se documenta la actualización de esa copia.
- La técnica para restar los agujeros pasantes y para dibujar los
  contornos.
- La posición y la cámara iniciales, y si hay un botón de reencuadre.
- El orden de implementación: es razonable empezar por la caja simple,
  verla funcionar, y extender al resto.

## Referencias

- Análisis técnico de los tres generadores: memoria `project-preview-3d`.
- Guía de estilo del sitio: `StudioKerftake2/docs/guia-estilo-subpaginas.md`.
- Mockups de esta conversación: `.superpowers/brainstorm/32205-1794618657/`.
