# Divisores de largo y de ancho — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar los divisores de alto (estantes, que sellan la mitad inferior de la caja) por divisores de ancho: placas verticales que cruzan a las de largo y dejan todo compartimento abierto por arriba.

**Architecture:** Los dos tipos de divisor pasan a ser la misma clase de pieza — placa vertical de alto interior completo — así que las dos funciones que hoy las dibujan se unifican en `buildDividerPoints`, con un parámetro que dice desde qué canto se entalla la ranura de cruce. Cada tipo de caja sigue poniendo las ranuras de cejilla en coordenadas de su propia pared; lo único que cambia ahí es que la ranura del divisor de ancho pasa de horizontal a vertical.

**Tech Stack:** JavaScript ES modules, sin dependencias, sin build step. Self-checks en `test.html`, corridos en el navegador.

**Spec:** `docs/superpowers/specs/2026-10-31-divisores-largo-ancho-design.md`. Léelo entero antes de empezar. El spec previo `2026-10-26-divisores-con-cejilla-design.md` explica el mecanismo de cejilla que acá se conserva.

## Global Constraints

- **Rama:** `divisiones-con-tab`, encima del trabajo de la cejilla que ya está en el árbol sin commitear. No trabajar sobre `main`.
- **Commits:** Dani no quiere commits automáticos. Ningún paso commitea; el trabajo se queda en el árbol. Nunca `git push`.
- **Ejes:** X = largo, Y = ancho, Z = alto. Las paredes FRONT/BACK están a Y constante y miden `Lo` de ancho; LEFT/RIGHT están a X constante y miden `spanY`.
- **El divisor de largo** se sitúa a X constante, mide `spanY` × alto interior, y clava sus cejillas en FRONT/BACK.
- **El divisor de ancho** se sitúa a Y constante, mide `spanX` × alto interior, y clava sus cejillas en LEFT/RIGHT.
- **Ranura de cruce:** profundidad = alto interior ÷ 2; ancho = grosor − kerf. Largo entalla desde ABAJO, ancho desde ARRIBA.
- **Parámetro:** `heightDividers` desaparece; nace `widthDividers`. Ids `divider-w{j}`, etiquetas `DIVIDER-W{j}`, ranuras `divider-slot-w{j}`.
- **Textos:** español, mismo tono que los existentes. Comentarios de código en español, explicando el porqué.
- **Mensajes de error (copia exacta):**
  - `El alto interior de ${dividerHeight.toFixed(1)} mm es demasiado bajo para cruzar divisores de largo y de ancho: la ranura no deja material suficiente.`
  - `La ranura de un divisor en ${label} queda a menos de ${t} mm de otro corte de la pared.` (`slotTooClose`, ya existe)
  - `Un divisor de ancho queda dentro de la franja que barre la tapa al abrir: usa menos divisores de ancho.`
- **Avisos (copia exacta):**
  - `Los compartimentos de largo quedan de ${v} mm, muy angostos para ${t} mm de material.`
  - `Los compartimentos de ancho quedan de ${v} mm, muy angostos para ${t} mm de material.`

## Cómo correr las pruebas

```bash
cd "/Users/danmo/Library/CloudStorage/OneDrive-Personal/Documents/Daniel/Claude Projects/BoxMaker"
PORT=8765 node dev-server.mjs &   # deja el servidor corriendo
agent-browser open http://localhost:8765/test.html && agent-browser wait 3000
agent-browser eval "(()=>{const t=document.body.innerText;return {summary:document.getElementById('summary').textContent, fails:t.split('\n').filter(l=>l.includes('✘'))}})()"
```

Para recargar después de un cambio: `agent-browser reload && agent-browser wait 3000` y repetir el `eval`. Al terminar: `pkill -f dev-server.mjs; agent-browser close`.

**Línea base: correr los checks ANTES de tocar nada y anotar el total.** Todo check que no sea de divisores debe seguir pasando en cada tarea.

## Review Focus

1. **Caja sin divisores, en los cinco tipos de tapa.** Debe salir idéntica a hoy: mismos paneles, mismos puntos. Lo cubren las Tasks 3, 4 y 5.
2. **Un solo tipo de divisor.** Con divisores de ancho y ninguno de largo, la placa sale lisa, sin ranura de cruce, y al revés igual. Lo cubre la Task 1.
3. **Caja muy baja.** Si la mitad del alto interior no supera el grosor, el cruce no deja material: debe salir el error, no una pieza partida. Lo cubre la Task 1.
4. **Compartimento justo en modo cejilla.** Si entre el extremo de una placa y la primera ranura de cruce no queda un grosor de material, debe salir `slotTooClose`, no una pared debilitada. Lo cubre la Task 2.
5. **Bisagra con divisores de ancho al fondo.** Un divisor de ancho dentro de la franja que barre la cola de la tapa traba la tapa: debe salir error. Lo cubre la Task 5.

---

### Task 1: Núcleo en `dividers.js` — las dos placas y el cruce

**Files:**
- Modify: `js/boxes/dividers.js`
- Test: `test.html` (reemplazar los checks de `buildLengthDividerPoints` / `buildHeightDividerPoints` / `validateDividers` / `dividerWarnings` / `buildDividerPanels`)

**Interfaces:**
- Produces:
  - `buildDividerPoints({ width, height, notchEdge, notchDepth, notchWidth, positions, topCornerCut, tab }) -> Point[]` — `notchEdge` es `'bottom'` o `'top'`. Reemplaza y borra `buildLengthDividerPoints` y `buildHeightDividerPoints`.
  - `buildDividerPanels({ spanX, spanY, dividerHeight, t, kerf, lengthDividers, widthDividers, topCornerCut, tabs }) -> Panel[]`
  - `validateDividers({ lengthDividers, widthDividers, dividerHeight, t }) -> string[]`
  - `dividerWarnings({ lengthDividers, widthDividers, spanX, spanY, t }) -> string[]`
  - `evenPositions` no cambia.

- [ ] **Step 1: Correr los checks de hoy y anotar el total**

Run: el bloque de "Cómo correr las pruebas".
Expected: el `summary` dice `N/N`. Anotar `N`.

- [ ] **Step 2: Escribir los checks que fallan**

En `test.html`, reemplazar los checks viejos de divisores por estos (mismo estilo `check(nombre, fn)`):

```js
check('divisores: buildDividerPoints sin posiciones da un rectángulo liso de 4 puntos', () => {
  const pts = buildDividerPoints({ width: 44, height: 114, notchEdge: 'bottom', notchDepth: 57, notchWidth: 2.9, positions: [] });
  assert(pts.length === 4, `${pts.length} puntos, esperaba 4`);
  assertSimplePolygon(pts, 'buildDividerPoints sin muescas');
});

check('divisores: la placa de largo entalla desde abajo y la de ancho desde arriba', () => {
  const abajo = buildDividerPoints({ width: 44, height: 114, notchEdge: 'bottom', notchDepth: 57, notchWidth: 2.9, positions: [22] });
  const arriba = buildDividerPoints({ width: 44, height: 114, notchEdge: 'top', notchDepth: 57, notchWidth: 2.9, positions: [22] });
  assert(abajo.some((p) => p.y === 114) && abajo.some((p) => p.y === 57), 'la muesca de abajo va de y=114 a y=57');
  assert(arriba.some((p) => p.y === 0) && arriba.some((p) => p.y === 57), 'la muesca de arriba va de y=0 a y=57');
  assertSimplePolygon(abajo, 'placa de largo');
  assertSimplePolygon(arriba, 'placa de ancho');
});

check('divisores: las dos placas tienen el mismo alto y cruzan a media madera', () => {
  const panels = buildDividerPanels({ spanX: 144, spanY: 44, dividerHeight: 114, t: 3, kerf: 0.1, lengthDividers: 1, widthDividers: 1 });
  const l = boundingBox(panels.find((p) => p.id === 'divider-l1').points);
  const w = boundingBox(panels.find((p) => p.id === 'divider-w1').points);
  assert(l.height === 114 && w.height === 114, `altos ${l.height} y ${w.height}, esperaba 114 los dos`);
  assert(l.width === 44, `la placa de largo mide ${l.width} de ancho, esperaba 44 (spanY)`);
  assert(w.width === 144, `la placa de ancho mide ${w.width} de ancho, esperaba 144 (spanX)`);
});

check('divisores: buildDividerPanels nombra DIVIDER-L y DIVIDER-W', () => {
  const panels = buildDividerPanels({ spanX: 144, spanY: 44, dividerHeight: 114, t: 3, kerf: 0.1, lengthDividers: 3, widthDividers: 2 });
  assert(panels.length === 5, `${panels.length} piezas, esperaba 5`);
  for (const id of ['divider-l1', 'divider-l2', 'divider-l3', 'divider-w1', 'divider-w2']) {
    assert(panels.some((p) => p.id === id), `falta ${id}`);
  }
});

check('divisores: sin divisores de ancho, la placa de largo sale lisa', () => {
  const panels = buildDividerPanels({ spanX: 144, spanY: 44, dividerHeight: 114, t: 3, kerf: 0.1, lengthDividers: 1, widthDividers: 0 });
  assert(panels[0].points.length === 4, 'DIVIDER-L1 debería ser un rectángulo liso de 4 puntos');
});

check('divisores: validateDividers da error si el cruce no deja material (alto/2 <= t)', () => {
  const errors = validateDividers({ lengthDividers: 1, widthDividers: 1, dividerHeight: 5, t: 3 });
  assert(errors.length === 1, `${errors.length} errores, esperaba 1`);
  const unSoloTipo = validateDividers({ lengthDividers: 1, widthDividers: 0, dividerHeight: 5, t: 3 });
  assert(unSoloTipo.length === 0, 'sin cruce no hay nada que validar');
});

check('divisores: dividerWarnings avisa por largo y por ancho', () => {
  const w = dividerWarnings({ lengthDividers: 20, widthDividers: 20, spanX: 144, spanY: 44, t: 3 });
  assert(w.length === 2, `${w.length} avisos, esperaba 2 (largo y ancho)`);
  assert(w.some((m) => m.includes('de largo')) && w.some((m) => m.includes('de ancho')), 'falta uno de los dos avisos');
});
```

- [ ] **Step 3: Correr y verificar que fallan**

Expected: fallan los checks nuevos con `buildDividerPoints is not defined` y `widthDividers` ignorado.

- [ ] **Step 4: Implementar en `js/boxes/dividers.js`**

- `buildDividerPoints` sustituye a las dos funciones de hoy. Recorrido horario; con `notchEdge: 'bottom'` las muescas se entallan desde `y = height` hacia arriba (lo que hoy hace `buildHeightDividerPoints`), con `'top'` desde `y = 0` hacia abajo. `topCornerCut` y `tab` se comportan igual que hoy, sobre los cantos `x = 0` y `x = width`.
- `buildDividerPanels` llama a `buildDividerPoints` dos veces: la de largo con `width: spanY`, `notchEdge: 'bottom'`, `positions: evenPositions(spanY, widthDividers)`; la de ancho con `width: spanX`, `notchEdge: 'top'`, `positions: evenPositions(spanX, lengthDividers)`. Las dos con `height: dividerHeight` y `notchDepth: dividerHeight / 2`.
- `validateDividers` cambia su comprobación de `spanY / 2 <= t` a `dividerHeight / 2 <= t`.
- `dividerWarnings` mide los compartimentos sobre `spanX` y `spanY` (ya no sobre el alto).

- [ ] **Step 5: Correr y verificar que pasan**

Expected: pasan los checks nuevos; el resto de los checks de la Task 1 en adelante fallarán hasta que las cajas se actualicen (Tasks 3–5). Anotar cuáles.

---

### Task 2: Cejillas y validación horizontal

**Files:**
- Modify: `js/boxes/dividers.js`
- Test: `test.html` (checks de `lengthTabCenter` y `planDividerTabs`)

**Interfaces:**
- Consumes: `buildDividerPanels` y `evenPositions` de la Task 1.
- Produces:
  - `tabCenter({ dividerHeight, tabWidth, t, topCutDepth }) -> number | null` — reemplaza `lengthTabCenter`; ya no recibe `notchPositions`.
  - `planDividerTabs({ dividerMode, lengthDividers, widthDividers, spanX, spanY, dividerHeight, t, lengthTabWidth, widthTabWidth, widthProtrude, topCutDepth }) -> { errors, tabs }` con `tabs: { length: {width, center, protrude} | null, width: {width, center, protrude} | null }`.
  - Se borra la constante `NO_TAB_ROOM`; se borra `shelfTooNarrow`.

- [ ] **Step 1: Escribir los checks que fallan**

```js
check('cejilla: tabCenter va a media altura cuando nada se lo impide', () => {
  assert(tabCenter({ dividerHeight: 114, tabWidth: 10, t: 3 }) === 57, 'esperaba 57');
});

check('cejilla: tabCenter baja la cejilla si el recorte de la bisagra ocupa la media altura', () => {
  const c = tabCenter({ dividerHeight: 40, tabWidth: 10, t: 3, topCutDepth: 25 });
  assert(c !== null && c < 20, `esperaba una altura por debajo de 20, dio ${c}`);
});

check('cejilla: planDividerTabs pone cejilla a los dos tipos, a la misma altura', () => {
  const { errors, tabs } = planDividerTabs({
    dividerMode: 'tabbed', lengthDividers: 1, widthDividers: 1,
    spanX: 144, spanY: 44, dividerHeight: 114, t: 3,
    lengthTabWidth: 10, widthTabWidth: 10,
  });
  assert(errors.length === 0, errors.join(' | '));
  assert(tabs.length.center === tabs.width.center, 'las dos cejillas van a la misma altura');
});

check('cejilla: error si entre el extremo y la primera ranura de cruce no queda material', () => {
  const { errors } = planDividerTabs({
    dividerMode: 'tabbed', lengthDividers: 1, widthDividers: 20,
    spanX: 144, spanY: 44, dividerHeight: 114, t: 3,
    lengthTabWidth: 10, widthTabWidth: 10,
  });
  assert(errors.some((m) => m.includes('FRONT/BACK')), `esperaba slotTooClose de FRONT/BACK, dio: ${errors.join(' | ')}`);
});

check('cejilla: modo suelto no devuelve cejillas', () => {
  const { tabs } = planDividerTabs({
    dividerMode: 'loose', lengthDividers: 1, widthDividers: 1,
    spanX: 144, spanY: 44, dividerHeight: 114, t: 3,
    lengthTabWidth: 10, widthTabWidth: 10,
  });
  assert(tabs === null, 'en modo suelto no hay cejillas');
});
```

- [ ] **Step 2: Correr y verificar que fallan**

- [ ] **Step 3: Implementar**

- `tabCenter` es `lengthTabCenter` sin `notchPositions`: media altura si cabe (necesita `tabWidth / 2 + t` de margen arriba y abajo), y si el recorte superior la invade, la altura libre más cercana a la media; en empate, la de abajo. Devuelve `null` si no hay ninguna.
- `planDividerTabs` calcula un solo `center` con `tabCenter` y se lo da a los dos tipos. Antes de aceptar, comprueba la separación horizontal: con divisores de ancho presentes, `spanY / (widthDividers + 1) >= 1.5 * t` o `slotTooClose('FRONT/BACK', t)`; con divisores de largo presentes, `spanX / (lengthDividers + 1) >= 1.5 * t` o `slotTooClose('LEFT/RIGHT', t)`. `protrude` es `t` para el de largo y `widthProtrude ?? t` para el de ancho.

- [ ] **Step 4: Correr y verificar que pasan**

---

### Task 3: `simple-box.js` — tapa con espigas y tapa plana

**Files:**
- Modify: `js/boxes/simple-box.js:50-125`, `js/boxes/simple-box.js:214-234`
- Test: `test.html`

**Interfaces:**
- Consumes: todo lo de las Tasks 1 y 2.

- [ ] **Step 1: Escribir los checks que fallan**

```js
check('caja simple: el divisor de ancho llega del piso al techo y cruza al de largo', () => {
  const box = buildBox({ ...BASE, lengthDividers: 1, widthDividers: 1 });
  assert(box.errors.length === 0, box.errors.join(' | '));
  const l = boundingBox(box.panels.find((p) => p.id === 'divider-l1').points);
  const w = boundingBox(box.panels.find((p) => p.id === 'divider-w1').points);
  assert(l.height === w.height, `alturas distintas: ${l.height} y ${w.height}`);
});

check('caja simple: sin divisores sale idéntica a no pasar el parámetro', () => {
  const sin = buildBox({ ...BASE });
  const cero = buildBox({ ...BASE, lengthDividers: 0, widthDividers: 0 });
  assert(JSON.stringify(sin.panels) === JSON.stringify(cero.panels), 'los paneles deberían ser idénticos');
});

check('caja simple: la ranura de la cejilla de ancho es vertical en LEFT/RIGHT', () => {
  const box = buildBox({ ...BASE, lengthDividers: 0, widthDividers: 1, dividerMode: 'tabbed' });
  assert(box.errors.length === 0, box.errors.join(' | '));
  const left = box.panels.find((p) => p.id === 'left');
  const slot = left.features.find((f) => f.id === 'divider-slot-w1');
  const b = boundingBox(slot.points);
  assert(b.height > b.width, `la ranura debería ser más alta que ancha, dio ${b.width}×${b.height}`);
});
```

- [ ] **Step 2: Correr y verificar que fallan**

- [ ] **Step 3: Implementar**

Renombrar `heightDividers` → `widthDividers` en la lectura de parámetros y en las llamadas a `validateDividers`, `planDividerTabs`, `buildDividerPanels` y `dividerWarnings`, con los argumentos nuevos de cada una. Las ranuras de LEFT/RIGHT (`divider-slot-w{j}`) pasan a calcularse como las de FRONT/BACK pero sobre el eje Y: `x0/x1` = `y_j ± t/2` con `y_j` de `evenPositions(spanY, widthDividers)`, y `y0/y1` = la altura de la cejilla ± `widthTabWidth / 2`, en coordenadas de la pared lateral (ancho `spanY`).

- [ ] **Step 4: Correr y verificar que pasan**

---

### Task 4: `sliding-box.js` y `sliding-support-box.js`

**Files:**
- Modify: `js/boxes/sliding-box.js:90-160`, `js/boxes/sliding-box.js:250-275`
- Modify: `js/boxes/sliding-support-box.js:90-145`, `js/boxes/sliding-support-box.js:270-295`
- Test: `test.html`

**Interfaces:**
- Consumes: todo lo de las Tasks 1 y 2.

- [ ] **Step 1: Escribir los checks que fallan**

```js
check('deslizante: el divisor de ancho no estorba el canal de la tapa', () => {
  const box = buildSlidingBox({ ...SLIDING, lengthDividers: 1, widthDividers: 1, dividerMode: 'tabbed' });
  assert(box.errors.length === 0, box.errors.join(' | '));
});

check('soportes: el divisor de ancho mide el largo útil y su cejilla cruza el soporte', () => {
  const box = buildSlidingSupportBox({ ...SUPPORTS, lengthDividers: 1, widthDividers: 1, dividerMode: 'tabbed' });
  assert(box.errors.length === 0, box.errors.join(' | '));
  const w = boundingBox(box.panels.find((p) => p.id === 'divider-w1').points);
  const l = boundingBox(box.panels.find((p) => p.id === 'divider-l1').points);
  assert(w.height === l.height, `alturas distintas: ${w.height} y ${l.height}`);
});

check('soportes: la caja de Dani (100x100x80, t=2.75) ya no produce compartimentos tapados', () => {
  const box = buildSlidingSupportBox({
    length: 100, width: 100, height: 80, thickness: 2.75, kerf: 0.16,
    dimensionMode: 'outer', tabWidth: 10, lengthDividers: 1, widthDividers: 1,
  });
  assert(box.errors.length === 0, box.errors.join(' | '));
  assert(!box.panels.some((p) => p.id.startsWith('divider-h')), 'no debería quedar ninguna pieza DIVIDER-H');
});
```

- [ ] **Step 2: Correr y verificar que fallan**

- [ ] **Step 3: Implementar**

Mismo renombre y mismo cambio de ranura que en la Task 3. En `sliding-support-box.js`, el divisor de ancho usa `usableX` como ancho de pieza (los soportes le comen un grosor por lado) y su cejilla mantiene `widthProtrude: 2 * t` para cruzar soporte y pared. El divisor de largo no cambia.

- [ ] **Step 4: Correr y verificar que pasan**

---

### Task 5: `hinged-box.js` y la franja que barre la tapa

**Files:**
- Modify: `js/boxes/hinged-box.js:317-345`, `js/boxes/hinged-box.js:395-421`
- Modify: `js/boxes/dividers.js` (mensaje nuevo)
- Test: `test.html`

**Interfaces:**
- Consumes: todo lo de las Tasks 1 y 2.
- Produces: `sweptBandError` en `dividers.js`, con el texto exacto de Global Constraints.

- [ ] **Step 1: Escribir los checks que fallan**

```js
check('bisagra: divisores de ancho normales no estorban la tapa', () => {
  const box = buildHingedBox({ ...HINGED, lengthDividers: 1, widthDividers: 1 });
  assert(box.errors.length === 0, box.errors.join(' | '));
});

check('bisagra: un divisor de ancho dentro de la franja barrida da error', () => {
  const box = buildHingedBox({ ...HINGED, lengthDividers: 0, widthDividers: 40 });
  assert(box.errors.some((m) => m.includes('barre la tapa')), `esperaba el error de la franja, dio: ${box.errors.join(' | ')}`);
});

check('bisagra: el divisor de largo conserva el recorte de sus dos esquinas superiores', () => {
  const box = buildHingedBox({ ...HINGED, lengthDividers: 1, widthDividers: 0 });
  const l = box.panels.find((p) => p.id === 'divider-l1');
  assert(l.points.length > 4, 'la placa de largo debería traer los recortes de esquina');
});
```

- [ ] **Step 2: Correr y verificar que fallan**

- [ ] **Step 3: Implementar**

Mismo renombre que en las Tasks 3 y 4. `dividerTopCut` se le sigue aplicando sólo al divisor de largo. Para los de ancho, comprobar que ninguna posición de `evenPositions(spanY, widthDividers)` cae a menos de `dividerTopCut.depth` de cualquiera de los dos extremos; si cae, empujar `sweptBandError()` a `errors`.

- [ ] **Step 4: Correr y verificar que pasan**

---

### Task 6: Interfaz, README y barrido de nombres

**Files:**
- Modify: `index.html:230-245`
- Modify: `js/ui/app.js:43-90`
- Modify: `README.md:45-47`, `README.md:67`
- Test: verificación en el navegador

- [ ] **Step 1: Cambiar el campo**

En `index.html`, `heightDividers` → `widthDividers` y la etiqueta "Divisores de alto" → "Divisores de ancho". Reescribir la ayuda del bloque: los de largo parten el largo en columnas, los de ancho parten el ancho en filas, y al cruzarse arman una rejilla; todos llegan del piso a la tapa.

- [ ] **Step 2: Cambiar la lectura de parámetros**

En `js/ui/app.js`, `heightDividers` → `widthDividers` en `readParams` y en el cálculo de `anyDivider`.

- [ ] **Step 3: Barrido**

Run: `grep -rn "heightDividers\|divider-h\|DIVIDER-H\|divisores de alto\|Divisores de alto" js index.html test.html README.md`
Expected: sin resultados.

- [ ] **Step 4: Actualizar el README**

Las filas de la tabla de parámetros y la línea de `js/boxes/` que describe `dividers.js`.

- [ ] **Step 5: Correr todos los checks**

Expected: el `summary` dice `N/N`, sin `✘`.

- [ ] **Step 6: Verificar en el navegador**

Abrir la app, reproducir la caja de Dani (100 × 100 × 80, grosor 2.75, kerf 0.16, tapa deslizante con soportes, 1 divisor de largo y 1 de ancho) y confirmar que salen `DIVIDER-L1` y `DIVIDER-W1`, las dos del mismo alto, y que los cuatro compartimentos quedan abiertos por arriba.
