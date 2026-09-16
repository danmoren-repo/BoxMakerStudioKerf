# Tapa deslizante — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir un tercer tipo de tapa a BoxMaker — una tapa que desliza dentro de un canal vaciado en laterales y fondo, entrando por el frente, con el canal marcado en una capa de grabado aparte del SVG.

**Architecture:** Extensión mínima sobre el generador actual. Una pieza gana una lista opcional de contornos interiores (`features`) con etiqueta de capa; el renderer emite un segundo grupo SVG para ellos. Lo común a los dos generadores se extrae a `js/boxes/shared.js` y la caja deslizante vive en su propio módulo `js/boxes/sliding-box.js`. La caja cerrada y la tapa plana no cambian de comportamiento, y un check de regresión con geometría congelada lo demuestra.

**Tech Stack:** JavaScript ES modules, sin dependencias, sin build step. Web estática servida por `dev-server.mjs` (node). Self-checks en `test.html`, ejecutados en el navegador.

**Spec:** `docs/superpowers/specs/2026-09-14-tapa-deslizante-design.md` — leerlo entero antes de empezar. El plan argumenta desde el spec; las fórmulas y el porqué de cada número están ahí.

## Global Constraints

- **Rama de trabajo:** `tapa-deslizante`. No trabajar sobre `main`.
- **Sin dependencias nuevas, sin build step, sin backend.** Es una web estática client-side y se queda así.
- **Todo en milímetros.** El SVG exportado lleva `width`/`height` en mm y un `viewBox` con los mismos números: 1 unidad = 1 mm.
- **Idioma:** mensajes de error y aviso en español (son para Dani); etiquetas de pieza en el SVG en inglés (`BOTTOM`, `FRONT`, `BACK`, `LEFT`, `RIGHT`, `LID`).
- **Idioma de los comentarios**, que el repo ya tiene resuelto por carpeta y conviene no romper: `js/core/` y `js/render/` van **en inglés**, sin excepciones — son geometría y dibujo puros. `js/boxes/` va **mixto a propósito**: inglés para explicar la estructura del código, español para el razonamiento de taller (por qué una pared pierde un grosor, por qué una junta arranca maciza). Al añadir un comentario, mirar primero qué carpeta es.
- **Color de la capa de grabado:** `#e5484d`. Color de la capa de corte: `#000000`. `stroke-width` 0.2 en ambas.
- **El canal se dibuja a medida terminada, sin compensación de kerf.** El kerf sólo se aplica a cortes pasantes.
- **Caso de referencia que no se puede romper:** caja cerrada 80 × 80 × 80 exteriores, `thickness` 3, `kerf` 0.16, `tabWidth` 12, `lidType` `finger`. Es la caja que Dani ya cortó y validó físicamente.
- **Números del ejemplo canónico de la tapa deslizante** (80 × 80 × 80 exteriores, `t` 3, `tl` 3, `p` 1.5, `h` 0.2): laterales 74 × 83.2 · fondo 80 × 83.2 · frente 80 × 77 · base 74 × 74 · tapa 76.6 × 78.3 · canal piso 77, techo 80.2, profundidad 1.5 · canal del fondo ancho 77.0 de x = 1.5 a x = 78.5 · interior 74 × 74 × 74.
- **Commits:** cada tarea termina en commit, con el mensaje que indica la tarea. **No hacer `git push`** — el push lo corre Dani a mano.
- Terminar cada mensaje de commit con:
  `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`

## Cómo se corren los checks

No hay runner de línea de comandos: los self-checks viven en `test.html` y corren en el navegador. El ciclo, idéntico en todas las tareas:

1. Levantar el servidor (si no está ya levantado):
   `preview_start` con `{ "name": "boxmaker" }` — usa `.claude/launch.json`, puerto 8000.
2. Navegar a `http://localhost:8000/test.html`. **No hay recarga automática**: después de cada edición hay que volver a navegar a esa URL para que el navegador recargue los módulos.
3. Leer la consola con `read_console_messages`.
   - Verde: aparece la línea `ALL CHECKS PASSED`.
   - Rojo: aparece `FAILED: <nombres de los checks que fallaron>`.
4. Para ver el detalle de un fallo, `get_page_text` sobre la misma pestaña: cada check fallado sale con su mensaje.

Los módulos de geometría (`js/core/*.js`, `js/boxes/*.js`) no tocan el DOM, así que para depurar un cálculo suelto se puede importar en node directamente. Eso es para depurar; **los checks que cuentan son los de `test.html`**.

---

### Task 1: Congelar la geometría actual como red de seguridad

Antes de mover una sola línea, dejamos grabada la geometría que hoy produce la caja cerrada. Todo lo que sigue se apoya en este check: si un refactor cambia un punto de un contorno, salta acá.

**Files:**
- Create: `test/golden-finger-80.json`
- Modify: `test.html` (bloque de imports, y un check nuevo)

**Interfaces:**
- Consumes: `buildBox(params)` de `js/boxes/simple-box.js`, ya existente.
- Produces: `test/golden-finger-80.json`, un objeto `{ [panelId]: [[x, y], ...] }` con los puntos redondeados a 3 decimales. Las tareas siguientes no lo tocan; sólo el check lo lee.

- [ ] **Step 1: Generar el fixture desde el código actual**

Escribir este script en el scratchpad (no en el repo) y correrlo. Sustituir `<REPO>` por la ruta absoluta del repositorio.

```js
// <SCRATCHPAD>/gen-golden.mjs
import { buildBox } from '<REPO>/js/boxes/simple-box.js';

const box = buildBox({
  length: 80, width: 80, height: 80,
  thickness: 3, kerf: 0.16, tabWidth: 12,
  dimensionMode: 'outer', lidType: 'finger',
});

if (box.errors.length > 0) throw new Error(box.errors.join(' | '));
if (box.panels.length !== 6) throw new Error(`esperaba 6 piezas, hay ${box.panels.length}`);

const r = (v) => Math.round(v * 1000) / 1000;
const data = Object.fromEntries(
  box.panels.map((p) => [p.id, p.points.map((q) => [r(q.x), r(q.y)])]),
);
console.log(JSON.stringify(data, null, 0));
```

Run:
```bash
mkdir -p test && node <SCRATCHPAD>/gen-golden.mjs > test/golden-finger-80.json
```

Verificar que el archivo no está vacío y tiene las seis piezas:
```bash
node -e "const g=require('./test/golden-finger-80.json');console.log(Object.keys(g).join(','), Object.values(g).map(p=>p.length).join('/'))"
```
Expected: imprime `bottom,front,left,top,back,right` y seis longitudes, todas > 4.

- [ ] **Step 2: Escribir el check de regresión**

En `test.html`, dentro del `<script type="module">`, justo después de la línea `const t = BASE.thickness;`, añadir:

```js
    // Geometría congelada de la caja que Dani cortó y validó (kerf 0.16, 3 mm).
    // Si este check se pone rojo, algo cambió la caja cerrada: no seguir.
    const GOLDEN = await fetch('./test/golden-finger-80.json').then((r) => r.json());
    const GOLDEN_PARAMS = {
      length: 80, width: 80, height: 80,
      thickness: 3, kerf: 0.16, tabWidth: 12,
      dimensionMode: 'outer', lidType: 'finger',
    };

    check('regresión: la caja cerrada de 80×80×80 en 3 mm sigue idéntica', () => {
      const current = buildBox(GOLDEN_PARAMS);
      assert(current.errors.length === 0, current.errors.join(' | '));
      const ids = Object.keys(GOLDEN);
      assert(current.panels.length === ids.length,
        `${current.panels.length} piezas, esperaba ${ids.length}`);
      for (const id of ids) {
        const panel = current.panels.find((p) => p.id === id);
        assert(panel, `falta la pieza ${id}`);
        assert(panel.points.length === GOLDEN[id].length,
          `${id}: ${panel.points.length} puntos, esperaba ${GOLDEN[id].length}`);
        panel.points.forEach((q, i) => {
          const [gx, gy] = GOLDEN[id][i];
          assert(near(q.x, gx, 1e-3) && near(q.y, gy, 1e-3),
            `${id}[${i}]: (${q.x}, ${q.y}), esperaba (${gx}, ${gy})`);
        });
      }
    });
```

- [ ] **Step 3: Correr los checks — deben pasar en verde**

Seguir "Cómo se corren los checks".
Expected: `ALL CHECKS PASSED`, y en la página el check nuevo aparece con ✔.

Este es el único caso del plan donde el test nace en verde, y es a propósito: describe lo que ya existe.

- [ ] **Step 4: Probar que el check muerde**

Verificación de que la red de seguridad sirve para algo. Editar temporalmente `test.html` y cambiar `thickness: 3` por `thickness: 3.1` **dentro de `GOLDEN_PARAMS`**. Recargar y leer la consola.
Expected: `FAILED: regresión: la caja cerrada de 80×80×80 en 3 mm sigue idéntica`.

Deshacer el cambio (volver a `thickness: 3`), recargar y confirmar `ALL CHECKS PASSED`.

- [ ] **Step 5: Commit**

```bash
git add test/golden-finger-80.json test.html
git commit -m "$(cat <<'EOF'
Freeze closed-box geometry as a regression fixture

The 80x80x80 box in 3mm with kerf 0.16 is the one that was cut and
verified physically. Freeze its outlines so any refactor that moves a
point fails loudly.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Extraer `shared.js`

Refactor puro, sin cambio de comportamiento: lo que los dos generadores van a compartir sale de `simple-box.js` a un módulo propio. El check de la Task 1 es el juez.

**Files:**
- Create: `js/boxes/shared.js`
- Modify: `js/boxes/simple-box.js`

**Interfaces:**
- Consumes: `computeSegments(span, targetTabWidth, startsSolid)` de `js/core/finger-joint.js`.
- Produces, desde `js/boxes/shared.js`:
  - `outerDimensions({ length, width, height, thickness, dimensionMode }, heightPad?) → { Lo, Wo, Ho }`
  - `jointSegments(span, targetTabWidth) → { count, width, tabs }`
  - `autoTabWidthFromSpans(spans: number[], thickness) → number`
  - `KERF_TOO_BIG: string` — el texto del error de kerf, para que viva en un solo sitio aunque lo empuje cada caja
  - `validateBasics({ t, kerf, tabWidth, Lo, Wo, Ho }) → string[]` — sólo los campos no positivos; el kerf contra el grosor lo comprueba cada caja junto a sus dimensiones
  - `validateTabsVsKerf(spans: [string, number][], tabWidth, kerf) → string[]`
  - `commonWarnings({ jointWidths: number[], t, kerf, tabWidth }) → string[]`
  - `simple-box.js` mantiene sus exports actuales: `buildBox(params)` y `autoTabWidth(params)`.

- [ ] **Step 1: Escribir el módulo compartido**

Crear `js/boxes/shared.js`:

```js
import { computeSegments } from '../core/finger-joint.js';

// Outer dimensions from the requested ones. In "inner" mode the box grows
// around the requested space: one thickness per side in plan, and whatever the
// lid arrangement needs in height — hence heightPad, which the sliding box
// overrides because under its lid there is nothing else.
export function outerDimensions(
  { length, width, height, thickness, dimensionMode },
  heightPad = 2 * thickness,
) {
  const inner = dimensionMode === 'inner';
  return {
    Lo: inner ? length + 2 * thickness : length,
    Wo: inner ? width + 2 * thickness : width,
    Ho: inner ? height + heightPad : height,
  };
}

// Segmentation of one joint span, plus how many tabs the male side grows.
export function jointSegments(span, targetTabWidth) {
  const s = computeSegments(span, targetTabWidth, true);
  return { ...s, tabs: (s.count - 1) / 2 };
}

// Suggested finger width: ~3x material thickness, never under 6 mm, and always
// small enough that the shortest joint still gets at least three segments.
export function autoTabWidthFromSpans(spans, thickness) {
  const preferred = Math.max(3 * thickness, 6);
  const shortest = Math.min(...spans);
  if (!(shortest > 0)) return preferred;
  return Math.min(preferred, shortest / 3);
}

// El kerf contra el grosor NO se valida aquí: en el original va en el mismo
// lote que los chequeos de dimensiones de cada caja, y una caja inválida por
// las dos cosas a la vez tiene que seguir mostrando los dos errores. Se exporta
// el texto para que ese mensaje viva en un solo sitio.
export const KERF_TOO_BIG = 'El kerf debe ser menor que el grosor del material.';

export function validateBasics({ t, kerf, tabWidth, Lo, Wo, Ho }) {
  const errors = [];
  const positive = (value) => Number.isFinite(value) && value > 0;

  if (!positive(t)) errors.push('El grosor del material debe ser mayor que 0.');
  if (!Number.isFinite(kerf) || kerf < 0) errors.push('El kerf no puede ser negativo.');
  if (!positive(tabWidth)) errors.push('El ancho de espiga debe ser mayor que 0.');
  if (!positive(Lo) || !positive(Wo) || !positive(Ho)) {
    errors.push('Largo, ancho y alto deben ser mayores que 0.');
  }
  return errors;
}

export function validateTabsVsKerf(spans, tabWidth, kerf) {
  const errors = [];
  for (const [name, span] of spans) {
    const { width } = computeSegments(span, tabWidth, true);
    if (width <= kerf * 1.5) {
      errors.push(
        `Las espigas del ${name} quedan de ${width.toFixed(2)} mm, demasiado pequeñas frente a un kerf de ${kerf} mm.`,
      );
    }
  }
  return errors;
}

export function commonWarnings({ jointWidths, t, kerf, tabWidth }) {
  const warnings = [];
  const narrowest = Math.min(...jointWidths);

  if (narrowest < 2) {
    warnings.push(
      `Alguna espiga queda de ${narrowest.toFixed(2)} mm: muy frágil para cortar. Sube el ancho de espiga.`,
    );
  }
  if (tabWidth < 1.5 * t) {
    warnings.push(
      `El ancho de espiga (${tabWidth} mm) es menor que 1.5 veces el grosor (${t} mm); la junta queda débil.`,
    );
  }
  if (tabWidth > 6 * t) {
    warnings.push(
      `El ancho de espiga (${tabWidth} mm) es más de 6 veces el grosor (${t} mm); pocas espigas y ensamble flojo.`,
    );
  }
  if (kerf === 0) {
    warnings.push('Kerf en 0: las piezas quedarán flojas al cortarlas. Mide el kerf real de tu láser.');
  }
  return warnings;
}
```

- [ ] **Step 2: Reescribir `simple-box.js` para usarlo**

En `js/boxes/simple-box.js`:

Reemplazar las dos primeras líneas de imports por:

```js
import { panelOutline } from '../core/panel.js';
import {
  autoTabWidthFromSpans,
  commonWarnings,
  jointSegments,
  KERF_TOO_BIG,
  outerDimensions,
  validateBasics,
  validateTabsVsKerf,
} from './shared.js';
```

Reemplazar la función `autoTabWidth` entera por:

```js
export function autoTabWidth(params) {
  const { thickness } = params;
  const { Lo, Wo, Ho } = outerDimensions(params);
  const wallHeight = wallHeightFor(Ho, thickness, params.lidType);
  return autoTabWidthFromSpans(
    [wallHeight - 2 * thickness, Lo - 2 * thickness, Wo - 2 * thickness],
    thickness,
  );
}
```

Borrar la función `outerDimensions` local y su `export`; ahora viene de `shared.js`. No hace falta re-exportarla: nadie la importa desde fuera de `simple-box.js` (comprobado con `grep -rn outerDimensions js test.html index.html`), así que el `export` que tiene hoy ya es superficie muerta y se va con la función.

Reemplazar el bloque `const segments = (span) => {...}` y la línea `const joints = ...` por:

```js
  const joints = {
    x: jointSegments(spanX, tabWidth),
    y: jointSegments(spanY, tabWidth),
    z: jointSegments(spanZ, tabWidth),
  };
```

Reemplazar la función `validate` entera por:

```js
function validate({ Lo, Wo, Ho, spanX, spanY, spanZ, t, kerf, tabWidth, flatLid }) {
  const errors = validateBasics({ t, kerf, tabWidth, Lo, Wo, Ho });
  if (errors.length > 0) return errors;

  if (kerf >= t) errors.push(KERF_TOO_BIG);
  if (spanX <= 0 || spanY <= 0) {
    errors.push(
      `El material de ${t} mm es demasiado grueso para una caja de ${Lo} × ${Wo} mm: no queda espacio para la tapa.`,
    );
  }
  if (spanZ <= 0) {
    errors.push(flatLid
      ? `Con ${t} mm de material y tapa plana, una caja de ${Ho} mm de alto no deja pared suficiente para las espigas.`
      : `Con ${t} mm de material, una caja de ${Ho} mm de alto no deja pared entre la base y la tapa.`);
  }
  if (errors.length > 0) return errors;

  errors.push(...validateTabsVsKerf(
    [['largo', spanX], ['ancho', spanY], ['alto', spanZ]],
    tabWidth,
    kerf,
  ));
  return errors;
}
```

Reemplazar la función `collectWarnings` entera por una llamada en el `return` de `buildBox`: cambiar
`warnings: collectWarnings({ joints, t, kerf, tabWidth }),` por

```js
    warnings: commonWarnings({
      jointWidths: [joints.x.width, joints.y.width, joints.z.width],
      t, kerf, tabWidth,
    }),
```

y borrar la función `collectWarnings`.

- [ ] **Step 3: Correr los checks — nada puede haber cambiado**

Seguir "Cómo se corren los checks".
Expected: `ALL CHECKS PASSED`. En particular el check de regresión de la Task 1 tiene que seguir verde: si el refactor movió un punto, sale rojo con la pieza y el índice exactos.

- [ ] **Step 4: Confirmar que la app sigue viva**

Navegar a `http://localhost:8000/` y leer la consola con `read_console_messages`.
Expected: sin errores. Si `app.js` perdiera un import, saldría aquí como `SyntaxError` o `does not provide an export named`.

- [ ] **Step 5: Commit**

```bash
git add js/boxes/shared.js js/boxes/simple-box.js
git commit -m "$(cat <<'EOF'
Extract shared box helpers into shared.js

Dimensions, joint segmentation, auto tab width, basic validation and
common warnings move out of simple-box.js so a second box generator can
use them. No behaviour change: the frozen geometry check proves it.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Contornos interiores y capa de grabado

La maquinaria que hace posible el canal: una pieza puede llevar contornos interiores etiquetados por capa, y el renderer los saca en un grupo SVG aparte. Sin esto no hay canal, y la bisagra del futuro va a usar exactamente lo mismo.

**Files:**
- Modify: `js/core/panel.js` (añadir `pocketFeature`)
- Modify: `js/render/svg-render.js` (grupo de grabado + traslación en `layout`)
- Modify: `test.html` (imports + tres checks)

**Interfaces:**
- Consumes: `panelOutline(panel, material)`, `boundingBox(points)`, `pathFromPoints(points)` — ya existentes.
- Produces:
  - `pocketFeature({ id, x, y, width, height, depth, layer? }) → { id, layer, kind: 'pocket', depth, points }` exportada desde `js/core/panel.js`. `layer` por defecto `'engrave'`; `kind` siempre `'pocket'`; `points` son cuatro esquinas en coordenadas locales de la pieza, en el mismo sistema que `panel.points`.
  - Un panel puede llevar `panel.features: Feature[]`. Ausente o vacío = pieza sin contornos interiores, que es como salen todas las de `simple-box.js`.
  - `renderBox(box, opts?)` emite `<g id="engrave">` **sólo si alguna pieza tiene features**.

- [ ] **Step 1: Escribir los checks que fallan**

En `test.html`, cambiar la línea de import de `panel.js` por:

```js
    import { panelOutline, pocketFeature } from './js/core/panel.js';
```

y añadir, junto a los otros imports:

```js
    import { renderBox } from './js/render/svg-render.js';
```

Añadir estos tres checks al final del bloque de checks, justo antes de la línea `const failed = results.filter((r) => !r.ok);`:

```js
    check('pocketFeature devuelve un rectángulo cerrado con su capa y profundidad', () => {
      const f = pocketFeature({ id: 'groove', x: 1, y: 2, width: 10, height: 3, depth: 1.5 });
      assert(f.id === 'groove', `id ${f.id}`);
      assert(f.layer === 'engrave', `capa ${f.layer}, esperaba engrave`);
      assert(f.kind === 'pocket', `kind ${f.kind}, esperaba pocket`);
      assert(near(f.depth, 1.5), `depth ${f.depth}`);
      assert(f.points.length === 4, `${f.points.length} puntos, esperaba 4`);
      const bb = boundingBox(f.points);
      assert(near(bb.minX, 1) && near(bb.minY, 2) && near(bb.width, 10) && near(bb.height, 3),
        `bbox (${bb.minX}, ${bb.minY}) ${bb.width} × ${bb.height}`);
    });

    check('el render saca las features a la capa de grabado, trasladadas con su pieza', () => {
      const spec = {
        id: 'probe', label: 'PROBE', width: 20, height: 10,
        edges: {
          top: { gender: 'plain' }, right: { gender: 'plain' },
          bottom: { gender: 'plain' }, left: { gender: 'plain' },
        },
      };
      const points = panelOutline(spec, { thickness: 3, kerf: 0, tabWidth: 6 });
      const feature = pocketFeature({ id: 'groove', x: 2, y: 1, width: 5, height: 2, depth: 1.5 });
      const svg = renderBox({ panels: [{ ...spec, points, features: [feature] }] });

      const engrave = svg.querySelector('#engrave');
      assert(engrave, 'no hay capa de grabado');
      assert(engrave.getAttribute('stroke') === '#e5484d',
        `trazo ${engrave.getAttribute('stroke')}, esperaba #e5484d`);
      assert(engrave.children.length === 1,
        `${engrave.children.length} paths en grabado, esperaba 1`);
      // La pieza se coloca con margen 10, así que la feature se corre igual: (2,1) → (12,11).
      assert(engrave.children[0].getAttribute('d') === 'M12,11 L17,11 L17,13 L12,13Z',
        `d = ${engrave.children[0].getAttribute('d')}`);
      assert(svg.querySelector('#cut').children.length === 1, 'el contorno no llegó a la capa de corte');
    });

    check('la caja cerrada no genera una capa de grabado vacía', () => {
      const svg = renderBox(buildBox(BASE));
      assert(!svg.querySelector('#engrave'), 'apareció una capa de grabado sin nada dentro');
    });
```

- [ ] **Step 2: Correr para verlos fallar**

Seguir "Cómo se corren los checks".
Expected: `FAILED: pocketFeature devuelve un rectángulo cerrado con su capa y profundidad, el render saca las features a la capa de grabado, trasladadas con su pieza`. El tercero (`la caja cerrada no genera una capa de grabado vacía`) pasa desde ya, porque todavía no existe ninguna capa de grabado — es el que va a impedir que la implementación del paso siguiente se pase de lista.

Si además aparece un error de importación de `pocketFeature`, es lo esperado en este punto.

- [ ] **Step 3: Implementar `pocketFeature`**

Al final de `js/core/panel.js`, añadir:

```js
// Un contorno interior rectangular de la pieza, en las mismas coordenadas
// locales que su contorno exterior. `depth` es cuánto se vacía hacia dentro del
// material: no es un corte pasante, así que nunca lleva compensación de kerf.
export function pocketFeature({ id, x, y, width, height, depth, layer = 'engrave' }) {
  return {
    id,
    layer,
    kind: 'pocket',
    depth,
    points: [
      { x, y },
      { x: x + width, y },
      { x: x + width, y: y + height },
      { x, y: y + height },
    ],
  };
}
```

- [ ] **Step 4: Emitir la capa de grabado en el renderer**

En `js/render/svg-render.js`:

Añadir, junto a las constantes de arriba del archivo:

```js
const INKSCAPE_NS = 'http://www.inkscape.org/namespaces/inkscape';
const CUT_COLOR = '#000000';
const ENGRAVE_COLOR = '#e5484d';
```

Dentro de `renderBox`, después de `svg.setAttribute('viewBox', ...)`, añadir:

```js
  svg.setAttribute('xmlns:inkscape', INKSCAPE_NS);
```

Reemplazar el bloque que crea `cuts` por una fábrica que sirve para las dos capas:

```js
  const layerGroup = (id, label, stroke) => {
    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('id', id);
    g.setAttribute('fill', 'none');
    g.setAttribute('stroke', stroke);
    g.setAttribute('stroke-width', '0.2');
    g.setAttributeNS(INKSCAPE_NS, 'inkscape:groupmode', 'layer');
    g.setAttributeNS(INKSCAPE_NS, 'inkscape:label', label);
    return g;
  };

  const cuts = layerGroup('cut', 'Corte', CUT_COLOR);
  const engrave = layerGroup('engrave', 'Grabado', ENGRAVE_COLOR);
  let engraveCount = 0;
```

Dentro del bucle `for (const item of placed.items)`, justo después de `cuts.appendChild(path);`, añadir:

```js
    for (const feature of item.features) {
      const featurePath = document.createElementNS(SVG_NS, 'path');
      featurePath.setAttribute('id', `${item.panel.id}-${feature.id}`);
      featurePath.setAttribute('d', pathFromPoints(feature.points));
      (feature.layer === 'cut' ? cuts : engrave).appendChild(featurePath);
      if (feature.layer !== 'cut') engraveCount += 1;
    }
```

Reemplazar el bloque final `svg.appendChild(cuts); ...` por:

```js
  svg.appendChild(cuts);
  if (engraveCount > 0) svg.appendChild(engrave);
  if (showLabels) svg.appendChild(labels);
  return svg;
```

En `layout`, dentro de `panels.forEach(...)`, reemplazar el `items.push({...})` por:

```js
    items.push({
      panel,
      points: panel.points.map((p) => ({ x: p.x + dx, y: p.y + dy })),
      features: (panel.features ?? []).map((f) => ({
        ...f,
        points: f.points.map((p) => ({ x: p.x + dx, y: p.y + dy })),
      })),
    });
```

El bounding box de la pieza se sigue calculando sólo desde el contorno exterior: las features viven dentro y no pueden agrandar la hoja.

- [ ] **Step 5: Correr los checks — los tres en verde**

Seguir "Cómo se corren los checks".
Expected: `ALL CHECKS PASSED`.

- [ ] **Step 6: Commit**

```bash
git add js/core/panel.js js/render/svg-render.js test.html
git commit -m "$(cat <<'EOF'
Add interior features and an engrave layer

A panel can now carry interior contours tagged with a layer, and the
renderer emits them in their own SVG group so LightBurn and Inkscape see
cut and engrave as separate layers. The group is omitted entirely when
nothing uses it.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: `sliding-box.js` — alturas y piezas

El generador nuevo, todavía sin canales: las seis piezas con sus medidas y sus juntas. Acá se juega la cota que Dani pidió — de suelo a cara superior de la tapa.

**Files:**
- Create: `js/boxes/sliding-box.js`
- Modify: `test.html` (imports + seis checks)

**Interfaces:**
- Consumes: `panelOutline`, `pocketFeature` de `js/core/panel.js`; todo lo de `js/boxes/shared.js`.
- Produces, desde `js/boxes/sliding-box.js`:
  - `lidThicknessFor(params) → number`
  - `grooveDepthFor(params) → number`
  - `slidingHeights(params) → { Lo, Wo, Ho, t, tl, h, p, grooveFloor, grooveTop, wallHeight, frontHeight, innerHeight }`
  - `autoTabWidth(params) → number`
  - `buildSlidingBox(params) → { panels, joints, errors, warnings, outer, inner, realOuterHeight, groove, lid }`
  - Parámetros de entrada que reconoce: `length`, `width`, `height`, `dimensionMode`, `thickness`, `kerf`, `tabWidth`, `lidThickness`, `grooveDepth`, `grooveDepthAuto`, `slideClearance`.
  - `panels[].id` ∈ `bottom | front | left | lid | back | right`, en ese orden.
  - `joints` = `{ x, y, z, zBack }`, cada uno `{ count, width, tabs }`; `z` es la junta del frente (la corta).

- [ ] **Step 1: Escribir los checks que fallan**

En `test.html`, añadir junto a los otros imports:

```js
    import { buildSlidingBox } from './js/boxes/sliding-box.js';
```

Y añadir, antes de `const failed = ...`:

```js
    const SLIDE = {
      length: 80, width: 80, height: 80,
      thickness: 3, kerf: 0.16, tabWidth: 12,
      dimensionMode: 'outer', lidType: 'sliding',
      slideClearance: 0.2,
    };
    const slide = buildSlidingBox(SLIDE);
    const sp = (id) => slide.panels.find((p) => p.id === id);

    check('deslizante: seis piezas y ningún error', () => {
      assert(slide.errors.length === 0, slide.errors.join(' | '));
      assert(slide.panels.length === 6, `${slide.panels.length} piezas, esperaba 6`);
      assert(sp('lid'), 'falta la tapa');
      assert(!slide.panels.some((p) => p.id === 'top'), 'la tapa deslizante no debe llamarse top');
    });

    check('deslizante: de suelo a tapa da el alto pedido', () => {
      assert(near(slide.outer.height, 80), `alto exterior ${slide.outer.height}`);
      assert(near(slide.realOuterHeight, 83.2),
        `alto real ${slide.realOuterHeight}, esperaba 83.2`);
    });

    check('deslizante: alturas de pared y frente', () => {
      assert(near(sp('left').height, 83.2), `lateral ${sp('left').height}`);
      assert(near(sp('right').height, 83.2), `lateral ${sp('right').height}`);
      assert(near(sp('back').height, 83.2), `fondo ${sp('back').height}`);
      assert(near(sp('front').height, 77), `frente ${sp('front').height}`);
      assert(near(sp('front').width, 80) && near(sp('back').width, 80),
        'frente y fondo deben abarcar el largo completo');
      assert(near(sp('left').width, 74), `lateral ancho ${sp('left').width}`);
    });

    check('deslizante: la tapa mide 76.6 × 78.3 y va lisa', () => {
      const lid = sp('lid');
      assert(near(lid.width, 76.6), `ancho ${lid.width}`);
      assert(near(lid.height, 78.3), `profundo ${lid.height}`);
      assert(lid.points.length === 4, `${lid.points.length} puntos: la tapa no lleva espigas`);
    });

    check('deslizante: interior útil y modo interiores', () => {
      assert(near(slide.inner.height, 74), `alto interior ${slide.inner.height}`);
      assert(near(slide.inner.length, 74) && near(slide.inner.width, 74), 'interior en planta');
      const byInner = buildSlidingBox({ ...SLIDE, dimensionMode: 'inner', length: 74, width: 74, height: 74 });
      assert(byInner.errors.length === 0, byInner.errors.join(' | '));
      assert(near(byInner.outer.height, 80), `exterior ${byInner.outer.height}, esperaba 80`);
      assert(near(byInner.inner.height, 74), `interior ${byInner.inner.height}`);
      assert(near(byInner.outer.length, 80), `largo exterior ${byInner.outer.length}`);
    });

    check('deslizante: cantos superiores lisos y junta del frente más corta', () => {
      for (const id of ['front', 'back', 'left', 'right']) {
        const p = sp(id);
        const onTop = p.points.filter((q) => Math.abs(q.y) < TOL);
        assert(onTop.length === 2,
          `${id}: el borde superior tiene ${onTop.length} vértices, esperaba 2 (recto)`);
      }
      const left = sp('left');
      assert(near(left.edges.left.jointSpan, 71),
        `junta del frente ${left.edges.left.jointSpan}, esperaba 71`);
      assert(near(left.edges.right.jointSpan, 77.2),
        `junta del fondo ${left.edges.right.jointSpan}, esperaba 77.2`);
    });

    check('deslizante: cada par de aristas macho/hembra encaja', () => {
      // [pieza hembra, su arista, pieza macho, su arista]. En los laterales la
      // arista 'left' es la que mira al frente y 'right' la que mira al fondo.
      const pairs = [
        ['front', 'left', 'left', 'left'],
        ['front', 'right', 'right', 'right'],
        ['back', 'left', 'left', 'right'],
        ['back', 'right', 'right', 'left'],
        ['front', 'bottom', 'bottom', 'top'],
        ['back', 'bottom', 'bottom', 'bottom'],
        ['left', 'bottom', 'bottom', 'left'],
        ['right', 'bottom', 'bottom', 'right'],
      ];
      for (const [femaleId, femaleEdge, maleId, maleEdge] of pairs) {
        const female = sp(femaleId).edges[femaleEdge];
        const male = sp(maleId).edges[maleEdge];
        const pair = `${femaleId}.${femaleEdge} ↔ ${maleId}.${maleEdge}`;
        assert(female.gender === 'female', `${pair}: ${femaleId} no es hembra`);
        assert(male.gender === 'male', `${pair}: ${maleId} no es macho`);
        const femaleSpan = female.jointSpan ?? null;
        const maleSpan = male.jointSpan ?? null;
        if (femaleSpan !== null && maleSpan !== null) {
          assert(near(femaleSpan, maleSpan),
            `${pair}: tramos distintos, ${femaleSpan} vs ${maleSpan}`);
        }
          // 'left'/'top' recorren la arista en línea recta (u crece con z o x); 'right'/
          // 'bottom' caminan al revés, así que su jointStart se mide desde el extremo
          // lejano y depende del tamaño propio de la pieza. Comparar el jointStart crudo
          // entre una arista 'right' y una 'left' — o entre dos 'right' de piezas de alto
          // distinto, como el lateral derecho contra el frente — compara cosas que no
          // están en el mismo sistema; hay que traducir las dos al mismo origen antes.
          const globalStart = (panel, edgeKey, spec) => {
            const start = spec.jointStart ?? 0;
            const own = (edgeKey === 'left' || edgeKey === 'right') ? panel.height : panel.width;
            return (edgeKey === 'left' || edgeKey === 'top') ? start : own - start - spec.jointSpan;
          };
          const femaleStart = globalStart(sp(femaleId), femaleEdge, female);
          const maleStart = globalStart(sp(maleId), maleEdge, male);
          assert(near(femaleStart, maleStart),
            `${pair}: arranques distintos en coordenada global, ${femaleStart} vs ${maleStart}`);
        assert((female.startsSolid ?? false) === (male.startsSolid ?? false),
          `${pair}: fases distintas, la espiga no caería en su ranura`);
      }
    });

    check('deslizante: los dos laterales son espejo, no la misma pieza', () => {
      const left = sp('left');
      const right = sp('right');
      // Si este par de igualdades no se cumple, un lateral le presenta al frente
      // la junta del fondo: la caja no monta y en el dibujo no se nota.
      assert(near(left.edges.left.jointSpan, right.edges.right.jointSpan),
        `el canto que mira al frente difiere entre laterales: ${left.edges.left.jointSpan} vs ${right.edges.right.jointSpan}`);
      assert(near(left.edges.right.jointSpan, right.edges.left.jointSpan),
        `el canto que mira al fondo difiere entre laterales: ${left.edges.right.jointSpan} vs ${right.edges.left.jointSpan}`);
      // Sin esto el check sería vacuo: con las dos juntas iguales se cumpliría solo.
      assert(!near(left.edges.left.jointSpan, left.edges.right.jointSpan),
        'las dos juntas verticales de un lateral deben diferir; si no, este check no prueba nada');
    });
```

Este check es el que prueba el requisito del spec de que las espigas del frente, pese a tener un tramo más corto que las del fondo, siguen cayendo en las ranuras de su lateral. Las aristas de la base no declaran `jointSpan` porque cubren la arista entera, así que en esos pares sólo se comparan géneros y fase.

- [ ] **Step 2: Correr para verlos fallar**

Seguir "Cómo se corren los checks".
Expected: la consola del navegador muestra un error de importación de `./js/boxes/sliding-box.js` (404) y la página queda en "corriendo…". Ese es el fallo esperado: el módulo todavía no existe.

- [ ] **Step 3: Escribir el generador**

Crear `js/boxes/sliding-box.js`:

```js
import { panelOutline, pocketFeature } from '../core/panel.js';
import {
  autoTabWidthFromSpans,
  commonWarnings,
  jointSegments,
  KERF_TOO_BIG,
  outerDimensions,
  validateBasics,
  validateTabsVsKerf,
} from './shared.js';

const DEFAULT_CLEARANCE = 0.2;
const MAX_AUTO_GROOVE_DEPTH = 6;

// La tapa puede ser de otro material que la caja: caja de 10 con tapa de 3, o
// tapa de acrílico sobre caja de madera. Sin valor, copia el grosor de pared.
// Un valor presente pero absurdo se deja pasar a propósito, para que la
// validación pueda decirlo en vez de sustituirlo a la espalda del usuario.
export function lidThicknessFor({ thickness, lidThickness }) {
  return Number.isFinite(lidThickness) ? lidThickness : thickness;
}

// Automática: media pared, con tope, para no fresar más hondo de lo que hace
// falta en maciza gruesa. La tapa no agarra mejor por eso, y es tiempo de
// máquina. Con la casilla desmarcada manda el valor escrito, bueno o malo.
export function grooveDepthFor({ thickness, grooveDepth, grooveDepthAuto = true }) {
  if (!grooveDepthAuto && Number.isFinite(grooveDepth)) return grooveDepth;
  return Math.min(thickness / 2, MAX_AUTO_GROOVE_DEPTH);
}

// Ho se mide del suelo a la cara superior de la tapa, con la tapa apoyada en el
// piso del canal. La holgura va por encima de la tapa: así esa cota da exacta y
// lo que crece es el reborde. Laterales y fondo sobresalen h + t por encima.
export function slidingHeights(params) {
  const t = params.thickness;
  const tl = lidThicknessFor(params);
  const h = Number.isFinite(params.slideClearance) ? params.slideClearance : DEFAULT_CLEARANCE;
  const p = grooveDepthFor(params);
  const { Lo, Wo, Ho } = outerDimensions(params, t + tl);

  return {
    Lo, Wo, Ho, t, tl, h, p,
    grooveFloor: Ho - tl,
    grooveTop: Ho + h,
    wallHeight: Ho + h + t,
    frontHeight: Ho - tl,
    innerHeight: Ho - tl - t,
  };
}

// El tramo de junta más corto es el del frente, que es más bajo que el resto.
export function autoTabWidth(params) {
  const { Lo, Wo, t, frontHeight } = slidingHeights(params);
  return autoTabWidthFromSpans(
    [frontHeight - 2 * t, Lo - 2 * t, Wo - 2 * t],
    t,
  );
}

export function buildSlidingBox(params) {
  const { kerf, tabWidth } = params;
  const {
    Lo, Wo, Ho, t, tl, h, p,
    grooveFloor, grooveTop, wallHeight, frontHeight, innerHeight,
  } = slidingHeights(params);

  const spanX = Lo - 2 * t; // frente/fondo <-> base
  const spanY = Wo - 2 * t; // laterales <-> base
  const spanZFront = frontHeight - 2 * t; // frente <-> laterales
  const spanZBack = wallHeight - 2 * t; // fondo <-> laterales

  const errors = validate({
    Lo, Wo, Ho, t, tl, h, p, kerf, tabWidth,
    spanX, spanY, spanZFront, spanZBack, frontHeight,
  });
  if (errors.length > 0) return { errors, warnings: [], panels: [] };

  const joints = {
    x: jointSegments(spanX, tabWidth),
    y: jointSegments(spanY, tabWidth),
    z: jointSegments(spanZFront, tabWidth),
    zBack: jointSegments(spanZBack, tabWidth),
  };

  // Toda junta arranca y termina con material en la pieza hembra, para que las
  // esquinas no queden colgando de medio kerf.
  const SOLID = { startsSolid: true };

  // La tapa se dibuja una holgura más chica que el hueco donde vive: si llegara
  // al fondo de los tres canales entraría a presión y no deslizaría.
  const grip = p - h;
  const grooveHeight = tl + h;
  // El canal es una banda horizontal; en coordenadas de pieza, y = 0 es el canto
  // superior de la pared, así que z se lee al revés.
  const grooveY = wallHeight - grooveTop;

  // Los dos laterales NO son la misma pieza: son espejo uno del otro. El canal
  // va en la cara interior, y una pieza grabada sólo tiene canal en una cara; si
  // se emitieran idénticas habría que girar una 180° para meter su canal hacia
  // dentro, y ese giro intercambia el frente con el fondo. Mirando cada cara
  // interior desde dentro de la caja, en el lateral izquierdo el frente queda a
  // la izquierda del dibujo y en el derecho queda a la derecha. Como el frente
  // es más bajo que el fondo, sus juntas verticales miden distinto, así que
  // equivocar el lado le presentaría al frente la junta del fondo y la caja no
  // montaría. En la caja cerrada esto no pasaba porque ambas juntas medían igual.
  // La arista 'left' recorre la pieza de piso hacia arriba (su u coincide con z
  // sin importar cuánto mida la pieza), pero 'right' recorre de arriba hacia
  // abajo: su jointStart se cuenta desde el CANTO SUPERIOR PROPIO. El fondo y
  // los laterales comparten alto (wallHeight), así que ahí da igual qué arista
  // toque a cuál. El frente es más bajo, así que cuando su junta cae en la
  // arista 'right' de un lateral (el lateral derecho, con este espejo) hay que
  // correr el arranque el sobrante de altura entre lateral y frente para que
  // siga midiéndose desde el piso; si no, la espiga sube 6+ mm y queda al aire.
  const sideWall = (id, label, frontEdge) => {
    const backEdge = frontEdge === 'left' ? 'right' : 'left';
    const frontJointStart = frontEdge === 'left' ? t : wallHeight - t - spanZFront;
    return {
      id,
      label,
      width: spanY,
      height: wallHeight,
      edges: {
        top: { gender: 'plain' },
        bottom: { gender: 'female', ...SOLID },
        [frontEdge]: { gender: 'male', jointStart: frontJointStart, jointSpan: spanZFront, ...SOLID },
        [backEdge]: { gender: 'male', jointStart: t, jointSpan: spanZBack, ...SOLID },
      },
      // El canal recorre la pieza entera, así que es simétrico y no cambia con
      // el espejo: es lo único de la pieza que sí puede ser idéntico en ambos.
      features: [pocketFeature({
        id: 'groove',
        x: 0, y: grooveY,
        width: spanY, height: grooveHeight,
        depth: p,
      })],
    };
  };

  const specs = [
    {
      id: 'bottom', label: 'BOTTOM',
      width: spanX, height: spanY,
      edges: {
        top: { gender: 'male', ...SOLID },
        bottom: { gender: 'male', ...SOLID },
        left: { gender: 'male', ...SOLID },
        right: { gender: 'male', ...SOLID },
      },
    },
    {
      id: 'front', label: 'FRONT',
      width: Lo, height: frontHeight,
      edges: {
        top: { gender: 'plain' },
        bottom: { gender: 'female', jointStart: t, jointSpan: spanX, ...SOLID },
        left: { gender: 'female', jointStart: t, jointSpan: spanZFront, ...SOLID },
        right: { gender: 'female', jointStart: t, jointSpan: spanZFront, ...SOLID },
      },
    },
    sideWall('left', 'LEFT', 'left'),
    {
      id: 'lid', label: 'LID',
      width: spanX + 2 * grip,
      height: spanY + grip + t,
      edges: {
        top: { gender: 'plain' },
        bottom: { gender: 'plain' },
        left: { gender: 'plain' },
        right: { gender: 'plain' },
      },
    },
    {
      id: 'back', label: 'BACK',
      width: Lo, height: wallHeight,
      edges: {
        top: { gender: 'plain' },
        bottom: { gender: 'female', jointStart: t, jointSpan: spanX, ...SOLID },
        left: { gender: 'female', jointStart: t, jointSpan: spanZBack, ...SOLID },
        right: { gender: 'female', jointStart: t, jointSpan: spanZBack, ...SOLID },
      },
      // El canal del fondo es más ancho que el hueco interior porque las
      // esquinas de la tapa viven en los tres canales a la vez. Deja margen
      // t − p a cada canto: la misma pared que queda detrás de los laterales.
      features: [pocketFeature({
        id: 'groove',
        x: t - p, y: grooveY,
        width: Lo - 2 * t + 2 * p, height: grooveHeight,
        depth: p,
      })],
    },
    sideWall('right', 'RIGHT', 'right'),
  ];

  const material = { thickness: t, kerf, tabWidth };
  const panels = specs.map((spec) => ({ ...spec, points: panelOutline(spec, material) }));
  const lid = panels.find((panel) => panel.id === 'lid');

  return {
    panels,
    joints,
    errors,
    warnings: warningsFor({
      jointWidths: [joints.x.width, joints.y.width, joints.z.width, joints.zBack.width],
      t, kerf, tabWidth, p, h, tl,
      lidWidth: lid.width, lidDepth: lid.height,
    }),
    outer: { length: Lo, width: Wo, height: Ho },
    inner: { length: spanX, width: spanY, height: innerHeight },
    realOuterHeight: wallHeight,
    groove: { depth: p, clearance: h, floor: grooveFloor, top: grooveTop, grip },
    lid: { thickness: tl, width: lid.width, depth: lid.height },
  };
}

function validate() {
  return [];
}

function warningsFor({ jointWidths, t, kerf, tabWidth }) {
  return commonWarnings({ jointWidths, t, kerf, tabWidth });
}
```

`validate` y `warningsFor` quedan de momento como cascarones: la Task 6 les pone el contenido. Están así para que este paso se pueda probar solo, no porque el diseño los quiera vacíos.

- [ ] **Step 4: Correr los checks — los ocho en verde**

Seguir "Cómo se corren los checks".
Expected: `ALL CHECKS PASSED`.

Si falla `la tapa mide 76.6 × 78.3`, revisar `grip = p - h`: con `p` 1.5 y `h` 0.2 vale 1.3, y la tapa sale `74 + 2 × 1.3 = 76.6` de ancho y `74 + 1.3 + 3 = 78.3` de profundo.

- [ ] **Step 5: Commit**

```bash
git add js/boxes/sliding-box.js test.html
git commit -m "$(cat <<'EOF'
Add sliding lid box generator: heights and panels

Six panels with the height rule Dani asked for: the requested height is
floor to the top face of the lid, and side and back walls stand h + t
above it. Front wall is shorter, and its joint against the sides is
shorter too. Grooves come next.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Los tres canales

Las features ya existen (Task 3) y las piezas ya las declaran (Task 4). Esta tarea prueba que los canales caen donde tienen que caer — que es lo único que decide si la tapa entra o no.

**Files:**
- Modify: `test.html` (cinco checks)

**Interfaces:**
- Consumes: `buildSlidingBox(params)` y el objeto `slide` ya definido en la Task 4; `boundingBox` de `js/core/geometry.js`.
- Produces: nada nuevo de código. Si algún check falla, el arreglo va en `js/boxes/sliding-box.js`.

- [ ] **Step 1: Escribir los checks**

En `test.html`, añadir antes de `const failed = ...`:

```js
    // z se lee desde el canto superior de la pieza: z = wallHeight - y.
    const grooveZ = (id) => {
      const panel = sp(id);
      const feature = panel.features.find((f) => f.id === 'groove');
      assert(feature, `${id}: no tiene canal`);
      const bb = boundingBox(feature.points);
      return {
        floor: panel.height - (bb.minY + bb.height),
        top: panel.height - bb.minY,
        minX: bb.minX,
        width: bb.width,
        depth: feature.depth,
        layer: feature.layer,
      };
    };

    check('canales: los tres a la misma altura, en la capa de grabado', () => {
      const [left, right, back] = ['left', 'right', 'back'].map(grooveZ);
      for (const [name, g] of [['lateral izq', left], ['lateral der', right], ['fondo', back]]) {
        assert(near(g.floor, 77), `${name}: piso a ${g.floor}, esperaba 77`);
        assert(near(g.top, 80.2), `${name}: techo a ${g.top}, esperaba 80.2`);
        assert(g.layer === 'engrave', `${name}: capa ${g.layer}`);
      }
    });

    check('canales: ninguno atraviesa su pared', () => {
      for (const id of ['left', 'right', 'back']) {
        const g = grooveZ(id);
        assert(g.depth < SLIDE.thickness,
          `${id}: canal de ${g.depth} en pared de ${SLIDE.thickness}`);
        assert(near(g.depth, 1.5), `${id}: profundidad ${g.depth}, esperaba 1.5`);
      }
    });

    check('canales laterales: recorren la pieza de punta a punta', () => {
      for (const id of ['left', 'right']) {
        const g = grooveZ(id);
        assert(near(g.minX, 0), `${id}: arranca en ${g.minX}, esperaba 0`);
        assert(near(g.width, 74), `${id}: ancho ${g.width}, esperaba 74`);
      }
    });

    check('canal del fondo: más ancho que la tapa, con margen t − p a cada canto', () => {
      const g = grooveZ('back');
      assert(near(g.width, 77), `ancho ${g.width}, esperaba 77`);
      assert(near(g.minX, 1.5), `arranca en ${g.minX}, esperaba 1.5`);
      assert(near(80 - (g.minX + g.width), 1.5),
        `margen derecho ${80 - (g.minX + g.width)}, esperaba 1.5`);
      assert(g.width > sp('lid').width,
        `el canal (${g.width}) no es más ancho que la tapa (${sp('lid').width})`);
    });

    check('la tapa agarra en los tres canales y el frente no lleva canal', () => {
      assert(slide.groove.grip > 0, `agarre ${slide.groove.grip}`);
      assert(near(slide.groove.grip, 1.3), `agarre ${slide.groove.grip}, esperaba 1.3`);
      assert(!sp('front').features || sp('front').features.length === 0,
        'el frente no debe llevar canal: por ahí entra la tapa');
      assert(!sp('bottom').features || sp('bottom').features.length === 0,
        'la base no lleva canal');
      assert(!sp('lid').features || sp('lid').features.length === 0,
        'la tapa no lleva canal');
    });
```

- [ ] **Step 2: Correr los checks**

Seguir "Cómo se corren los checks".
Expected: `ALL CHECKS PASSED`. La Task 4 ya dejó los canales declarados, así que lo normal es que pasen a la primera.

Si alguno falla, el arreglo va en `js/boxes/sliding-box.js` y no en el check: los números del check salen del spec.

- [ ] **Step 3: Mirar el dibujo**

Navegar a `http://localhost:8000/` y, en la consola del navegador (`javascript_tool`), pegar:

```js
const { buildSlidingBox } = await import('/js/boxes/sliding-box.js');
const { renderBox } = await import('/js/render/svg-render.js');
const svg = renderBox(buildSlidingBox({
  length: 80, width: 80, height: 80, thickness: 3, kerf: 0.16, tabWidth: 12,
  dimensionMode: 'outer', lidType: 'sliding', slideClearance: 0.2,
}));
document.getElementById('preview').replaceChildren(svg);
[svg.querySelector('#cut').children.length, svg.querySelector('#engrave').children.length];
```

Expected: devuelve `[6, 3]` — seis contornos de corte y tres canales. Tomar un screenshot y comprobar a ojo que los tres canales están a la misma altura y que el frente es visiblemente más bajo.

- [ ] **Step 4: Commit**

```bash
git add test.html
git commit -m "$(cat <<'EOF'
Check the three grooves land where the lid needs them

Same height on all three walls, none cutting through its wall, side
grooves running end to end, and a back groove wider than the lid with
the t - p margin at each edge.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Validaciones y avisos

Que la aplicación diga que no cuando la caja no existe físicamente, y que avise cuando existe pero va a salir mal.

**Files:**
- Modify: `js/boxes/sliding-box.js` (rellenar `validate` y `warningsFor`)
- Modify: `test.html` (dos checks)

**Interfaces:**
- Consumes: `validateBasics`, `validateTabsVsKerf`, `commonWarnings` de `js/boxes/shared.js`.
- Produces: `buildSlidingBox` devuelve `errors: string[]` no vacío y `panels: []` cuando la caja es imposible; `warnings: string[]` cuando es posible pero problemática. Misma forma que `buildBox`, así que `js/ui/app.js` no necesita saber cuál generador corrió.

- [ ] **Step 1: Escribir los checks que fallan**

En `test.html`, añadir antes de `const failed = ...`:

```js
    check('deslizante: errores que bloquean la generación', () => {
      const cases = [
        ['canal tan profundo como la pared', { grooveDepth: 3, grooveDepthAuto: false }, 'atraviesa'],
        ['holgura mayor que el canal', { slideClearance: 2 }, 'agarrarse'],
        ['caja más baja que su tapa', { height: 2 }, 'más baja'],
        ['sin pared para las espigas del frente', { height: 8 }, 'espigas'],
        ['grosor de tapa inválido', { lidThickness: -1, thickness: 3 }, 'tapa'],
      ];
      for (const [name, override, fragment] of cases) {
        const r = buildSlidingBox({ ...SLIDE, ...override });
        assert(r.errors.length > 0, `${name}: no produjo error`);
        assert(r.panels.length === 0, `${name}: devolvió piezas pese al error`);
        assert(r.errors.some((e) => e.toLowerCase().includes(fragment)),
          `${name}: esperaba un error con "${fragment}", salió: ${r.errors.join(' | ')}`);
      }
    });

    check('deslizante: avisos que no bloquean', () => {
      const cases = [
        ['holgura en 0', { slideClearance: 0 }, 'presión'],
        ['holgura grande', { slideClearance: 0.8 }, 'bailar'],
        ['poca pared detrás del canal', { thickness: 2.5, kerf: 0.16, tabWidth: 8 }, 'pared'],
        ['tapa que pandea', { length: 400, width: 400, tabWidth: 24 }, 'pandear'],
      ];
      for (const [name, override, fragment] of cases) {
        const r = buildSlidingBox({ ...SLIDE, ...override });
        assert(r.errors.length === 0, `${name}: debía generar, pero dio ${r.errors.join(' | ')}`);
        assert(r.warnings.some((w) => w.toLowerCase().includes(fragment)),
          `${name}: esperaba un aviso con "${fragment}", salió: ${r.warnings.join(' | ') || '(ninguno)'}`);
      }
      assert(slide.warnings.length === 0,
        `la caja canónica no debería avisar nada: ${slide.warnings.join(' | ')}`);
    });
```

- [ ] **Step 2: Correr para verlos fallar**

Seguir "Cómo se corren los checks".
Expected: `FAILED: deslizante: errores que bloquean la generación, deslizante: avisos que no bloquean`.

- [ ] **Step 3: Implementar las validaciones**

En `js/boxes/sliding-box.js`, reemplazar el cascarón `function validate() { return []; }` por:

```js
function validate({
  Lo, Wo, Ho, t, tl, h, p, kerf, tabWidth,
  spanX, spanY, spanZFront, spanZBack, frontHeight,
}) {
  const errors = validateBasics({ t, kerf, tabWidth, Lo, Wo, Ho });
  if (errors.length > 0) return errors;

  const positive = (value) => Number.isFinite(value) && value > 0;
  if (!positive(tl)) errors.push('El grosor de la tapa debe ser mayor que 0.');
  if (!Number.isFinite(h) || h < 0) errors.push('La holgura de deslizamiento no puede ser negativa.');
  if (!positive(p)) errors.push('La profundidad del canal debe ser mayor que 0.');
  if (errors.length > 0) return errors;

  // Kerf y geometría van en un solo lote: una caja inválida por varios motivos
  // los muestra todos, en vez de obligar a arreglarlos de uno en uno.
  if (kerf >= t) errors.push(KERF_TOO_BIG);
  if (p >= t) {
    errors.push(`Un canal de ${p} mm atraviesa una pared de ${t} mm. Baja la profundidad del canal.`);
  }
  if (h >= p) {
    errors.push(
      `Con una holgura de ${h} mm y un canal de ${p} mm de profundidad, la tapa no llega a agarrarse en la ranura.`,
    );
  }
  if (spanX <= 0 || spanY <= 0) {
    errors.push(
      `El material de ${t} mm es demasiado grueso para una caja de ${Lo} × ${Wo} mm: no queda espacio dentro.`,
    );
  }
  if (frontHeight <= 0) {
    errors.push(`Una caja de ${Ho} mm de alto es más baja que su propia tapa de ${tl} mm.`);
  } else if (spanZFront <= 0) {
    errors.push(
      `El frente queda de ${frontHeight.toFixed(1)} mm: no deja pared entre la base y el canal para las espigas.`,
    );
  }
  if (errors.length > 0) return errors;

  errors.push(...validateTabsVsKerf(
    [
      ['largo', spanX],
      ['ancho', spanY],
      ['alto del frente', spanZFront],
      ['alto del fondo', spanZBack],
    ],
    tabWidth,
    kerf,
  ));
  return errors;
}
```

Y reemplazar el cascarón `warningsFor` por:

```js
function warningsFor({ jointWidths, t, kerf, tabWidth, p, h, tl, lidWidth, lidDepth }) {
  const warnings = commonWarnings({ jointWidths, t, kerf, tabWidth });
  const behind = t - p;
  const narrowestLid = Math.min(lidWidth, lidDepth);

  if (behind < 1.5) {
    warnings.push(
      `Detrás del canal quedan ${behind.toFixed(2)} mm de pared: puede reventar al meter la tapa.`,
    );
  }
  if (h === 0) {
    warnings.push('Holgura en 0: la tapa entrará a presión y no va a deslizar.');
  }
  if (h > 0.5) {
    warnings.push(`Holgura de ${h} mm: la tapa va a bailar dentro del canal.`);
  }
  if (narrowestLid / tl > 60) {
    warnings.push(
      `La tapa de ${tl} mm mide ${narrowestLid.toFixed(0)} mm de lado: se va a pandear en el medio.`,
    );
  }
  if (t < 2) {
    warnings.push(`El reborde sobre el canal vale un grosor (${t} mm) y queda frágil.`);
  }
  return warnings;
}
```

- [ ] **Step 4: Correr los checks**

Seguir "Cómo se corren los checks".
Expected: `ALL CHECKS PASSED`.

Si falla el caso `poca pared detrás del canal`, comprobar que con `thickness` 2.5 la profundidad automática da 1.25 y quedan 1.25 mm detrás, por debajo del umbral de 1.5.

- [ ] **Step 5: Commit**

```bash
git add js/boxes/sliding-box.js test.html
git commit -m "$(cat <<'EOF'
Validate sliding lid boxes and warn about bad fits

Errors for boxes that cannot exist: a groove through the wall, a
clearance that leaves no grip, a box shorter than its own lid, a front
wall with no room for joints. Warnings for the ones that will cut but
disappoint.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Interfaz

Conectar el generador al formulario: la opción nueva, sus tres campos, el alto real en el resumen y la nota que evita que alguien mande los canales a corte pasante.

**Files:**
- Modify: `index.html`
- Modify: `js/ui/app.js`
- Modify: `css/styles.css`

**Interfaces:**
- Consumes: `buildSlidingBox`, `autoTabWidth` (de `sliding-box.js`); `buildBox`, `autoTabWidth` (de `simple-box.js`); `renderBox`, `downloadSvg`, `round`.
- Produces: elementos nuevos en el DOM con estos `id` exactos — `lid-sliding`, `slidingFields`, `lidThickness`, `lidThicknessAuto`, `grooveDepth`, `grooveAuto`, `slideClearance`, `engraveNote`.

- [ ] **Step 1: Añadir la opción y los campos al formulario**

En `index.html`, dentro del `div.field.field-radio-group` de Tapa, después del bloque `radio-option` de `lid-flat` y **antes** del `<p class="help">`, añadir:

```html
            <div class="radio-option">
              <input type="radio" id="lid-sliding" name="lidType" value="sliding">
              <label for="lid-sliding">Deslizante</label>
            </div>
```

Reemplazar el `<p class="help">` de ese mismo bloque por:

```html
            <p class="help">
              "Con espigas": la tapa encaja dentro como el resto de las piezas.
              "Plana": un rectángulo liso que se apoya encima de las paredes, que se
              acortan un grosor para que el alto total siga siendo el que pediste.
              "Deslizante": la tapa corre dentro de un canal vaciado en laterales y
              fondo, y entra por el frente, que queda más bajo.
            </p>
```

Justo después de cerrar ese `div.field.field-radio-group`, añadir el bloque de campos:

```html
          <div class="field sliding-fields" id="slidingFields" hidden>
            <div class="field">
              <label for="lidThickness">Grosor de la tapa <span class="unit">mm</span></label>
              <input type="number" id="lidThickness" name="lidThickness" value="3" step="0.1" min="0.01" inputmode="decimal">
              <div class="field-checkbox">
                <input type="checkbox" id="lidThicknessAuto" name="lidThicknessAuto" checked>
                <label for="lidThicknessAuto">Igual que el material</label>
              </div>
            </div>

            <div class="field">
              <label for="grooveDepth">Profundidad del canal <span class="unit">mm</span></label>
              <input type="number" id="grooveDepth" name="grooveDepth" value="1.5" step="0.1" min="0.01" inputmode="decimal">
              <div class="field-checkbox">
                <input type="checkbox" id="grooveAuto" name="grooveAuto" checked>
                <label for="grooveAuto">Automática (mitad de la pared)</label>
              </div>
            </div>

            <div class="field">
              <label for="slideClearance">Holgura de deslizamiento <span class="unit">mm</span></label>
              <input type="number" id="slideClearance" name="slideClearance" value="0.2" step="0.05" min="0" inputmode="decimal">
              <p class="help">
                Cuánto más alto se dibuja el canal que la tapa, para que corra sin
                trabarse. Es aparte del kerf: el kerf compensa un corte pasante y el
                canal es un vaciado. Calíbrala con un recorte antes de cortar la caja.
              </p>
            </div>
          </div>
```

Y en la zona de preview, reemplazar `<div id="preview"></div>` por:

```html
      <div id="preview"></div>
      <p id="engraveNote" class="engrave-note" hidden></p>
```

- [ ] **Step 2: Darles estilo mínimo**

El archivo trabaja con tokens de color y tiene un juego para claro y otro para oscuro. El rojo del grabado necesita el suyo: reutilizar `--error-*` haría que una instrucción neutral se leyera como un error de validación. El borde se queda en el rojo exacto del SVG para que la vista lo asocie con los rectángulos del dibujo; el texto usa un tono con contraste suficiente en cada tema.

En el bloque `:root` de arriba, junto a los otros tokens, añadir:

```css
  --engrave-border: #e5484d;
  --engrave-text: #a3262b;
```

Y dentro del `@media (prefers-color-scheme: dark)`, junto a sus equivalentes:

```css
    --engrave-border: #e05656;
    --engrave-text: #f7a8a8;
```

Al final de `css/styles.css`, añadir (en `px`, como el resto del archivo):

```css
.sliding-fields {
  border-left: 2px solid var(--engrave-border);
  padding-left: 12px;
}

.engrave-note {
  margin: 12px 0 0;
  font-size: 13px;
  color: var(--engrave-text);
}
```

- [ ] **Step 3: Conectar el generador**

En `js/ui/app.js`:

Reemplazar las dos primeras líneas de import por:

```js
import { buildBox, autoTabWidth as simpleTabWidth } from '../boxes/simple-box.js';
import { buildSlidingBox, autoTabWidth as slidingTabWidth } from '../boxes/sliding-box.js';
```

Añadir, junto a las otras constantes de elementos:

```js
const slidingFields = document.getElementById('slidingFields');
const lidThicknessEl = document.getElementById('lidThickness');
const lidThicknessAutoEl = document.getElementById('lidThicknessAuto');
const grooveDepthEl = document.getElementById('grooveDepth');
const grooveAutoEl = document.getElementById('grooveAuto');
const engraveNote = document.getElementById('engraveNote');

// Cada tipo de tapa trae su generador y su cálculo de espiga automática: el
// tramo de junta más corto no es el mismo en una caja cerrada que en una con
// el frente rebajado.
const BUILDERS = {
  sliding: { build: buildSlidingBox, autoTab: slidingTabWidth },
  default: { build: buildBox, autoTab: simpleTabWidth },
};
const builderFor = (lidType) => BUILDERS[lidType] ?? BUILDERS.default;
```

Reemplazar la función `readParams` entera por:

```js
function readParams() {
  const number = (id) => parseFloat(document.getElementById(id).value);
  const lidType = form.elements.lidType.value;
  const sliding = lidType === 'sliding';

  const params = {
    length: number('length'),
    width: number('width'),
    height: number('height'),
    thickness: number('thickness'),
    kerf: number('kerf'),
    dimensionMode: form.elements.dimensionMode.value,
    lidType,
    tabWidth: number('tabWidth'),
  };

  slidingFields.hidden = !sliding;

  if (sliding) {
    lidThicknessEl.disabled = lidThicknessAutoEl.checked;
    if (lidThicknessAutoEl.checked) lidThicknessEl.value = params.thickness;
    params.lidThickness = parseFloat(lidThicknessEl.value);

    params.grooveDepthAuto = grooveAutoEl.checked;
    grooveDepthEl.disabled = grooveAutoEl.checked;
    if (grooveAutoEl.checked) {
      grooveDepthEl.value = round(Math.min(params.thickness / 2, 6), 2);
    }
    params.grooveDepth = parseFloat(grooveDepthEl.value);
    params.slideClearance = number('slideClearance');
  }

  tabWidthEl.disabled = tabAutoEl.checked;
  if (tabAutoEl.checked) {
    params.tabWidth = round(builderFor(lidType).autoTab(params), 1);
    tabWidthEl.value = params.tabWidth;
  }
  return params;
}
```

En `recompute`, reemplazar `const box = buildBox(params);` por:

```js
  const box = builderFor(params.lidType).build(params);
```

En el bloque de error de `recompute`, después de `downloadBtn.disabled = true;`, añadir:

```js
    engraveNote.hidden = true;
```

Y reemplazar el bloque final de `recompute` (desde `const dims = ...` hasta el final de la función) por:

```js
  const dims = (d) => `${round(d.length, 1)} × ${round(d.width, 1)} × ${round(d.height, 1)} mm`;
  const realHeight = box.realOuterHeight
    ? ` (alto real con reborde: ${round(box.realOuterHeight, 1)})`
    : '';
  summaryEl.textContent =
    `Exterior ${dims(box.outer)}${realHeight} · Interior ${dims(box.inner)} · ` +
    `Hoja ${currentSvg.getAttribute('width')} × ${currentSvg.getAttribute('height')} · ` +
    `Espigas ${box.joints.x.tabs}/${box.joints.y.tabs}/${box.joints.z.tabs} por junta (largo/ancho/alto)`;

  if (box.groove) {
    engraveNote.textContent =
      `Los rectángulos rojos se vacían a ${round(box.groove.depth, 2)} mm de profundidad: ` +
      'no son cortes pasantes. En LightBurn entran en su propia capa por color.';
    engraveNote.hidden = false;
  } else {
    engraveNote.hidden = true;
  }
```

En el handler de `downloadBtn`, reemplazar la línea del sufijo por:

```js
  const SUFFIXES = { flat: '-tapaplana', sliding: '-deslizante' };
  const lid = SUFFIXES[form.elements.lidType.value] ?? '';
```

- [ ] **Step 4: Probar la interfaz en el navegador**

Navegar a `http://localhost:8000/` y comprobar, en este orden:

1. `read_console_messages` → sin errores.
2. Con "Con espigas" seleccionada: `javascript_tool` con
   `document.getElementById('slidingFields').hidden` → `true`, y
   `document.getElementById('engraveNote').hidden` → `true`.
3. Elegir la opción nueva y poner el caso canónico:
   ```js
   document.getElementById('length').value = 80;
   document.getElementById('width').value = 80;
   document.getElementById('height').value = 80;
   document.getElementById('thickness').value = 3;
   document.getElementById('kerf').value = 0.16;
   document.getElementById('lid-sliding').checked = true;
   document.getElementById('params').dispatchEvent(new Event('change'));
   document.getElementById('summary').textContent;
   ```
   Expected: el texto contiene `Exterior 80 × 80 × 80 mm (alto real con reborde: 83.2)` y `Interior 74 × 74 × 74 mm`.
4. `document.getElementById('slidingFields').hidden` → `false`, y
   `document.getElementById('grooveDepth').value` → `1.5`.
5. `document.querySelectorAll('#preview #engrave path').length` → `3`.
6. `document.getElementById('engraveNote').hidden` → `false`.
7. Screenshot del preview: seis piezas, tres con una banda roja, el frente visiblemente más bajo que laterales y fondo.
8. Volver a "Con espigas" y confirmar que `#slidingFields` se oculta, que `#engraveNote` se oculta y que el resumen vuelve a no llevar el paréntesis del alto real.

- [ ] **Step 5: Correr los self-checks otra vez**

Seguir "Cómo se corren los checks". La interfaz no debería haberlos tocado, pero `app.js` importa de los mismos módulos.
Expected: `ALL CHECKS PASSED`.

- [ ] **Step 6: Commit**

```bash
git add index.html js/ui/app.js css/styles.css
git commit -m "$(cat <<'EOF'
Wire the sliding lid into the form

Third lid option with its three fields, shown only when it is selected.
The summary now reports the real outer height, since it is the one case
where the box is taller than what you typed, and a note under the
preview says the red rectangles are pockets, not cuts.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Verificación de punta a punta y entrega

Comprobar el archivo que realmente va a la máquina, y dejar escrito lo que Dani tiene que hacer con madera.

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: la aplicación completa.
- Produces: nada de código. El resultado es el SVG verificado y el README al día.

- [ ] **Step 1: Verificar el SVG exportado**

Con la app abierta en el caso canónico (80 × 80 × 80, 3 mm, kerf 0.16, tapa deslizante), en `javascript_tool`:

```js
const svg = document.querySelector('#preview svg');
const out = new XMLSerializer().serializeToString(svg);
({
  mm: [svg.getAttribute('width'), svg.getAttribute('height')],
  viewBox: svg.getAttribute('viewBox'),
  cut: svg.querySelectorAll('#cut path').length,
  engrave: svg.querySelectorAll('#engrave path').length,
  engraveStroke: svg.querySelector('#engrave').getAttribute('stroke'),
  inkscapeLayers: [...svg.querySelectorAll('g[id]')].map((g) => g.getAttribute('inkscape:label')),
  hasNegativeCoords: /-\d/.test(out.split('viewBox')[1] ?? ''),
});
```

Expected:
- `mm` termina en `mm` en los dos valores y los números coinciden con el `viewBox`.
- `cut` = 6, `engrave` = 3.
- `engraveStroke` = `#e5484d`.
- `inkscapeLayers` contiene `Corte` y `Grabado`.
- `hasNegativeCoords` = `false` — ninguna pieza se sale de la hoja.

- [ ] **Step 2: Comprobar que la descarga sale con el nombre correcto**

En `javascript_tool`:

```js
document.getElementById('downloadBtn').disabled;
```
Expected: `false`.

El nombre se arma en el handler; verificarlo sin descargar:
```js
const round1 = (v) => Math.round(v * 10) / 10;
`boxmaker-80x80x80-t${document.getElementById('thickness').value}-deslizante.svg`;
```
Expected: `boxmaker-80x80x80-t3-deslizante.svg`.

- [ ] **Step 3: Probar los tres tipos de tapa seguidos**

En la interfaz, pasar por "Con espigas" → "Plana" → "Deslizante" → "Con espigas", leyendo la consola después de cada cambio.
Expected: sin errores en consola, y en cada paso el preview se redibuja con el número de piezas correcto (6 siempre) y `#engrave` sólo existe en deslizante.

- [ ] **Step 4: Actualizar el README**

En `README.md`, sección **Los parámetros**, reemplazar la fila `| Tapa: Con espigas / Plana | ...` por esta fila y las tres que la siguen:

```markdown
| Tapa: Con espigas / Plana / Deslizante | Con espigas | "Con espigas": la tapa encaja dentro como el resto de las piezas. "Plana": un rectángulo liso del tamaño exterior que se apoya sobre el canto de las paredes; el borde superior de las cuatro paredes queda recto y las paredes se acortan un grosor, así que el alto total y el espacio interior no cambian. La tapa plana no lleva nada que la sujete: se desliza si mueves la caja. "Deslizante": la tapa corre dentro de un canal vaciado en los dos laterales y el fondo, y entra por el frente, que queda más bajo que el resto. Con esta tapa el alto que pides se mide del suelo a la cara superior de la tapa, y laterales y fondo sobresalen por encima un grosor más la holgura — el resumen te enseña ese alto real. |
| Grosor de la tapa (mm) | el del material | Solo con tapa deslizante. Con la casilla "Igual que el material" marcada copia el grosor de las paredes. Desmárcala para una caja de 10 mm con tapa de 3, o una tapa de acrílico sobre caja de madera. |
| Profundidad del canal (mm) | la mitad de la pared, máximo 6 | Solo con tapa deslizante. Cuánto muerde el canal hacia dentro de la pared. Con "Automática" marcada es la mitad del grosor, con tope de 6 mm para no fresar de más en maciza gruesa. Nunca puede llegar al grosor completo: atravesaría la pared. |
| Holgura de deslizamiento (mm) | 0.2 | Solo con tapa deslizante. Cuánto más alto se dibuja el canal que la tapa para que corra sin trabarse. Es un número aparte del kerf a propósito: el kerf compensa un corte pasante y el canal es un vaciado, así que recalibrar uno no debe mover el otro. Calíbrala con un recorte antes de cortar la caja entera. |
```

En la sección **Cómo se corta**, reemplazar la lista de grupos del SVG por:

```markdown
- **`#cut`** (negro): los trazos de corte de cada panel (lo que la láser debe cortar de lado a lado).
- **`#engrave`** (rojo): solo con tapa deslizante. Los tres canales por donde corre la tapa. **Esto no se corta: se vacía** a la profundidad indicada en el resumen, con grabado láser, con fresa en un CNC o a mano. Si mandas este grupo a corte pasante, arruinas las tres piezas.
- **`#labels`**: el nombre de cada panel (BOTTOM, FRONT, LEFT, etc.), pensado solo como referencia visual para armar la caja. Este grupo hay que apagarlo o borrarlo antes de cortar, porque si no la láser grabaría (engraving) ese texto sobre el material.

Los grupos van con nombre de capa de Inkscape (*Corte* y *Grabado*), y LightBurn los reparte en capas distintas al importar porque llevan colores distintos.
```

En la sección **Qué falta (v2)**, borrar la línea `- Tapa deslizante.` y añadir al final de la lista:

```markdown
- Compensación de radio de fresa (*dogbone*) en las puntas del canal del fondo, para cortar la tapa deslizante en un router CNC.
- Generar el cupón de calibración de la holgura desde la propia aplicación.
- Tirador o muesca para el dedo en la tapa deslizante.
```

En la sección **Cómo está hecho**, reemplazar la línea de `js/boxes/` por:

```markdown
- `js/boxes/` — los tipos de caja concretos: `simple-box.js` (caja cerrada de seis paneles y tapa plana), `sliding-box.js` (tapa deslizante) y `shared.js` con lo que ambos comparten: dimensiones exteriores, segmentación de juntas, ancho de espiga automático y las validaciones y avisos comunes.
```

En la sección **Verificación**, actualizar el número de checks: sustituir `**21 checks**` por el número que imprima la página después de este plan (`get_page_text` sobre `test.html` lo muestra en el resumen de arriba, con el formato `✅ N/N checks OK`).

- [ ] **Step 5: Correr los self-checks una última vez**

Seguir "Cómo se corren los checks".
Expected: `ALL CHECKS PASSED`, incluido el check de regresión de la Task 1.

- [ ] **Step 6: Commit**

```bash
git add README.md
git commit -m "$(cat <<'EOF'
Document the sliding lid

Covers the engrave layer, the floor-to-lid height rule and the three new
parameters with their defaults.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 7: Entregar a Dani**

No hacer `git push`. Decirle:

- Qué quedó en la rama `tapa-deslizante` y cuántos commits son.
- Que el siguiente paso es suyo y es físico, en este orden: abrir el SVG en LightBurn y confirmar que negro y rojo caen en capas distintas; cortar el **cupón de calibración** (una tira de retazo de ~60 mm con el canal grabado y otra tira del grosor de la tapa) para ajustar la holgura antes de gastar una caja; después una caja chica completa (~60 × 60 × 40 en 3 mm).
- Que cuando tenga la holgura buena, la anotemos como se anotó el kerf 0.16.

---

## Pendientes conocidos, fuera de este plan

Están en el spec y se dejan escritos acá para que nadie los "arregle" de paso:

- **Compensación de radio de fresa (*dogbone*)** en las puntas del canal del fondo. En láser las esquinas salen vivas; con fresa quedan redondeadas y las esquinas traseras de la tapa pueden no asentar. Depende del diámetro de fresa, así que espera al día que se ataque el router en serio.
- **Cupón de calibración generado desde la app.** Hoy se corta a mano.
- **Tirador o muesca para el dedo** en la tapa.
- **Tapa deslizante entrando por un lateral.** Se obtiene intercambiando largo y ancho.
- **Tapa con bisagra de pin.** Es el ciclo siguiente, y va a reutilizar `pocketFeature` con `layer: 'cut'` para los agujeros del pivote.
