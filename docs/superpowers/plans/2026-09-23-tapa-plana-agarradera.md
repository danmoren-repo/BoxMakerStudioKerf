# Tapa plana con agarradera — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar una casilla opcional "Agarradera" a la tapa "Plana" de BoxMaker que, al activarse, agrega una perilla armada de dos piezas (domo + vástago, encastradas a 90°) que atraviesa dos agujeros en cruz — uno en la tapa exterior (TOP), otro en un inserto nuevo (TOP-INSERT) pegado por debajo.

**Architecture:** Toda la geometría nueva (agujero en cruz, las dos piezas de la perilla, sus fórmulas de validación) vive en un módulo nuevo y enfocado, `js/boxes/lid-grip.js`, que `js/boxes/simple-box.js` importa y usa solo cuando `lidType === 'flat'` y `params.grip === true`. Cada bulto/muesca se construye como una lista de puntos explícita (arcos tesselados igual que `handleCapPoints` en `hinged-box.js`), nunca como un agujero tallado en el mismo contorno — el agujero en cruz usa el mismo patrón de lazo cerrado independiente que ya usa `holeFeature` en `js/core/panel.js`.

**Tech Stack:** JS plano, ES modules nativos, sin build step. Pruebas en `test.html` (self-checks en el navegador, sin framework de testing).

**Spec:** `docs/superpowers/specs/2026-09-23-tapa-plana-agarradera-design.md`

## Global Constraints

- `EDGE_MARGIN = 2` (ya definido y exportado en `js/boxes/hinged-box.js`) — se reutiliza, no se duplica.
- El vástago y el agujero en cruz tienen SIEMPRE grosor de brazo `t` (el grosor del material) — no es un parámetro configurable.
- Sin holgura de kerf en el agujero en cruz ni en el vástago/ranura de la perilla — dimensiones nominales, igual que el archivo de referencia (decisión del spec).
- El inserto (`TOP-INSERT`) mide exactamente `spanX × spanY` — sin holgura extra (decisión del spec).
- Sin esquinas redondeadas en `TOP` ni en `TOP-INSERT` (decisión del spec).
- No debe cambiar el comportamiento de `lidType` `finger`, `sliding`, `hinged` ni `hingedDouble`, ni el de `flat` cuando `params.grip` no es `true`.
- Todo mensaje de error/aviso nuevo debe coincidir con las tablas de "Validaciones" del spec.

---

## Contexto de archivos existentes (leer antes de empezar)

- `js/core/panel.js` — `holeFeature({id, cx, cy, diameter, kerf, layer, segments})` devuelve `{id, layer, kind:'hole', points}`: un círculo tesselado como lazo cerrado independiente (no mezclado con el contorno del panel). `panelOutline(spec, material)` construye el contorno de un panel a partir de sus 4 aristas (`top/right/bottom/left`, cada una con `gender: 'plain'|'male'|'female'`).
- `js/render/svg-render.js` (líneas ~50-57) — cada `feature` de un panel (`panel.features`) se dibuja como un `<path>` separado, con `kind`/`layer` genéricos: no asume que sea un círculo, cualquier lista de puntos cerrada sirve.
- `js/boxes/hinged-box.js` — trae `EDGE_MARGIN` (exportado), y el patrón de arco tesselado ya probado:
  ```js
  const handleCapPoints = (x, width, tipY, radius, steps = 6) => {
    const arc = (cx, cy, fromDeg, toDeg) => {
      const pts = [];
      for (let i = 0; i <= steps; i++) {
        const a = ((fromDeg + (toDeg - fromDeg) * (i / steps)) * Math.PI) / 180;
        pts.push({ x: cx + radius * Math.cos(a), y: cy + radius * Math.sin(a) });
      }
      return pts;
    };
    return [...]; // arco de 180 a 360, partido en dos con una punta plana
  };
  ```
  Convención de ángulos: centro `(cx,cy)`, ángulo 180°→`(cx-radius,cy)`, 270°→`(cx,cy-radius)` (el punto MÁS ARRIBA, porque `y` crece hacia abajo), 360°→`(cx+radius,cy)`. Un barrido de 180°→360° traza un semicírculo que abulta hacia ARRIBA (y negativa) sobre una base horizontal — exactamente lo que hace falta para el domo de la perilla.
- `js/boxes/simple-box.js` — el `buildBox()` actual (sin tocar todavía): calcula `flatLid = lidType==='flat'`, arma `specs` (bottom/front/left/top/back/right) y hace `panels = specs.map((spec) => ({...spec, points: panelOutline(spec, material)}))`. El `top` usa `flatPanel` (rectángulo `Lo×Wo`, las 4 aristas `plain`) cuando `flatLid` es true.
- `js/boxes/shared.js` — `outerDimensions`, `jointSegments`, `autoTabWidthFromSpans`, `KERF_TOO_BIG`, `validateBasics`, `validateTabsVsKerf`, `commonWarnings`. No se toca.

---

### Task 1: `lid-grip.js` — parámetros, geometría derivada, y el agujero en cruz

**Files:**
- Create: `js/boxes/lid-grip.js`
- Test: `test.html` (agregar checks en una sección nueva)

**Interfaces:**
- Consumes: `EDGE_MARGIN` desde `js/boxes/hinged-box.js`.
- Produces:
  - `gripDiameterFor({ gripDiameter }) → number`
  - `gripStemSpanFor({ gripStemSpan }) → number`
  - `gripGeometry({ t, gd, gs }) → { t, gd, gs, R, D, H, splitY, archCrossY }`
  - `crossHoleFeature({ id, cx, cy, span, thickness, layer }) → { id, layer, kind:'hole', points }`

- [ ] **Step 1: Escribir `js/boxes/lid-grip.js` con la resolución de parámetros y la geometría derivada**

```js
import { EDGE_MARGIN } from './hinged-box.js';

// Sin fórmula automática: es un tamaño de agarre a criterio, no se deriva
// del grosor del material (igual que `handleWidthFor` en hinged-box.js,
// que tampoco sigue una fórmula).
export function gripDiameterFor({ gripDiameter }) {
  return Number.isFinite(gripDiameter) ? gripDiameter : 30;
}

export function gripStemSpanFor({ gripStemSpan }) {
  return Number.isFinite(gripStemSpan) ? gripStemSpan : 16;
}

// R = radio del domo. D = profundidad del vástago (un grosor de material
// por cada una de las dos capas que atraviesa: TOP y TOP-INSERT). H = alto
// total de cada mitad de la perilla, de la punta del domo al fondo del
// vástago. splitY = plano de unión entre las dos mitades, medido desde la
// línea base (y=0): negativo = hacia la punta del domo, positivo = hacia
// el fondo del vástago. Con R > D (el caso normal) ese plano cae DENTRO
// del domo, no del vástago — por eso hace falta archCrossY: dónde la pared
// de la ranura (x = ±t/2) cruza la curva del domo (radio R, centro en la
// línea base), para poder abrir la ranura de una de las dos piezas a
// través de esa curva en vez de un canto recto. Fórmula: el domo es
// x² + y² = R² (y ≤ 0); en x = t/2, y = −√(R² − (t/2)²).
export function gripGeometry({ t, gd, gs }) {
  const R = gd / 2;
  const D = 2 * t;
  const H = R + D;
  const splitY = (D - R) / 2;
  const archCrossY = -Math.sqrt(R * R - (t / 2) * (t / 2));
  return {
    t, gd, gs, R, D, H, splitY, archCrossY,
  };
}

// Agujero en forma de "+" (cruz simétrica), como lazo cerrado independiente
// — mismo patrón que holeFeature en core/panel.js (un `kind: 'hole'` que se
// dibuja aparte, nunca tallado en el mismo contorno del panel). `span` es
// el ancho total de brazo a brazo opuesto (igual en las dos direcciones);
// `thickness` es el ancho de cada brazo (siempre el grosor del material).
// Sin compensación de kerf — dimensiones nominales, igual que el archivo
// de referencia (decisión del spec: "sin holgura calibrable nueva").
export function crossHoleFeature({
  id, cx, cy, span, thickness, layer = 'cut',
}) {
  const s = span / 2;
  const a = thickness / 2;
  const points = [
    { x: cx - s, y: cy - a },
    { x: cx - a, y: cy - a },
    { x: cx - a, y: cy - s },
    { x: cx + a, y: cy - s },
    { x: cx + a, y: cy - a },
    { x: cx + s, y: cy - a },
    { x: cx + s, y: cy + a },
    { x: cx + a, y: cy + a },
    { x: cx + a, y: cy + s },
    { x: cx - a, y: cy + s },
    { x: cx - a, y: cy + a },
    { x: cx - s, y: cy + a },
  ];
  return { id, layer, kind: 'hole', points };
}

export { EDGE_MARGIN };
```

- [ ] **Step 2: Agregar los checks en `test.html`**

**Importante:** en esta rama (creada desde `main`), `test.html` todavía
NO tiene el helper `assertSimplePolygon` — se agregó en otra rama
(`tapa-bisagra-doble`) que todavía no se mergeó a `main`. Hay que
definirlo acá también (mismo código ya probado ahí, verificado en su
momento con 0 falsos positivos sobre las piezas de la bisagra doble): si
para cuando se implementa este plan `tapa-bisagra-doble` ya se mergeó y
`assertSimplePolygon` ya existe en `test.html`, NO duplicar la función —
usar la que ya está.

Justo antes del bloque final que arma `results`/`summary` (buscar
`const failed = results.filter`), agregar el import y una sección nueva:

```js
import {
  gripDiameterFor, gripStemSpanFor, gripGeometry, crossHoleFeature,
} from './js/boxes/lid-grip.js';
```

(agregar junto a los demás `import` al principio del `<script type="module">`).

```js
// --- Tapa plana con agarradera: geometría base ---

// Verifica que un contorno sea un polígono simple: sin cruces
// transversales, sin aristas colineares que se solapen más allá de un
// punto, y sin aristas que rocen un vértice ajeno a mitad de camino.
// (Si `assertSimplePolygon` ya existe en este archivo por otra rama
// mergeada, borrar esta definición y usar la que ya está.)
function assertSimplePolygon(points, label) {
  const n = points.length;
  const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const collinear = (o, a, b) => Math.abs(cross(o, a, b)) < 1e-6;
  const segInt = (p1, p2, p3, p4) => {
    const d1 = cross(p3, p4, p1); const d2 = cross(p3, p4, p2);
    const d3 = cross(p1, p2, p3); const d4 = cross(p1, p2, p4);
    return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
  };
  const onSegment = (p, a, b) => {
    if (Math.abs(cross(a, b, p)) > 1e-6) return false;
    return p.x >= Math.min(a.x, b.x) - 1e-7 && p.x <= Math.max(a.x, b.x) + 1e-7
      && p.y >= Math.min(a.y, b.y) - 1e-7 && p.y <= Math.max(a.y, b.y) + 1e-7;
  };
  for (let i = 0; i < n; i++) {
    const a1 = points[i]; const a2 = points[(i + 1) % n];
    for (let j = 0; j < n; j++) {
      const adjacent = j === (i + 1) % n || i === (j + 1) % n;
      if (adjacent || i === j) continue;
      const b1 = points[j]; const b2 = points[(j + 1) % n];
      if (j > i) {
        assert(!segInt(a1, a2, b1, b2), `${label}: cruce transversal entre las aristas ${i} y ${j}`);
        if (collinear(a1, a2, b1) && collinear(a1, a2, b2)) {
          const ox = Math.max(0, Math.min(Math.max(a1.x, a2.x), Math.max(b1.x, b2.x)) - Math.max(Math.min(a1.x, a2.x), Math.min(b1.x, b2.x)));
          const oy = Math.max(0, Math.min(Math.max(a1.y, a2.y), Math.max(b1.y, b2.y)) - Math.max(Math.min(a1.y, a2.y), Math.min(b1.y, b2.y)));
          assert(ox <= 1e-6 && oy <= 1e-6, `${label}: solape colinear entre las aristas ${i} y ${j}`);
        }
      }
      if (j !== i && j !== (i + 1) % n) {
        const v = points[j];
        if (onSegment(v, a1, a2)) {
          const atEnd = Math.hypot(v.x - a1.x, v.y - a1.y) < 1e-7 || Math.hypot(v.x - a2.x, v.y - a2.y) < 1e-7;
          assert(atEnd, `${label}: la arista ${i} roza el vértice ${j} a mitad de camino`);
        }
      }
    }
  }
}

function insidePolygonGrip(pt, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const xi = points[i].x; const yi = points[i].y; const xj = points[j].x; const yj = points[j].y;
    if ((yi > pt.y) !== (yj > pt.y) && pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

check('agarradera: gripDiameterFor/gripStemSpanFor tienen los defaults del spec', () => {
  assert(near(gripDiameterFor({}), 30), 'default de diámetro debería ser 30');
  assert(near(gripStemSpanFor({}), 16), 'default de ancho de agujero debería ser 16');
  assert(near(gripDiameterFor({ gripDiameter: 40 }), 40), 'debería respetar el valor explícito');
  assert(near(gripStemSpanFor({ gripStemSpan: 12 }), 12), 'debería respetar el valor explícito');
});

check('agarradera: gripGeometry reproduce el ejemplo de referencia del spec (t=3, gd=30, gs=16)', () => {
  const geo = gripGeometry({ t: 3, gd: 30, gs: 16 });
  assert(near(geo.R, 15), `R=${geo.R}, esperaba 15`);
  assert(near(geo.D, 6), `D=${geo.D}, esperaba 6`);
  assert(near(geo.H, 21), `H=${geo.H}, esperaba 21`);
  assert(near(geo.splitY, -4.5), `splitY=${geo.splitY}, esperaba -4.5`);
  assert(near(geo.archCrossY, -14.9248, 0.001), `archCrossY=${geo.archCrossY}, esperaba ≈-14.9248`);
});

check('agarradera: crossHoleFeature arma una cruz simétrica de 12 puntos, simple, con el bbox esperado', () => {
  const hole = crossHoleFeature({
    id: 'test-hole', cx: 50, cy: 40, span: 16, thickness: 3,
  });
  assert(hole.kind === 'hole', 'kind debería ser hole');
  assert(hole.points.length === 12, `${hole.points.length} puntos, esperaba 12`);
  const bb = boundingBox(hole.points);
  assert(near(bb.minX, 42) && near(bb.maxX, 58), `bbox X [${bb.minX},${bb.maxX}], esperaba [42,58]`);
  assert(near(bb.minY, 32) && near(bb.maxY, 48), `bbox Y [${bb.minY},${bb.maxY}], esperaba [32,48]`);
  assertSimplePolygon(hole.points, 'crossHoleFeature');
  assert(insidePolygonGrip({ x: 50, y: 32.5 }, hole.points), 'el brazo de arriba debería ser material (dentro del polígono de la cruz)');
  assert(!insidePolygonGrip({ x: 44, y: 34 }, hole.points), 'la esquina fuera de los brazos debería ser vacío');
});
```

`boundingBox` ya existe en `test.html` (viene de `js/core/geometry.js`,
ya importada) — `assertSimplePolygon` es la que se acaba de definir en
este mismo Step.

- [ ] **Step 3: Levantar el servidor y correr los checks**

```bash
node dev-server.mjs
```

Abrir `http://localhost:8000/test.html` (con `agent-browser` o el
navegador) y confirmar que el resumen dice `✅ N/N checks OK`, con los 3
checks nuevos en verde.

- [ ] **Step 4: Commit**

```bash
git add js/boxes/lid-grip.js test.html
git commit -m "Add grip parameter resolution, geometry, and cross-hole feature"
```

---

### Task 2: `lid-grip.js` — TOP-INSERT y el agujero de TOP

**Files:**
- Modify: `js/boxes/lid-grip.js`
- Test: `test.html`

**Interfaces:**
- Consumes: `crossHoleFeature` (Task 1).
- Produces:
  - `buildTopHole({ Lo, Wo, gs, t }) → feature` (mismo shape que `crossHoleFeature`)
  - `buildInsertPanel({ spanX, spanY, gs, t, material }) → panel` con `{id:'top-insert', label:'TOP-INSERT', width, height, edges, points, features}`

- [ ] **Step 1: Agregar a `js/boxes/lid-grip.js`**

```js
import { panelOutline } from '../core/panel.js';
```

(agregar a los imports del principio del archivo, junto al `import { EDGE_MARGIN } from './hinged-box.js';`)

```js
// El agujero de TOP queda centrado en el panel completo (Lo × Wo).
export function buildTopHole({
  Lo, Wo, gs, t,
}) {
  return crossHoleFeature({
    id: 'grip-hole', cx: Lo / 2, cy: Wo / 2, span: gs, thickness: t,
  });
}

// TOP-INSERT: rectángulo liso del tamaño exacto del hueco interno
// (spanX × spanY, sin holgura — decisión del spec), con su propio agujero
// en cruz centrado en el panel, mismas medidas que el de TOP (así quedan
// alineados una vez pegado por debajo, centrado).
export function buildInsertPanel({
  spanX, spanY, gs, t, material,
}) {
  const edges = {
    top: { gender: 'plain' },
    bottom: { gender: 'plain' },
    left: { gender: 'plain' },
    right: { gender: 'plain' },
  };
  const spec = { width: spanX, height: spanY, edges };
  const hole = crossHoleFeature({
    id: 'grip-hole', cx: spanX / 2, cy: spanY / 2, span: gs, thickness: t,
  });
  return {
    id: 'top-insert',
    label: 'TOP-INSERT',
    width: spanX,
    height: spanY,
    edges,
    points: panelOutline(spec, material),
    features: [hole],
  };
}
```

- [ ] **Step 2: Agregar los checks en `test.html`**

```js
import {
  gripDiameterFor, gripStemSpanFor, gripGeometry, crossHoleFeature,
  buildTopHole, buildInsertPanel,
} from './js/boxes/lid-grip.js';
```

(reemplazar el import agregado en la Task 1 por esta lista extendida)

```js
check('agarradera: buildTopHole queda centrado en Lo × Wo', () => {
  const hole = buildTopHole({
    Lo: 200, Wo: 150, gs: 16, t: 3,
  });
  const bb = boundingBox(hole.points);
  const cx = (bb.minX + bb.maxX) / 2;
  const cy = (bb.minY + bb.maxY) / 2;
  assert(near(cx, 100), `centro X ${cx}, esperaba 100 (Lo/2)`);
  assert(near(cy, 75), `centro Y ${cy}, esperaba 75 (Wo/2)`);
});

check('agarradera: buildInsertPanel mide spanX × spanY exacto, con su propio agujero centrado', () => {
  const material = { thickness: 3, kerf: 0.16, tabWidth: 12 };
  const insert = buildInsertPanel({
    spanX: 74, spanY: 74, gs: 16, t: 3, material,
  });
  assert(insert.id === 'top-insert', 'id debería ser top-insert');
  const bb = boundingBox(insert.points);
  assert(near(bb.minX, 0) && near(bb.maxX, 74), `bbox X [${bb.minX},${bb.maxX}], esperaba [0,74]`);
  assert(near(bb.minY, 0) && near(bb.maxY, 74), `bbox Y [${bb.minY},${bb.maxY}], esperaba [0,74]`);
  assertSimplePolygon(insert.points, 'top-insert');
  assert(insert.features.length === 1, 'debería tener exactamente un agujero');
  const holeBb = boundingBox(insert.features[0].points);
  const cx = (holeBb.minX + holeBb.maxX) / 2;
  const cy = (holeBb.minY + holeBb.maxY) / 2;
  assert(near(cx, 37) && near(cy, 37), `agujero centrado en (${cx},${cy}), esperaba (37,37)`);
});
```

- [ ] **Step 3: Correr los checks en el navegador**

Confirmar `✅ N/N checks OK` con los 2 checks nuevos en verde.

- [ ] **Step 4: Commit**

```bash
git add js/boxes/lid-grip.js test.html
git commit -m "Add TOP hole and TOP-INSERT panel builders"
```

---

### Task 3: `lid-grip.js` — HANDLE-A y HANDLE-B (la perilla)

Esta es la parte geométricamente más delicada: dos piezas en domo, cada
una con una ranura de encastre distinta (una recta sobre el vástago, la
otra abierta a través de la curva del domo), que tienen que terminar en
el MISMO plano (`splitY`) para quedar al ras al armarlas.

**Files:**
- Modify: `js/boxes/lid-grip.js`
- Test: `test.html`

**Interfaces:**
- Consumes: `gripGeometry` (Task 1), la constante `EDGE_MARGIN`.
- Produces: `buildHandlePanels({ R, gs, t, D, splitY, archCrossY }) → { handleA, handleB }`, cada una `{id, label, width, height, edges, points}`.

- [ ] **Step 1: Agregar a `js/boxes/lid-grip.js`**

```js
const ARC_STEPS = 32;

// Mismo patrón que el arco tesselado de handleCapPoints en hinged-box.js:
// centro (cx,cy), ángulo 180°→(cx-radius,cy), 270°→(cx,cy-radius) (el
// punto más arriba, y crece hacia abajo), 360°→(cx+radius,cy). Un barrido
// de 180 a 360 traza un semicírculo que abulta hacia arriba sobre una
// base horizontal en y=cy.
function arc(cx, cy, radius, fromDeg, toDeg, steps = ARC_STEPS) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const a = ((fromDeg + (toDeg - fromDeg) * (i / steps)) * Math.PI) / 180;
    pts.push({ x: cx + radius * Math.cos(a), y: cy + radius * Math.sin(a) });
  }
  return pts;
}

// HANDLE-A: domo intacto (sin tocar la curva), con la ranura de encastre
// abierta en el canto recto de ABAJO (el fondo del vástago), subiendo
// hasta el plano de unión splitY. Sólo líneas rectas, ningún cálculo de
// arco hace falta para la ranura misma — el domo se centra en (0,0), así
// que el primer punto del arco (180°) ya es (-R,0): no hace falta repetir
// ese punto a mano antes de empezar el arco.
function buildHandleBottomSlotted({
  R, gs, t, D, splitY,
}) {
  return [
    ...arc(0, 0, R, 180, 360),
    { x: gs / 2, y: 0 },
    { x: gs / 2, y: D },
    { x: t / 2, y: D },
    { x: t / 2, y: splitY },
    { x: -t / 2, y: splitY },
    { x: -t / 2, y: D },
    { x: -gs / 2, y: D },
    { x: -gs / 2, y: 0 },
  ];
}

// HANDLE-B: la ranura se abre en la PUNTA del domo (la curva), no en el
// vástago (que acá queda macizo). deltaDeg es el ángulo, medido desde el
// ápice (270°), donde la pared de la ranura (x = ±t/2) cruza la curva:
// sale de resolver R·cos(270°−δ) = −t/2 con la misma convención de arc()
// de arriba, dando sin δ = t/(2R). El arco de 180° a 270−δ TERMINA
// exactamente en (−t/2, archCrossY) — y el de 270+δ a 360 EMPIEZA
// exactamente en (t/2, archCrossY) — por eso esos dos puntos no se repiten
// a mano entre el arco y la ranura, sólo el fondo de la ranura (splitY) sí
// hace falta escribirlo explícito.
function buildHandleApexSlotted({
  R, gs, t, D, splitY, archCrossY,
}) {
  const deltaDeg = (Math.asin(t / (2 * R)) * 180) / Math.PI;
  return [
    ...arc(0, 0, R, 180, 270 - deltaDeg),
    { x: -t / 2, y: splitY },
    { x: t / 2, y: splitY },
    ...arc(0, 0, R, 270 + deltaDeg, 360),
    { x: gs / 2, y: 0 },
    { x: gs / 2, y: D },
    { x: -gs / 2, y: D },
    { x: -gs / 2, y: 0 },
  ];
}

export function buildHandlePanels({
  R, gs, t, D, splitY, archCrossY,
}) {
  const edges = {
    top: { gender: 'plain' },
    bottom: { gender: 'plain' },
    left: { gender: 'plain' },
    right: { gender: 'plain' },
  };
  const bboxWidth = 2 * R;
  const bboxHeight = R + D;
  const handleA = {
    id: 'handle-a',
    label: 'HANDLE-A',
    width: bboxWidth,
    height: bboxHeight,
    edges,
    points: buildHandleBottomSlotted({
      R, gs, t, D, splitY,
    }),
  };
  const handleB = {
    id: 'handle-b',
    label: 'HANDLE-B',
    width: bboxWidth,
    height: bboxHeight,
    edges,
    points: buildHandleApexSlotted({
      R, gs, t, D, splitY, archCrossY,
    }),
  };
  return { handleA, handleB };
}
```

- [ ] **Step 2: Agregar los checks en `test.html`**

```js
import {
  gripDiameterFor, gripStemSpanFor, gripGeometry, crossHoleFeature,
  buildTopHole, buildInsertPanel, buildHandlePanels,
} from './js/boxes/lid-grip.js';
```

(reemplazar el import de la Task 2 por esta lista extendida)

```js
const GRIP_GEO = gripGeometry({ t: 3, gd: 30, gs: 16 });
const { handleA: GRIP_A, handleB: GRIP_B } = buildHandlePanels(GRIP_GEO);

check('agarradera: HANDLE-A y HANDLE-B son polígonos simples (sin cruces, solapes, ni aristas que rocen un vértice ajeno)', () => {
  assertSimplePolygon(GRIP_A.points, 'handle-a');
  assertSimplePolygon(GRIP_B.points, 'handle-b');
});

check('agarradera: HANDLE-A y HANDLE-B miden lo mismo por fuera (2R de ancho, R+D de alto)', () => {
  const bbA = boundingBox(GRIP_A.points);
  const bbB = boundingBox(GRIP_B.points);
  const expectedWidth = 2 * GRIP_GEO.R;
  const expectedHeight = GRIP_GEO.R + GRIP_GEO.D;
  assert(near(bbA.width, expectedWidth, 0.01), `handle-a ancho ${bbA.width}, esperaba ${expectedWidth}`);
  assert(near(bbB.width, expectedWidth, 0.01), `handle-b ancho ${bbB.width}, esperaba ${expectedWidth}`);
  assert(near(bbA.height, expectedHeight, 0.01), `handle-a alto ${bbA.height}, esperaba ${expectedHeight}`);
  // El bbox de handle-b puede quedar levemente más bajo que R+D exacto: su
  // curva no llega literalmente hasta la punta matemática (270°), se corta
  // un poco antes en 270°-δ/270°+δ para abrir la ranura — así que su alto
  // real es una fracción de mm menor a R+D, nunca mayor.
  assert(bbB.height <= expectedHeight + 0.01, `handle-b alto ${bbB.height} no debería superar ${expectedHeight}`);
  assert(bbB.height > expectedHeight - 0.1, `handle-b alto ${bbB.height} se aleja demasiado de ${expectedHeight}`);
});

check('agarradera: la ranura de HANDLE-A mide t de ancho y llega hasta splitY', () => {
  const notchPts = GRIP_A.points.filter((p) => near(Math.abs(p.x), GRIP_GEO.t / 2, 1e-6));
  assert(notchPts.length === 4, `${notchPts.length} vértices cerca de x=±t/2, esperaba 4`);
  const ys = notchPts.map((p) => p.y);
  assert(near(Math.min(...ys), GRIP_GEO.splitY, 0.01), `fondo de la ranura en y=${Math.min(...ys)}, esperaba ${GRIP_GEO.splitY}`);
  assert(near(Math.max(...ys), GRIP_GEO.D, 0.01), `boca de la ranura en y=${Math.max(...ys)}, esperaba ${GRIP_GEO.D} (fondo del vástago)`);
});

check('agarradera: la ranura de HANDLE-B mide t de ancho, se abre en la curva del domo, y llega hasta splitY', () => {
  const notchPts = GRIP_B.points.filter((p) => near(Math.abs(p.x), GRIP_GEO.t / 2, 1e-6));
  assert(notchPts.length === 4, `${notchPts.length} vértices cerca de x=±t/2, esperaba 4 (2 del arco, 2 del fondo de la ranura)`);
  const ys = notchPts.map((p) => p.y);
  assert(near(Math.min(...ys), GRIP_GEO.archCrossY, 0.01), `boca de la ranura en y=${Math.min(...ys)}, esperaba ${GRIP_GEO.archCrossY} (cruce con la curva)`);
  assert(near(Math.max(...ys), GRIP_GEO.splitY, 0.01), `fondo de la ranura en y=${Math.max(...ys)}, esperaba ${GRIP_GEO.splitY}`);
});

check('agarradera: las dos ranuras (HANDLE-A y HANDLE-B) llegan exactamente al mismo plano de unión', () => {
  // HANDLE-A: el fondo de su ranura es el mínimo y entre sus puntos en
  // x=±t/2 (su boca, en el fondo del vástago, es el máximo). HANDLE-B: al
  // revés — su fondo es el MÁXIMO (su boca, más arriba en la curva del
  // domo, es el mínimo). Cada lado deriva su propio valor de sus propios
  // puntos, sin asumir de antemano que van a coincidir.
  const notchYs = (points) => points
    .filter((p) => near(Math.abs(p.x), GRIP_GEO.t / 2, 1e-6))
    .map((p) => p.y);
  const splitA = Math.min(...notchYs(GRIP_A.points));
  const splitB = Math.max(...notchYs(GRIP_B.points));
  assert(near(splitA, splitB, 1e-6), `handle-a corta en y=${splitA}, handle-b en y=${splitB} — no quedan al ras`);
});

check('agarradera: el domo de HANDLE-A clasifica como material, y la ranura como vacío (ray-casting)', () => {
  assert(insidePolygonGrip({ x: 0, y: -GRIP_GEO.R + 1 }, GRIP_A.points), 'la punta del domo debería ser material');
  assert(insidePolygonGrip({ x: GRIP_GEO.gs / 2 - 1, y: GRIP_GEO.D - 1 }, GRIP_A.points), 'el vástago fuera de la ranura debería ser material');
  assert(!insidePolygonGrip({ x: 0, y: GRIP_GEO.D - 0.5 }, GRIP_A.points), 'el centro de la ranura, cerca de la boca, debería ser vacío');
});
```

- [ ] **Step 3: Correr los checks en el navegador**

Confirmar `✅ N/N checks OK` con los 6 checks nuevos en verde. Si
`assertSimplePolygon` falla con un cruce transversal en las aristas de la
ranura de HANDLE-B, revisar el signo de `deltaDeg` (el arco tiene que
terminar/empezar exactamente donde arrancan/terminan los segmentos de la
ranura — sin punto duplicado ni hueco entre ellos).

- [ ] **Step 4: Commit**

```bash
git add js/boxes/lid-grip.js test.html
git commit -m "Add HANDLE-A/HANDLE-B dome-and-stem geometry with the cross-lap notch"
```

---

### Task 4: `lid-grip.js` — validaciones y avisos

**Files:**
- Modify: `js/boxes/lid-grip.js`
- Test: `test.html`

**Interfaces:**
- Consumes: `EDGE_MARGIN`.
- Produces: `validateGrip({ t, gd, gs, spanX, spanY }) → string[]`, `gripWarnings({ gd, gs }) → string[]`.

- [ ] **Step 1: Agregar a `js/boxes/lid-grip.js`**

```js
export function validateGrip({
  t, gd, gs, spanX, spanY,
}) {
  const errors = [];
  const positive = (v) => Number.isFinite(v) && v > 0;
  if (!positive(gd)) errors.push('El diámetro de la perilla debe ser mayor que 0.');
  if (!positive(gs)) errors.push('El ancho del agujero en cruz debe ser mayor que 0.');
  if (errors.length > 0) return errors;

  if (gs <= t + 2 * EDGE_MARGIN) {
    errors.push(`El vástago de la perilla (${gs} mm) es demasiado angosto para ${t} mm de material: no queda pared a los costados de la ranura.`);
  }
  if (gd <= gs + 2 * EDGE_MARGIN) {
    errors.push(`La perilla (${gd} mm de diámetro) es demasiado chica, o el agujero (${gs} mm) demasiado ancho: el domo no alcanza a apoyarse sobre la tapa.`);
  }
  if (gs + 2 * EDGE_MARGIN >= Math.min(spanX, spanY)) {
    errors.push(`El material es demasiado grueso, o la perilla demasiado ancha, para una caja de este tamaño: el agujero en cruz (${gs} mm) no cabe dentro del hueco interno.`);
  }
  return errors;
}

// Margen del reborde del domo (gd−gs)/2 por debajo del cual avisamos que
// puede costar agarrarla — umbral elegido a ojo, mayor que el margen de
// error (EDGE_MARGIN = 2) para que quede una franja de aviso antes de
// llegar al error bloqueante.
const GRIP_RIM_WARNING_MARGIN = 5;

export function gripWarnings({ gd, gs }) {
  const warnings = [];
  if (Number.isFinite(gd) && Number.isFinite(gs) && (gd - gs) / 2 < GRIP_RIM_WARNING_MARGIN) {
    warnings.push(`El reborde de la perilla queda angosto (${((gd - gs) / 2).toFixed(1)} mm): puede costar agarrarla.`);
  }
  return warnings;
}
```

- [ ] **Step 2: Agregar los checks en `test.html`**

```js
import {
  gripDiameterFor, gripStemSpanFor, gripGeometry, crossHoleFeature,
  buildTopHole, buildInsertPanel, buildHandlePanels, validateGrip, gripWarnings,
} from './js/boxes/lid-grip.js';
```

(reemplazar el import de la Task 3 por esta lista extendida)

```js
check('agarradera: validateGrip — la caja canónica (t=3, gd=30, gs=16, hueco 74×74) no da errores', () => {
  const errors = validateGrip({
    t: 3, gd: 30, gs: 16, spanX: 74, spanY: 74,
  });
  assert(errors.length === 0, errors.join(' | '));
});

check('agarradera: validateGrip — errores que bloquean la generación', () => {
  const BASE = {
    t: 3, gd: 30, gs: 16, spanX: 74, spanY: 74,
  };
  const cases = [
    ['diámetro inválido', { gd: 0 }, 'diámetro'],
    ['ancho de agujero inválido', { gs: 0 }, 'agujero'],
    ['vástago demasiado angosto', { gs: 6 }, 'vástago'],
    ['domo demasiado chico para el agujero', { gd: 18, gs: 16 }, 'perilla'],
    ['agujero no entra en el hueco interno', { gs: 16, spanX: 18, spanY: 18 }, 'hueco interno'],
  ];
  for (const [name, override, fragment] of cases) {
    const errors = validateGrip({ ...BASE, ...override });
    assert(errors.length > 0, `${name}: no produjo error`);
    assert(errors.some((e) => e.toLowerCase().includes(fragment)),
      `${name}: esperaba un error con "${fragment}", salió: ${errors.join(' | ')}`);
  }
});

check('agarradera: gripWarnings — reborde angosto avisa, reborde amplio no avisa nada', () => {
  const narrow = gripWarnings({ gd: 22, gs: 16 }); // reborde (22-16)/2 = 3 < 5
  assert(narrow.some((w) => w.toLowerCase().includes('reborde')), `esperaba aviso de reborde, salió: ${narrow.join(' | ')}`);
  const wide = gripWarnings({ gd: 30, gs: 16 }); // reborde (30-16)/2 = 7 >= 5
  assert(wide.length === 0, `no debería avisar nada, salió: ${wide.join(' | ')}`);
});
```

- [ ] **Step 3: Correr los checks en el navegador**

Confirmar `✅ N/N checks OK` con los 3 checks nuevos en verde.

- [ ] **Step 4: Commit**

```bash
git add js/boxes/lid-grip.js test.html
git commit -m "Add grip validation errors and warnings"
```

---

### Task 5: Conectar todo en `simple-box.js`

**Files:**
- Modify: `js/boxes/simple-box.js`
- Test: `test.html`

**Interfaces:**
- Consumes: todo lo de `lid-grip.js` (Tasks 1-4).
- Produces: `buildBox(params)` ahora acepta `params.grip` (boolean), `params.gripDiameter`, `params.gripStemSpan`. Con `lidType==='flat'` y `grip: true`, el panel `'top'` gana `features: [hole]` y el resultado incluye 3 piezas nuevas (`top-insert`, `handle-a`, `handle-b`) y un campo `grip: { diameter, stemSpan }` en el objeto devuelto. Sin `grip: true`, o con otro `lidType`, el comportamiento es idéntico al actual (sin cambios).

- [ ] **Step 1: Leer el `buildBox()` actual completo**

```bash
cat js/boxes/simple-box.js
```

Confirmar que sigue teniendo exactamente la forma descrita en la sección
"Contexto de archivos existentes" de arriba antes de tocarlo — si algo
cambió desde que se escribió este plan, adaptar los pasos de abajo a la
forma real, no pisarla a ciegas.

- [ ] **Step 2: Editar `js/boxes/simple-box.js`**

Agregar el import nuevo, después del `import { panelOutline } from '../core/panel.js';`:

```js
import {
  gripDiameterFor, gripStemSpanFor, gripGeometry,
  buildTopHole, buildInsertPanel, buildHandlePanels,
  validateGrip, gripWarnings,
} from './lid-grip.js';
```

Dentro de `buildBox(params)`, justo después de la línea
`const flatLid = lidType === 'flat';`, agregar:

```js
  const gripEnabled = flatLid && params.grip === true;
  const gd = gripEnabled ? gripDiameterFor(params) : null;
  const gs = gripEnabled ? gripStemSpanFor(params) : null;
```

Reemplazar la línea:

```js
  const errors = validate({ Lo, Wo, Ho, spanX, spanY, spanZ, t, kerf, tabWidth, flatLid });
```

por:

```js
  const errors = validate({ Lo, Wo, Ho, spanX, spanY, spanZ, t, kerf, tabWidth, flatLid });
  if (gripEnabled && errors.length === 0) {
    errors.push(...validateGrip({
      t, gd, gs, spanX, spanY,
    }));
  }
```

Reemplazar el bloque de `specs` (la lista `bottom/front/left/top/back/right`):

```js
  const specs = [
    { id: 'bottom', label: 'BOTTOM', ...cap },
    { id: 'front', label: 'FRONT', ...endWall },
    { id: 'left', label: 'LEFT', ...sideWall },
    { id: 'top', label: 'TOP', ...(flatLid ? flatPanel : cap) },
    { id: 'back', label: 'BACK', ...endWall },
    { id: 'right', label: 'RIGHT', ...sideWall },
  ];
```

por:

```js
  const topSpec = { id: 'top', label: 'TOP', ...(flatLid ? flatPanel : cap) };
  if (gripEnabled) {
    topSpec.features = [buildTopHole({
      Lo, Wo, gs, t,
    })];
  }

  const specs = [
    { id: 'bottom', label: 'BOTTOM', ...cap },
    { id: 'front', label: 'FRONT', ...endWall },
    { id: 'left', label: 'LEFT', ...sideWall },
    topSpec,
    { id: 'back', label: 'BACK', ...endWall },
    { id: 'right', label: 'RIGHT', ...sideWall },
  ];
```

Reemplazar la línea:

```js
  const material = { thickness: t, kerf, tabWidth };
  const panels = specs.map((spec) => ({ ...spec, points: panelOutline(spec, material) }));
```

por:

```js
  const material = { thickness: t, kerf, tabWidth };
  const panels = specs.map((spec) => ({ ...spec, points: panelOutline(spec, material) }));

  if (gripEnabled) {
    const geo = gripGeometry({ t, gd, gs });
    panels.push(buildInsertPanel({
      spanX, spanY, gs, t, material,
    }));
    const { handleA, handleB } = buildHandlePanels(geo);
    panels.push(handleA, handleB);
  }
```

Reemplazar el `return` final:

```js
  return {
    panels,
    joints,
    errors,
    warnings: commonWarnings({
      jointWidths: [joints.x.width, joints.y.width, joints.z.width],
      t, kerf, tabWidth,
    }),
    outer: { length: Lo, width: Wo, height: Ho },
    inner: { length: Lo - 2 * t, width: Wo - 2 * t, height: Ho - 2 * t },
  };
```

por:

```js
  return {
    panels,
    joints,
    errors,
    warnings: [
      ...commonWarnings({
        jointWidths: [joints.x.width, joints.y.width, joints.z.width],
        t, kerf, tabWidth,
      }),
      ...(gripEnabled ? gripWarnings({ gd, gs }) : []),
    ],
    outer: { length: Lo, width: Wo, height: Ho },
    inner: { length: Lo - 2 * t, width: Wo - 2 * t, height: Ho - 2 * t },
    ...(gripEnabled ? { grip: { diameter: gd, stemSpan: gs } } : {}),
  };
```

- [ ] **Step 3: Agregar los checks de integración en `test.html`**

```js
import { buildBox, autoTabWidth } from './js/boxes/simple-box.js';
```

ya existe — no hace falta tocarlo, `buildBox` ya está importado.

```js
const FLAT_GRIP = {
  length: 80, width: 80, height: 80,
  thickness: 3, kerf: 0.16, tabWidth: 12,
  dimensionMode: 'outer', lidType: 'flat', grip: true,
};

check('agarradera: tapa plana SIN agarradera sigue dando exactamente 6 piezas (regresión)', () => {
  const box = buildBox({ ...FLAT_GRIP, grip: false });
  assert(box.errors.length === 0, box.errors.join(' | '));
  assert(box.panels.length === 6, `${box.panels.length} piezas, esperaba 6`);
  assert(box.grip === undefined, 'no debería traer campo grip cuando está desactivada');
  const top = box.panels.find((p) => p.id === 'top');
  assert(!top.features, 'TOP no debería tener features sin la agarradera');
});

check('agarradera: tapa plana CON agarradera da 9 piezas, sin errores, con el campo grip', () => {
  const box = buildBox(FLAT_GRIP);
  assert(box.errors.length === 0, box.errors.join(' | '));
  assert(box.panels.length === 9, `${box.panels.length} piezas, esperaba 9`);
  for (const id of ['bottom', 'front', 'left', 'top', 'back', 'right', 'top-insert', 'handle-a', 'handle-b']) {
    assert(box.panels.find((p) => p.id === id), `falta la pieza ${id}`);
  }
  assert(near(box.grip.diameter, 30), `grip.diameter=${box.grip.diameter}, esperaba 30`);
  assert(near(box.grip.stemSpan, 16), `grip.stemSpan=${box.grip.stemSpan}, esperaba 16`);
  const top = box.panels.find((p) => p.id === 'top');
  assert(top.features.length === 1, 'TOP debería tener exactamente un agujero');
});

check('agarradera: el contorno de las 9 piezas es siempre un polígono simple', () => {
  const box = buildBox(FLAT_GRIP);
  for (const p of box.panels) {
    assertSimplePolygon(p.points, p.id);
  }
});

check('agarradera: errores del box completo cuando la agarradera no entra en la caja', () => {
  const tooSmall = buildBox({
    ...FLAT_GRIP, length: 20, width: 20,
  });
  assert(tooSmall.errors.length > 0, 'debería dar error con una caja demasiado chica para la agarradera');
  assert(tooSmall.panels.length === 0, 'no debería devolver piezas si hay error');
});

check('agarradera: otros tipos de tapa (finger/sliding/hinged) no se ven afectados por params.grip', () => {
  const withStrayGrip = buildBox({ ...BASE, grip: true });
  const without = buildBox(BASE);
  assert(withStrayGrip.panels.length === without.panels.length, 'un grip:true en lidType finger no debería agregar piezas');
});
```

`BASE` ya existe en `test.html` (la config de 200×150×80 con `lidType`
implícito `finger`, definida cerca del principio del archivo) — no hace
falta declararla de nuevo.

- [ ] **Step 4: Correr los checks en el navegador**

Confirmar `✅ N/N checks OK` con los 5 checks nuevos en verde, y que
NINGÚN check preexistente (los de `finger`/`sliding`/`hinged` u otros de
`flat` sin agarradera) se puso en rojo.

- [ ] **Step 5: Commit**

```bash
git add js/boxes/simple-box.js test.html
git commit -m "Wire the grip handle into the flat lid's buildBox()"
```

---

### Task 6: Wiring en la interfaz (`index.html` + `js/ui/app.js`)

**Files:**
- Modify: `index.html`
- Modify: `js/ui/app.js`

**Interfaces:**
- Consumes: `buildBox` ya actualizado (Task 5).
- Produces: casilla "Agarradera" visible solo con tapa "Plana" seleccionada, con dos campos (`gripDiameter`, `gripStemSpan`) visibles solo si la casilla está marcada.

- [ ] **Step 1: Editar `index.html`**

Dentro del `fieldset` "Dimensiones", después del bloque
`<div class="field hinged-fields" id="hingedFields" hidden> ... </div>`
(el último de los bloques condicionales de tapa), agregar:

```html
          <div class="field flat-fields" id="flatFields" hidden>
            <div class="field-checkbox">
              <input type="checkbox" id="grip" name="grip">
              <label for="grip">Agarradera</label>
            </div>
            <div class="field grip-fields" id="gripFields" hidden>
              <div class="field">
                <label for="gripDiameter">Diámetro de la perilla <span class="unit">mm</span></label>
                <input type="number" id="gripDiameter" name="gripDiameter" value="30" step="1" min="1" inputmode="decimal">
              </div>
              <div class="field">
                <label for="gripStemSpan">Ancho del agujero en cruz <span class="unit">mm</span></label>
                <input type="number" id="gripStemSpan" name="gripStemSpan" value="16" step="1" min="1" inputmode="decimal">
              </div>
              <p class="help">
                Perilla armada de dos piezas en domo que se encastran a 90°
                y bajan a presión por un agujero en cruz en la tapa y otro
                igual en un inserto pegado por debajo. El diámetro es el
                tamaño del domo (lo que se agarra); el ancho del agujero es
                cuánto vástago tiene que atravesar las dos capas — tiene que
                quedar bastante más chico que el diámetro, para que el domo
                se apoye sobre la tapa sin pasar por el agujero.
              </p>
            </div>
          </div>
```

En el párrafo `<p class="help">` que describe los tipos de tapa (el que
empieza con `"Con espigas": la tapa encaja dentro...`), agregar al final,
antes del cierre `</p>`:

```
              Con la casilla "Agarradera" (solo disponible con tapa
              "Plana"), se le agrega una perilla armada de dos piezas que
              atraviesa la tapa y un inserto pegado por debajo.
```

- [ ] **Step 2: Editar `js/ui/app.js`**

Agregar, junto a las demás constantes `const ... = document.getElementById(...)` al principio del archivo:

```js
const flatFields = document.getElementById('flatFields');
const gripEl = document.getElementById('grip');
const gripFields = document.getElementById('gripFields');
const gripDiameterEl = document.getElementById('gripDiameter');
const gripStemSpanEl = document.getElementById('gripStemSpan');
```

Dentro de `readParams()`, después del bloque `if (hinged) { ... }` (el que
resuelve los campos de la bisagra) y antes de `tabWidthEl.disabled = ...`,
agregar:

```js
  const flat = lidType === 'flat';
  flatFields.hidden = !flat;
  if (flat) {
    params.grip = gripEl.checked;
    gripFields.hidden = !params.grip;
    if (params.grip) {
      params.gripDiameter = parseFloat(gripDiameterEl.value);
      params.gripStemSpan = parseFloat(gripStemSpanEl.value);
    }
  }
```

- [ ] **Step 3: Verificar en el navegador**

```bash
node dev-server.mjs
```

Con `agent-browser` (o el navegador):
1. Abrir `http://localhost:8000/`.
2. Elegir tapa "Plana (apoyada)" — debería aparecer la casilla "Agarradera", sin marcar, sin los campos de diámetro/ancho visibles.
3. Marcar "Agarradera" — deberían aparecer los dos campos, con 30 y 16 por defecto, y la vista previa debería mostrar 9 piezas (BOTTOM, FRONT, LEFT, TOP, BACK, RIGHT, TOP-INSERT, HANDLE-A, HANDLE-B), sin errores ni avisos con las dimensiones por defecto (200×150×80).
4. Elegir otra tapa (por ejemplo "Con espigas") — la casilla "Agarradera" y sus campos deberían desaparecer, y la vista previa volver a las 6 piezas de siempre.
5. Sacar una captura de pantalla del resultado con la agarradera activada y confirmar a ojo que TOP tiene un agujero en cruz cerca del centro, y que aparecen las 3 piezas nuevas con esa misma forma de cruz/domo.

- [ ] **Step 4: Commit**

```bash
git add index.html js/ui/app.js
git commit -m "Wire the grip checkbox and fields into the flat lid form"
```

---

### Task 7: Documentación y verificación final

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Actualizar `README.md`**

Reemplazar la fila de "Tapa" en la tabla de parámetros (sección "Los
parámetros") — buscar la línea que empieza con
`| Tapa: Con espigas / Plana / Deslizante / Con bisagra | Con espigas |` —
por la misma fila con esta oración agregada al final de la descripción de
"Plana", antes de la comilla de cierre `"`:

```
 Con la casilla "Agarradera" se le agrega una perilla armada de dos piezas en domo (encastradas a 90°, mismo grosor que el material) que atraviesa dos agujeros en cruz — uno en la tapa, otro en un inserto pegado por debajo, del tamaño exacto del hueco interno de la caja."
```

Agregar dos filas nuevas a la tabla, justo después de esa fila de "Tapa":

```
| Diámetro de la perilla (mm) | 30 | Solo con tapa plana y "Agarradera" activada. Tamaño del domo que se agarra — no sigue ninguna fórmula, es a criterio. |
| Ancho del agujero en cruz (mm) | 16 | Solo con tapa plana y "Agarradera" activada. Cuánto vástago atraviesa las dos capas de la tapa — tiene que quedar bastante más chico que el diámetro, para que el domo se apoye sobre la tapa sin pasar por el agujero. |
```

En "Cómo está hecho", reemplazar la línea:

```
- `js/boxes/` — los tipos de caja concretos: `simple-box.js` (caja cerrada y tapa plana), `sliding-box.js` (tapa deslizante), `hinged-box.js` (tapa con bisagra) y `shared.js` con lo que todos comparten.
```

por:

```
- `js/boxes/` — los tipos de caja concretos: `simple-box.js` (caja cerrada y tapa plana), `sliding-box.js` (tapa deslizante), `hinged-box.js` (tapa con bisagra), `lid-grip.js` (agarradera de la tapa plana: perilla en dos piezas y el agujero en cruz, reutilizada por `simple-box.js`) y `shared.js` con lo que todos comparten.
```

En "Verificación", actualizar el número de checks al total real después
de correr la suite completa (ver Step 2 más abajo) — buscar la frase
"Actualmente son **N checks**" y reemplazar el número.

- [ ] **Step 2: Correr la suite completa y confirmar el número final de checks**

```bash
node dev-server.mjs
```

Abrir `http://localhost:8000/test.html`, confirmar `✅ N/N checks OK`
(sin ningún rojo), y usar ese `N` para actualizar el texto de
"Verificación" en `README.md` si el número cambió desde el Step 1.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "Document the flat lid's grip handle"
```

---

## Autorrevisión del plan (spec vs. plan)

- **Cobertura del spec:** las dos capas (TOP + TOP-INSERT, Task 2), la
  perilla de dos piezas con el plano de unión compartido (Task 3), las
  validaciones de error/aviso de la tabla del spec (Task 4), el
  parámetro por defecto sin holgura de kerf (decisión aplicada en
  `crossHoleFeature` y en las piezas de la perilla, Tasks 1 y 3), sin
  esquinas redondeadas (ningún task las agrega), sin holgura calibrable
  para el inserto (`buildInsertPanel` usa `spanX × spanY` exacto, Task
  2) — todo cubierto.
- **Sin placeholders:** cada step trae código completo, sin "TBD" ni
  "agregar validación acá".
- **Consistencia de tipos:** `gripGeometry` devuelve `{t, gd, gs, R, D,
  H, splitY, archCrossY}`, y todas las funciones que lo consumen
  (`buildHandlePanels`, los checks de Task 3) usan exactamente esos
  nombres de campo. `validateGrip`/`gripWarnings` reciben `{t, gd, gs,
  spanX, spanY}`/`{gd, gs}` consistentemente en `simple-box.js` (Task 5)
  y en sus propios checks (Task 4).
