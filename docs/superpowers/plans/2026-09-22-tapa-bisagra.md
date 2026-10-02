# Tapa con bisagra — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir un cuarto tipo de tapa a BoxMaker — una tapa unida a la caja por una bisagra hecha del mismo material (sin varilla aparte), que gira sobre el canto trasero y pega contra la pared trasera al abrir del todo.

**Architecture:** Extensión mínima sobre el generador actual, reutilizando `panel.features` (ya introducido por la tapa deslizante). Se suma `holeFeature()` para agujeros pasantes con compensación de kerf. La caja nueva vive en `js/boxes/hinged-box.js` y reutiliza `js/boxes/shared.js`. Las cuatro paredes y la base son casi la caja cerrada de siempre (mismo `wallHeight`, mismas juntas); lo distinto son los laterales (llevan un poste que sobresale por la esquina trasera, con el agujero de la bisagra) y la tapa (lleva dos espigas que encajan en esos agujeros, una muesca por cada poste, y una manija que sobresale por el frente encajando en una muesca a juego en la pared frontal). Ningún tipo de tapa existente cambia de comportamiento.

**Tech Stack:** JavaScript ES modules, sin dependencias, sin build step. Web estática servida por `dev-server.mjs` (node). Self-checks en `test.html`, ejecutados en el navegador.

**Spec:** `docs/superpowers/specs/2026-09-22-tapa-bisagra-design.md` — leerlo entero antes de empezar. El plan argumenta desde el spec; las fórmulas y el porqué de cada número están ahí.

## Global Constraints

- **Rama de trabajo:** `tapa-bisagra`. No trabajar sobre `main`.
- **Sin dependencias nuevas, sin build step, sin backend.**
- **Todo en milímetros.**
- **Idioma:** mensajes de error y aviso en español; etiquetas de pieza en el SVG en inglés (`BOTTOM`, `FRONT`, `BACK`, `LEFT`, `RIGHT`, `LID`).
- **Idioma de los comentarios:** `js/core/` y `js/render/` en inglés. `js/boxes/` mixto: inglés para estructura, español para el razonamiento de taller.
- **Colores:** capa de corte `#000000`, capa de grabado `#e5484d`. `stroke-width` 0.2 en ambas.
- **El agujero de bisagra es un corte pasante y SÍ lleva compensación de kerf** — al revés que el canal de la tapa deslizante, que no la lleva porque no es pasante.
- **Caso de referencia que no se puede romper:** caja cerrada 80 × 80 × 80 exteriores, `thickness` 3, `kerf` 0.16, `tabWidth` 12, `lidType` `finger`. Ya está protegida por `test/golden-finger-80.json`; ninguna tarea de este plan debe tocar `simple-box.js`, `sliding-box.js` ni sus checks.
- **Ejemplo canónico de la tapa con bisagra** (80 × 80 × 80 exteriores, `t` 3, `tl` 3, `dp` 12, `hc` 1, `em` 2, `hw` 20, `hd` 6, `hr` 2): frente y fondo 80 × 77 · laterales 74 × 77 fuera del poste, 74 × 87 en la esquina del poste · agujero diámetro 13 (sin kerf), centro a `em + rh` = 8.5 mm del canto superior del poste · tapa 80 × 80.
- **Commits:** cada tarea termina en commit, con el mensaje que indica la tarea. **No hacer `git push`.**
- Terminar cada mensaje de commit con:
  `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`

## Cómo se corren los checks

No hay runner de línea de comandos: los self-checks viven en `test.html` y corren en el navegador.

1. Levantar el servidor (si no está ya levantado): `preview_start` con `{ "name": "boxmaker" }` — usa `.claude/launch.json`, puerto 8000.
2. Navegar a `http://localhost:8000/test.html`. **No hay recarga automática**: después de cada edición hay que volver a navegar a esa URL.
3. Leer la consola con `read_console_messages`.
   - Verde: aparece la línea `ALL CHECKS PASSED`.
   - Rojo: aparece `FAILED: <nombres de los checks que fallaron>`.
4. Para ver el detalle de un fallo, `get_page_text` sobre la misma pestaña.

---

### Task 1: `holeFeature()` — agujeros pasantes con kerf

La única pieza de maquinaria nueva de verdad: un agujero redondo, aproximado por un polígono, que sí lleva compensación de kerf (al revés que `pocketFeature`).

**Files:**
- Modify: `js/core/panel.js` (añadir `holeFeature`)
- Modify: `test.html` (import + dos checks)

**Interfaces:**
- Consumes: nada nuevo — sólo `Math`.
- Produces: `holeFeature({ id, cx, cy, diameter, kerf?, layer?, segments? }) → { id, layer, kind: 'hole', points }` exportada desde `js/core/panel.js`. `kerf` por defecto 0, `layer` por defecto `'cut'`, `segments` por defecto 48. `points` son un polígono cerrado de `segments` vértices aproximando un círculo de radio `diameter/2 + kerf/2`, centrado en `(cx, cy)`, en las mismas coordenadas locales que `panel.points`.

- [ ] **Step 1: Escribir los checks que fallan**

En `test.html`, cambiar la línea de import de `panel.js`:

```js
    import { panelOutline, pocketFeature, holeFeature } from './js/core/panel.js';
```

Añadir, antes de `const failed = ...`:

```js
    check('holeFeature: círculo de 48 lados, sin kerf, capa de corte por defecto', () => {
      const f = holeFeature({ id: 'hinge-hole', cx: 10, cy: 5, diameter: 6 });
      assert(f.id === 'hinge-hole', `id ${f.id}`);
      assert(f.layer === 'cut', `capa ${f.layer}, esperaba cut`);
      assert(f.kind === 'hole', `kind ${f.kind}, esperaba hole`);
      assert(f.points.length === 48, `${f.points.length} puntos, esperaba 48`);
      for (const p of f.points) {
        const d = Math.hypot(p.x - 10, p.y - 5);
        assert(near(d, 3, 1e-6), `punto a distancia ${d} del centro, esperaba 3`);
      }
    });

    check('holeFeature: el kerf agranda el radio para que el agujero terminado dé la medida nominal', () => {
      const f = holeFeature({ id: 'hinge-hole', cx: 0, cy: 0, diameter: 10, kerf: 0.2 });
      const d = Math.hypot(f.points[0].x, f.points[0].y);
      assert(near(d, 5.1, 1e-6), `radio dibujado ${d}, esperaba 5.1 (5 + kerf/2)`);
    });
```

- [ ] **Step 2: Correr para verlos fallar**

Seguir "Cómo se corren los checks".
Expected: error de importación de `holeFeature` (no existe todavía).

- [ ] **Step 3: Implementar `holeFeature`**

Al final de `js/core/panel.js`, añadir:

```js
// A circular through hole, approximated by a `segments`-sided polygon. Unlike
// pocketFeature, this one DOES carry kerf compensation: it is a through cut,
// so the radius is drawn kerf/2 larger — once the beam eats its half-kerf
// share, the hole lands on its nominal diameter.
export function holeFeature({ id, cx, cy, diameter, kerf = 0, layer = 'cut', segments = 48 }) {
  const r = diameter / 2 + kerf / 2;
  const points = [];
  for (let i = 0; i < segments; i++) {
    const angle = (i / segments) * 2 * Math.PI;
    points.push({ x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) });
  }
  return { id, layer, kind: 'hole', points };
}
```

- [ ] **Step 4: Correr los checks — verde**

Seguir "Cómo se corren los checks".
Expected: `ALL CHECKS PASSED`.

- [ ] **Step 5: Commit**

```bash
git add js/core/panel.js test.html
git commit -m "$(cat <<'EOF'
Add holeFeature for through-cut circular holes

Unlike pocketFeature, this one carries kerf compensation: it is a
through cut, not a pocket. The hinge holes are the first consumer.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: `hinged-box.js` — alturas y las cuatro paredes lisas

El esqueleto: base, frente, fondo, laterales y tapa, todos como en la tapa plana (paredes a `Ho − tl`, tapa lisa del tamaño exterior), sin bisagra todavía. Esto prueba que el armazón general es correcto antes de meterle la geometría rara.

**Files:**
- Create: `js/boxes/hinged-box.js`
- Modify: `test.html` (imports + cuatro checks)

**Interfaces:**
- Consumes: `panelOutline` de `js/core/panel.js`; todo lo de `js/boxes/shared.js`.
- Produces, desde `js/boxes/hinged-box.js`:
  - `lidThicknessFor(params) → number`
  - `hingedHeights(params) → { Lo, Wo, Ho, t, tl, wallHeight }`
  - `autoTabWidth(params) → number`
  - `buildHingedBox(params) → { panels, joints, errors, warnings, outer, inner }`
  - `panels[].id` ∈ `bottom | front | left | lid | back | right`, en ese orden.
  - `joints = { x, y, z }`, cada uno `{ count, width, tabs }` — misma forma que `buildBox`.

- [ ] **Step 1: Escribir los checks que fallan**

En `test.html`, añadir junto a los otros imports:

```js
    import { buildHingedBox } from './js/boxes/hinged-box.js';
```

Y antes de `const failed = ...`:

```js
    const HINGED = {
      length: 80, width: 80, height: 80,
      thickness: 3, kerf: 0.16, tabWidth: 12,
      dimensionMode: 'outer', lidType: 'hinged',
    };
    const hinged = buildHingedBox(HINGED);
    const hp = (id) => hinged.panels.find((p) => p.id === id);

    check('bisagra: seis piezas y ningún error', () => {
      assert(hinged.errors.length === 0, hinged.errors.join(' | '));
      assert(hinged.panels.length === 6, `${hinged.panels.length} piezas, esperaba 6`);
      assert(hp('lid'), 'falta la tapa');
    });

    check('bisagra: de suelo a tapa da el alto pedido, con tl = t las paredes miden igual que la tapa plana', () => {
      assert(near(hinged.outer.height, 80), `alto exterior ${hinged.outer.height}`);
      assert(near(hp('front').height, 77), `frente ${hp('front').height}, esperaba 77`);
      assert(near(hp('back').height, 77), `fondo ${hp('back').height}, esperaba 77`);
      assert(near(hinged.inner.height, 74), `interior ${hinged.inner.height}, esperaba 74`);
    });

    check('bisagra: la tapa es lisa y del tamaño exterior completo', () => {
      const lid = hp('lid');
      assert(lid.points.length === 4, `${lid.points.length} puntos: la tapa base no debería llevar bultos`);
      const bb = boundingBox(lid.points);
      assert(near(bb.width, 80) && near(bb.height, 80), `tapa ${bb.width} × ${bb.height}, esperaba 80 × 80`);
    });

    check('bisagra: modo interiores da el hueco pedido', () => {
      const byInner = buildHingedBox({ ...HINGED, dimensionMode: 'inner', length: 74, width: 74, height: 74 });
      assert(byInner.errors.length === 0, byInner.errors.join(' | '));
      assert(near(byInner.outer.height, 80), `exterior ${byInner.outer.height}, esperaba 80`);
      assert(near(byInner.inner.height, 74), `interior ${byInner.inner.height}`);
    });
```

- [ ] **Step 2: Correr para verlos fallar**

Expected: error de importación de `./js/boxes/hinged-box.js` (no existe todavía).

- [ ] **Step 3: Escribir el generador**

Crear `js/boxes/hinged-box.js`:

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

// La tapa puede ser de otro grosor que la caja. Sin valor, copia la pared.
export function lidThicknessFor({ thickness, lidThickness }) {
  return Number.isFinite(lidThickness) ? lidThickness : thickness;
}

// Ho es la distancia de la base a la cara superior de la tapa cerrada, igual
// que en las otras tapas. Las cuatro paredes quedan a Ho − tl, como la tapa
// plana: la tapa se apoya encima y queda a ras.
export function hingedHeights(params) {
  const t = params.thickness;
  const tl = lidThicknessFor(params);
  const { Lo, Wo, Ho } = outerDimensions(params, t + tl);
  return { Lo, Wo, Ho, t, tl, wallHeight: Ho - tl };
}

export function autoTabWidth(params) {
  const { Lo, Wo, t, wallHeight } = hingedHeights(params);
  return autoTabWidthFromSpans([Lo - 2 * t, Wo - 2 * t, wallHeight - 2 * t], t);
}

export function buildHingedBox(params) {
  const { kerf, tabWidth } = params;
  const { Lo, Wo, Ho, t, tl, wallHeight } = hingedHeights(params);
  const spanX = Lo - 2 * t; // frente/fondo <-> base
  const spanY = Wo - 2 * t; // laterales <-> base
  const spanZ = wallHeight - 2 * t; // juntas verticales, iguales en las cuatro paredes

  const errors = validate({ Lo, Wo, Ho, t, tl, kerf, tabWidth, spanX, spanY, spanZ });
  if (errors.length > 0) return { errors, warnings: [], panels: [] };

  const joints = {
    x: jointSegments(spanX, tabWidth),
    y: jointSegments(spanY, tabWidth),
    z: jointSegments(spanZ, tabWidth),
  };

  const SOLID = { startsSolid: true };
  const endWall = {
    width: Lo, height: wallHeight,
    edges: {
      top: { gender: 'plain' },
      bottom: { gender: 'female', jointStart: t, jointSpan: spanX, ...SOLID },
      left: { gender: 'female', jointStart: t, jointSpan: spanZ, ...SOLID },
      right: { gender: 'female', jointStart: t, jointSpan: spanZ, ...SOLID },
    },
  };
  const sideWall = {
    width: spanY, height: wallHeight,
    edges: {
      top: { gender: 'plain' },
      bottom: { gender: 'female', ...SOLID },
      left: { gender: 'male', jointStart: t, jointSpan: spanZ, ...SOLID },
      right: { gender: 'male', jointStart: t, jointSpan: spanZ, ...SOLID },
    },
  };

  const specs = [
    {
      id: 'bottom', label: 'BOTTOM', width: spanX, height: spanY,
      edges: {
        top: { gender: 'male', ...SOLID }, bottom: { gender: 'male', ...SOLID },
        left: { gender: 'male', ...SOLID }, right: { gender: 'male', ...SOLID },
      },
    },
    { id: 'front', label: 'FRONT', ...endWall },
    { id: 'left', label: 'LEFT', ...sideWall },
    {
      id: 'lid', label: 'LID', width: Lo, height: Wo,
      edges: {
        top: { gender: 'plain' }, bottom: { gender: 'plain' },
        left: { gender: 'plain' }, right: { gender: 'plain' },
      },
    },
    { id: 'back', label: 'BACK', ...endWall },
    { id: 'right', label: 'RIGHT', ...sideWall },
  ];

  const material = { thickness: t, kerf, tabWidth };
  const panels = specs.map((spec) => ({ ...spec, points: panelOutline(spec, material) }));

  return {
    panels,
    joints,
    errors,
    warnings: commonWarnings({
      jointWidths: [joints.x.width, joints.y.width, joints.z.width],
      t, kerf, tabWidth,
    }),
    outer: { length: Lo, width: Wo, height: Ho },
    inner: { length: spanX, width: spanY, height: wallHeight - t },
  };
}

function validate({ Lo, Wo, Ho, t, tl, kerf, tabWidth, spanX, spanY, spanZ }) {
  const errors = validateBasics({ t, kerf, tabWidth, Lo, Wo, Ho });
  if (errors.length > 0) return errors;

  const positive = (v) => Number.isFinite(v) && v > 0;
  if (!positive(tl)) errors.push('El grosor de la tapa debe ser mayor que 0.');
  if (errors.length > 0) return errors;

  if (kerf >= t) errors.push(KERF_TOO_BIG);
  if (spanX <= 0 || spanY <= 0) {
    errors.push(`El material de ${t} mm es demasiado grueso para una caja de ${Lo} × ${Wo} mm: no queda espacio dentro.`);
  }
  if (spanZ <= 0) {
    errors.push(`Con ${t} mm de material, una caja de ${Ho} mm de alto no deja pared entre la base y la tapa.`);
  }
  if (errors.length > 0) return errors;

  errors.push(...validateTabsVsKerf(
    [['largo', spanX], ['ancho', spanY], ['alto', spanZ]],
    tabWidth, kerf,
  ));
  return errors;
}
```

- [ ] **Step 4: Correr los checks — verde**

Expected: `ALL CHECKS PASSED`.

- [ ] **Step 5: Commit**

```bash
git add js/boxes/hinged-box.js test.html
git commit -m "$(cat <<'EOF'
Add hinged lid box generator: heights and plain panels

Same wallHeight rule as the flat lid (Ho - tl), shared by all four
walls this time — the hinge corner post comes next, but the joints
between front/back and the sides are already final.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: El poste y el agujero de los laterales

Por qué el lateral necesita un poste: la espiga vive a la altura de la tapa cerrada, y para que el agujero quede cerrado (con material arriba) el lateral tiene que llegar más alto que `wallHeight` justo en esa esquina. El spec lo explica con números; acá se implementa.

**Files:**
- Modify: `js/boxes/hinged-box.js`
- Modify: `test.html` (cinco checks)

**Interfaces:**
- Consumes: `holeFeature` de `js/core/panel.js`; todo lo ya existente en `hinged-box.js`.
- Produces, añadidos a `js/boxes/hinged-box.js`:
  - `pegDiameterFor(params) → number` (default `4 × thickness`)
  - `hingeClearanceFor(params) → number` (default `1`)
  - `hingedHeights(params)` gana `dp`, `hc`, `rh` (radio del agujero), `postHeight`, `postWidth`.
  - Los paneles `left`/`right` ganan `panel.features = [holeFeature(...)]` y su `points`/`height` reflejan el poste.
  - `buildHingedBox(params).hinge = { pegDiameter, clearance, holeDiameter, postHeight }`.

- [ ] **Step 1: Escribir los checks que fallan**

En `test.html`, añadir antes de `const failed = ...`:

```js
    check('bisagra: el agujero de cada lateral está centrado a em + rh del canto superior del poste', () => {
      for (const id of ['left', 'right']) {
        const p = hp(id);
        const hole = p.features.find((f) => f.id === 'hinge-hole');
        assert(hole, `${id}: no tiene agujero de bisagra`);
        const bb = boundingBox(hole.points);
        const cy = (bb.minY + bb.maxY) / 2;
        assert(near(cy, 8.5, 0.05), `${id}: centro del agujero a y=${cy}, esperaba 8.5 (em 2 + rh 6.5)`);
        assert(near(bb.height, 13, 0.05), `${id}: diámetro dibujado ${bb.height}, esperaba 13 (dp 12 + hc 1)`);
        assert(hole.layer === 'cut', `${id}: capa ${hole.layer}, esperaba cut`);
      }
    });

    check('bisagra: el poste sobresale por encima del nivel de la tapa cerrada', () => {
      for (const id of ['left', 'right']) {
        const p = hp(id);
        assert(near(p.height, 87, 0.05), `${id}: alto ${p.height}, esperaba 87 (77 + 10 de poste)`);
        const bb = boundingBox(p.points);
        assert(near(bb.minY, 0), `${id}: el contorno no llega a y=0, el poste no se dibujó`);
      }
    });

    check('bisagra: el poste ocupa sólo la esquina trasera, el resto del canto queda a wallHeight', () => {
      for (const id of ['left', 'right']) {
        const p = hp(id);
        const onNormalLevel = p.points.filter((q) => near(q.y, 10, 0.01));
        assert(onNormalLevel.length >= 1, `${id}: no hay ningún vértice en el nivel normal (y=10)`);
      }
    });

    check('bisagra: hay material por encima del agujero (el agujero no toca el canto del poste)', () => {
      for (const id of ['left', 'right']) {
        const p = hp(id);
        const hole = p.features.find((f) => f.id === 'hinge-hole');
        const bb = boundingBox(hole.points);
        assert(bb.minY > 1.9, `${id}: el agujero llega a y=${bb.minY}, casi al canto (y=0)`);
      }
    });

    check('bisagra: los dos laterales son espejo — el poste vive en la esquina trasera de cada uno', () => {
      const left = hp('left');
      const right = hp('right');
      const holeLeft = left.features.find((f) => f.id === 'hinge-hole');
      const holeRight = right.features.find((f) => f.id === 'hinge-hole');
      const cxLeft = boundingBox(holeLeft.points).minX + boundingBox(holeLeft.points).width / 2;
      const cxRight = boundingBox(holeRight.points).minX + boundingBox(holeRight.points).width / 2;
      // spanY = 74; el agujero queda a em + rh = 8.5 del canto que mira al fondo.
      // En 'left' ese canto es x = spanY (74); en 'right' es x = 0. Espejados.
      assert(near(cxLeft, 74 - 8.5, 0.05), `left: centro en x=${cxLeft}, esperaba 65.5`);
      assert(near(cxRight, 8.5, 0.05), `right: centro en x=${cxRight}, esperaba 8.5`);
    });
```

- [ ] **Step 2: Correr para verlos fallar**

Expected: fallan los cinco — los laterales todavía no llevan poste ni agujero.

- [ ] **Step 3: Implementar el poste y el agujero**

En `js/boxes/hinged-box.js`, reemplazar el import de arriba por:

```js
import { holeFeature, panelOutline } from '../core/panel.js';
```

Añadir, junto a las otras constantes/funciones exportadas (después de `lidThicknessFor`):

```js
const DEFAULT_PEG_DIAMETER_FACTOR = 4; // dp por defecto = 4 × t
const DEFAULT_HINGE_CLEARANCE = 1;
export const EDGE_MARGIN = 2; // material mínimo alrededor de cualquier corte cerrado

export function pegDiameterFor({ thickness, pegDiameter }) {
  return Number.isFinite(pegDiameter) ? pegDiameter : DEFAULT_PEG_DIAMETER_FACTOR * thickness;
}

export function hingeClearanceFor({ hingeClearance }) {
  return Number.isFinite(hingeClearance) ? hingeClearance : DEFAULT_HINGE_CLEARANCE;
}
```

Reemplazar `hingedHeights` entera por:

```js
// Ho es la distancia de la base a la cara superior de la tapa cerrada, igual
// que en las otras tapas. Las cuatro paredes quedan a Ho − tl, como la tapa
// plana: la tapa se apoya encima y queda a ras.
//
// La espiga es plana y vive exactamente a la altura de la tapa cerrada. Para
// que el agujero del lateral quede cerrado (con material por encima, no
// abierto al canto) el lateral tiene que llegar más alto que Ho − tl en la
// esquina trasera. postHeight es cuánto: media tapa hasta el centro del
// agujero (tl/2), más el radio del agujero (rh), más el margen de material
// que tiene que quedar por encima (em).
export function hingedHeights(params) {
  const t = params.thickness;
  const tl = lidThicknessFor(params);
  const dp = pegDiameterFor(params);
  const hc = hingeClearanceFor(params);
  const rh = (dp + hc) / 2;
  const { Lo, Wo, Ho } = outerDimensions(params, t + tl);
  const postHeight = tl / 2 + rh + EDGE_MARGIN;
  const postWidth = dp + hc + 2 * EDGE_MARGIN;

  return {
    Lo, Wo, Ho, t, tl, dp, hc, rh,
    wallHeight: Ho - tl,
    postHeight,
    postWidth,
  };
}
```

Reemplazar el inicio de `buildHingedBox` (hasta el `const errors = ...`) por:

```js
export function buildHingedBox(params) {
  const { kerf, tabWidth } = params;
  const {
    Lo, Wo, Ho, t, tl, dp, hc, rh, wallHeight, postHeight, postWidth,
  } = hingedHeights(params);
  const spanX = Lo - 2 * t; // frente/fondo <-> base
  const spanY = Wo - 2 * t; // laterales <-> base
  const spanZ = wallHeight - 2 * t; // juntas verticales, iguales en las cuatro paredes

  const errors = validate({ Lo, Wo, Ho, t, tl, dp, hc, kerf, tabWidth, spanX, spanY, spanZ });
```

Después del bloque `const joints = {...}` (justo antes de `const SOLID = { startsSolid: true };`), no cambiar nada; pero reemplazar el bloque de `endWall`/`sideWall`/`specs`/`panels` completo (desde `const SOLID` hasta `const panels = specs.map(...)`) por:

```js
  const SOLID = { startsSolid: true };
  const material = { thickness: t, kerf, tabWidth };
  const endWall = {
    width: Lo, height: wallHeight,
    edges: {
      top: { gender: 'plain' },
      bottom: { gender: 'female', jointStart: t, jointSpan: spanX, ...SOLID },
      left: { gender: 'female', jointStart: t, jointSpan: spanZ, ...SOLID },
      right: { gender: 'female', jointStart: t, jointSpan: spanZ, ...SOLID },
    },
  };

  // El poste sólo sobresale en la esquina trasera; el resto del canto sigue a
  // wallHeight. Se arma el lateral normal (sin poste) y se le injerta el bulto
  // en el canto superior, que en panelOutline son siempre los dos primeros
  // puntos del contorno (el canto 'top' no lleva espigas, así que no se mezcla
  // con nada del resto de la pieza).
  const buildSideWall = (id, label, frontEdge) => {
    const isLeft = frontEdge === 'left';
    const backEdge = isLeft ? 'right' : 'left';
    const spec = {
      width: spanY, height: wallHeight,
      edges: {
        top: { gender: 'plain' },
        bottom: { gender: 'female', ...SOLID },
        [frontEdge]: { gender: 'male', jointStart: t, jointSpan: spanZ, ...SOLID },
        [backEdge]: { gender: 'male', jointStart: t, jointSpan: spanZ, ...SOLID },
      },
    };
    const basePoints = panelOutline(spec, material);
    // basePoints[0] y [1] son las dos esquinas del canto superior, en ese
    // orden de recorrido (sentido horario). El resto de la pieza (aristas
    // right/bottom/left) no cambia de forma, sólo se corre postHeight hacia
    // abajo para que el nuevo y=0 sea el canto superior del poste.
    const rest = basePoints.slice(2).map((p) => ({ x: p.x, y: p.y + postHeight }));
    const postNear = isLeft ? spanY - postWidth : postWidth;
    const backX = isLeft ? spanY : 0;
    const frontCorner = { x: isLeft ? 0 : spanY, y: postHeight };
    const nearPoint = { x: postNear, y: postHeight };
    const stepUp = { x: postNear, y: 0 };
    const backCorner = { x: backX, y: 0 };
    const top = isLeft
      ? [frontCorner, nearPoint, stepUp, backCorner]
      : [backCorner, stepUp, nearPoint, frontCorner];
    const points = [...top, ...rest];

    const holeCenterX = isLeft ? spanY - EDGE_MARGIN - rh : EDGE_MARGIN + rh;
    const hole = holeFeature({
      id: 'hinge-hole', cx: holeCenterX, cy: EDGE_MARGIN + rh, diameter: dp + hc, kerf,
    });

    return {
      id, label, width: spanY, height: wallHeight + postHeight,
      edges: spec.edges, points, features: [hole],
    };
  };

  const specs = [
    {
      id: 'bottom', label: 'BOTTOM', width: spanX, height: spanY,
      edges: {
        top: { gender: 'male', ...SOLID }, bottom: { gender: 'male', ...SOLID },
        left: { gender: 'male', ...SOLID }, right: { gender: 'male', ...SOLID },
      },
    },
    { id: 'front', label: 'FRONT', ...endWall },
    { id: 'back', label: 'BACK', ...endWall },
    {
      id: 'lid', label: 'LID', width: Lo, height: Wo,
      edges: {
        top: { gender: 'plain' }, bottom: { gender: 'plain' },
        left: { gender: 'plain' }, right: { gender: 'plain' },
      },
    },
  ];

  const generic = Object.fromEntries(
    specs.map((spec) => [spec.id, { ...spec, points: panelOutline(spec, material) }]),
  );
  const left = buildSideWall('left', 'LEFT', 'left');
  const right = buildSideWall('right', 'RIGHT', 'right');
  const panels = [generic.bottom, generic.front, left, generic.lid, generic.back, right];
```

Por último, en el `return` de `buildHingedBox`, después de `warnings: commonWarnings({...}),`, añadir:

```js
    hinge: { pegDiameter: dp, clearance: hc, holeDiameter: dp + hc, postHeight },
```

- [ ] **Step 4: Correr los checks — verde**

Expected: `ALL CHECKS PASSED`.

Si falla `el poste sobresale...` con un alto distinto a 87, revisar `postHeight = tl/2 + rh + EDGE_MARGIN`: con `tl` 3, `dp` 12, `hc` 1 → `rh` 6.5 → `postHeight = 1.5 + 6.5 + 2 = 10`, y `87 = wallHeight(77) + postHeight(10)`.

- [ ] **Step 5: Mirar el dibujo**

Navegar a `http://localhost:8000/` y en la consola del navegador:

```js
const { buildHingedBox } = await import('/js/boxes/hinged-box.js');
const { renderBox } = await import('/js/render/svg-render.js');
const svg = renderBox(buildHingedBox({
  length: 80, width: 80, height: 80, thickness: 3, kerf: 0.16, tabWidth: 12,
  dimensionMode: 'outer', lidType: 'hinged',
}));
document.getElementById('preview').replaceChildren(svg);
[svg.querySelector('#cut').children.length, [...svg.querySelectorAll('#left, #right')].length];
```

Expected: los dos laterales se ven con un bulto rectangular en una esquina del canto superior, con un círculo adentro (el agujero, en negro — capa de corte, no de grabado). Tomar screenshot y confirmar a ojo que el bulto está en la esquina que corresponde al fondo (la misma esquina en los dos laterales, espejada).

- [ ] **Step 6: Commit**

```bash
git add js/boxes/hinged-box.js test.html
git commit -m "$(cat <<'EOF'
Add the hinge post and hole to the side walls

The peg lives flat at the closed lid's height, so the wall needs to
stand taller than the lid line right at the back corner for the hole
to have material above it. Only that corner grows; the rest of the
wall stays at the normal height.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Las dos espigas de la tapa

La tapa gana dos pestañas redondeadas en el canto trasero, una por esquina, que encajan en los agujeros de la Task 3. Cada una vive dentro de una muesca que le hace lugar al poste correspondiente.

**Files:**
- Modify: `js/boxes/hinged-box.js`
- Modify: `test.html` (cuatro checks)

**Interfaces:**
- Consumes: nada nuevo.
- Produces: el panel `lid` deja de ser un rectángulo de 4 puntos; su `points` incluye las dos muescas con sus espigas. `buildHingedBox(...).hinge` no cambia de forma.

- [ ] **Step 1: Escribir los checks que fallan**

Añadir antes de `const failed = ...`:

```js
    check('bisagra: la tapa lleva una muesca con espiga en cada esquina trasera', () => {
      const lid = hp('lid');
      assert(lid.points.length > 4, 'la tapa sigue siendo un rectángulo liso: faltan las espigas');
      // Las espigas viven cerca de y = Wo (80): puntos con y claramente mayor
      // que el resto del contorno, más allá del rectángulo base.
      const beyondBack = lid.points.filter((p) => p.y > 80 + 0.01);
      assert(beyondBack.length === 0, 'ningún punto de la espiga debe sobresalir por detrás del canto trasero');
    });

    check('bisagra: el disco de cada espiga queda centrado sobre el agujero de su lateral', () => {
      // La espiga vive en el mismo plano que la tapa: su centro, en X e Y
      // absolutos de la caja, tiene que coincidir con el centro del agujero
      // del lateral que le toca. left: x = t/2. right: x = Lo - t/2. Los dos
      // en y = Wo - t - em - rh.
      const lid = hp('lid');
      const near80 = lid.points.filter((p) => p.y > 60);
      const leftCluster = near80.filter((p) => p.x < 20);
      const rightCluster = near80.filter((p) => p.x > 60);
      assert(leftCluster.length > 0, 'no hay puntos de espiga cerca de la esquina izquierda');
      assert(rightCluster.length > 0, 'no hay puntos de espiga cerca de la esquina derecha');
      const cx = (pts) => (Math.min(...pts.map((p) => p.x)) + Math.max(...pts.map((p) => p.x))) / 2;
      const cy = (pts) => (Math.min(...pts.map((p) => p.y)) + Math.max(...pts.map((p) => p.y))) / 2;
      assert(near(cx(leftCluster), 1.5, 0.3), `disco izquierdo centrado en x=${cx(leftCluster)}, esperaba ~1.5 (t/2)`);
      assert(near(cx(rightCluster), 78.5, 0.3), `disco derecho centrado en x=${cx(rightCluster)}, esperaba ~78.5 (Lo - t/2)`);
      assert(near(cy(leftCluster), 68.5, 0.5), `disco izquierdo centrado en y=${cy(leftCluster)}, esperaba ~68.5 (Wo - t - em - rh)`);
    });

    check('bisagra: la muesca de la esquina no invade el resto del canto lateral de la tapa', () => {
      const lid = hp('lid');
      // El canto izquierdo (x = 0) es un único segmento recto de (0,Wo) a
      // (0,0): sin la muesca ahí en medio, esos deberían ser los DOS únicos
      // vértices con x ≈ 0 (nada de la espiga o su cuello debe tocar x = 0).
      const atLeftEdge = lid.points.filter((p) => near(p.x, 0, 1e-6));
      assert(atLeftEdge.length === 2,
        `${atLeftEdge.length} vértices en x = 0, esperaba 2 (las dos esquinas, nada de la espiga invadiendo el canto)`);
    });

    check('bisagra: el contorno de la tapa sigue siendo un único camino cerrado', () => {
      const lid = hp('lid');
      for (const p of lid.points) {
        assert(Number.isFinite(p.x) && Number.isFinite(p.y), 'coordenada no numérica en la tapa');
      }
    });
```

- [ ] **Step 2: Correr para verlos fallar**

Expected: fallan los cuatro — la tapa sigue siendo un rectángulo liso.

- [ ] **Step 3: Implementar las espigas**

En `js/boxes/hinged-box.js`, añadir esta función junto a `buildSideWall` (antes de `const specs = [...]`):

```js
  // Cada espiga es una pestaña redondeada (un rectángulo terminado en
  // semicírculo) que sale de la tapa hacia la esquina trasera y encaja en el
  // agujero de su lateral. Vive dentro de una muesca del mismo ancho que el
  // poste correspondiente, para que el poste tenga sitio cuando la tapa
  // cierra. El disco queda centrado en (t/2, Wo − t − em − rh) para la
  // esquina izquierda, espejado para la derecha — el mismo centro, en
  // coordenadas absolutas de la caja, que el agujero de su lateral.
  const pegArc = (cx, cy, fromDeg, toDeg, steps = 16) => {
    const pts = [];
    for (let i = 0; i <= steps; i++) {
      const a = ((fromDeg + (toDeg - fromDeg) * (i / steps)) * Math.PI) / 180;
      pts.push({ x: cx + rh * Math.cos(a), y: cy + rh * Math.sin(a) });
    }
    return pts;
  };

  const notchWidth = t + EDGE_MARGIN;
  const notchDepth = t + postWidth;
  const buildPegCorner = (isLeft) => {
    const cx = isLeft ? t / 2 : Lo - t / 2;
    const cy = Wo - t - EDGE_MARGIN - rh;
    const attachX = isLeft ? notchWidth : Lo - notchWidth;
    // Arco: para la esquina izquierda el cuello sale hacia +x (desde el
    // disco, que está más cerca del canto), así que se dibuja la mitad del
    // círculo que mira hacia -x (90°→270°). Para la derecha, al revés.
    const arc = isLeft ? pegArc(cx, cy, -90, 90) : pegArc(cx, cy, 90, 270);
    const neckHalf = rh;
    const nearY = cy - neckHalf;
    const farY = cy + neckHalf;
    return isLeft
      ? [{ x: attachX, y: nearY }, ...arc, { x: attachX, y: farY }]
      : [{ x: attachX, y: nearY }, ...arc, { x: attachX, y: farY }];
  };

  const lidWithPegs = () => {
    const spec = {
      width: Lo, height: Wo,
      edges: {
        top: { gender: 'plain' }, bottom: { gender: 'plain' },
        left: { gender: 'plain' }, right: { gender: 'plain' },
      },
    };
    const base = panelOutline(spec, material);
    // base es el rectángulo Lo × Wo en sentido horario: (0,0) (Lo,0) (Lo,Wo) (0,Wo).
    // Se reconstruye a mano insertando, en el canto trasero (de (Lo,Wo) a
    // (0,Wo)), la muesca+espiga de la derecha primero y la de la izquierda
    // después, porque el recorrido va de x=Lo hacia x=0 en ese tramo.
    const rightPeg = buildPegCorner(false);
    const leftPeg = buildPegCorner(true);
    return [
      { x: 0, y: 0 }, { x: Lo, y: 0 }, { x: Lo, y: Wo },
      { x: Lo - notchWidth, y: Wo }, ...rightPeg, { x: Lo - notchWidth, y: Wo },
      { x: notchWidth, y: Wo }, ...leftPeg, { x: notchWidth, y: Wo },
      { x: 0, y: Wo },
    ];
  };
```

Y reemplazar la línea del spec `lid` dentro de `specs` (la que tiene `id: 'lid'`) por sólo el resto de specs sin `lid` — es decir, quitar ese objeto del array `specs` — y en el bloque de construcción de `generic`/`panels`, reemplazar:

```js
  const left = buildSideWall('left', 'LEFT', 'left');
  const right = buildSideWall('right', 'RIGHT', 'right');
  const panels = [generic.bottom, generic.front, left, generic.lid, generic.back, right];
```

por:

```js
  const left = buildSideWall('left', 'LEFT', 'left');
  const right = buildSideWall('right', 'RIGHT', 'right');
  const lid = {
    id: 'lid', label: 'LID', width: Lo, height: Wo,
    edges: {
      top: { gender: 'plain' }, bottom: { gender: 'plain' },
      left: { gender: 'plain' }, right: { gender: 'plain' },
    },
    points: lidWithPegs(),
  };
  const panels = [generic.bottom, generic.front, left, lid, generic.back, right];
```

(`generic.lid` ya no existe: quitar también `id: 'lid'` del array `specs` como se indicó arriba, para no construir un panel `lid` de más.)

- [ ] **Step 4: Correr los checks**

Expected: `ALL CHECKS PASSED`. Si `el disco... centrado en y=...` falla por poco, revisar `cy = Wo - t - EDGE_MARGIN - rh` con los números canónicos: `80 - 3 - 2 - 6.5 = 68.5`.

- [ ] **Step 5: Mirar el dibujo**

En la consola del navegador, con la app abierta:

```js
document.getElementById('lid-finger').checked = false;
```

(o el flujo de UI que exista en ese momento — si la Task 7 todavía no conectó `hinged` al formulario, generar y previsualizar a mano como en la Task 3, Step 5, pero mirando la pieza `lid`.) Confirmar a ojo: la tapa tiene dos bultos redondeados en las esquinas traseras, cada uno dentro de una muesca rectangular, y el resto del contorno sigue siendo el rectángulo Lo × Wo.

- [ ] **Step 6: Commit**

```bash
git add js/boxes/hinged-box.js test.html
git commit -m "$(cat <<'EOF'
Add the two hinge pegs to the lid

Each peg is a rounded tab living inside a notch sized to the matching
post, centered on the same absolute point as its side wall's hole.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Manija — pestaña en la tapa, muesca en el frente

Lo último de geometría: la tapa gana una pestaña rectangular de esquinas redondeadas en el centro del canto delantero, que sobresale del perímetro; la pared frontal gana una muesca a juego, en la misma posición.

**Files:**
- Modify: `js/boxes/hinged-box.js`
- Modify: `test.html` (tres checks)

**Interfaces:**
- Consumes: nada nuevo.
- Produces: `lid.points` gana la pestaña delantera; `front.points` gana la muesca. `buildHingedBox(params)` reconoce `handleWidth`, `handleDepth`, `handleCornerRadius` (defaults 20, 6, 2).

- [ ] **Step 1: Escribir los checks que fallan**

```js
    check('bisagra: la tapa tiene una manija que sobresale del canto delantero', () => {
      const lid = hp('lid');
      const beyondFront = lid.points.filter((p) => p.y < -0.01);
      assert(beyondFront.length > 0, 'ningún punto de la tapa sobresale por delante: falta la manija');
      const minY = Math.min(...lid.points.map((p) => p.y));
      assert(near(minY, -6, 0.05), `la manija sobresale ${-minY} mm, esperaba 6`);
    });

    check('bisagra: la manija queda centrada en X', () => {
      const lid = hp('lid');
      const minY = Math.min(...lid.points.map((p) => p.y));
      const tip = lid.points.filter((p) => near(p.y, minY, 0.5));
      const xs = tip.map((p) => p.x);
      const center = (Math.min(...xs) + Math.max(...xs)) / 2;
      assert(near(center, 40, 0.5), `manija centrada en x=${center}, esperaba 40 (Lo/2)`);
    });

    check('bisagra: la pared frontal tiene una muesca del mismo ancho, en la misma posición', () => {
      const front = hp('front');
      const notchPoints = front.points.filter((p) => p.y > 0.01);
      assert(notchPoints.length > 0, 'la pared frontal no tiene ninguna muesca');
      const xs = notchPoints.map((p) => p.x);
      const center = (Math.min(...xs) + Math.max(...xs)) / 2;
      assert(near(center, 40, 0.5), `muesca del frente centrada en x=${center}, esperaba 40`);
      const width = Math.max(...xs) - Math.min(...xs);
      assert(near(width, 20, 0.5), `muesca del frente de ${width} mm, esperaba 20 (handleWidth)`);
    });
```

- [ ] **Step 2: Correr para verlos fallar**

Expected: fallan los tres.

- [ ] **Step 3: Implementar manija y muesca**

En `js/boxes/hinged-box.js`, añadir junto a las otras funciones que leen defaults:

```js
export function handleWidthFor({ handleWidth }) {
  return Number.isFinite(handleWidth) ? handleWidth : 20;
}
export function handleDepthFor({ handleDepth }) {
  return Number.isFinite(handleDepth) ? handleDepth : 6;
}
export function handleCornerRadiusFor({ handleCornerRadius }) {
  return Number.isFinite(handleCornerRadius) ? handleCornerRadius : 2;
}
```

En `buildHingedBox`, después de `const { kerf, tabWidth } = params;`, añadir:

```js
  const hw = handleWidthFor(params);
  const hd = handleDepthFor(params);
  const hr = handleCornerRadiusFor(params);
```

Añadir esta función junto a `lidWithPegs` (antes de ella, ya que `lidWithPegs` la va a usar):

```js
  // Rectángulo de esquinas redondeadas, recorrido en sentido horario, con la
  // esquina superior-izquierda en (x, y) y las dimensiones dadas.
  const roundedRectPoints = (x, y, width, height, radius, steps = 6) => {
    const arc = (cx, cy, fromDeg, toDeg) => {
      const pts = [];
      for (let i = 0; i <= steps; i++) {
        const a = ((fromDeg + (toDeg - fromDeg) * (i / steps)) * Math.PI) / 180;
        pts.push({ x: cx + radius * Math.cos(a), y: cy + radius * Math.sin(a) });
      }
      return pts;
    };
    return [
      ...arc(x + radius, y + radius, 180, 270),
      ...arc(x + width - radius, y + radius, 270, 360),
      ...arc(x + width - radius, y + height - radius, 0, 90),
      ...arc(x + radius, y + height - radius, 90, 180),
    ];
  };

  const handleStart = Lo / 2 - hw / 2;
```

Y reemplazar el primer punto del `return` de `lidWithPegs` (la construcción del array final) — cambiar:

```js
    return [
      { x: 0, y: 0 }, { x: Lo, y: 0 }, { x: Lo, y: Wo },
      { x: Lo - notchWidth, y: Wo }, ...rightPeg, { x: Lo - notchWidth, y: Wo },
      { x: notchWidth, y: Wo }, ...leftPeg, { x: notchWidth, y: Wo },
      { x: 0, y: Wo },
    ];
```

por:

```js
    const handle = roundedRectPoints(handleStart, -hd, hw, hd + 0.01, hr);
    return [
      { x: 0, y: 0 }, { x: handleStart, y: 0 }, ...handle, { x: handleStart + hw, y: 0 },
      { x: Lo, y: 0 }, { x: Lo, y: Wo },
      { x: Lo - notchWidth, y: Wo }, ...rightPeg, { x: Lo - notchWidth, y: Wo },
      { x: notchWidth, y: Wo }, ...leftPeg, { x: notchWidth, y: Wo },
      { x: 0, y: Wo },
    ];
```

(El `+ 0.01` en la altura del rectángulo de la manija evita que el borde inferior del rounded-rect, en `y = -hd + 0.01`, quede exactamente sobre `y = 0`: así no hay dos vértices casi idénticos que `dedupePoints` — que acá no corre, este contorno se arma a mano — pudiera confundir. No cambia la medida a los ojos ni al corte.)

Ahora la muesca del frente. Reemplazar el objeto `endWall` (usado por `front` y `back`) para que `front` use una versión propia con la muesca. Cambiar:

```js
  const endWall = {
    width: Lo, height: wallHeight,
    edges: {
      top: { gender: 'plain' },
      bottom: { gender: 'female', jointStart: t, jointSpan: spanX, ...SOLID },
      left: { gender: 'female', jointStart: t, jointSpan: spanZ, ...SOLID },
      right: { gender: 'female', jointStart: t, jointSpan: spanZ, ...SOLID },
    },
  };
```

por:

```js
  const endWallEdges = {
    top: { gender: 'plain' },
    bottom: { gender: 'female', jointStart: t, jointSpan: spanX, ...SOLID },
    left: { gender: 'female', jointStart: t, jointSpan: spanZ, ...SOLID },
    right: { gender: 'female', jointStart: t, jointSpan: spanZ, ...SOLID },
  };
  const endWall = { width: Lo, height: wallHeight, edges: endWallEdges };

  // La muesca del frente hace juego con la manija de la tapa: juntas dejan un
  // hueco por el que meter el dedo. Se injerta igual que el poste del
  // lateral: los dos primeros puntos de panelOutline son las esquinas del
  // canto superior (acá 'top' es plain, así que no se mezcla con nada más).
  const buildFrontWall = () => {
    const basePoints = panelOutline(endWall, material);
    const rest = basePoints.slice(2);
    return {
      id: 'front', label: 'FRONT', width: Lo, height: wallHeight, edges: endWallEdges,
      points: [
        { x: 0, y: 0 }, { x: handleStart, y: 0 }, { x: handleStart, y: hd },
        { x: handleStart + hw, y: hd }, { x: handleStart + hw, y: 0 }, { x: Lo, y: 0 },
        ...rest,
      ],
    };
  };
```

Y en `specs`, quitar `{ id: 'front', label: 'FRONT', ...endWall },` (ya no se construye por el camino genérico) y en el bloque final, reemplazar:

```js
  const left = buildSideWall('left', 'LEFT', 'left');
  const right = buildSideWall('right', 'RIGHT', 'right');
```

por:

```js
  const front = buildFrontWall();
  const left = buildSideWall('left', 'LEFT', 'left');
  const right = buildSideWall('right', 'RIGHT', 'right');
```

y en la línea de `panels`, cambiar `generic.front` por `front`:

```js
  const panels = [generic.bottom, front, left, lid, generic.back, right];
```

- [ ] **Step 4: Correr los checks**

Expected: `ALL CHECKS PASSED`.

- [ ] **Step 5: Mirar el dibujo y verificar visualmente**

Regenerar el preview (igual que en la Task 3, Step 5) y comprobar: la tapa tiene una lengüeta redondeada sobresaliendo del centro del canto delantero, y la pared frontal tiene una muesca del mismo ancho justo debajo, alineada. Las dos espigas traseras y los dos postes siguen viéndose bien.

- [ ] **Step 6: Commit**

```bash
git add js/boxes/hinged-box.js test.html
git commit -m "$(cat <<'EOF'
Add the finger-pull handle and its matching notch

A rounded tab on the lid's front edge and a matching notch on the
front wall, same width and position, so the two line up into one
opening you can hook a finger into.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Validaciones y avisos

**Files:**
- Modify: `js/boxes/hinged-box.js`
- Modify: `test.html` (dos checks)

**Interfaces:**
- Consumes: `validateBasics`, `validateTabsVsKerf`, `commonWarnings` de `js/boxes/shared.js`.
- Produces: `buildHingedBox` devuelve `errors`/`panels: []` cuando la caja es imposible, `warnings` cuando es posible pero problemática. Misma forma que las otras cajas.

- [ ] **Step 1: Escribir los checks que fallan**

```js
    check('bisagra: errores que bloquean la generación', () => {
      const cases = [
        ['grosor de tapa inválido', { lidThickness: -1 }, 'tapa'],
        ['diámetro de espiga inválido', { pegDiameter: 0 }, 'espiga'],
        ['holgura de agujero negativa', { hingeClearance: -1 }, 'holgura'],
        ['manija sin ancho', { handleWidth: 0 }, 'manija'],
        ['manija más ancha que el frente disponible', { handleWidth: 90 }, 'manija'],
      ];
      for (const [name, override, fragment] of cases) {
        const r = buildHingedBox({ ...HINGED, ...override });
        assert(r.errors.length > 0, `${name}: no produjo error`);
        assert(r.panels.length === 0, `${name}: devolvió piezas pese al error`);
        assert(r.errors.some((e) => e.toLowerCase().includes(fragment)),
          `${name}: esperaba un error con "${fragment}", salió: ${r.errors.join(' | ')}`);
      }
    });

    check('bisagra: avisos que no bloquean', () => {
      const cases = [
        ['holgura muy chica', { hingeClearance: 0.05 }, 'dura'],
        ['holgura muy grande', { hingeClearance: 4 }, 'floja'],
        ['poco material alrededor del agujero', { thickness: 8, pegDiameter: 4, hingeClearance: 0.2 }, 'material'],
      ];
      for (const [name, override, fragment] of cases) {
        const r = buildHingedBox({ ...HINGED, ...override });
        assert(r.errors.length === 0, `${name}: debía generar, pero dio ${r.errors.join(' | ')}`);
        assert(r.warnings.some((w) => w.toLowerCase().includes(fragment)),
          `${name}: esperaba un aviso con "${fragment}", salió: ${r.warnings.join(' | ') || '(ninguno)'}`);
      }
      assert(hinged.warnings.length === 0, `la caja canónica no debería avisar nada: ${hinged.warnings.join(' | ')}`);
    });
```

- [ ] **Step 2: Correr para verlos fallar**

Expected: `FAILED: bisagra: errores que bloquean la generación, bisagra: avisos que no bloquean`.

- [ ] **Step 3: Implementar las validaciones**

En `js/boxes/hinged-box.js`, reemplazar la función `validate` entera por:

```js
function validate({
  Lo, Wo, Ho, t, tl, dp, hc, kerf, tabWidth, spanX, spanY, spanZ, hw, notchWidth,
}) {
  const errors = validateBasics({ t, kerf, tabWidth, Lo, Wo, Ho });
  if (errors.length > 0) return errors;

  const positive = (v) => Number.isFinite(v) && v > 0;
  if (!positive(tl)) errors.push('El grosor de la tapa debe ser mayor que 0.');
  if (!positive(dp)) errors.push('El diámetro de la espiga debe ser mayor que 0.');
  if (!Number.isFinite(hc) || hc < 0) errors.push('La holgura del agujero no puede ser negativa.');
  if (!positive(hw)) errors.push('El ancho de la manija debe ser mayor que 0.');
  if (errors.length > 0) return errors;

  if (kerf >= t) errors.push(KERF_TOO_BIG);
  if (spanX <= 0 || spanY <= 0) {
    errors.push(`El material de ${t} mm es demasiado grueso para una caja de ${Lo} × ${Wo} mm: no queda espacio dentro.`);
  }
  if (spanZ <= 0) {
    errors.push(`Con ${t} mm de material, una caja de ${Ho} mm de alto no deja pared entre la base y la tapa.`);
  }
  if (hw + 2 * notchWidth >= Lo) {
    errors.push(`La manija (${hw} mm) es demasiado ancha para el frente: choca con las espigas de bisagra de las esquinas.`);
  }
  if (errors.length > 0) return errors;

  errors.push(...validateTabsVsKerf(
    [['largo', spanX], ['ancho', spanY], ['alto', spanZ]],
    tabWidth, kerf,
  ));
  return errors;
}
```

Y en la llamada a `validate(...)` dentro de `buildHingedBox`, pasarle también `hw` y `notchWidth`:

```js
  const errors = validate({ Lo, Wo, Ho, t, tl, dp, hc, kerf, tabWidth, spanX, spanY, spanZ, hw, notchWidth });
```

Reemplazar el `warnings: commonWarnings({...}),` del `return` de `buildHingedBox` por:

```js
    warnings: warningsFor({
      jointWidths: [joints.x.width, joints.y.width, joints.z.width],
      t, kerf, tabWidth, hc, rh,
    }),
```

Y añadir, junto a `validate`, la función `warningsFor`:

```js
function warningsFor({ jointWidths, t, kerf, tabWidth, hc, rh }) {
  const warnings = commonWarnings({ jointWidths, t, kerf, tabWidth });
  if (hc < 0.1) {
    warnings.push(`Holgura del agujero de ${hc} mm: la bisagra va a quedar dura, puede no girar.`);
  }
  if (hc > 2) {
    warnings.push(`Holgura del agujero de ${hc} mm: la bisagra va a quedar floja, con bamboleo notorio.`);
  }
  if (t >= 6 && rh < t) {
    warnings.push(`Con ${t} mm de material, poco material puede quedar alrededor del agujero: revisa el diámetro de espiga.`);
  }
  return warnings;
}
```

- [ ] **Step 4: Correr los checks**

Expected: `ALL CHECKS PASSED`.

- [ ] **Step 5: Commit**

```bash
git add js/boxes/hinged-box.js test.html
git commit -m "$(cat <<'EOF'
Validate hinged boxes and warn about bad hinge fits

Errors for impossible boxes: bad lid thickness, non-positive peg
diameter, negative clearance, a handle too wide for the front.
Warnings for hinges that will cut but bind or wobble.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Interfaz

Conectar el generador al formulario: la opción nueva y sus cinco campos.

**Files:**
- Modify: `index.html`
- Modify: `js/ui/app.js`
- Modify: `css/styles.css`

**Interfaces:**
- Consumes: `buildHingedBox`, `autoTabWidth` de `hinged-box.js`; lo ya existente de `simple-box.js` y `sliding-box.js`.
- Produces: elementos nuevos en el DOM con estos `id` exactos — `lid-hinged`, `hingedFields`, `pegDiameter`, `pegDiameterAuto`, `hingeClearance`, `handleWidth`, `handleDepth`.

- [ ] **Step 1: Añadir la opción y los campos al formulario**

En `index.html`, dentro del `div.field.field-radio-group` de Tapa, después del bloque `radio-option` de `lid-sliding`, añadir:

```html
            <div class="radio-option">
              <input type="radio" id="lid-hinged" name="lidType" value="hinged">
              <label for="lid-hinged">Con bisagra</label>
            </div>
```

Reemplazar el `<p class="help">` de ese bloque, añadiendo una frase:

```html
            <p class="help">
              "Con espigas": la tapa encaja dentro como el resto de las piezas.
              "Plana": un rectángulo liso que se apoya encima de las paredes, que se
              acortan un grosor para que el alto total siga siendo el que pediste.
              "Deslizante": la tapa corre dentro de un canal vaciado en laterales y
              fondo, y entra por el frente, que queda más bajo.
              "Con bisagra": la tapa queda unida por una bisagra del mismo material,
              gira sobre el canto trasero y pega contra el fondo al abrir del todo.
            </p>
```

Después de cerrar el `div#slidingFields`, añadir el bloque de campos nuevo:

```html
          <div class="field hinged-fields" id="hingedFields" hidden>
            <div class="field">
              <label for="pegDiameter">Diámetro de la espiga <span class="unit">mm</span></label>
              <input type="number" id="pegDiameter" name="pegDiameter" value="12" step="0.5" min="0.1" inputmode="decimal">
              <div class="field-checkbox">
                <input type="checkbox" id="pegDiameterAuto" name="pegDiameterAuto" checked>
                <label for="pegDiameterAuto">Automático (4× el grosor)</label>
              </div>
            </div>

            <div class="field">
              <label for="hingeClearance">Holgura del agujero <span class="unit">mm</span></label>
              <input type="number" id="hingeClearance" name="hingeClearance" value="1" step="0.1" min="0" inputmode="decimal">
              <p class="help">
                Diámetro de más sobre la espiga, para que gire sin trabarse.
                Calíbrala con una prueba antes de cortar la caja: dura si es poca,
                bamboleante si es mucha.
              </p>
            </div>

            <div class="field">
              <label for="handleWidth">Ancho de la manija <span class="unit">mm</span></label>
              <input type="number" id="handleWidth" name="handleWidth" value="20" step="1" min="1" inputmode="decimal">
            </div>

            <div class="field">
              <label for="handleDepth">Profundidad de la manija <span class="unit">mm</span></label>
              <input type="number" id="handleDepth" name="handleDepth" value="6" step="0.5" min="1" inputmode="decimal">
            </div>
          </div>
```

- [ ] **Step 2: Estilo mínimo**

En `css/styles.css`, al final, añadir:

```css
.hinged-fields {
  border-left: 2px solid var(--accent);
  padding-left: 12px;
}
```

- [ ] **Step 3: Conectar el generador**

En `js/ui/app.js`, añadir el import:

```js
import { buildHingedBox, autoTabWidth as hingedTabWidth } from '../boxes/hinged-box.js';
```

Añadir, junto a los otros elementos:

```js
const hingedFields = document.getElementById('hingedFields');
const pegDiameterEl = document.getElementById('pegDiameter');
const pegDiameterAutoEl = document.getElementById('pegDiameterAuto');
const hingeClearanceEl = document.getElementById('hingeClearance');
const handleWidthEl = document.getElementById('handleWidth');
const handleDepthEl = document.getElementById('handleDepth');
```

Añadir `hinged` a `BUILDERS`:

```js
const BUILDERS = {
  sliding: { build: buildSlidingBox, autoTab: slidingTabWidth },
  hinged: { build: buildHingedBox, autoTab: hingedTabWidth },
  default: { build: buildBox, autoTab: simpleTabWidth },
};
```

En `readParams`, después del bloque `slidingFields.hidden = !sliding;` ... `if (sliding) { ... }`, añadir:

```js
  const hinged = lidType === 'hinged';
  hingedFields.hidden = !hinged;

  if (hinged) {
    pegDiameterEl.disabled = pegDiameterAutoEl.checked;
    if (pegDiameterAutoEl.checked) pegDiameterEl.value = round(4 * params.thickness, 1);
    params.pegDiameter = parseFloat(pegDiameterEl.value);
    params.hingeClearance = number('hingeClearance');
    params.handleWidth = number('handleWidth');
    params.handleDepth = number('handleDepth');
  }
```

En el handler de `downloadBtn`, actualizar el mapa de sufijos:

```js
  const SUFFIXES = { flat: '-tapaplana', sliding: '-deslizante', hinged: '-bisagra' };
```

- [ ] **Step 4: Probar la interfaz en el navegador**

Navegar a `http://localhost:8000/` y comprobar:

1. `read_console_messages` → sin errores.
2. Elegir "Con bisagra" y poner el caso canónico (80/80/80, grosor 3, kerf 0.16).
3. `document.getElementById('hingedFields').hidden` → `false`.
4. `document.getElementById('summary').textContent` contiene `Exterior 80 × 80 × 80 mm` (sin paréntesis de alto real: acá la caja sí mide exactamente lo pedido, sin reborde).
5. Screenshot del preview: seis piezas, la tapa con dos bultos redondeados atrás y una lengüeta adelante, los laterales con un poste con un círculo negro adentro, el frente con una muesca alineada con la lengüeta de la tapa.
6. Volver a "Con espigas" y confirmar que `#hingedFields` se oculta.

- [ ] **Step 5: Correr los self-checks otra vez**

Expected: `ALL CHECKS PASSED`.

- [ ] **Step 6: Commit**

```bash
git add index.html js/ui/app.js css/styles.css
git commit -m "$(cat <<'EOF'
Wire the hinged lid into the form

Fourth lid option with its four fields, shown only when selected.
Suffix -bisagra on download, same pattern as the other lid types.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Verificación de punta a punta, documentación y entrega

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: la aplicación completa.
- Produces: nada de código.

- [ ] **Step 1: Verificar el SVG exportado**

Con la app abierta en el caso canónico con "Con bisagra", en `javascript_tool`:

```js
const svg = document.querySelector('#preview svg');
({
  cut: svg.querySelectorAll('#cut path').length,
  engrave: svg.querySelector('#engrave'),
  hasHoles: [...svg.querySelectorAll('#left-hinge-hole, #right-hinge-hole')].length,
});
```

Expected: `cut` = 8 (6 contornos de pieza + 2 agujeros de bisagra, todos en corte porque el agujero es pasante), `engrave` = `null` (esta tapa no usa grabado), `hasHoles` = 2.

- [ ] **Step 2: Probar los cuatro tipos de tapa seguidos**

En la interfaz, pasar por "Con espigas" → "Plana" → "Deslizante" → "Con bisagra" → "Con espigas", leyendo la consola después de cada cambio.
Expected: sin errores, siempre 6 piezas.

- [ ] **Step 3: Actualizar el README**

En `README.md`, sección **Los parámetros**, reemplazar la fila de Tapa por:

```markdown
| Tapa: Con espigas / Plana / Deslizante / Con bisagra | Con espigas | "Con espigas": la tapa encaja dentro como el resto de las piezas. "Plana": un rectángulo liso que se apoya sobre el canto de las paredes; el alto total y el espacio interior no cambian. "Deslizante": la tapa corre dentro de un canal vaciado en laterales y fondo. "Con bisagra": la tapa queda unida por una bisagra hecha del mismo material — dos espigas en el canto trasero encajan en un agujero en cada lateral — y gira sobre el canto trasero hasta pegar contra el fondo. Las cuatro paredes miden lo mismo que con la tapa plana, salvo un poste que sobresale en la esquina trasera de cada lateral para dejarle material alrededor al agujero. |
| Diámetro de la espiga (mm) | 4× el grosor | Solo con tapa con bisagra. El disco que hace de eje de la bisagra. Con "Automático" marcada sigue al grosor del material. |
| Holgura del agujero (mm) | 1 | Solo con tapa con bisagra. Cuánto más grande se dibuja el agujero que la espiga, para que gire sin trabarse. Se calibra con una prueba antes de cortar la caja: dura si es poca, bamboleante si es mucha. |
| Ancho de la manija (mm) | 20 | Solo con tapa con bisagra. Ancho de la lengüeta que sobresale del canto delantero de la tapa y de la muesca a juego en la pared frontal. |
| Profundidad de la manija (mm) | 6 | Solo con tapa con bisagra. Cuánto sobresale la lengüeta más allá del perímetro de la caja. |
```

En la sección **Cómo está hecho**, reemplazar la línea de `js/boxes/`:

```markdown
- `js/boxes/` — los tipos de caja concretos: `simple-box.js` (caja cerrada y tapa plana), `sliding-box.js` (tapa deslizante), `hinged-box.js` (tapa con bisagra) y `shared.js` con lo que todos comparten.
```

En **Qué falta (v2)**, borrar `- Caja con tapa con bisagra de pin.` y añadir al final:

```markdown
- Tope de apertura diseñado a un ángulo específico en la tapa con bisagra.
- Bisagra con varilla separada (dowel o metal) en vez de espiga integral.
```

En **Verificación**, actualizar el número de checks al que muestre `test.html` en ese momento.

- [ ] **Step 4: Correr los self-checks una última vez**

Expected: `ALL CHECKS PASSED`, incluido el check de regresión de la caja cerrada.

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "$(cat <<'EOF'
Document the hinged lid

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 6: Entregar a Dani**

No hacer `git push`. Decirle:

- Qué quedó en la rama `tapa-bisagra` y cuántos commits son.
- Que el siguiente paso es físico: cortar un cupón de calibración (una espiga y un agujero de prueba en un retazo chico) para ajustar el diámetro de espiga y la holgura antes de cortar una caja completa; después una caja chica (~60 × 60 × 40 en 3 mm).
- Que cuando tenga los números buenos, los anotemos como se anotó el kerf 0.16 y la holgura de la deslizante 0.2.

---

## Pendientes conocidos, fuera de este plan

- **Tope de apertura a un ángulo específico.** Hoy la tapa gira libre hasta pegar contra el fondo.
- **Bisagra con varilla separada.** Se descartó a propósito: todo del mismo material.
- **Bisagra tipo piano.** Sólo dos espigas, una por esquina.
- **Generar el cupón de calibración desde la app.**
- **Bisagra entrando por un lateral en vez del fondo.**
