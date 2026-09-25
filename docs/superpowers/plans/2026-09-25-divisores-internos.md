# Divisores internos — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar dos campos — "Divisores de largo" y "Divisores de alto" — a las 4 tapas de BoxMaker, que parten el interior de la caja en columnas y/o capas apiladas, cruzándose con una ranura a media madera cuando se usan los dos tipos a la vez.

**Architecture:** Toda la geometría nueva vive en un módulo enfocado y nuevo, `js/boxes/dividers.js`, sin tocar `finger-joint.js` ni `panel.js` (las ranuras de cruce son cortes puntuales en una posición arbitraria, no la hilera pareja de espigas que resuelve `edgeProfile`). Los tres constructores de caja (`simple-box.js`, `sliding-box.js`, `hinged-box.js`) llaman a ese módulo con su propio `spanX`/`spanY`/alto interior ya calculado, y le agregan los paneles y avisos resultantes a lo que ya arman hoy.

**Tech Stack:** JS plano, ES modules nativos, sin build step. Pruebas en `test.html` (self-checks en el navegador, sin framework de testing).

**Spec:** `docs/superpowers/specs/2026-09-25-divisores-internos-design.md`

## Global Constraints

- Grosor de los divisores = `t` (grosor de material de la caja) — sin parámetro nuevo.
- Sin unión a las paredes exteriores: los divisores quedan sueltos a presión, sin espigas.
- Bordes exteriores de los divisores (los que no llevan ranura de cruce): medida nominal exacta, sin compensación de kerf — mismo criterio que `TOP-INSERT` en `lid-grip.js`.
- Ranura de cruce: ancho nominal `t`, compensada de kerf como una arista hembra (`t − kerf`); profundidad `spanY / 2`, sin compensación de kerf — mismo criterio de "depth" que usa `finger-joint.js` para sus tabs.
- Solo cantidad por eje (`lengthDividers`, `heightDividers`), reparto automático a distancias iguales — sin control de posición individual.
- Disponible por igual en las 4 tapas (`finger`, `flat` —con o sin agarradera—, `sliding`, `hinged`).
- `lengthDividers`/`heightDividers` no definidos o no finitos se tratan como `0` (sin divisores), igual que el resto de los parámetros opcionales de este proyecto (`gripDiameter`, `pegSize`, etc.).

---

## Contexto de archivos existentes (leer antes de empezar)

- `js/core/panel.js` — `panelOutline(spec, material)` arma el contorno de un panel a partir de sus 4 aristas (`gender: 'plain'|'male'|'female'`, sistema de `finger-joint.js`). Los divisores NO pasan por acá: sus muescas de cruce son cortes puntuales en una posición arbitraria del borde, no una hilera pareja de tabs, así que se arman como una lista de puntos explícita — mismo patrón que `handleCapPoints` en `hinged-box.js` o el injerto de `buildSideWall`.
- `js/core/finger-joint.js` — referencia de convención de kerf: una arista **female** se dibuja `kerf` más angosta (`start = nominal + kerf/2`, `end = nominal − kerf/2`) para que el corte del láser la deje en su ancho nominal. La ranura de cruce de los divisores usa la misma idea, aplicada a mano a una banda puntual en vez de a una hilera de tabs.
- `js/render/svg-render.js` — dibuja cada panel de `box.panels` como un `<path>` a partir de `panel.points` (y cada `panel.features` aparte). No usa `panel.width`/`panel.height`/`panel.edges` para nada — un panel de divisor solo necesita `{ id, label, points }`.
- `js/boxes/simple-box.js` — `buildBox({ length, width, height, thickness, kerf, tabWidth, lidType, dimensionMode, grip?, gripDiameter?, gripStemSpan? })`. Ya calcula `spanX`, `spanY`, `spanZ` (el alto interior libre, igual para `finger` y `flat`) antes de armar `specs`. Devuelve `{ panels, joints, errors, warnings, outer, inner, grip? }`.
- `js/boxes/sliding-box.js` — `buildSlidingBox(params)`. `slidingHeights(params)` ya calcula `innerHeight` (el alto interior libre real, descontando el grosor de la tapa deslizante). `spanX`, `spanY` también ya calculados.
- `js/boxes/hinged-box.js` — `buildHingedBox(params)`. `wallHeight` ya calculado (`Ho − tl`); el alto interior libre es `wallHeight − t` (mismo valor que ya devuelve como `inner.height`). `spanX`, `spanY` también ya calculados.
- `js/boxes/shared.js` — `outerDimensions`, `jointSegments`, `commonWarnings`, `validateBasics`, `validateTabsVsKerf`, `KERF_TOO_BIG`. No se toca.
- `test.html` — ya trae, en este branch, `assertSimplePolygon(points, label)` (verifica que un contorno sea un polígono simple: sin cruces, sin colineares solapados, sin vértice ajeno a mitad de arista) e `insidePolygonGrip(pt, points)` (point-in-polygon genérico, pese al nombre). Reusar las dos tal cual — no redefinir.
- `js/ui/app.js` / `index.html` — `readParams()` arma el objeto `params` leyendo el formulario; `recompute()` lo pasa a `builderFor(lidType).build(params)` y arma el texto de `summaryEl`.

---

### Task 1: `dividers.js` — posiciones parejas y las dos formas de panel con muescas

**Files:**
- Create: `js/boxes/dividers.js`
- Test: `test.html`

**Interfaces:**
- Produces:
  - `evenPositions(span, count) → number[]`
  - `buildLengthDividerPoints({ width, height, notchDepth, notchWidth, positions }) → Point[]`
  - `buildHeightDividerPoints({ width, height, notchDepth, notchWidth, positions }) → Point[]`

- [ ] **Step 1: Escribir `js/boxes/dividers.js` con las posiciones y las dos formas de panel**

```js
// Posiciones a distancias iguales dentro de un tramo, sin tocar los
// extremos: con `count` divisores, el tramo queda partido en `count + 1`
// partes iguales y cada divisor cae en un borde interno entre dos partes.
// Con count=0 no hay ninguna posición — el panel sale liso más abajo.
export function evenPositions(span, count) {
  const positions = [];
  for (let i = 1; i <= count; i += 1) positions.push((i * span) / (count + 1));
  return positions;
}

// Rectángulo width × height, recorrido en sentido horario, con una muesca
// rectangular entallada hacia ADENTRO desde el borde IZQUIERDO (u = 0) por
// cada posición en `positions`, hasta `notchDepth`. Sin posiciones, es un
// rectángulo liso (el caso de un solo tipo de divisor, sin cruces — ver
// spec, "Uno.svg"). Usada por DIVIDER-L: `width` es spanY, `height` es el
// alto interior libre, y cada posición es la altura (eje Z) de un divisor
// de alto que lo cruza.
export function buildLengthDividerPoints({
  width, height, notchDepth, notchWidth, positions,
}) {
  const half = notchWidth / 2;
  // Se recorre en sentido horario: tras las 3 primeras esquinas, el borde
  // izquierdo se camina de abajo (y = height) hacia arriba (y = 0), así
  // que las muescas se insertan ordenadas de mayor a menor y.
  const sorted = [...positions].sort((a, b) => b - a);
  const points = [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height },
  ];
  for (const p of sorted) {
    points.push({ x: 0, y: p + half });
    points.push({ x: notchDepth, y: p + half });
    points.push({ x: notchDepth, y: p - half });
    points.push({ x: 0, y: p - half });
  }
  return points;
}

// Igual que `buildLengthDividerPoints`, pero la muesca se entalla desde el
// borde DE ABAJO (v = height) hacia arriba — el lado OPUESTO, a propósito:
// así, en cualquier cruce, lo que le falta a un DIVIDER-L es justo lo que
// le sobra a un DIVIDER-H, y encajan a media madera (ver spec, "Las dos
// piezas"). Usada por DIVIDER-H: `width` es spanX, `height` es spanY, y
// cada posición es el largo (eje X) de un divisor de largo que lo cruza.
export function buildHeightDividerPoints({
  width, height, notchDepth, notchWidth, positions,
}) {
  const half = notchWidth / 2;
  // Tras las 3 primeras esquinas, el borde de abajo se camina de derecha
  // (x = width) a izquierda (x = 0), así que las muescas se insertan
  // ordenadas de mayor a menor x.
  const sorted = [...positions].sort((a, b) => b - a);
  const points = [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
  ];
  for (const p of sorted) {
    points.push({ x: p + half, y: height });
    points.push({ x: p + half, y: height - notchDepth });
    points.push({ x: p - half, y: height - notchDepth });
    points.push({ x: p - half, y: height });
  }
  points.push({ x: 0, y: height });
  return points;
}
```

- [ ] **Step 2: Agregar los checks en `test.html`**

Junto a los demás `import` al principio del `<script type="module">`, agregar:

```js
import {
  evenPositions, buildLengthDividerPoints, buildHeightDividerPoints,
} from './js/boxes/dividers.js';
```

Justo antes del bloque final que arma `results`/`summary` (buscar `const failed = results.filter`), agregar una sección nueva:

```js
// --- Divisores internos: posiciones y formas base ---

check('divisores: evenPositions reparte a distancias iguales, sin tocar los extremos', () => {
  assert(JSON.stringify(evenPositions(144, 3)) === JSON.stringify([36, 72, 108]),
    `evenPositions(144,3) = ${JSON.stringify(evenPositions(144, 3))}`);
  assert(JSON.stringify(evenPositions(114, 2)) === JSON.stringify([38, 76]),
    `evenPositions(114,2) = ${JSON.stringify(evenPositions(114, 2))}`);
  assert(JSON.stringify(evenPositions(100, 0)) === '[]', 'evenPositions con count=0 debería dar []');
  assert(JSON.stringify(evenPositions(100, 1)) === '[50]', 'evenPositions(100,1) debería dar [50]');
});

check('divisores: buildLengthDividerPoints sin posiciones da un rectángulo liso de 4 puntos', () => {
  const pts = buildLengthDividerPoints({
    width: 44, height: 114, notchDepth: 22, notchWidth: 2.9, positions: [],
  });
  assert(pts.length === 4, `${pts.length} puntos, esperaba 4`);
  const bb = boundingBox(pts);
  assert(near(bb.width, 44) && near(bb.height, 114), `bbox ${bb.width}x${bb.height}, esperaba 44x114`);
  assertSimplePolygon(pts, 'buildLengthDividerPoints sin muescas');
});

check('divisores: buildLengthDividerPoints con 2 muescas reproduce el ejemplo de referencia (Nc=3,Ns=2)', () => {
  const positions = evenPositions(114, 2); // [38, 76] — alto interior 114, 2 divisores de alto
  const pts = buildLengthDividerPoints({
    width: 44, height: 114, notchDepth: 22, notchWidth: 2.9, positions,
  });
  assert(pts.length === 12, `${pts.length} puntos, esperaba 12 (4 esquinas + 2 muescas x 4)`);
  const bb = boundingBox(pts);
  assert(near(bb.width, 44) && near(bb.height, 114), 'las muescas no deberían agrandar el bbox: son cortes hacia adentro');
  assertSimplePolygon(pts, 'buildLengthDividerPoints con 2 muescas');
  // La muesca en v=76 debería llegar hasta u=22 (notchDepth) y no más lejos.
  const notchPoints = pts.filter((p) => near(p.y, 76 + 1.45) || near(p.y, 76 - 1.45));
  assert(notchPoints.some((p) => near(p.x, 22)), 'la muesca en v=76 debería tener un punto en u=22 (notchDepth)');
});

check('divisores: buildHeightDividerPoints con 3 muescas reproduce el ejemplo de referencia (Nc=3,Ns=2)', () => {
  const positions = evenPositions(144, 3); // [36, 72, 108] — largo interior 144, 3 divisores de largo
  const pts = buildHeightDividerPoints({
    width: 144, height: 44, notchDepth: 22, notchWidth: 2.9, positions,
  });
  assert(pts.length === 15, `${pts.length} puntos, esperaba 15 (3 esquinas + 3 muescas x 4)`);
  const bb = boundingBox(pts);
  assert(near(bb.width, 144) && near(bb.height, 44), 'las muescas no deberían agrandar el bbox');
  assertSimplePolygon(pts, 'buildHeightDividerPoints con 3 muescas');
  const notchPoints = pts.filter((p) => near(p.x, 72 + 1.45) || near(p.x, 72 - 1.45));
  assert(notchPoints.some((p) => near(p.y, 22)), 'la muesca en u=72 debería tener un punto en v=22 (notchDepth)');
});
```

- [ ] **Step 3: Levantar el servidor y correr los checks**

```bash
node dev-server.mjs
```

Abrir `http://localhost:8000/test.html` (con `agent-browser` o el navegador) y confirmar `✅ N/N checks OK`, con los 5 checks nuevos en verde.

- [ ] **Step 4: Commit**

```bash
git add js/boxes/dividers.js test.html
git commit -m "Add divider positioning and notched-panel shape builders"
```

---

### Task 2: `dividers.js` — validaciones y avisos

**Files:**
- Modify: `js/boxes/dividers.js`
- Test: `test.html`

**Interfaces:**
- Produces:
  - `validateDividers({ lengthDividers, heightDividers, spanY, t }) → string[]`
  - `dividerWarnings({ lengthDividers, heightDividers, spanX, dividerHeight, t }) → string[]`

- [ ] **Step 1: Agregar a `js/boxes/dividers.js`**

```js
const MIN_COMPARTMENT_RATIO = 3; // aviso si un compartimento queda por debajo de 3x el grosor

function isDividerCount(n) {
  return Number.isInteger(n) && n >= 0;
}

// Sin valor (undefined/NaN) se trata como 0 divisores — mismo criterio que
// el resto de los parámetros opcionales de este proyecto.
function resolveCount(n) {
  return Number.isFinite(n) ? n : 0;
}

export function validateDividers({
  lengthDividers, heightDividers, spanY, t,
}) {
  const Nc = resolveCount(lengthDividers);
  const Ns = resolveCount(heightDividers);
  const errors = [];

  if (!isDividerCount(Nc) || !isDividerCount(Ns)) {
    errors.push('La cantidad de divisores debe ser un número entero de 0 en adelante.');
    return errors;
  }
  // La ranura de cruce llega hasta spanY/2: si eso no supera el grosor del
  // material, la muesca deja un filo más fino que su propio ancho, o
  // directamente se cruza con la muesca opuesta.
  if (Nc > 0 && Ns > 0 && spanY / 2 <= t) {
    errors.push(
      `El ancho interior de ${spanY.toFixed(1)} mm es demasiado angosto para cruzar divisores de largo y de alto: la ranura no deja material suficiente.`,
    );
  }
  return errors;
}

export function dividerWarnings({
  lengthDividers, heightDividers, spanX, dividerHeight, t,
}) {
  const Nc = resolveCount(lengthDividers);
  const Ns = resolveCount(heightDividers);
  const warnings = [];

  if (Nc > 0) {
    const compartment = spanX / (Nc + 1);
    if (compartment < MIN_COMPARTMENT_RATIO * t) {
      warnings.push(
        `Los compartimentos de largo quedan de ${compartment.toFixed(1)} mm, muy angostos para ${t} mm de material.`,
      );
    }
  }
  if (Ns > 0) {
    const compartment = dividerHeight / (Ns + 1);
    if (compartment < MIN_COMPARTMENT_RATIO * t) {
      warnings.push(
        `Los compartimentos de alto quedan de ${compartment.toFixed(1)} mm, muy angostos para ${t} mm de material.`,
      );
    }
  }
  return warnings;
}
```

- [ ] **Step 2: Agregar los checks en `test.html`**

Ampliar el import de `dividers.js` agregado en el Task 1:

```js
import {
  evenPositions, buildLengthDividerPoints, buildHeightDividerPoints,
  validateDividers, dividerWarnings,
} from './js/boxes/dividers.js';
```

Agregar, después de los checks del Task 1:

```js
check('divisores: validateDividers no da error con cantidades válidas y espacio de sobra', () => {
  const errors = validateDividers({
    lengthDividers: 3, heightDividers: 2, spanY: 44, t: 3,
  });
  assert(errors.length === 0, errors.join(' | '));
});

check('divisores: validateDividers rechaza cantidades no enteras o negativas', () => {
  assert(validateDividers({ lengthDividers: 1.5, heightDividers: 0, spanY: 44, t: 3 }).length === 1,
    'debería rechazar 1.5');
  assert(validateDividers({ lengthDividers: -1, heightDividers: 0, spanY: 44, t: 3 }).length === 1,
    'debería rechazar -1');
  assert(validateDividers({ lengthDividers: undefined, heightDividers: 0, spanY: 44, t: 3 }).length === 0,
    'sin valor (undefined) debería tratarse como 0, sin error');
});

check('divisores: validateDividers da error si el cruce no deja material (spanY/2 <= t)', () => {
  const errors = validateDividers({
    lengthDividers: 1, heightDividers: 1, spanY: 5, t: 3,
  });
  assert(errors.length === 1, `esperaba 1 error, dio ${errors.length}`);
  const onlyOneType = validateDividers({
    lengthDividers: 1, heightDividers: 0, spanY: 5, t: 3,
  });
  assert(onlyOneType.length === 0, 'sin cruce (un solo tipo activo) no debería dar este error');
});

check('divisores: dividerWarnings avisa cuando los compartimentos quedan angostos', () => {
  const tight = dividerWarnings({
    lengthDividers: 20, heightDividers: 0, spanX: 144, dividerHeight: 114, t: 3,
  });
  assert(tight.length === 1, `esperaba 1 aviso, dio ${tight.length}`);
  const loose = dividerWarnings({
    lengthDividers: 3, heightDividers: 2, spanX: 144, dividerHeight: 114, t: 3,
  });
  assert(loose.length === 0, loose.join(' | '));
});
```

- [ ] **Step 3: Levantar el servidor y correr los checks**

```bash
node dev-server.mjs
```

Abrir `http://localhost:8000/test.html` y confirmar `✅ N/N checks OK`, con los 4 checks nuevos en verde.

- [ ] **Step 4: Commit**

```bash
git add js/boxes/dividers.js test.html
git commit -m "Add divider count validation and compartment-size warnings"
```

---

### Task 3: `dividers.js` — `buildDividerPanels` y el check de correctitud del cruce

**Files:**
- Modify: `js/boxes/dividers.js`
- Test: `test.html`

**Interfaces:**
- Consumes: `evenPositions`, `buildLengthDividerPoints`, `buildHeightDividerPoints` (Task 1).
- Produces: `buildDividerPanels({ spanX, spanY, dividerHeight, t, kerf, lengthDividers, heightDividers }) → panel[]`, cada panel `{ id, label, points }`. Asume input ya validado (no valida internamente — eso es responsabilidad de `validateDividers`, llamado aparte).

- [ ] **Step 1: Agregar a `js/boxes/dividers.js`**

```js
export function buildDividerPanels({
  spanX, spanY, dividerHeight, t, kerf, lengthDividers, heightDividers,
}) {
  const Nc = resolveCount(lengthDividers);
  const Ns = resolveCount(heightDividers);
  if (Nc === 0 && Ns === 0) return [];

  const notchDepth = spanY / 2;
  const notchWidth = t - kerf; // ranura compensada de kerf, como una arista hembra

  const lengthPoints = buildLengthDividerPoints({
    width: spanY,
    height: dividerHeight,
    notchDepth,
    notchWidth,
    positions: evenPositions(dividerHeight, Ns),
  });
  const heightPoints = buildHeightDividerPoints({
    width: spanX,
    height: spanY,
    notchDepth,
    notchWidth,
    positions: evenPositions(spanX, Nc),
  });

  const panels = [];
  for (let i = 1; i <= Nc; i += 1) {
    panels.push({ id: `divider-l${i}`, label: `DIVIDER-L${i}`, points: lengthPoints });
  }
  for (let j = 1; j <= Ns; j += 1) {
    panels.push({ id: `divider-h${j}`, label: `DIVIDER-H${j}`, points: heightPoints });
  }
  return panels;
}
```

- [ ] **Step 2: Agregar los checks en `test.html`**

Ampliar el import una vez más:

```js
import {
  evenPositions, buildLengthDividerPoints, buildHeightDividerPoints,
  validateDividers, dividerWarnings, buildDividerPanels,
} from './js/boxes/dividers.js';
```

Agregar, después de los checks del Task 2:

```js
check('divisores: buildDividerPanels sin divisores da un arreglo vacío', () => {
  const panels = buildDividerPanels({
    spanX: 144, spanY: 44, dividerHeight: 114, t: 3, kerf: 0.1,
    lengthDividers: 0, heightDividers: 0,
  });
  assert(panels.length === 0, `${panels.length} piezas, esperaba 0`);
});

check('divisores: buildDividerPanels reproduce el caso de referencia "2 y 3" (Nc=3, Ns=2 → 5 piezas)', () => {
  const panels = buildDividerPanels({
    spanX: 144, spanY: 44, dividerHeight: 114, t: 3, kerf: 0.1,
    lengthDividers: 3, heightDividers: 2,
  });
  assert(panels.length === 5, `${panels.length} piezas, esperaba 5 (3 DIVIDER-L + 2 DIVIDER-H)`);
  for (const id of ['divider-l1', 'divider-l2', 'divider-l3', 'divider-h1', 'divider-h2']) {
    assert(panels.find((p) => p.id === id), `falta la pieza ${id}`);
  }
  for (const p of panels) assertSimplePolygon(p.points, p.id);
});

check('divisores: sin cruce (solo un tipo activo), las piezas salen sin muescas', () => {
  const panels = buildDividerPanels({
    spanX: 144, spanY: 44, dividerHeight: 114, t: 3, kerf: 0.1,
    lengthDividers: 1, heightDividers: 0,
  });
  assert(panels.length === 1, `${panels.length} piezas, esperaba 1`);
  assert(panels[0].points.length === 4, 'sin divisores de alto que crucen, DIVIDER-L1 debería ser un rectángulo liso de 4 puntos');
});

check('divisores: en el cruce, lo que le falta a DIVIDER-L es justo lo que le sobra a DIVIDER-H (y viceversa)', () => {
  // Caja de referencia del spec: spanX=144, spanY=44, dividerHeight=114,
  // t=3, kerf=0.1, Nc=3, Ns=2 → cruce en x=72 (2do de 3), z=76 (2do de 2).
  const panels = buildDividerPanels({
    spanX: 144, spanY: 44, dividerHeight: 114, t: 3, kerf: 0.1,
    lengthDividers: 3, heightDividers: 2,
  });
  const dividerL2 = panels.find((p) => p.id === 'divider-l2').points; // cruza z=76
  const dividerH1 = panels.find((p) => p.id === 'divider-h1').points; // cruza x=72 (la más cercana a v=spanY del panel; da igual cuál, todas cruzan x=72)

  // DIVIDER-L2 (spanY x dividerHeight): en la banda z=76, la mitad CERCANA
  // (u=11, dentro de [0, spanY/2]) debería estar vacía (removida), y la
  // mitad LEJANA (u=33) debería seguir siendo material.
  assert(!insidePolygonGrip({ x: 11, y: 76 }, dividerL2), 'DIVIDER-L2 en (11,76) debería estar vacío (dentro de la muesca)');
  assert(insidePolygonGrip({ x: 33, y: 76 }, dividerL2), 'DIVIDER-L2 en (33,76) debería ser material sólido');

  // DIVIDER-H1 (spanX x spanY): en la banda x=72, es justo lo opuesto — la
  // mitad CERCANA (v=11) es material, la mitad LEJANA (v=33) está vacía.
  assert(insidePolygonGrip({ x: 72, y: 11 }, dividerH1), 'DIVIDER-H1 en (72,11) debería ser material sólido');
  assert(!insidePolygonGrip({ x: 72, y: 33 }, dividerH1), 'DIVIDER-H1 en (72,33) debería estar vacío (dentro de la muesca)');
});
```

`insidePolygonGrip` ya existe en `test.html` (definida para los checks de
la agarradera) — es un point-in-polygon genérico, no específico de la
perilla; se reutiliza tal cual.

- [ ] **Step 3: Levantar el servidor y correr los checks**

```bash
node dev-server.mjs
```

Abrir `http://localhost:8000/test.html` y confirmar `✅ N/N checks OK`, con los 4 checks nuevos en verde. El último check (complementariedad del cruce) es el más importante de todo el feature: si algo en la geometría de las muescas está mal, es el que lo va a mostrar.

- [ ] **Step 4: Commit**

```bash
git add js/boxes/dividers.js test.html
git commit -m "Add buildDividerPanels and verify the cross-notch fit is complementary"
```

---

### Task 4: Conectar en `simple-box.js` (tapas "con espigas" y "plana")

**Files:**
- Modify: `js/boxes/simple-box.js`
- Test: `test.html`

**Interfaces:**
- Consumes: `buildDividerPanels`, `validateDividers`, `dividerWarnings` (Tasks 2-3).

- [ ] **Step 1: Editar `js/boxes/simple-box.js`**

Agregar el import, junto a los demás al principio del archivo:

```js
import {
  buildDividerPanels, validateDividers, dividerWarnings,
} from './dividers.js';
```

En `buildBox()`, después de la línea `const gs = gripEnabled ? gripStemSpanFor(params) : null;`, agregar:

```js
  const lengthDividers = Number.isFinite(params.lengthDividers) ? params.lengthDividers : 0;
  const heightDividers = Number.isFinite(params.heightDividers) ? params.heightDividers : 0;
```

Reemplazar:

```js
  const errors = validate({ Lo, Wo, Ho, spanX, spanY, spanZ, t, kerf, tabWidth, flatLid });
  if (gripEnabled && errors.length === 0) {
    errors.push(...validateGrip({
      t, gd, gs, spanX, spanY,
    }));
  }
  if (errors.length > 0) return { errors, warnings: [], panels: [] };
```

por:

```js
  const errors = validate({ Lo, Wo, Ho, spanX, spanY, spanZ, t, kerf, tabWidth, flatLid });
  if (gripEnabled && errors.length === 0) {
    errors.push(...validateGrip({
      t, gd, gs, spanX, spanY,
    }));
  }
  if (errors.length === 0) {
    errors.push(...validateDividers({
      lengthDividers, heightDividers, spanY, t,
    }));
  }
  if (errors.length > 0) return { errors, warnings: [], panels: [] };
```

Reemplazar:

```js
  if (gripEnabled) {
    const geo = gripGeometry({ t, gd, gs });
    panels.push(buildInsertPanel({
      spanX, spanY, gs, t, material,
    }));
    const { handleA, handleB } = buildHandlePanels(geo);
    panels.push(handleA, handleB);
  }

  return {
```

por:

```js
  if (gripEnabled) {
    const geo = gripGeometry({ t, gd, gs });
    panels.push(buildInsertPanel({
      spanX, spanY, gs, t, material,
    }));
    const { handleA, handleB } = buildHandlePanels(geo);
    panels.push(handleA, handleB);
  }

  panels.push(...buildDividerPanels({
    spanX, spanY, dividerHeight: spanZ, t, kerf, lengthDividers, heightDividers,
  }));

  return {
```

Reemplazar:

```js
    warnings: [
      ...commonWarnings({
        jointWidths: [joints.x.width, joints.y.width, joints.z.width],
        t, kerf, tabWidth,
      }),
      ...(gripEnabled ? gripWarnings({ gd, gs }) : []),
    ],
```

por:

```js
    warnings: [
      ...commonWarnings({
        jointWidths: [joints.x.width, joints.y.width, joints.z.width],
        t, kerf, tabWidth,
      }),
      ...(gripEnabled ? gripWarnings({ gd, gs }) : []),
      ...dividerWarnings({
        lengthDividers, heightDividers, spanX, dividerHeight: spanZ, t,
      }),
    ],
```

- [ ] **Step 2: Agregar los checks en `test.html`**

Agregar, después de los checks del Task 3:

```js
// --- Divisores internos: integración con buildBox() (simple-box.js) ---

check('divisores + buildBox: sin divisores, sigue dando exactamente 6 piezas (regresión)', () => {
  const withoutDividers = buildBox(BASE);
  assert(withoutDividers.errors.length === 0, withoutDividers.errors.join(' | '));
  assert(withoutDividers.panels.length === 6, `${withoutDividers.panels.length} piezas, esperaba 6`);
});

check('divisores + buildBox: con 1 divisor de largo, da 7 piezas sin errores (tapa con espigas)', () => {
  const box = buildBox({ ...BASE, lengthDividers: 1 });
  assert(box.errors.length === 0, box.errors.join(' | '));
  assert(box.panels.length === 7, `${box.panels.length} piezas, esperaba 7`);
  assert(box.panels.find((p) => p.id === 'divider-l1'), 'falta divider-l1');
});

check('divisores + buildBox: con divisores de largo Y de alto, cruzan y dan las piezas de las dos', () => {
  const box = buildBox({ ...BASE, lengthDividers: 3, heightDividers: 2 });
  assert(box.errors.length === 0, box.errors.join(' | '));
  assert(box.panels.length === 11, `${box.panels.length} piezas, esperaba 11 (6 + 3 + 2)`);
  for (const p of box.panels) assertSimplePolygon(p.points, `${p.id} (buildBox con divisores cruzados)`);
});

check('divisores + buildBox: funcionan igual con la tapa plana, con y sin agarradera', () => {
  const plain = buildBox({ ...FLAT, lengthDividers: 1 });
  assert(plain.errors.length === 0, plain.errors.join(' | '));
  assert(plain.panels.length === 7, `${plain.panels.length} piezas, esperaba 7`);

  const withGrip = buildBox({
    ...FLAT, grip: true, lengthDividers: 1, heightDividers: 1,
  });
  assert(withGrip.errors.length === 0, withGrip.errors.join(' | '));
  assert(withGrip.panels.length === 11, `${withGrip.panels.length} piezas, esperaba 11 (9 de la agarradera + 2 divisores)`);
});
```

- [ ] **Step 3: Levantar el servidor y correr los checks**

```bash
node dev-server.mjs
```

Abrir `http://localhost:8000/test.html` y confirmar `✅ N/N checks OK`, con los 4 checks nuevos en verde.

- [ ] **Step 4: Commit**

```bash
git add js/boxes/simple-box.js test.html
git commit -m "Wire dividers into the finger-joint and flat lid box (simple-box.js)"
```

---

### Task 5: Conectar en `sliding-box.js`

**Files:**
- Modify: `js/boxes/sliding-box.js`
- Test: `test.html`

**Interfaces:**
- Consumes: `buildDividerPanels`, `validateDividers`, `dividerWarnings` (Tasks 2-3).

- [ ] **Step 1: Editar `js/boxes/sliding-box.js`**

Agregar el import:

```js
import {
  buildDividerPanels, validateDividers, dividerWarnings,
} from './dividers.js';
```

En `buildSlidingBox()`, después de la línea que desestructura `slidingHeights(params)` (`const { Lo, Wo, Ho, t, tl, h, p, grooveFloor, grooveTop, wallHeight, frontHeight, innerHeight } = slidingHeights(params);`), agregar:

```js
  const lengthDividers = Number.isFinite(params.lengthDividers) ? params.lengthDividers : 0;
  const heightDividers = Number.isFinite(params.heightDividers) ? params.heightDividers : 0;
```

Reemplazar:

```js
  const errors = validate({
    Lo, Wo, Ho, t, tl, h, p, kerf, tabWidth,
    spanX, spanY, spanZFront, spanZBack, frontHeight,
  });
  if (errors.length > 0) return { errors, warnings: [], panels: [] };
```

por:

```js
  const errors = validate({
    Lo, Wo, Ho, t, tl, h, p, kerf, tabWidth,
    spanX, spanY, spanZFront, spanZBack, frontHeight,
  });
  if (errors.length === 0) {
    errors.push(...validateDividers({ lengthDividers, heightDividers, spanY, t }));
  }
  if (errors.length > 0) return { errors, warnings: [], panels: [] };
```

Reemplazar:

```js
  const material = { thickness: t, kerf, tabWidth };
  const panels = specs.map((spec) => ({ ...spec, points: panelOutline(spec, material) }));
  const lid = panels.find((panel) => panel.id === 'lid');
```

por:

```js
  const material = { thickness: t, kerf, tabWidth };
  const panels = specs.map((spec) => ({ ...spec, points: panelOutline(spec, material) }));
  const lid = panels.find((panel) => panel.id === 'lid');
  panels.push(...buildDividerPanels({
    spanX, spanY, dividerHeight: innerHeight, t, kerf, lengthDividers, heightDividers,
  }));
```

Reemplazar:

```js
    warnings: warningsFor({
      jointWidths: [joints.x.width, joints.y.width, joints.z.width, joints.zBack.width],
      t, kerf, tabWidth, p, h, tl, backSegment: joints.zBack.width,
      lidWidth: lid.width, lidDepth: lid.height,
    }),
```

por:

```js
    warnings: [
      ...warningsFor({
        jointWidths: [joints.x.width, joints.y.width, joints.z.width, joints.zBack.width],
        t, kerf, tabWidth, p, h, tl, backSegment: joints.zBack.width,
        lidWidth: lid.width, lidDepth: lid.height,
      }),
      ...dividerWarnings({ lengthDividers, heightDividers, spanX, dividerHeight: innerHeight, t }),
    ],
```

- [ ] **Step 2: Agregar los checks en `test.html`**

Agregar, después de los checks del Task 4:

```js
// --- Divisores internos: integración con buildSlidingBox() (sliding-box.js) ---

check('divisores + buildSlidingBox: sin divisores, sigue dando exactamente 6 piezas (regresión)', () => {
  const box = buildSlidingBox(SLIDE);
  assert(box.errors.length === 0, box.errors.join(' | '));
  assert(box.panels.length === 6, `${box.panels.length} piezas, esperaba 6`);
});

check('divisores + buildSlidingBox: con divisores de largo y de alto, cruzan y dan las piezas de las dos', () => {
  const box = buildSlidingBox({ ...SLIDE, lengthDividers: 2, heightDividers: 1 });
  assert(box.errors.length === 0, box.errors.join(' | '));
  assert(box.panels.length === 9, `${box.panels.length} piezas, esperaba 9 (6 + 2 + 1)`);
  for (const p of box.panels) assertSimplePolygon(p.points, `${p.id} (buildSlidingBox con divisores)`);
});
```

- [ ] **Step 3: Levantar el servidor y correr los checks**

```bash
node dev-server.mjs
```

Abrir `http://localhost:8000/test.html` y confirmar `✅ N/N checks OK`, con los 2 checks nuevos en verde.

- [ ] **Step 4: Commit**

```bash
git add js/boxes/sliding-box.js test.html
git commit -m "Wire dividers into the sliding lid box"
```

---

### Task 6: Conectar en `hinged-box.js`

**Files:**
- Modify: `js/boxes/hinged-box.js`
- Test: `test.html`

**Interfaces:**
- Consumes: `buildDividerPanels`, `validateDividers`, `dividerWarnings` (Tasks 2-3).

- [ ] **Step 1: Editar `js/boxes/hinged-box.js`**

Agregar el import:

```js
import {
  buildDividerPanels, validateDividers, dividerWarnings,
} from './dividers.js';
```

En `buildHingedBox()`, después de la línea `const spanZ = wallHeight - 2 * t; // juntas verticales, iguales en las cuatro paredes`, agregar:

```js
  const lengthDividers = Number.isFinite(params.lengthDividers) ? params.lengthDividers : 0;
  const heightDividers = Number.isFinite(params.heightDividers) ? params.heightDividers : 0;
```

Reemplazar:

```js
  const errors = validate({
    Lo, Wo, Ho, t, tl, ps, hc, kerf, tabWidth, spanX, spanY, spanZ, hw, hd,
  });
  if (errors.length > 0) return { errors, warnings: [], panels: [] };
```

por:

```js
  const errors = validate({
    Lo, Wo, Ho, t, tl, ps, hc, kerf, tabWidth, spanX, spanY, spanZ, hw, hd,
  });
  if (errors.length === 0) {
    errors.push(...validateDividers({ lengthDividers, heightDividers, spanY, t }));
  }
  if (errors.length > 0) return { errors, warnings: [], panels: [] };
```

Reemplazar:

```js
  const panels = [generic.bottom, front, left, lid, generic.back, right];

  return {
    panels,
```

por:

```js
  const dividerPanels = buildDividerPanels({
    spanX, spanY, dividerHeight: wallHeight - t, t, kerf, lengthDividers, heightDividers,
  });
  const panels = [generic.bottom, front, left, lid, generic.back, right, ...dividerPanels];

  return {
    panels,
```

Reemplazar:

```js
    warnings: warningsFor({
      jointWidths: [joints.x.width, joints.y.width, joints.z.width],
      t, kerf, tabWidth, hc, rh, postWidth, spanY, hw, Lo,
    }),
```

por:

```js
    warnings: [
      ...warningsFor({
        jointWidths: [joints.x.width, joints.y.width, joints.z.width],
        t, kerf, tabWidth, hc, rh, postWidth, spanY, hw, Lo,
      }),
      ...dividerWarnings({ lengthDividers, heightDividers, spanX, dividerHeight: wallHeight - t, t }),
    ],
```

- [ ] **Step 2: Agregar los checks en `test.html`**

`test.html` ya define, para los checks de bisagra existentes, una
constante `HINGED` (`{ length: 80, width: 80, height: 80, thickness: 3,
kerf: 0.16, tabWidth: 12, dimensionMode: 'outer', lidType: 'hinged' }`,
buscar `const HINGED = {`) — reusarla tal cual, no declarar una nueva.
Agregar, después de los checks del Task 5 (fuera de cualquier otro
bloque, al mismo nivel que los demás `check(...)`):

```js
check('divisores + buildHingedBox: sin divisores, sigue dando exactamente 6 piezas (regresión)', () => {
  const box = buildHingedBox(HINGED);
  assert(box.errors.length === 0, box.errors.join(' | '));
  assert(box.panels.length === 6, `${box.panels.length} piezas, esperaba 6`);
});

check('divisores + buildHingedBox: con divisores de largo y de alto, cruzan y dan las piezas de las dos', () => {
  const box = buildHingedBox({ ...HINGED, lengthDividers: 1, heightDividers: 2 });
  assert(box.errors.length === 0, box.errors.join(' | '));
  assert(box.panels.length === 9, `${box.panels.length} piezas, esperaba 9 (6 + 1 + 2)`);
  for (const p of box.panels) assertSimplePolygon(p.points, `${p.id} (buildHingedBox con divisores)`);
});
```

- [ ] **Step 3: Levantar el servidor y correr los checks**

```bash
node dev-server.mjs
```

Abrir `http://localhost:8000/test.html` y confirmar `✅ N/N checks OK`, con los 2 checks nuevos en verde.

- [ ] **Step 4: Commit**

```bash
git add js/boxes/hinged-box.js test.html
git commit -m "Wire dividers into the hinged lid box"
```

---

### Task 7: Wiring en la interfaz (`index.html` + `js/ui/app.js`)

**Files:**
- Modify: `index.html`
- Modify: `js/ui/app.js`

**Interfaces:**
- Consumes: `buildBox`/`buildSlidingBox`/`buildHingedBox` ya actualizados (Tasks 4-6).
- Produces: dos campos numéricos ("Divisores de largo", "Divisores de alto") visibles siempre, en 0 por default.

- [ ] **Step 1: Editar `index.html`**

Dentro del `fieldset` "Dimensiones", justo después del bloque `<div class="field flat-fields" id="flatFields" hidden> ... </div>` y antes del `</fieldset>` que lo cierra, agregar:

```html
          <div class="field">
            <span class="field-label">Divisores internos</span>
            <div class="field">
              <label for="lengthDividers">Divisores de largo</label>
              <input type="number" id="lengthDividers" name="lengthDividers" value="0" step="1" min="0" inputmode="numeric">
            </div>
            <div class="field">
              <label for="heightDividers">Divisores de alto</label>
              <input type="number" id="heightDividers" name="heightDividers" value="0" step="1" min="0" inputmode="numeric">
            </div>
            <p class="help">
              Parten el interior en compartimentos: "de largo" agrega
              columnas a lo largo del eje Largo, "de alto" agrega capas
              apiladas en altura. Se reparten solos, a distancias iguales.
              Usando los dos tipos a la vez se cruzan con una ranura a
              media madera y quedan sueltos a presión, sin espigas hacia
              las paredes.
            </p>
          </div>
```

- [ ] **Step 2: Editar `js/ui/app.js`**

Agregar, junto a las demás constantes `const ... = document.getElementById(...)` al principio del archivo:

```js
const lengthDividersEl = document.getElementById('lengthDividers');
const heightDividersEl = document.getElementById('heightDividers');
```

Dentro de `readParams()`, después de la línea `tabWidth: number('tabWidth'),` en el objeto `params` inicial, agregar dos propiedades:

```js
  const params = {
    length: number('length'),
    width: number('width'),
    height: number('height'),
    thickness: number('thickness'),
    kerf: number('kerf'),
    dimensionMode: form.elements.dimensionMode.value,
    lidType,
    tabWidth: number('tabWidth'),
    lengthDividers: number('lengthDividers'),
    heightDividers: number('heightDividers'),
  };
```

(Reemplaza el objeto `params` completo tal como está hoy en `readParams()`, solo con esas dos líneas nuevas al final.)

En `recompute()`, reemplazar:

```js
  const dims = (d) => `${round(d.length, 1)} × ${round(d.width, 1)} × ${round(d.height, 1)} mm`;
  const realHeight = box.realOuterHeight
    ? ` (alto real con reborde: ${round(box.realOuterHeight, 1)})`
    : '';
  summaryEl.textContent =
    `Exterior ${dims(box.outer)}${realHeight} · Interior ${dims(box.inner)} · ` +
    `Hoja ${currentSvg.getAttribute('width')} × ${currentSvg.getAttribute('height')} · ` +
    `Espigas ${box.joints.x.tabs}/${box.joints.y.tabs}/${box.joints.z.tabs} por junta (largo/ancho/alto)`;
```

por:

```js
  const dims = (d) => `${round(d.length, 1)} × ${round(d.width, 1)} × ${round(d.height, 1)} mm`;
  const realHeight = box.realOuterHeight
    ? ` (alto real con reborde: ${round(box.realOuterHeight, 1)})`
    : '';
  const Nc = Number.isFinite(params.lengthDividers) ? params.lengthDividers : 0;
  const Ns = Number.isFinite(params.heightDividers) ? params.heightDividers : 0;
  const compartments = (Nc > 0 || Ns > 0) ? ` · Compartimentos ${Nc + 1} × ${Ns + 1}` : '';
  summaryEl.textContent =
    `Exterior ${dims(box.outer)}${realHeight} · Interior ${dims(box.inner)} · ` +
    `Hoja ${currentSvg.getAttribute('width')} × ${currentSvg.getAttribute('height')} · ` +
    `Espigas ${box.joints.x.tabs}/${box.joints.y.tabs}/${box.joints.z.tabs} por junta (largo/ancho/alto)${compartments}`;
```

- [ ] **Step 3: Verificar en el navegador**

```bash
node dev-server.mjs
```

Con `agent-browser` (o el navegador):
1. Abrir `http://localhost:8000/`. Deberían verse los campos "Divisores de largo" y "Divisores de alto", ambos en 0, visibles sin importar qué tapa esté elegida.
2. Poner "Divisores de largo" en 2 — la vista previa debería agregar 2 piezas nuevas (DIVIDER-L1, DIVIDER-L2) y el resumen debería decir "Compartimentos 3 × 1".
3. Poner además "Divisores de alto" en 1 — deberían aparecer también DIVIDER-H1, y el resumen "Compartimentos 3 × 2"; las piezas DIVIDER-L deberían mostrar una muesca visible en el borde izquierdo.
4. Cambiar de tapa (por ejemplo a "Deslizante" o "Con bisagra") con los divisores puestos — el conteo de piezas debería seguir sumando los divisores sin errores.
5. Sacar una captura de pantalla del resultado con divisores de los dos tipos activos y confirmar a ojo que las piezas DIVIDER-L y DIVIDER-H muestran sus muescas.

- [ ] **Step 4: Commit**

```bash
git add index.html js/ui/app.js
git commit -m "Wire the divider count fields into the form"
```

---

### Task 8: Documentación y verificación final

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Actualizar `README.md`**

En la tabla de "Los parámetros", agregar dos filas nuevas al final de la tabla:

```
| Divisores de largo | 0 | Cuántos divisores verticales parten la caja en columnas a lo largo del eje Largo. Se reparten solos, a distancias iguales. |
| Divisores de alto | 0 | Cuántos divisores horizontales (estantes) parten la caja en capas apiladas en altura. Se reparten solos, a distancias iguales. Usando los dos tipos de divisor a la vez, se cruzan con una ranura a media madera. |
```

En "Cómo está hecho", reemplazar la línea:

```
- `js/boxes/` — los tipos de caja concretos: `simple-box.js` (caja cerrada y tapa plana), `sliding-box.js` (tapa deslizante), `hinged-box.js` (tapa con bisagra), `lid-grip.js` (agarradera de la tapa plana: perilla en dos piezas y el agujero en cruz, reutilizada por `simple-box.js`) y `shared.js` con lo que todos comparten.
```

por:

```
- `js/boxes/` — los tipos de caja concretos: `simple-box.js` (caja cerrada y tapa plana), `sliding-box.js` (tapa deslizante), `hinged-box.js` (tapa con bisagra), `lid-grip.js` (agarradera de la tapa plana), `dividers.js` (divisores internos: columnas, capas y su ranura de cruce, reutilizado por los tres tipos de caja) y `shared.js` con lo que todos comparten.
```

En "Verificación", actualizar el número de checks al total real después de correr la suite completa (ver Step 2) — buscar la frase "Actualmente son **N checks**" y reemplazar el número.

- [ ] **Step 2: Correr la suite completa y confirmar el número final de checks**

```bash
node dev-server.mjs
```

Abrir `http://localhost:8000/test.html`, confirmar `✅ N/N checks OK` (sin ningún rojo), y usar ese `N` para actualizar el texto de "Verificación" en `README.md` si el número cambió desde el Step 1.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "Document internal dividers"
```

---

## Autorrevisión del plan (spec vs. plan)

- **Cobertura del spec:** las dos piezas y sus posiciones parejas (Task 1), validaciones y avisos de la tabla del spec (Task 2), la ranura de cruce complementaria — el corazón del feature — con un check dedicado a probarlo numéricamente (Task 3), disponibilidad en las 4 tapas (Tasks 4-6), campos de UI siempre visibles (Task 7), documentación (Task 8). Sin huecos encontrados contra el spec.
- **Placeholders:** ninguno — cada step trae el código completo, sin "TBD" ni "agregar validación" sin mostrar cuál.
- **Consistencia de tipos:** `buildDividerPanels`, `validateDividers` y `dividerWarnings` usan los mismos nombres de parámetro (`lengthDividers`, `heightDividers`, `spanX`, `spanY`, `dividerHeight`, `t`, `kerf`) en las Tasks 2, 3, 4, 5 y 6 — verificado línea por línea contra las firmas declaradas en cada bloque de "Interfaces".
