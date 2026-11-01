# Divisores fijos con cejilla — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir el modo "Fijos con cejilla" a los divisores: cada divisor lleva una cejilla por extremo que entra en una ranura pasante de la pared, para armar la caja sin pegar los divisores.

**Architecture:** Toda la lógica nueva de divisores vive en `js/boxes/dividers.js`: resolver el modo, calcular la altura de la cejilla (con la regla de choque), dibujar las cejillas en las piezas y validar que una ranura cabe en su pared. Cada tipo de caja (`simple-box.js`, `sliding-box.js`, `sliding-support-box.js`, `hinged-box.js`) llama a esas funciones y agrega las ranuras como `features` (`rectHoleFeature`) en sus propias coordenadas de pared. El modo `'loose'` (default) no toca nada de lo de hoy.

**Tech Stack:** JavaScript ES modules, sin dependencias, sin build step. Self-checks en `test.html`, ejecutados en el navegador con `agent-browser`.

**Spec:** `docs/superpowers/specs/2026-10-26-divisores-con-cejilla-design.md`. Léelo entero antes de empezar; de ahí salen las fórmulas y las decisiones. El spec previo `2026-09-25-divisores-internos-design.md` explica la geometría de los divisores y sus muescas.

## Global Constraints

- **Rama:** `divisiones-con-tab` (ya existe). No trabajar sobre `main`.
- **Commits:** Dani no quiere commits automáticos. Cada paso "Commit" se hace sólo si Dani autorizó commits para esta ejecución; si no, el cambio se queda en el árbol de trabajo y se sigue. Nunca `git push`.
- **Parámetro nuevo:** `dividerMode: 'loose' | 'tabbed'`. Ausente o cualquier otro valor ⇒ `'loose'`.
- **Modo `'loose'` idéntico a hoy:** mismos paneles, mismos puntos, sin `features` nuevas.
- **Ejes:** X = largo, Y = ancho, Z = alto. `c` (altura de la cejilla del divisor de largo) y `zⱼ` (altura de los estantes) se miden **desde la cara interior de la base** (el canto de abajo del divisor), no en coordenadas de pieza (allí `y = 0` es el canto de arriba).
- **Cejilla:** sobresale `t` (en la caja con soportes, el estante sobresale `2t`). Se dibuja `kerf` más ancha (medio kerf por lado), como un dedo macho. La profundidad no se compensa.
- **Ranura:** medida nominal = tamaño nominal de la cejilla (`t` × ancho). Se dibuja con `rectHoleFeature(..., kerf)`, que ya la achica `kerf/2` por lado.
- **Ancho de cejilla:** divisor de largo `wL` = segmento de la junta vertical **del frente** (`joints.z.width` en simple, deslizante y bisagra; `joints.zFront.width` en la caja con soportes). Estante `wH` = `joints.y.width`.
- **Regla de choque (decisión de Dani):** las dos cejillas del divisor de largo se mueven juntas a la altura libre más cercana a `dividerHeight / 2`; si hay empate, gana la de abajo; si no hay ninguna, sale un error.
- **Ids de las ranuras:** `divider-slot-l${i}` en FRONT/BACK (`i = 1..Nc`), `divider-slot-h${j}` en LEFT/RIGHT/SUPPORT (`j = 1..Ns`).
- **Textos:** en español, con el mismo tono que los existentes. Comentarios de código en español, explicando el porqué.
- **Mensajes de error (copia exacta):**
  - `No hay espacio para la cejilla de los divisores de largo entre los cruces de los divisores de alto: usa menos divisores de alto o una caja más alta.`
  - `El ancho interior de ${spanY.toFixed(1)} mm es muy angosto para la cejilla de los divisores de alto.`
  - `La ranura de un divisor en ${label} queda a menos de ${t} mm de otro corte de la pared.`

## Cómo correr las pruebas

```bash
cd "/Users/danmo/Library/CloudStorage/OneDrive-Personal/Documents/Daniel/Claude Projects/BoxMaker"
PORT=8765 node dev-server.mjs &   # deja el servidor corriendo
agent-browser open http://localhost:8765/test.html && agent-browser wait 3000
agent-browser eval "(()=>{const t=document.body.innerText;return {summary:document.getElementById('summary').textContent, fails:t.split('\n').filter(l=>l.includes('✘'))}})()"
```

Para recargar después de un cambio: `agent-browser reload && agent-browser wait 3000` y repetir el `eval`. Al terminar: `pkill -f dev-server.mjs; agent-browser close`.

**Línea base: 139/139 checks OK.** Todo check existente debe seguir pasando en cada tarea.

## Review Focus

1. **Cajas existentes sin cambios.** Con `dividerMode` ausente o `'loose'`, cada tipo de caja con divisores debe salir idéntica a hoy. Task 2 agrega una prueba que compara loose contra "sin parámetro" en los cuatro tipos.
2. **Ranura que choca con otro corte.** Por ejemplo, un estante alto en la deslizante que cae sobre el canal grabado, o una ranura junto al hueco de bisagra. Debe salir el error, no una pared rota. Lo cubren las Tasks 3 y 5.
3. **Divisor bajo y ancho de espiga grande:** sin altura libre para la cejilla. Debe salir el error de "No hay espacio…", no `NaN` ni una cejilla fuera de la pieza. Lo cubre la Task 1.
4. **Empate en la regla de choque por redondeo de punto flotante:** un estante a media altura da distancias "iguales" que difieren en 1e-15. Debe ganar la de abajo. Lo cubre la Task 1 (caso 37 → 25.1).
5. **Cambiar el modo sin divisores:** el selector se oculta y la caja no cambia. Lo cubre la Task 6.

---

### Task 1: Núcleo en `dividers.js` — modo, altura de cejilla, cejillas y ajuste de ranura

**Files:**
- Modify: `js/boxes/dividers.js`
- Test: `test.html` (sumar al `import` de `./js/boxes/dividers.js` y agregar checks al final, antes del resumen)

**Interfaces:**
- Produces:
  - `resolveDividerMode(mode) -> 'loose' | 'tabbed'`
  - `lengthTabCenter({ dividerHeight, tabWidth, t, notchPositions, topCutDepth = 0 }) -> number | null`: `c` medido desde el canto de abajo del divisor.
  - `planDividerTabs({ dividerMode, lengthDividers, heightDividers, spanY, dividerHeight, t, lengthTabWidth, heightTabWidth, heightProtrude = t, topCutDepth = 0 }) -> { errors: string[], tabs: null | { length: { width, center, protrude } | null, height: { width, protrude } | null } }`. `tabs` es `null` en modo loose o sin divisores; `length` es `null` si `Nc = 0` y `height` es `null` si `Ns = 0`.
  - `buildDividerPanels({ ...lo de hoy, tabs })`: `tabs` opcional, con la misma forma que en `planDividerTabs`.
  - `slotFits(rect, { bounds, t, obstacles = [] }) -> boolean`. Todos son `{ x0, y0, x1, y1 }` en coordenadas de pieza: `rect` es la ranura nominal, `bounds` es la zona de la pared con material y `obstacles` son los rectángulos de otros cortes.
  - `featureBounds(feature) -> { x0, y0, x1, y1 }`: la caja envolvente de los `points` de una feature.
  - Los mensajes de error de Global Constraints, exportados como `NO_TAB_ROOM`, `shelfTooNarrow(spanY)` y `slotTooClose(label, t)`.

- [ ] **Step 1: Escribir los checks que fallan**

```js
check('cejilla: modo ausente o desconocido es loose', () => {
  assert(resolveDividerMode(undefined) === 'loose', 'undefined');
  assert(resolveDividerMode('xyz') === 'loose', 'xyz');
  assert(resolveDividerMode('tabbed') === 'tabbed', 'tabbed');
});
check('cejilla: sin estantes va a media altura', () => {
  const c = lengthTabCenter({ dividerHeight: 74, tabWidth: 14.8, t: 3, notchPositions: [] });
  assert(near(c, 37), `c=${c}`);
});
check('cejilla: un estante a media altura la baja a 25.1 (empate gana abajo)', () => {
  const c = lengthTabCenter({ dividerHeight: 74, tabWidth: 14.8, t: 3, notchPositions: [37] });
  assert(near(c, 25.1, 1e-9), `c=${c}`);
});
check('cejilla: dos estantes sin choque la dejan al centro', () => {
  // H=120, estantes en 40 y 80; banda prohibida [28.1,51.9] y [68.1,91.9]: 60 libre
  const c = lengthTabCenter({ dividerHeight: 120, tabWidth: 14.8, t: 3, notchPositions: [40, 80] });
  assert(near(c, 60), `c=${c}`);
});
check('cejilla: sin altura libre devuelve null', () => {
  const c = lengthTabCenter({ dividerHeight: 30, tabWidth: 14.8, t: 3, notchPositions: [15] });
  assert(c === null, `c=${c}`);
});
check('cejilla: el recorte superior también empuja la cejilla hacia abajo', () => {
  // banda prohibida por el recorte: [74−40, 74] expandida 10.4 ⇒ c ≤ 23.6
  const c = lengthTabCenter({ dividerHeight: 74, tabWidth: 14.8, t: 3, notchPositions: [], topCutDepth: 40 });
  assert(near(c, 23.6, 1e-9), `c=${c}`);
});
check('cejilla: planDividerTabs da error sin altura libre y con estante angosto', () => {
  const a = planDividerTabs({ dividerMode: 'tabbed', lengthDividers: 1, heightDividers: 1,
    spanY: 144, dividerHeight: 30, t: 3, lengthTabWidth: 14.8, heightTabWidth: 16 });
  assert(a.errors.includes(NO_TAB_ROOM), a.errors.join('|'));
  const b = planDividerTabs({ dividerMode: 'tabbed', lengthDividers: 0, heightDividers: 1,
    spanY: 20, dividerHeight: 74, t: 3, lengthTabWidth: 14.8, heightTabWidth: 16 });
  assert(b.errors.includes(shelfTooNarrow(20)), b.errors.join('|'));
  const c = planDividerTabs({ dividerMode: 'loose', lengthDividers: 1, heightDividers: 1,
    spanY: 144, dividerHeight: 30, t: 3, lengthTabWidth: 14.8, heightTabWidth: 16 });
  assert(c.errors.length === 0 && c.tabs === null, 'loose no valida ni produce cejillas');
});
check('cejilla: DIVIDER-L y DIVIDER-H dibujan sus cejillas con kerf', () => {
  const tabs = { length: { width: 14.8, center: 25.1, protrude: 3 }, height: { width: 16, protrude: 3 } };
  const panels = buildDividerPanels({ spanX: 194, spanY: 144, dividerHeight: 74, t: 3, kerf: 0.15,
    lengthDividers: 1, heightDividers: 1, tabs });
  const l = panels.find((p) => p.id === 'divider-l1').points;
  const h = panels.find((p) => p.id === 'divider-h1').points;
  const bb = (pts) => ({ x0: Math.min(...pts.map((p) => p.x)), x1: Math.max(...pts.map((p) => p.x)) });
  assert(near(bb(l).x0, -3) && near(bb(l).x1, 147), 'L sobresale 3 a cada lado');
  assert(near(bb(h).x0, -3) && near(bb(h).x1, 197), 'H sobresale 3 a cada lado');
  // cejilla de L: y = 74 − 25.1 = 48.9 ± (14.8 + 0.15)/2
  const lTab = l.filter((p) => near(p.x, -3)).map((p) => p.y).sort((a, b) => a - b);
  assert(near(lTab[0], 41.425, 1e-9) && near(lTab[1], 56.375, 1e-9), `L tab ${lTab}`);
  const hTab = h.filter((p) => near(p.x, 197)).map((p) => p.y).sort((a, b) => a - b);
  assert(near(hTab[0], 63.925, 1e-9) && near(hTab[1], 80.075, 1e-9), `H tab ${hTab}`);
});
check('cejilla: sin tabs, buildDividerPanels sale igual que hoy', () => {
  const args = { spanX: 194, spanY: 144, dividerHeight: 74, t: 3, kerf: 0.15, lengthDividers: 2, heightDividers: 1 };
  const a = buildDividerPanels(args);
  const b = buildDividerPanels({ ...args, tabs: null });
  assert(JSON.stringify(a) === JSON.stringify(b), 'tabs null cambia la geometría');
});
check('slotFits: dentro, pegada al borde y contra un obstáculo', () => {
  const bounds = { x0: 0, y0: 0, x1: 100, y1: 80 };
  assert(slotFits({ x0: 40, y0: 30, x1: 43, y1: 45 }, { bounds, t: 3 }), 'dentro');
  assert(!slotFits({ x0: 1, y0: 30, x1: 4, y1: 45 }, { bounds, t: 3 }), 'a 1 mm del borde');
  assert(!slotFits({ x0: 40, y0: 30, x1: 43, y1: 45 },
    { bounds, t: 3, obstacles: [{ x0: 0, y0: 46, x1: 100, y1: 50 }] }), 'a 1 mm del canal');
  assert(slotFits({ x0: 40, y0: 30, x1: 43, y1: 45 },
    { bounds, t: 3, obstacles: [{ x0: 0, y0: 48, x1: 100, y1: 50 }] }), 'a 3 mm exactos cabe');
});
```

- [ ] **Step 2: Correr las pruebas y confirmar que fallan**

Esperado: la página no carga los checks nuevos (falla el `import` porque las funciones no existen) o todos los checks nuevos salen ✘.

- [ ] **Step 3: Implementar en `js/boxes/dividers.js`**

- `lengthTabCenter`: la cejilla más `t` de material a cada lado ocupa una banda de radio `r = tabWidth/2 + t`. El centro permitido es `[r, H − r]`, quitando cada zona prohibida expandida en `r`: las muescas `[zⱼ − t/2, zⱼ + t/2]` y, si `topCutDepth > 0`, el recorte `[H − topCutDepth, H]`. Si `H/2` está permitido, devuelve `H/2`. Si no, devuelve el extremo permitido más cercano a `H/2`; con distancias iguales dentro de `EPS` (de `../core/geometry.js`), gana el menor. Si no hay ningún intervalo permitido, devuelve `null`. Las muescas son simétricas (`evenPositions`), así que `zⱼ` sale igual medido desde arriba o desde abajo.
- `planDividerTabs`: resuelve el modo; si es loose o `Nc = Ns = 0`, devuelve `{ errors: [], tabs: null }`. Con `Nc > 0`, llama a `lengthTabCenter` con `notchPositions = evenPositions(dividerHeight, Ns)` y, si da `null`, agrega `NO_TAB_ROOM`. Con `Ns > 0` y `spanY < heightTabWidth + 2t`, agrega `shelfTooNarrow(spanY)`. La cejilla de largo sobresale `t`; la de alto, `heightProtrude`.
- `buildLengthDividerPoints` / `buildHeightDividerPoints`: aceptan el parámetro opcional `tab: { width, y, protrude }`, ya convertido a coordenadas de pieza y con el kerf sumado al ancho. Insertan un bulto rectangular en el canto `x = 0` y otro en `x = width`, respetando el sentido de recorrido de cada función (los comentarios que ya existen lo explican). En DIVIDER-L, `y = dividerHeight − center`; en DIVIDER-H, `y = spanY / 2`. Sin `tab`, los puntos salen idénticos a hoy.
- `slotFits`: el `rect` expandido en `t` por cada lado tiene que quedar dentro de `bounds` (se permite tocar) y no puede cruzarse con ningún obstáculo (tocar el borde sí se permite).

- [ ] **Step 4: Correr las pruebas.** Esperado: todos OK (139 + 10).

- [ ] **Step 5: Commit** (sólo si Dani lo autorizó)

```bash
git add js/boxes/dividers.js test.html
git commit -m "Add tab geometry and slot checks for fixed dividers"
```

---

### Task 2: Caja simple (tapa con espigas, plana y plana con agarradera)

**Files:**
- Modify: `js/boxes/simple-box.js`
- Test: `test.html`

**Interfaces:**
- Consumes: `planDividerTabs`, `slotFits`, `featureBounds` y `slotTooClose` de la Task 1, y `rectHoleFeature` de `../core/panel.js`.
- Produces: el resultado de `buildBox` incluye `dividerTabs` (el objeto `tabs` de `planDividerTabs`, o `null`). La interfaz (Task 6) lo usa para decidir la nota de armado.

- [ ] **Step 1: Escribir los checks que fallan**

```js
const TABBED = { ...BASE, lengthDividers: 1, heightDividers: 1, dividerMode: 'tabbed' };
check('cejilla simple: ranuras de FRONT/BACK en la altura corrida', () => {
  const b = buildBox(TABBED);
  assert(b.errors.length === 0, b.errors.join('|'));
  for (const id of ['front', 'back']) {
    const f = b.panels.find((p) => p.id === id).features.find((x) => x.id === 'divider-slot-l1');
    const bb = featureBounds(f);
    // nominal x 98.5..101.5, y 44.5..59.3; dibujada kerf/2 adentro
    assert(near(bb.x0, 98.575, 1e-9) && near(bb.x1, 101.425, 1e-9), `${id} x ${bb.x0}..${bb.x1}`);
    assert(near(bb.y0, 44.575, 1e-9) && near(bb.y1, 59.225, 1e-9), `${id} y ${bb.y0}..${bb.y1}`);
  }
});
check('cejilla simple: ranuras de LEFT/RIGHT a la altura del estante', () => {
  const b = buildBox(TABBED);
  for (const id of ['left', 'right']) {
    const bb = featureBounds(b.panels.find((p) => p.id === id).features.find((x) => x.id === 'divider-slot-h1'));
    assert(near(bb.x0, 64.075, 1e-9) && near(bb.x1, 79.925, 1e-9), `${id} x`);
    assert(near(bb.y0, 38.575, 1e-9) && near(bb.y1, 41.425, 1e-9), `${id} y`);
  }
});
check('cejilla simple: tapa plana usa el alto de pared Ho − t', () => {
  const b = buildBox({ ...TABBED, lidType: 'flat', heightDividers: 0 });
  assert(b.errors.length === 0, b.errors.join('|'));
  const front = b.panels.find((p) => p.id === 'front');
  const bb = featureBounds(front.features.find((x) => x.id === 'divider-slot-l1'));
  // dividerHeight 74, c = 37, pared de 77: centro y = 77 − (3 + 37) = 37
  assert(near((bb.y0 + bb.y1) / 2, 37, 1e-9), `centro ${(bb.y0 + bb.y1) / 2}`);
});
check('cejilla: modo loose deja las cuatro cajas idénticas a sin parámetro', () => {
  const cfgs = [
    { ...BASE, lengthDividers: 2, heightDividers: 1 },
    { ...SLIDE, lengthDividers: 1, heightDividers: 1 },
    { ...SUPPORTS, lengthDividers: 1, heightDividers: 1 },
    { ...HINGED, lengthDividers: 1, heightDividers: 1 },
  ];
  for (const cfg of cfgs) {
    const build = cfg.lidType === 'hinged' ? buildHingedBox : buildAny;
    const a = build(cfg);
    const b = build({ ...cfg, dividerMode: 'loose' });
    assert(JSON.stringify(a.panels) === JSON.stringify(b.panels), `${cfg.lidType} cambia`);
  }
});
```

`HINGED` ya existe en `test.html` (línea ~1025), pero se define después de los checks de la caja simple: este check va después de esa definición.

- [ ] **Step 2: Correr las pruebas.** Esperado: los 3 checks de "cejilla simple" fallan. El de loose puede pasar desde ya.

- [ ] **Step 3: Integrar en `buildBox`**

Calcula `joints` antes de validar los divisores, o calcula `jointSegments` aparte, porque el ancho de la cejilla lo necesita: `wL = joints.z.width` y `wH = joints.y.width`. Llama a `planDividerTabs` con `spanY`, `dividerHeight` y `t`, y agrega sus errores. Con `tabs`:
- Cada pieza FRONT/BACK (de `width Lo`, `height wallHeight`) recibe, por cada `xᵢ` de `evenPositions(spanX, Nc)`, la ranura nominal `x ∈ [t + xᵢ − t/2, t + xᵢ + t/2]`, `y ∈ [wallHeight − t − c − wL/2, wallHeight − t − c + wL/2]`.
- Cada pieza LEFT/RIGHT (de `width spanY`) recibe, por cada `zⱼ`, la ranura `x ∈ [spanY/2 − wH/2, spanY/2 + wH/2]`, `y ∈ [wallHeight − t − zⱼ − t/2, wallHeight − t − zⱼ + t/2]`.
- Cada ranura pasa por `slotFits(rect, { bounds: { x0: 0, y0: 0, x1: panelWidth, y1: wallHeight }, t, obstacles: features que ya tenga la pared, vía featureBounds })`. Si alguna no cabe, devuelve `slotTooClose(label, t)` como error, sin paneles.
- Pásale `tabs` a `buildDividerPanels` y devuelve `dividerTabs: tabs`.

Ojo: hoy `endWall` y `sideWall` son un solo objeto compartido para las dos paredes; las `features` se pueden poner en ese objeto común porque las posiciones son simétricas.

- [ ] **Step 4: Correr las pruebas.** Esperado: todos OK.

- [ ] **Step 5: Commit** — `git add js/boxes/simple-box.js test.html && git commit -m "Cut divider tab slots in the simple box walls"`

---

### Task 3: Caja deslizante (canal grabado)

**Files:**
- Modify: `js/boxes/sliding-box.js`
- Test: `test.html`

**Interfaces:**
- Consumes: lo de la Task 1, más el patrón de la Task 2.
- Produces: `dividerTabs` en el resultado.

- [ ] **Step 1: Escribir los checks que fallan**

```js
const SLIDE_TABBED = { ...SLIDE, lengthDividers: 1, heightDividers: 0, dividerMode: 'tabbed' };
check('cejilla deslizante: la ranura de FRONT y BACK queda a la misma altura desde el piso', () => {
  const b = buildSlidingBox(SLIDE_TABBED);
  assert(b.errors.length === 0, b.errors.join('|'));
  const front = b.panels.find((p) => p.id === 'front');
  const back = b.panels.find((p) => p.id === 'back');
  const cy = (panel) => { const bb = featureBounds(panel.features.find((x) => x.id === 'divider-slot-l1')); return (bb.y0 + bb.y1) / 2; };
  const c = b.dividerTabs.length.center;
  assert(near(front.height - cy(front), 3 + c, 1e-9), 'FRONT');
  assert(near(back.height - cy(back), 3 + c, 1e-9), 'BACK');
  const bb = featureBounds(front.features.find((x) => x.id === 'divider-slot-l1'));
  assert(near(bb.y1 - bb.y0, b.joints.z.width - 0.16, 1e-9), 'ancho = junta del frente − kerf');
});
check('cejilla deslizante: un estante sobre el canal da error de ranura', () => {
  // con 16 estantes el de arriba queda en z = 74·16/17 ≈ 69.6: su ranura llega a
  // 3 + 69.6 + 1.5 = 74.1 desde el piso exterior, a menos de t del canal (77)
  const b = buildSlidingBox({ ...SLIDE, heightDividers: 16, dividerMode: 'tabbed' });
  assert(b.errors.some((e) => e.startsWith('La ranura de un divisor en')), b.errors.join('|'));
});
```

Verifica la cuenta del comentario contra `grooveFloor = Ho − tl` del módulo; si difiere, ajusta la cantidad de estantes y el comentario.

- [ ] **Step 2: Correr las pruebas.** Esperado: los 2 checks nuevos fallan.

- [ ] **Step 3: Integrar en `buildSlidingBox`**: `wL = joints.z.width` (el frente; el fondo es `joints.zBack`), `wH = joints.y.width` y `dividerHeight = innerHeight`. Usa las mismas fórmulas de ranura de la Task 2, pero con el alto propio de cada pared: FRONT `frontHeight`, BACK y laterales `wallHeight`. Los laterales se generan con `sideWall(...)`; sus `features` ya traen el canal, así que la ranura se agrega a esa lista y el canal se pasa como obstáculo a `slotFits`. En BACK, el canal del fondo también es obstáculo.

- [ ] **Step 4: Correr las pruebas.** Esperado: todos OK.

- [ ] **Step 5: Commit** — `git add js/boxes/sliding-box.js test.html && git commit -m "Cut divider tab slots in the sliding box"`

---

### Task 4: Caja deslizante con soportes

**Files:**
- Modify: `js/boxes/sliding-support-box.js`
- Test: `test.html`

**Interfaces:**
- Consumes: lo de la Task 1, con `heightProtrude = 2 * t`.
- Produces: `dividerTabs` en el resultado.

- [ ] **Step 1: Escribir los checks que fallan**

```js
const SUP_TABBED = { ...SUPPORTS, lengthDividers: 1, heightDividers: 1, dividerMode: 'tabbed' };
check('cejilla soportes: ranura de FRONT en x = 2t + xᵢ', () => {
  const b = buildSlidingSupportBox(SUP_TABBED);
  assert(b.errors.length === 0, b.errors.join('|'));
  const bb = featureBounds(b.panels.find((p) => p.id === 'front').features.find((x) => x.id === 'divider-slot-l1'));
  // Lo = 100, usableX = 88, x₁ = 44 ⇒ centro 6 + 44 = 50
  assert(near((bb.x0 + bb.x1) / 2, 50, 1e-9), `centro ${(bb.x0 + bb.x1) / 2}`);
  assert(near(bb.y1 - bb.y0, b.joints.zFront.width - 0.16, 1e-9), 'ancho = junta del frente − kerf');
});
check('cejilla soportes: el estante sobresale 2t y SUPPORT y lateral quedan alineados', () => {
  const b = buildSlidingSupportBox(SUP_TABBED);
  const h = b.panels.find((p) => p.id === 'divider-h1').points;
  assert(near(Math.min(...h.map((p) => p.x)), -6), 'sobresale 2t');
  const z = (panel, floorOffset) => { const bb = featureBounds(panel.features.find((x) => x.id === 'divider-slot-h1')); return panel.height - (bb.y0 + bb.y1) / 2 - floorOffset; };
  const left = b.panels.find((p) => p.id === 'left');
  const sup = b.panels.find((p) => p.id === 'support-1');
  // lateral: piso a t del canto de abajo; SUPPORT: se apoya en la base, su canto de abajo ES el piso
  assert(near(z(left, 3), z(sup, 0), 1e-9), 'misma altura en lateral y SUPPORT');
});
```

- [ ] **Step 2: Correr las pruebas.** Esperado: fallan.

- [ ] **Step 3: Integrar en `buildSlidingSupportBox`**: `wL = joints.zFront.width`, `wH = joints.y.width`, `dividerHeight = innerHeight`, `heightProtrude = 2t`. Las ranuras de FRONT (`height frontHeight`) y BACK (`height Ho`) van centradas en `x = 2t + xᵢ`, con `xᵢ` de `evenPositions(usableX, Nc)`. Las de LEFT/RIGHT (`height Ho`) van en `y = Ho − t − zⱼ`, y las de SUPPORT 1/2 (`height supportHeight`) en `y = supportHeight − zⱼ`. Las dos van centradas en `x = spanY/2`. `support(n)` hoy no tiene `features`: agrégaselas. Cada ranura pasa por `slotFits` usando los `bounds` de su pieza.

- [ ] **Step 4: Correr las pruebas.** Esperado: todos OK.

- [ ] **Step 5: Commit** — `git add js/boxes/sliding-support-box.js test.html && git commit -m "Cut divider tab slots in the sliding box with supports"`

---

### Task 5: Caja con bisagra

**Files:**
- Modify: `js/boxes/hinged-box.js`
- Test: `test.html`

**Interfaces:**
- Consumes: lo de la Task 1, con `topCutDepth = dividerTopCut.depth`.
- Produces: `dividerTabs` en el resultado.

- [ ] **Step 1: Escribir los checks que fallan**

```js
const HINGED_TABBED = { ...HINGED, lengthDividers: 1, heightDividers: 1, dividerMode: 'tabbed' };
check('cejilla bisagra: la ranura del lateral cuenta el alto del poste', () => {
  const b = buildHingedBox(HINGED_TABBED);
  assert(b.errors.length === 0, b.errors.join('|'));
  const left = b.panels.find((p) => p.id === 'left');
  const bb = featureBounds(left.features.find((x) => x.id === 'divider-slot-h1'));
  // y medido desde el canto de abajo de la pieza (que mide wallHeight + postHeight)
  const zFromFloor = left.height - (bb.y0 + bb.y1) / 2 - 3;
  const shelfZ = b.inner.height / 2;
  assert(near(zFromFloor, shelfZ, 1e-9), `z ${zFromFloor} vs ${shelfZ}`);
  assert(left.features.some((x) => x.id === 'hinge-hole'), 'conserva el agujero de bisagra');
});
check('cejilla bisagra: la cejilla del divisor de largo evita el recorte superior', () => {
  const b = buildHingedBox({ ...HINGED_TABBED, heightDividers: 0 });
  const c = b.dividerTabs.length.center;
  const r = b.dividerTabs.length.width / 2 + 3;
  const H = b.inner.height;
  assert(c + r <= H - (b.dividerTopCutDepth ?? 0) + 1e-9, 'la banda no entra al recorte');
});
```

Si `HINGED` da error de "No hay espacio…" con estos divisores, no cambies la regla: súbele `height` a la config del check y anótalo en un comentario.

Devuelve también `dividerTopCutDepth: dividerTopCut.depth` en el resultado de `buildHingedBox` (sólo para este check y para depurar).

- [ ] **Step 2: Correr las pruebas.** Esperado: fallan.

- [ ] **Step 3: Integrar en `buildHingedBox`**: `wL = joints.z.width`, `wH = joints.y.width`, `dividerHeight = innerHeight`, `topCutDepth = dividerTopCut.depth`. FRONT (lo arma `buildFrontWall`) y BACK (`generic.back`) tienen alto `wallHeight`. Las ranuras se agregan como `features` a las piezas ya construidas, y en FRONT la muesca de la manija (`y ∈ [0, tl]` y `x ∈ [handleStart, handleStart + hw]`) entra como obstáculo. En LEFT/RIGHT, `buildSideWall` corre todo `postHeight` hacia abajo, así que `y = postHeight + wallHeight − t − zⱼ`, con `bounds.y0 = postHeight`. El `hinge-hole` es obstáculo, y la ranura se suma a `features: [hole, ...]`.

- [ ] **Step 4: Correr las pruebas.** Esperado: todos OK.

- [ ] **Step 5: Commit** — `git add js/boxes/hinged-box.js test.html && git commit -m "Cut divider tab slots in the hinged box"`

---

### Task 6: Interfaz, nota de armado y README

**Files:**
- Modify: `index.html` (bloque "Divisores internos", alrededor de las líneas 230–247)
- Modify: `js/ui/app.js` (`readParams`, el bloque de notas de `recompute`)
- Modify: `README.md` (tabla de parámetros, líneas 45–46)

**Interfaces:**
- Consumes: `box.dividerTabs` de las Tasks 2–5 y `builderKey(params)`, que ya existe en `app.js`.

- [ ] **Step 1: Crear `ui-check.js` en el scratchpad (no va al repo)**

```js
(() => {
  const set = (id, v) => { const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); };
  const field = document.getElementById('dividerModeField');
  const out = {};
  set('lengthDividers', 0); set('heightDividers', 0);
  out.hiddenWithoutDividers = field.hidden;
  set('lengthDividers', 1);
  out.shownWithDivider = !field.hidden;
  out.defaultMode = document.getElementById('dividerMode').value;
  return out;
})()
```

Esperado después de implementar: `{ hiddenWithoutDividers: true, shownWithDivider: true, defaultMode: 'loose' }`. El input usa un debounce de 150 ms; si los valores salen viejos, corre el `eval` dos veces o agrega `agent-browser wait 300` entre `set` y la lectura.

- [ ] **Step 2: Implementar**

- En `index.html`, dentro del bloque de divisores, agregar `<div class="field" id="dividerModeField" hidden>`, con su `<label for="dividerMode">Tipo de divisor</label>` y un `<select id="dividerMode" name="dividerMode">` con dos opciones: `loose` "Sueltos (deslizables)" (seleccionada) y `tabbed` "Fijos con cejilla".
- Reemplazar la última oración del texto de ayuda ("Usando los dos tipos… hacia las paredes.") por: `Usando los dos tipos a la vez se cruzan con una ranura a media madera. "Sueltos" quedan a presión y se pueden sacar; "Fijos con cejilla" llevan una cejilla en cada extremo que entra en una ranura de la pared, así no hace falta pegarlos.`
- En `readParams`: `params.dividerMode = document.getElementById('dividerMode').value;` y `dividerModeField.hidden = !(Nc > 0 || Ns > 0)` (usa los valores ya leídos y trata `NaN` como 0).
- En `recompute`, convertir el bloque `engraveNote` en una lista de notas que se unen con un espacio: las dos que ya existen (canal y soportes), más esta si `box.dividerTabs` existe: `Arma los divisores junto con las paredes: mete sus cejillas en las ranuras y pega sólo paredes y tapas.` Con `builderKey === 'hinged'`, agrega `Monta la tapa al poner LEFT y RIGHT.` Con `'slidingSupports'`, agrega `Pega cada SUPPORT a su lateral usando un divisor de alto en su ranura como guía.` Si no hay ninguna nota, `engraveNote.hidden = true`.
- En `README.md`, agregar una fila `| Tipo de divisor | Sueltos | "Sueltos": a presión, como siempre. "Fijos con cejilla": una cejilla por extremo entra en una ranura de la pared y el divisor queda fijo sin pegamento. |`. En la línea del módulo `dividers.js`, agregar "y sus cejillas hacia las paredes".

- [ ] **Step 3: Verificar**: con el servidor corriendo, `agent-browser open http://localhost:8765/` y `agent-browser eval "$(cat <scratchpad>/ui-check.js)"`. Esperado: los tres valores del Step 1. `agent-browser console` sin errores. `test.html` sigue todo OK.

- [ ] **Step 4: Commit** — `git add index.html js/ui/app.js README.md && git commit -m "Add the fixed-divider option to the form"`

---

### Task 7: Verificación final y SVG para el corte de prueba

**Files:** ninguno del repo.

- [ ] **Step 1:** Correr `test.html`. Esperado: `✅ N/N checks OK`, con N = 139 + los checks nuevos.
- [ ] **Step 2:** En la app, armar una caja de 150 × 100 × 80 mm, plywood de 3 mm, kerf 0.16 (el caso calibrado de Dani), tapa con espigas, 2 divisores de largo, 1 de alto y "Fijos con cejilla". Descargar el SVG al scratchpad y tomar una `agent-browser screenshot` del preview.
- [ ] **Step 3:** Revisar a ojo en la captura que: cada cejilla esté a la misma altura que su ranura; las cejillas de los divisores de largo estén fuera del cruce con el estante; ninguna ranura toque los dedos. Darle a Dani las rutas completas del SVG y la captura para el corte de prueba.
- [ ] **Step 4:** `pkill -f dev-server.mjs; agent-browser close`.
