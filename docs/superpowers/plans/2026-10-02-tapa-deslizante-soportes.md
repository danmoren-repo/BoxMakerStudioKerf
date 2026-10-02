# Tapa deslizante con soportes pegados — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir a la tapa deslizante un segundo método, "Soportes pegados": caja cerrada con ventana en TOP, FRONT rebajado y dos placas SUPPORT pegadas dentro de los laterales, sobre las que desliza la tapa.

**Architecture:** Un módulo nuevo, `js/boxes/sliding-support-box.js`, con su propio generador (`buildSlidingSupportBox`), reusando el motor de juntas (`panelOutline`), los validadores de `shared.js` y los divisores de `dividers.js`. `sliding-box.js` no se toca. `app.js` elige el generador según `lidType` + `slideMethod`. La ventana de TOP es un agujero rectangular nuevo (`rectHoleFeature`) en `js/core/panel.js`.

**Tech Stack:** JavaScript ES modules, sin dependencias, sin build step. Web estática servida por `dev-server.mjs` (node). Self-checks en `test.html`, ejecutados en el navegador.

**Spec:** `docs/superpowers/specs/2026-10-02-tapa-deslizante-soportes-design.md` — leerlo entero antes de empezar. Todas las fórmulas y el porqué de cada número están ahí.

## Global Constraints

- **Rama de trabajo:** `tapa-deslizante-soportes` (ya existe, creada desde `main`). No trabajar sobre `main`.
- **Commits:** Dani no quiere commits automáticos. Cada "Commit" de este plan se hace sólo si Dani autorizó commits para esta ejecución; si no, se deja el cambio en el árbol de trabajo y se sigue. Nunca `git push`.
- **`js/boxes/sliding-box.js` no cambia.** Sólo se importa de él `lidThicknessFor`.
- **Canal grabado es el default:** `slideMethod` ausente o `'groove'` ⇒ el comportamiento de hoy, idéntico.
- **Marco automático:** `m = t + 4.5` (grosor del material + 4.5 mm), medido desde la cara interior de la pared.
- **Holgura por defecto:** `0.2` mm (la misma `slideClearance` del canal grabado).
- **Modo interiores:** `Lo = largo + 4t`, `Wo = ancho + 2t`, `Ho = alto + 2t + tl + h`.
- **Nombres de piezas:** `SUPPORT 1` / `SUPPORT 2` (ids `support-1` / `support-2`). Ids existentes: `bottom`, `front`, `left`, `top`, `back`, `right`, `lid`.
- **Textos de interfaz y mensajes:** en español, mismo tono que los existentes.
- **Comentarios de código:** en español, explican el porqué (estilo de `sliding-box.js`).
- **Sufijo de descarga:** `-deslizante-soportes`.
- **Nota de armado:** `Pega SUPPORT 1 y 2 por dentro de LEFT y RIGHT, apoyados sobre BOTTOM, antes de cerrar la caja con TOP.`

## Cómo correr las pruebas

```bash
cd "/Users/danmo/Library/CloudStorage/OneDrive-Personal/Documents/Daniel/Claude Projects/BoxMaker"
PORT=8765 node dev-server.mjs &   # deja el servidor corriendo
agent-browser open http://localhost:8765/test.html && agent-browser wait 3000
agent-browser eval "(()=>{const t=document.body.innerText;return {summary:document.getElementById('summary').textContent, fails:t.split('\n').filter(l=>l.includes('✘'))}})()"
```

Al terminar: `pkill -f dev-server.mjs; agent-browser close`.

Antes de empezar, la línea base es **125/125 checks OK**.

## Review Focus

1. **Marco escrito a mano absurdo** (0, negativo, mayor que media caja): debe dar error claro, nunca una ventana invertida ni NaN. → Task 3, casos de error.
2. **Material grueso / caja angosta** (p. ej. 6 mm en una caja de 40 mm de largo): sin espacio entre soportes ⇒ error, no piezas de ancho negativo. → Task 3, caso "sin espacio entre soportes" + barrido.
3. **Volver a "Canal grabado" después de usar "Soportes"**: la interfaz debe volver a mostrar la profundidad del canal y generar la caja de siempre. → Task 4, verificación en navegador.
4. **Kerf 0 y kerf grande**: la ventana no puede invertirse (`79 − kerf` sigue positivo) y las piezas siguen siendo polígonos simples. → Task 3, barrido con kerf 0 y 0.3.
5. **Divisores con soportes**: estantes del ancho útil (entre soportes), no del ancho entre paredes. → Task 2, check de divisores.

---

### Task 1: Agujero rectangular compensado (`rectHoleFeature`)

**Files:**
- Modify: `js/core/panel.js` (agregar después de `holeFeature`, ~línea 72)
- Test: `test.html` (import en ~línea 23; check nuevo después del bloque de checks generales, justo antes de `check('tapa plana: la tapa es un rectángulo liso del tamaño exterior'`)

**Interfaces:**
- Produces: `rectHoleFeature({ id, x, y, width, height, kerf = 0, layer = 'cut' }) → { id, layer, kind: 'hole', points }`. `x, y, width, height` son la medida **nominal** (la que debe tener el agujero ya cortado), en coordenadas de la pieza. Los `points` (4, sentido horario) quedan `kerf/2` hacia adentro por cada lado.

Nota de dirección del kerf: el haz va centrado en la línea y se come `kerf/2` a cada lado de ella. En un agujero, el lado que se pierde es el de afuera, así que la línea se dibuja `kerf/2` hacia adentro para que el agujero termine en su medida nominal. (`holeFeature`, que ya existe, hace lo contrario; eso queda fuera de este plan y se le reporta a Dani aparte. **No modificar `holeFeature`.**)

- [ ] **Step 1: Escribir el check que falla**

En `test.html`, cambiar la línea de import de `panel.js`:

```js
    import { panelOutline, pocketFeature, holeFeature, rectHoleFeature } from './js/core/panel.js';
```

Y agregar este check justo antes de `check('tapa plana: la tapa es un rectángulo liso del tamaño exterior'`:

```js
    check('rectHoleFeature: agujero rectangular, kerf/2 hacia adentro por lado', () => {
      const f = rectHoleFeature({ id: 'w', x: 10, y: 20, width: 79, height: 129, kerf: 0.16 });
      assert(f.kind === 'hole' && f.layer === 'cut', `kind/layer ${f.kind}/${f.layer}`);
      assert(f.points.length === 4, `${f.points.length} puntos, esperaba 4`);
      const bb = boundingBox(f.points);
      assert(near(bb.minX, 10.08) && near(bb.minY, 20.08), `origen ${bb.minX},${bb.minY}`);
      assert(near(bb.width, 78.84) && near(bb.height, 128.84), `tamaño ${bb.width} × ${bb.height}`);
      const plain = rectHoleFeature({ id: 'w', x: 0, y: 0, width: 5, height: 6 });
      const pb = boundingBox(plain.points);
      assert(near(pb.width, 5) && near(pb.height, 6), 'sin kerf debe quedar nominal');
    });
```

- [ ] **Step 2: Correr las pruebas y ver que falla**

Correr (ver "Cómo correr las pruebas"). Esperado: la página entera falla al cargar porque `rectHoleFeature` no existe (el `summary` se queda en "corriendo…" y la consola dice `does not provide an export named 'rectHoleFeature'`).

- [ ] **Step 3: Implementar**

En `js/core/panel.js`, después de `holeFeature`:

```js
// Un agujero rectangular pasante (la ventana de TOP en la tapa deslizante con
// soportes). x, y, width, height son la medida nominal: la que debe tener el
// agujero ya cortado. El haz se come kerf/2 a cada lado de la línea, y en un
// agujero lo que se pierde es el lado de afuera, así que la línea va kerf/2
// hacia ADENTRO por cada lado.
export function rectHoleFeature({ id, x, y, width, height, kerf = 0, layer = 'cut' }) {
  const half = kerf / 2;
  const x0 = x + half;
  const y0 = y + half;
  const x1 = x + width - half;
  const y1 = y + height - half;
  return {
    id,
    layer,
    kind: 'hole',
    points: [
      { x: x0, y: y0 },
      { x: x1, y: y0 },
      { x: x1, y: y1 },
      { x: x0, y: y1 },
    ],
  };
}
```

- [ ] **Step 4: Correr las pruebas y ver que pasan**

Esperado: `✅ 126/126 checks OK`.

- [ ] **Step 5: Commit** (sólo si Dani lo autorizó)

```bash
git add js/core/panel.js test.html
git commit -m "Add kerf-compensated rectangular hole feature"
```

---

### Task 2: Generador `buildSlidingSupportBox` (geometría)

**Files:**
- Create: `js/boxes/sliding-support-box.js`
- Test: `test.html` (import; fixture `SUPPORTS`; `buildAny`; listas de los checks generales; bloque nuevo de checks después de `check('deslizante: avisos que no bloquean'` y antes de `const HINGED = {`)

**Interfaces:**
- Consumes: `rectHoleFeature` (Task 1); `panelOutline` (`js/core/panel.js`); `autoTabWidthFromSpans, commonWarnings, jointSegments, KERF_TOO_BIG, validateBasics, validateTabsVsKerf` (`js/boxes/shared.js`); `buildDividerPanels, validateDividers, dividerWarnings` (`js/boxes/dividers.js`); `lidThicknessFor` (`js/boxes/sliding-box.js`).
- Produces:
  - `windowFrameFor({ thickness, windowFrame, windowFrameAuto = true }) → number`
  - `slidingSupportHeights(params) → { Lo, Wo, Ho, t, tl, h, m, railTop, frontHeight, supportHeight, innerHeight }`
  - `autoTabWidth(params) → number`
  - `buildSlidingSupportBox(params) → { panels, joints: { x, y, z, zFront }, errors, warnings, outer: { length, width, height }, inner: { length, width, height }, lid: { thickness, width, depth }, supports: { width, height, count: 2 }, window: { width, depth, frame } }`. Con errores: `{ errors, warnings: [], panels: [] }`.

En esta tarea la validación es mínima (sólo la que hace falta para no producir geometría rota); los errores y avisos completos llegan en la Task 3. Igual se escribe ya la función `validate` con su firma final para no reescribirla.

- [ ] **Step 1: Escribir los checks que fallan**

En `test.html`:

1. Import, después del import de `sliding-box.js`:

```js
    import {
      buildSlidingSupportBox, slidingSupportHeights, windowFrameFor,
      autoTabWidth as supportAutoTabWidth,
    } from './js/boxes/sliding-support-box.js';
```

2. Fixture y `buildAny`. Después de la constante `SLIDE`:

```js
    // Caja de referencia del método "soportes pegados" (spec, "Ejemplo de
    // referencia"): 100 × 150 × 80, plywood de 3 mm, kerf calibrado de Dani.
    const SUPPORTS = {
      length: 100, width: 150, height: 80,
      thickness: 3, kerf: 0.16, tabWidth: 12,
      dimensionMode: 'outer', lidType: 'sliding', slideMethod: 'supports',
      slideClearance: 0.2,
    };
```

y reemplazar la línea de `buildAny` por:

```js
    const buildAny = (cfg) => {
      if (cfg.lidType === 'sliding' && cfg.slideMethod === 'supports') return buildSlidingSupportBox(cfg);
      return cfg.lidType === 'sliding' ? buildSlidingBox(cfg) : buildBox(cfg);
    };
```

3. Sumar el método nuevo a los tres checks generales que iteran configuraciones:
   - En `check('ninguna pieza tiene material más fino que el kerf (nada incortable)'`, la lista `[BASE, FLAT, SLIDE, { ...SLIDE, thickness: 6, lidThickness: 3, tabWidth: 18 }]` pasa a `[BASE, FLAT, SLIDE, { ...SLIDE, thickness: 6, lidThickness: 3, tabWidth: 18 }, SUPPORTS, { ...SUPPORTS, thickness: 6, lidThickness: 3, tabWidth: 18 }]`.
   - En `check('ningún contorno se dobla sobre sí mismo (líneas cortadas dos veces)'`, agregar al final de `configs`: `SUPPORTS,` `{ ...SUPPORTS, kerf: 0.4, tabWidth: 25, length: 250, width: 200, height: 100 },` `{ ...SUPPORTS, thickness: 6, lidThickness: 3, tabWidth: 18 },`.
   - En `check('ninguna esquina queda colgando de un puente más fino que el kerf'`, agregar a la lista: `SUPPORTS, { ...SUPPORTS, thickness: 6, lidThickness: 3, tabWidth: 18 }`.

4. Bloque nuevo, justo antes de `const HINGED = {`:

```js
    // --- Tapa deslizante con soportes pegados --------------------------------

    const sup = buildSlidingSupportBox(SUPPORTS);
    const supp = (id) => sup.panels.find((p) => p.id === id);

    check('soportes: nueve piezas y ningún error en la caja de referencia', () => {
      assert(sup.errors.length === 0, sup.errors.join(' | '));
      const ids = sup.panels.map((p) => p.id).join(',');
      assert(ids === 'bottom,front,left,top,back,right,support-1,support-2,lid', `piezas: ${ids}`);
      assert(supp('support-1').label === 'SUPPORT 1' && supp('support-2').label === 'SUPPORT 2', 'etiquetas de soportes');
    });

    check('soportes: medidas del ejemplo de referencia (spec)', () => {
      const H = slidingSupportHeights(SUPPORTS);
      assert(near(H.m, 7.5), `marco ${H.m}`);
      assert(near(H.railTop, 73.8) && near(H.frontHeight, 73.8), `canto del riel ${H.railTop}`);
      assert(near(H.supportHeight, 70.8), `alto de soporte ${H.supportHeight}`);
      const dims = (id) => [supp(id).width, supp(id).height];
      const expect = {
        bottom: [94, 144], front: [100, 73.8], left: [144, 80], right: [144, 80],
        back: [100, 80], top: [94, 147], 'support-1': [144, 70.8], 'support-2': [144, 70.8], lid: [93.6, 146.8],
      };
      for (const [id, [w, h]] of Object.entries(expect)) {
        const [pw, ph] = dims(id);
        assert(near(pw, w) && near(ph, h), `${id}: ${pw} × ${ph}, esperaba ${w} × ${h}`);
      }
      for (const id of ['support-1', 'support-2', 'lid']) {
        assert(supp(id).points.length === 4, `${id}: ${supp(id).points.length} puntos, va liso`);
      }
      assert(near(sup.window.width, 79) && near(sup.window.depth, 129) && near(sup.window.frame, 7.5),
        `ventana ${sup.window.width} × ${sup.window.depth}, marco ${sup.window.frame}`);
      assert(near(sup.lid.width, 93.6) && near(sup.lid.depth, 146.8) && near(sup.lid.thickness, 3), 'resumen de tapa');
      assert(near(sup.supports.width, 144) && near(sup.supports.height, 70.8) && sup.supports.count === 2, 'resumen de soportes');
      assert(near(sup.outer.length, 100) && near(sup.outer.width, 150) && near(sup.outer.height, 80), 'exterior');
      assert(near(sup.inner.length, 88) && near(sup.inner.width, 144) && near(sup.inner.height, 70.8),
        `interior ${sup.inner.length} × ${sup.inner.width} × ${sup.inner.height}`);
      assert(sup.realOuterHeight === undefined, 'no lleva alto real con reborde');
      assert(sup.groove === undefined, 'no lleva canal');
    });

    check('soportes: ventana de TOP centrada en el marco, compensada de kerf', () => {
      const top = supp('top');
      assert(top.features.length === 1, `${top.features.length} features en TOP`);
      const w = top.features[0];
      assert(w.id === 'window' && w.kind === 'hole' && w.layer === 'cut', `${w.id}/${w.kind}/${w.layer}`);
      const bb = boundingBox(w.points);
      // x desde la cara interior de LEFT; y desde el canto delantero de TOP,
      // que sobresale un grosor (3) por encima de FRONT.
      assert(near(bb.minX, 7.5 + 0.08) && near(bb.minY, 3 + 7.5 + 0.08), `origen ${bb.minX},${bb.minY}`);
      assert(near(bb.width, 79 - 0.16) && near(bb.height, 129 - 0.16), `tamaño ${bb.width} × ${bb.height}`);
      for (const id of ['bottom', 'front', 'left', 'back', 'right', 'support-1', 'support-2', 'lid']) {
        assert((supp(id).features ?? []).length === 0, `${id} no debería llevar features (nada se graba)`);
      }
    });

    check('soportes: cada par de aristas macho/hembra encaja', () => {
      // Igual que en el canal grabado: en los laterales la arista 'left' de
      // LEFT y la 'right' de RIGHT miran al frente.
      const pairs = [
        ['front', 'left', 'left', 'left'],
        ['front', 'right', 'right', 'right'],
        ['back', 'left', 'left', 'right'],
        ['back', 'right', 'right', 'left'],
        ['front', 'bottom', 'bottom', 'top'],
        ['back', 'bottom', 'bottom', 'bottom'],
        ['left', 'bottom', 'bottom', 'left'],
        ['right', 'bottom', 'bottom', 'right'],
        ['back', 'top', 'top', 'bottom'],
        ['left', 'top', 'top', 'left'],
        ['right', 'top', 'top', 'right'],
      ];
      const globalStart = (panel, edgeKey, spec) => {
        const start = spec.jointStart ?? 0;
        const own = (edgeKey === 'left' || edgeKey === 'right') ? panel.height : panel.width;
        return (edgeKey === 'left' || edgeKey === 'top') ? start : own - start - spec.jointSpan;
      };
      for (const [femaleId, femaleEdge, maleId, maleEdge] of pairs) {
        const female = supp(femaleId).edges[femaleEdge];
        const male = supp(maleId).edges[maleEdge];
        const pair = `${femaleId}.${femaleEdge} ↔ ${maleId}.${maleEdge}`;
        assert(female.gender === 'female', `${pair}: ${femaleId} no es hembra`);
        assert(male.gender === 'male', `${pair}: ${maleId} no es macho`);
        const fSpan = female.jointSpan ?? null;
        const mSpan = male.jointSpan ?? null;
        if (fSpan !== null && mSpan !== null) {
          assert(near(fSpan, mSpan), `${pair}: tramos distintos, ${fSpan} vs ${mSpan}`);
          const fs = globalStart(supp(femaleId), femaleEdge, female);
          const ms = globalStart(supp(maleId), maleEdge, male);
          assert(near(fs, ms), `${pair}: arranques distintos en coordenada global, ${fs} vs ${ms}`);
        }
        assert((female.startsSolid ?? false) === (male.startsSolid ?? false), `${pair}: fases distintas`);
      }
      // TOP ↔ laterales: el lateral es hembra en todo su ancho (144); TOP
      // cubre esos 144 y deja liso el grosor que sobresale sobre FRONT.
      const top = supp('top');
      assert(near(top.edges.left.jointSpan, 144) && near(top.edges.right.jointSpan, 144), 'tramo de TOP a los lados');
      assert(near(top.edges.left.jointStart ?? 0, 0), `TOP.left arranca en ${top.edges.left.jointStart} (desde el fondo)`);
      assert(near(top.edges.right.jointStart, 3), `TOP.right arranca en ${top.edges.right.jointStart} (desde el frente)`);
      assert(top.edges.top.gender === 'plain', 'el canto delantero de TOP va liso');
      assert(supp('front').edges.top.gender === 'plain', 'el canto superior de FRONT va liso');
      // Lateral más alto que FRONT: la junta del frente es más corta que la del fondo.
      const left = supp('left');
      assert(near(left.edges.left.jointSpan, 73.8 - 6), `junta del frente ${left.edges.left.jointSpan}`);
      assert(near(left.edges.right.jointSpan, 80 - 6), `junta del fondo ${left.edges.right.jointSpan}`);
    });

    check('soportes: contornos simples, cerrados y sin NaN', () => {
      for (const p of sup.panels) {
        assertSimplePolygon(p.points, `${p.id} (soportes)`);
        for (const pt of p.points) assert(Number.isFinite(pt.x) && Number.isFinite(pt.y), `${p.id}: NaN`);
      }
      assertSimplePolygon(supp('top').features[0].points, 'ventana de TOP');
    });

    check('soportes: modo interiores mide el espacio entre soportes', () => {
      const byInner = buildSlidingSupportBox({
        ...SUPPORTS, dimensionMode: 'inner', length: 88, width: 144, height: 70.8,
      });
      assert(byInner.errors.length === 0, byInner.errors.join(' | '));
      assert(near(byInner.outer.length, 100) && near(byInner.outer.width, 150) && near(byInner.outer.height, 80),
        `exterior ${byInner.outer.length} × ${byInner.outer.width} × ${byInner.outer.height}`);
      assert(near(byInner.inner.length, 88) && near(byInner.inner.width, 144) && near(byInner.inner.height, 70.8),
        `interior ${byInner.inner.length} × ${byInner.inner.width} × ${byInner.inner.height}`);
      // Con tapa de otro grosor, el alto exterior crece lo que crece la tapa.
      const thickLid = buildSlidingSupportBox({
        ...SUPPORTS, dimensionMode: 'inner', length: 88, width: 144, height: 70.8, lidThickness: 5,
      });
      assert(near(thickLid.outer.height, 82), `con tapa de 5: alto exterior ${thickLid.outer.height}`);
    });

    check('soportes: marco automático y manual, ancho de espiga automático', () => {
      assert(near(windowFrameFor({ thickness: 3 }), 7.5), 'auto 3 mm');
      assert(near(windowFrameFor({ thickness: 6 }), 10.5), 'auto 6 mm');
      assert(near(windowFrameFor({ thickness: 3, windowFrame: 5, windowFrameAuto: false }), 5), 'manual');
      assert(near(windowFrameFor({ thickness: 3, windowFrame: 5 }), 7.5), 'con la casilla marcada manda el automático');
      const manual = buildSlidingSupportBox({ ...SUPPORTS, windowFrame: 10, windowFrameAuto: false });
      assert(near(manual.window.width, 74) && near(manual.window.depth, 124), `ventana manual ${manual.window.width} × ${manual.window.depth}`);
      // El tramo más corto es la junta del frente (73.8 − 6 = 67.8): 3t = 9 manda.
      assert(near(supportAutoTabWidth(SUPPORTS), 9), `espiga automática ${supportAutoTabWidth(SUPPORTS)}`);
    });

    check('soportes: los estantes usan el ancho entre soportes', () => {
      const box = buildSlidingSupportBox({ ...SUPPORTS, lengthDividers: 1, heightDividers: 1 });
      assert(box.errors.length === 0, box.errors.join(' | '));
      assert(box.panels.length === 11, `${box.panels.length} piezas, esperaba 11 (9 + 1 + 1)`);
      const shelf = boundingBox(box.panels.find((p) => p.id === 'divider-h1').points);
      assert(near(shelf.width, 88) && near(shelf.height, 144), `estante ${shelf.width} × ${shelf.height}`);
      const wall = boundingBox(box.panels.find((p) => p.id === 'divider-l1').points);
      assert(near(wall.width, 144) && near(wall.height, 70.8), `divisor de largo ${wall.width} × ${wall.height}`);
    });

    check('soportes: el canal grabado no cambia (regresión)', () => {
      const before = JSON.stringify(buildSlidingBox(SLIDE));
      const explicit = JSON.stringify(buildSlidingBox({ ...SLIDE, slideMethod: 'groove' }));
      assert(before === explicit, 'slideMethod "groove" cambió la caja del canal grabado');
      assert(slide.groove && slide.panels.length === 6, 'la caja del canal grabado sigue con canal y 6 piezas');
    });
```

- [ ] **Step 2: Correr las pruebas y ver que fallan**

Esperado: la página no carga (`sliding-support-box.js` no existe → error de import en consola).

- [ ] **Step 3: Implementar `js/boxes/sliding-support-box.js`**

```js
import { panelOutline, rectHoleFeature } from '../core/panel.js';
import {
  autoTabWidthFromSpans,
  commonWarnings,
  jointSegments,
  KERF_TOO_BIG,
  validateBasics,
  validateTabsVsKerf,
} from './shared.js';
import {
  buildDividerPanels, validateDividers, dividerWarnings,
} from './dividers.js';
import { lidThicknessFor } from './sliding-box.js';

const DEFAULT_CLEARANCE = 0.2;
// Margen de seguridad del marco de la ventana, por encima del grosor que ya
// ocupa el soporte (decisión con Dani: grosor + 4.5 mm).
const FRAME_MARGIN = 4.5;
// El tramo delantero del marco cruza la entrada de la tapa sujeto sólo por
// sus puntas. Por debajo de 1/20 de su largo se avisa que puede quebrarse.
const FRONT_BAR_RATIO = 20;

// Automático: grosor del material (lo que ocupa el soporte) + margen. Con la
// casilla desmarcada manda el valor escrito, bueno o malo: la validación lo
// juzga en vez de corregirlo a la espalda del usuario.
export function windowFrameFor({ thickness, windowFrame, windowFrameAuto = true }) {
  if (!windowFrameAuto && Number.isFinite(windowFrame)) return windowFrame;
  return thickness + FRAME_MARGIN;
}

// Ho es la altura total, de la cara de abajo de BOTTOM a la de arriba de TOP:
// aquí nada sobresale por encima de la tapa. La tapa apoya directo sobre los
// soportes y la holgura queda entre la tapa y TOP. El canto de los soportes
// y el de FRONT coinciden (railTop): la tapa entra a ras por encima de FRONT.
// En modo interiores el espacio útil se mide ENTRE SOPORTES, así que el
// largo suma 2 paredes + 2 soportes.
export function slidingSupportHeights(params) {
  const t = params.thickness;
  const tl = lidThicknessFor(params);
  const h = Number.isFinite(params.slideClearance) ? params.slideClearance : DEFAULT_CLEARANCE;
  const m = windowFrameFor(params);
  const inner = params.dimensionMode === 'inner';
  const Lo = inner ? params.length + 4 * t : params.length;
  const Wo = inner ? params.width + 2 * t : params.width;
  const Ho = inner ? params.height + 2 * t + tl + h : params.height;
  const railTop = Ho - t - h - tl;

  return {
    Lo, Wo, Ho, t, tl, h, m,
    railTop,
    frontHeight: railTop,
    supportHeight: railTop - t,
    innerHeight: railTop - t,
  };
}

// El tramo de junta más corto es el del frente, que es más bajo que el resto.
export function autoTabWidth(params) {
  const { Lo, Wo, t, frontHeight } = slidingSupportHeights(params);
  return autoTabWidthFromSpans([frontHeight - 2 * t, Lo - 2 * t, Wo - 2 * t], t);
}

export function buildSlidingSupportBox(params) {
  const { kerf, tabWidth } = params;
  const {
    Lo, Wo, Ho, t, tl, h, m, frontHeight, supportHeight, innerHeight,
  } = slidingSupportHeights(params);

  const spanX = Lo - 2 * t; // entre laterales: BOTTOM/TOP <-> frente/fondo
  const spanY = Wo - 2 * t; // entre frente y fondo: BOTTOM/TOP <-> laterales
  const spanZ = Ho - 2 * t; // fondo <-> laterales
  const spanZFront = frontHeight - 2 * t; // frente <-> laterales
  const usableX = spanX - 2 * t; // entre soportes

  const lengthDividers = Number.isFinite(params.lengthDividers) ? params.lengthDividers : 0;
  const heightDividers = Number.isFinite(params.heightDividers) ? params.heightDividers : 0;

  const errors = validate({
    Lo, Wo, Ho, t, tl, h, m, kerf, tabWidth,
    spanX, spanY, spanZ, spanZFront, frontHeight, supportHeight,
  });
  if (errors.length === 0) {
    errors.push(...validateDividers({ lengthDividers, heightDividers, spanY, t }));
  }
  if (errors.length > 0) return { errors, warnings: [], panels: [] };

  const joints = {
    x: jointSegments(spanX, tabWidth),
    y: jointSegments(spanY, tabWidth),
    z: jointSegments(spanZ, tabWidth),
    zFront: jointSegments(spanZFront, tabWidth),
  };

  // Toda junta arranca y termina con material en la pieza hembra, para que las
  // esquinas no queden colgando de medio kerf.
  const SOLID = { startsSolid: true };

  // Los laterales son espejo uno del otro por el mismo motivo que en el canal
  // grabado (ver sliding-box.js): FRONT es más bajo que BACK, así que sus
  // juntas verticales miden distinto. La arista 'right' recorre la pieza de
  // arriba hacia abajo, así que su arranque se cuenta desde el canto superior
  // propio y hay que correrlo para que la junta siga midiéndose desde el piso.
  // A diferencia del canal grabado, el canto superior es hembra: ahí encaja TOP.
  const sideWall = (id, label, frontEdge) => {
    const backEdge = frontEdge === 'left' ? 'right' : 'left';
    const frontJointStart = frontEdge === 'left' ? t : Ho - t - spanZFront;
    return {
      id,
      label,
      width: spanY,
      height: Ho,
      edges: {
        top: { gender: 'female', ...SOLID },
        bottom: { gender: 'female', ...SOLID },
        [frontEdge]: { gender: 'male', jointStart: frontJointStart, jointSpan: spanZFront, ...SOLID },
        [backEdge]: { gender: 'male', jointStart: t, jointSpan: spanZ, ...SOLID },
      },
    };
  };

  // TOP es la tapa de la caja cerrada, alargada un grosor hacia el frente para
  // quedar a ras de la cara de FRONT (que ya no llega hasta ella: por debajo
  // pasa la tapa). Su canto delantero ('top', y = 0) va liso. La arista 'left'
  // se recorre del fondo al frente y la 'right' del frente al fondo: en las dos,
  // la junta cubre spanY y el grosor sobrante queda en el extremo del frente.
  // La ventana se mide desde la cara interior de cada pared: en y, la cara
  // interior de FRONT está a t del canto delantero de TOP.
  const top = {
    id: 'top',
    label: 'TOP',
    width: spanX,
    height: spanY + t,
    edges: {
      top: { gender: 'plain' },
      bottom: { gender: 'male', ...SOLID },
      left: { gender: 'male', jointStart: 0, jointSpan: spanY, ...SOLID },
      right: { gender: 'male', jointStart: t, jointSpan: spanY, ...SOLID },
    },
    features: [rectHoleFeature({
      id: 'window',
      x: m,
      y: t + m,
      width: spanX - 2 * m,
      height: spanY - 2 * m,
      kerf,
    })],
  };

  const plainEdges = {
    top: { gender: 'plain' },
    bottom: { gender: 'plain' },
    left: { gender: 'plain' },
    right: { gender: 'plain' },
  };

  // Placa pegada por dentro de cada lateral, apoyada en BOTTOM: su canto de
  // arriba es el riel, y queda a la altura exacta sin medir al pegarla.
  const support = (n) => ({
    id: `support-${n}`,
    label: `SUPPORT ${n}`,
    width: spanY,
    height: supportHeight,
    edges: plainEdges,
  });

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
    top,
    {
      id: 'back', label: 'BACK',
      width: Lo, height: Ho,
      edges: {
        top: { gender: 'female', jointStart: t, jointSpan: spanX, ...SOLID },
        bottom: { gender: 'female', jointStart: t, jointSpan: spanX, ...SOLID },
        left: { gender: 'female', jointStart: t, jointSpan: spanZ, ...SOLID },
        right: { gender: 'female', jointStart: t, jointSpan: spanZ, ...SOLID },
      },
    },
    sideWall('right', 'RIGHT', 'right'),
    support(1),
    support(2),
    // La tapa corre entre los laterales con holgura a cada lado, y va del
    // fondo a la cara exterior de FRONT.
    {
      id: 'lid', label: 'LID',
      width: spanX - 2 * h,
      height: spanY - h + t,
      edges: plainEdges,
    },
  ];

  const material = { thickness: t, kerf, tabWidth };
  const panels = specs.map((spec) => ({ ...spec, points: panelOutline(spec, material) }));
  const lid = panels.find((panel) => panel.id === 'lid');
  panels.push(...buildDividerPanels({
    spanX: usableX, spanY, dividerHeight: innerHeight, t, kerf, lengthDividers, heightDividers,
  }));

  return {
    panels,
    joints,
    errors,
    warnings: [
      ...warningsFor({
        jointWidths: [joints.x.width, joints.y.width, joints.z.width, joints.zFront.width],
        t, kerf, tabWidth, h, tl, m, spanX,
        lidWidth: lid.width, lidDepth: lid.height,
      }),
      ...dividerWarnings({ lengthDividers, heightDividers, spanX: usableX, dividerHeight: innerHeight, t }),
    ],
    outer: { length: Lo, width: Wo, height: Ho },
    inner: { length: usableX, width: spanY, height: innerHeight },
    lid: { thickness: tl, width: lid.width, depth: lid.height },
    supports: { width: spanY, height: supportHeight, count: 2 },
    window: { width: spanX - 2 * m, depth: spanY - 2 * m, frame: m },
  };
}

// Task 2: sólo lo imprescindible para no generar geometría rota. La Task 3
// completa la lista del spec.
function validate({
  Lo, Wo, Ho, t, tl, h, m, kerf, tabWidth,
  spanX, spanY, spanZ, spanZFront, frontHeight, supportHeight,
}) {
  const errors = validateBasics({ t, kerf, tabWidth, Lo, Wo, Ho });
  if (errors.length > 0) return errors;
  if (kerf >= t) errors.push(KERF_TOO_BIG);
  if (spanX <= 2 * t || spanY <= 0 || supportHeight <= 0 || spanZFront <= 0
    || spanX - 2 * m <= 0 || spanY - 2 * m <= 0 || !(tl > 0) || !(h >= 0)) {
    errors.push('Medidas imposibles para la tapa deslizante con soportes.');
  }
  if (errors.length > 0) return errors;
  errors.push(...validateTabsVsKerf(
    [
      ['largo', spanX],
      ['ancho', spanY],
      ['alto del frente', spanZFront],
      ['alto del fondo', spanZ],
    ],
    tabWidth,
    kerf,
  ));
  return errors;
}

function warningsFor({ jointWidths, t, kerf, tabWidth }) {
  return commonWarnings({ jointWidths, t, kerf, tabWidth });
}
```

(`frontHeight` en la firma de `validate` y `h, tl, m, spanX, lidWidth, lidDepth` en la de `warningsFor` se usan en la Task 3.)

- [ ] **Step 4: Correr las pruebas y ver que pasan**

Esperado: `✅ 135/135 checks OK` (126 + 9 nuevos). Si falla el check de "macho/hembra", revisar primero los `jointStart` de TOP y del lateral derecho contra el spec ("Juntas verticales").

- [ ] **Step 5: Commit** (sólo si Dani lo autorizó)

```bash
git add js/boxes/sliding-support-box.js test.html
git commit -m "Add sliding-lid box with glued support plates"
```

---

### Task 3: Errores y avisos del método con soportes

**Files:**
- Modify: `js/boxes/sliding-support-box.js` (reemplazar `validate` y `warningsFor`)
- Test: `test.html` (dos checks + barrido, al final del bloque "Tapa deslizante con soportes pegados")

**Interfaces:**
- Consumes: `buildSlidingSupportBox`, `SUPPORTS`, `sup` (Task 2).
- Produces: mensajes de error/aviso con estos fragmentos (en minúsculas) que los checks buscan: `soportes`, `caería`, `se come la ventana`, `entre los soportes`, `demasiado baja`, `espigas`, `tapa`, `negativa`, `presión`, `bailar`, `quebrarse`, `pandear`.

- [ ] **Step 1: Escribir los checks que fallan**

Al final del bloque de soportes en `test.html`:

```js
    check('soportes: errores que bloquean la generación', () => {
      const cases = [
        ['holgura igual al grosor: la tapa no apoya', { slideClearance: 3 }, 'soportes'],
        ['marco más chico que la holgura', { windowFrame: 0.1, windowFrameAuto: false }, 'caería'],
        ['marco negativo', { windowFrame: -2, windowFrameAuto: false }, 'caería'],
        ['marco que se come la ventana', { windowFrame: 50, windowFrameAuto: false }, 'se come la ventana'],
        ['sin espacio entre soportes', { length: 12 }, 'entre los soportes'],
        ['caja más baja que tapa y soportes', { height: 8 }, 'demasiado baja'],
        ['sin pared para las espigas del frente', { height: 11 }, 'espigas'],
        ['grosor de tapa inválido', { lidThickness: -1 }, 'tapa'],
        ['holgura negativa', { slideClearance: -0.1 }, 'negativa'],
      ];
      for (const [name, override, fragment] of cases) {
        const r = buildSlidingSupportBox({ ...SUPPORTS, ...override });
        assert(r.errors.length > 0, `${name}: no produjo error`);
        assert(r.panels.length === 0, `${name}: devolvió piezas pese al error`);
        assert(r.errors.some((e) => e.toLowerCase().includes(fragment)),
          `${name}: esperaba un error con "${fragment}", salió: ${r.errors.join(' | ')}`);
      }
      // Varios problemas a la vez se muestran juntos, no de uno en uno.
      const both = buildSlidingSupportBox({ ...SUPPORTS, slideClearance: 3, windowFrame: 50, windowFrameAuto: false });
      assert(both.errors.length >= 2, `esperaba 2+ errores juntos, salió: ${both.errors.join(' | ')}`);
    });

    check('soportes: avisos que no bloquean', () => {
      const cases = [
        ['holgura en 0', { slideClearance: 0 }, 'presión'],
        ['holgura grande', { slideClearance: 0.8 }, 'bailar'],
        ['tramo delantero del marco angosto para su largo', { length: 300 }, 'quebrarse'],
        ['tapa que pandea', { length: 400, width: 400, tabWidth: 24 }, 'pandear'],
      ];
      for (const [name, override, fragment] of cases) {
        const r = buildSlidingSupportBox({ ...SUPPORTS, ...override });
        assert(r.errors.length === 0, `${name}: debía generar, pero dio ${r.errors.join(' | ')}`);
        assert(r.warnings.some((w) => w.toLowerCase().includes(fragment)),
          `${name}: esperaba un aviso con "${fragment}", salió: ${r.warnings.join(' | ') || '(ninguno)'}`);
      }
      assert(sup.warnings.length === 0, `la caja de referencia no debería avisar nada: ${sup.warnings.join(' | ')}`);
    });

    check('soportes: barrido de parámetros, nada explota ni devuelve NaN', () => {
      let built = 0;
      for (const thickness of [1.5, 3, 6]) {
        for (const kerf of [0, 0.16, 0.3]) {
          for (const dims of [[40, 40, 40], [100, 150, 80], [300, 200, 120]]) {
            for (const frame of [undefined, 2, 20]) {
              for (const dimensionMode of ['outer', 'inner']) {
                const base = {
                  length: dims[0], width: dims[1], height: dims[2], thickness, kerf, dimensionMode,
                  lidType: 'sliding', slideMethod: 'supports', slideClearance: 0.2,
                  ...(frame === undefined ? {} : { windowFrame: frame, windowFrameAuto: false }),
                };
                const r = buildSlidingSupportBox({ ...base, tabWidth: supportAutoTabWidth(base) });
                const label = `t=${thickness} k=${kerf} dims=${dims} marco=${frame ?? 'auto'} ${dimensionMode}`;
                for (const m of [...r.errors, ...r.warnings]) {
                  assert(!/NaN|undefined|Infinity/.test(m), `${label}: mensaje roto "${m}"`);
                }
                if (r.errors.length > 0) continue;
                built += 1;
                for (const p of r.panels) {
                  assertSimplePolygon(p.points, `${p.id} ${label}`);
                  for (const f of p.features ?? []) assertSimplePolygon(f.points, `${p.id}.${f.id} ${label}`);
                }
              }
            }
          }
        }
      }
      assert(built > 20, `sólo ${built} combinaciones generaron piezas: el barrido no está probando nada`);
    });
```

- [ ] **Step 2: Correr las pruebas y ver que fallan**

Esperado: fallan `errores que bloquean` (mensaje genérico "Medidas imposibles…" sin los fragmentos) y `avisos que no bloquean` (no hay avisos). El barrido puede pasar ya.

- [ ] **Step 3: Implementar `validate` y `warningsFor` completos**

Reemplazar las dos funciones en `js/boxes/sliding-support-box.js` (borrar el comentario "Task 2: sólo lo imprescindible…"):

```js
function validate({
  Lo, Wo, Ho, t, tl, h, m, kerf, tabWidth,
  spanX, spanY, spanZ, spanZFront, frontHeight, supportHeight,
}) {
  const errors = validateBasics({ t, kerf, tabWidth, Lo, Wo, Ho });
  if (errors.length > 0) return errors;

  const positive = (value) => Number.isFinite(value) && value > 0;
  if (!positive(tl)) errors.push('El grosor de la tapa debe ser mayor que 0.');
  if (!Number.isFinite(h) || h < 0) errors.push('La holgura de deslizamiento no puede ser negativa.');
  if (!Number.isFinite(m)) errors.push('El marco de la ventana debe ser un número.');
  if (errors.length > 0) return errors;

  // Kerf y geometría van en un solo lote: una caja inválida por varios motivos
  // los muestra todos, en vez de obligar a arreglarlos de uno en uno.
  if (kerf >= t) errors.push(KERF_TOO_BIG);
  if (h >= t) {
    errors.push(
      `Con una holgura de ${h} mm y material de ${t} mm, la tapa ya no se apoya sobre los soportes. Baja la holgura.`,
    );
  }
  if (m - h <= 0) {
    errors.push(
      `Un marco de ${m} mm con ${h} mm de holgura no sujeta la tapa: se caería por la ventana. Sube el marco.`,
    );
  }
  if (spanX <= 2 * t || spanY <= 0) {
    errors.push(
      `El material de ${t} mm es demasiado grueso para una caja de ${Lo} × ${Wo} mm: no queda espacio entre los soportes.`,
    );
  } else if (spanX - 2 * m <= 0 || spanY - 2 * m <= 0) {
    errors.push(
      `Un marco de ${m} mm se come la ventana en una caja de ${Lo} × ${Wo} mm. Baja el marco.`,
    );
  }
  if (supportHeight <= 0) {
    errors.push(
      `Una caja de ${Ho} mm de alto es demasiado baja para su base, su tapa de ${tl} mm y TOP: no quedan soportes.`,
    );
  } else if (spanZFront <= 0) {
    errors.push(
      `El frente queda de ${frontHeight.toFixed(1)} mm: no deja pared entre la base y la tapa para las espigas.`,
    );
  }
  if (errors.length > 0) return errors;

  errors.push(...validateTabsVsKerf(
    [
      ['largo', spanX],
      ['ancho', spanY],
      ['alto del frente', spanZFront],
      ['alto del fondo', spanZ],
    ],
    tabWidth,
    kerf,
  ));
  return errors;
}

function warningsFor({
  jointWidths, t, kerf, tabWidth, h, tl, m, spanX, lidWidth, lidDepth,
}) {
  const warnings = commonWarnings({ jointWidths, t, kerf, tabWidth });
  // El tramo del marco sobre la entrada de la tapa no tiene FRONT debajo: lo
  // sujetan sólo sus dos puntas, encajadas en los laterales.
  const frontBar = t + m;
  if (frontBar < spanX / FRONT_BAR_RATIO) {
    warnings.push(
      `El tramo del marco sobre la entrada de la tapa mide ${frontBar.toFixed(1)} mm de ancho para ${spanX.toFixed(0)} mm de largo, y sólo lo sujetan sus puntas: puede quebrarse. Sube el marco de la ventana.`,
    );
  }
  if (h === 0) {
    warnings.push('Holgura en 0: la tapa entrará a presión y no va a deslizar.');
  }
  if (h > 0.5) {
    warnings.push(`Holgura de ${h} mm: la tapa va a bailar entre los soportes y el marco.`);
  }
  const narrowestLid = Math.min(lidWidth, lidDepth);
  if (narrowestLid / tl > 60) {
    warnings.push(
      `La tapa de ${tl} mm mide ${narrowestLid.toFixed(0)} mm de lado: se va a pandear en el medio.`,
    );
  }
  return warnings;
}
```

- [ ] **Step 4: Correr las pruebas y ver que pasan**

Esperado: `✅ 138/138 checks OK`.

- [ ] **Step 5: Commit** (sólo si Dani lo autorizó)

```bash
git add js/boxes/sliding-support-box.js test.html
git commit -m "Validate and warn for the glued-support sliding lid"
```

---

### Task 4: Interfaz — selector de método, marco y nota de armado

**Files:**
- Modify: `index.html` (bloque `#slidingFields`, ~líneas 98–126; texto de ayuda del radio "Tapa", ~línea 76)
- Modify: `js/ui/app.js`

**Interfaces:**
- Consumes: `buildSlidingSupportBox`, `autoTabWidth`, `windowFrameFor` (Task 2); el resultado trae `supports` y no trae `groove` ni `realOuterHeight`.
- Produces: radios `name="slideMethod"` (`groove` | `supports`); campos `#windowFrame`, `#windowFrameAuto`; contenedores `#grooveField`, `#windowFrameField`.

- [ ] **Step 1: Escribir la verificación de interfaz (falla)**

Guardar este script en el scratchpad como `ui-check.js` (no va al repo). Con el servidor corriendo y `agent-browser open http://localhost:8765/` hecho, se corre con `agent-browser eval "$(cat ui-check.js)"`:

```js
(async () => {
  const wait = () => new Promise((r) => setTimeout(r, 400));
  const pick = (sel) => { const el = document.querySelector(sel); el.checked = true; el.dispatchEvent(new Event('change', { bubbles: true })); };
  const out = {};
  pick('#lid-sliding'); await wait();
  out.grooveDefault = {
    grooveVisible: !document.getElementById('grooveField').hidden,
    frameHidden: document.getElementById('windowFrameField').hidden,
    hasGroove: !!document.querySelector('#preview [id$="-groove"]'),
  };
  pick('#slide-supports'); await wait();
  out.supports = {
    grooveHidden: document.getElementById('grooveField').hidden,
    frameVisible: !document.getElementById('windowFrameField').hidden,
    frameValue: document.getElementById('windowFrame').value,
    frameDisabled: document.getElementById('windowFrame').disabled,
    hasWindow: !!document.querySelector('#preview [id="top-window"]'),
    hasSupports: !!document.querySelector('#preview [id="support-1"]') && !!document.querySelector('#preview [id="support-2"]'),
    note: document.getElementById('engraveNote').hidden ? null : document.getElementById('engraveNote').textContent,
    summary: document.getElementById('summary').textContent,
  };
  const auto = document.getElementById('windowFrameAuto');
  auto.checked = false; auto.dispatchEvent(new Event('change', { bubbles: true }));
  const frame = document.getElementById('windowFrame');
  frame.value = '0.1'; frame.dispatchEvent(new Event('change', { bubbles: true })); await wait();
  out.badFrameError = document.getElementById('warnings').textContent;
  auto.checked = true; auto.dispatchEvent(new Event('change', { bubbles: true })); await wait();
  pick('#slide-groove'); await wait();
  out.backToGroove = {
    grooveVisible: !document.getElementById('grooveField').hidden,
    hasGroove: !!document.querySelector('#preview [id$="-groove"]'),
    hasSupports: !!document.querySelector('#preview [id="support-1"]'),
  };
  return out;
})()
```

Esperado ahora: excepción (`#grooveField` no existe).

Resultado esperado al terminar la tarea (con los valores por defecto de la página: 3 mm de material):
- `grooveDefault`: `grooveVisible: true, frameHidden: true, hasGroove: true`
- `supports`: `grooveHidden: true, frameVisible: true, frameValue: "7.5", frameDisabled: true, hasWindow: true, hasSupports: true`, `note` con "Pega SUPPORT 1 y 2", `summary` **sin** "alto real con reborde"
- `badFrameError` contiene "caería"
- `backToGroove`: `grooveVisible: true, hasGroove: true, hasSupports: false`

- [ ] **Step 2: Cambiar `index.html`**

Dentro de `<div class="field sliding-fields" id="slidingFields" hidden>`, como **primer** hijo (antes del campo "Grosor de la tapa"):

```html
            <div class="field field-radio-group">
              <span class="field-label">Método del riel</span>
              <div class="radio-option">
                <input type="radio" id="slide-groove" name="slideMethod" value="groove" checked>
                <label for="slide-groove">Canal grabado</label>
              </div>
              <div class="radio-option">
                <input type="radio" id="slide-supports" name="slideMethod" value="supports">
                <label for="slide-supports">Soportes pegados</label>
              </div>
              <p class="help">
                "Canal grabado": la tapa corre en un canal vaciado en laterales y fondo.
                "Soportes pegados": la caja queda cerrada como la de espigas, con una
                ventana en TOP; dos placas (SUPPORT 1 y 2) se pegan por dentro de los
                laterales, apoyadas en la base, y la tapa corre sobre ellas, sujeta por
                el marco de la ventana. No se graba nada: mejor para material delgado.
              </p>
            </div>
```

Al `<div class="field">` que contiene "Profundidad del canal" agregarle `id="grooveField"`:

```html
            <div class="field" id="grooveField">
```

Justo después del cierre de ese `div` (antes del campo "Holgura de deslizamiento"):

```html
            <div class="field" id="windowFrameField" hidden>
              <label for="windowFrame">Marco de la ventana <span class="unit">mm</span></label>
              <input type="number" id="windowFrame" name="windowFrame" value="7.5" step="0.1" min="0.01" inputmode="decimal">
              <div class="field-checkbox">
                <input type="checkbox" id="windowFrameAuto" name="windowFrameAuto" checked>
                <label for="windowFrameAuto">Automático (grosor + 4.5 mm)</label>
              </div>
              <p class="help">
                Cuánto material de TOP queda alrededor de la ventana, medido desde la
                cara interior de cada pared. Es lo que sujeta la tapa por arriba.
              </p>
            </div>
```

Reemplazar el `<p class="help">` de "Holgura de deslizamiento" por:

```html
              <p class="help">
                El juego que se deja para que la tapa corra sin trabarse: con canal
                grabado, cuánto más alto es el canal que la tapa; con soportes, el
                espacio entre la tapa y TOP, y a cada lado contra los laterales. Es
                aparte del kerf. Calíbrala con un recorte antes de cortar la caja.
              </p>
```

En el `<p class="help">` del radio "Tapa", reemplazar la frase de "Deslizante":

```
              "Deslizante": la tapa corre dentro de un canal vaciado en laterales y
              fondo, y entra por el frente, que queda más bajo.
```

por:

```
              "Deslizante": la tapa entra por el frente, que queda más bajo, y corre
              por un canal grabado en las paredes o sobre dos soportes pegados por
              dentro (elige el método abajo).
```

- [ ] **Step 3: Cambiar `js/ui/app.js`**

1. Import, después del de `sliding-box.js`:

```js
import {
  buildSlidingSupportBox, autoTabWidth as slidingSupportTabWidth, windowFrameFor,
} from '../boxes/sliding-support-box.js';
```

2. Referencias al DOM, después de `const grooveAutoEl = …`:

```js
const grooveField = document.getElementById('grooveField');
const windowFrameField = document.getElementById('windowFrameField');
const windowFrameEl = document.getElementById('windowFrame');
const windowFrameAutoEl = document.getElementById('windowFrameAuto');
```

3. Reemplazar `BUILDERS` y `builderFor` por:

```js
// Cada tipo de tapa trae su generador y su cálculo de espiga automática: el
// tramo de junta más corto no es el mismo en una caja cerrada que en una con
// el frente rebajado. La tapa deslizante tiene dos generadores, uno por
// método de riel.
const BUILDERS = {
  sliding: { build: buildSlidingBox, autoTab: slidingTabWidth },
  slidingSupports: { build: buildSlidingSupportBox, autoTab: slidingSupportTabWidth },
  hinged: { build: buildHingedBox, autoTab: hingedTabWidth },
  hingedDouble: { build: buildHingedDoubleBox, autoTab: hingedDoubleTabWidth },
  default: { build: buildBox, autoTab: simpleTabWidth },
};
const builderKey = ({ lidType, slideMethod }) => (
  lidType === 'sliding' && slideMethod === 'supports' ? 'slidingSupports' : lidType
);
const builderFor = (params) => BUILDERS[builderKey(params)] ?? BUILDERS.default;
```

4. En `readParams`, reemplazar el bloque `if (sliding) { … }` por:

```js
  if (sliding) {
    lidThicknessEl.disabled = lidThicknessAutoEl.checked;
    if (lidThicknessAutoEl.checked) lidThicknessEl.value = params.thickness;
    params.lidThickness = parseFloat(lidThicknessEl.value);
    params.slideClearance = number('slideClearance');

    params.slideMethod = form.elements.slideMethod.value;
    const supports = params.slideMethod === 'supports';
    grooveField.hidden = supports;
    windowFrameField.hidden = !supports;

    if (supports) {
      params.windowFrameAuto = windowFrameAutoEl.checked;
      windowFrameEl.disabled = windowFrameAutoEl.checked;
      if (windowFrameAutoEl.checked) {
        windowFrameEl.value = round(windowFrameFor({ thickness: params.thickness }), 2);
      }
      params.windowFrame = parseFloat(windowFrameEl.value);
    } else {
      params.grooveDepthAuto = grooveAutoEl.checked;
      grooveDepthEl.disabled = grooveAutoEl.checked;
      if (grooveAutoEl.checked) {
        grooveDepthEl.value = round(Math.min(params.thickness / 2, 6), 2);
      }
      params.grooveDepth = parseFloat(grooveDepthEl.value);
    }
  }
```

5. En `readParams`, la línea `params.tabWidth = round(builderFor(lidType).autoTab(params), 1);` pasa a:

```js
    params.tabWidth = round(builderFor(params).autoTab(params), 1);
```

6. En `recompute`, `const box = builderFor(params.lidType).build(params);` pasa a:

```js
  const box = builderFor(params).build(params);
```

7. En `recompute`, reemplazar el bloque `if (box.groove) { … } else { … }` por:

```js
  if (box.groove) {
    engraveNote.textContent =
      `Los rectángulos rojos se vacían a ${round(box.groove.depth, 2)} mm de profundidad: ` +
      'no son cortes pasantes. En LightBurn entran en su propia capa por color.';
    engraveNote.hidden = false;
  } else if (box.supports) {
    engraveNote.textContent =
      'Pega SUPPORT 1 y 2 por dentro de LEFT y RIGHT, apoyados sobre BOTTOM, antes de cerrar la caja con TOP.';
    engraveNote.hidden = false;
  } else {
    engraveNote.hidden = true;
  }
```

8. En el listener de `downloadBtn`, reemplazar `SUFFIXES` y la línea de `lid` por:

```js
  const SUFFIXES = {
    flat: '-tapaplana',
    sliding: '-deslizante',
    slidingSupports: '-deslizante-soportes',
    hinged: '-bisagra',
    hingedDouble: '-bisagra-doble',
  };
  const lid = SUFFIXES[builderKey({
    lidType: form.elements.lidType.value,
    slideMethod: form.elements.slideMethod.value,
  })] ?? '';
```

- [ ] **Step 4: Correr la verificación de interfaz y los self-checks**

1. `agent-browser open http://localhost:8765/` y correr `ui-check.js`. Esperado: los valores listados en el Step 1.
2. Revisar la consola: `agent-browser console` sin errores.
3. Correr `test.html`: `✅ 138/138 checks OK` (esta tarea no agrega checks a `test.html`).
4. Captura para Dani: `agent-browser screenshot` con "Deslizante" + "Soportes pegados" elegidos, y guardar el SVG descargado de la caja 100×150×80 en el scratchpad para que lo abra en Inkscape/LightBurn.

- [ ] **Step 5: Commit** (sólo si Dani lo autorizó)

```bash
git add index.html js/ui/app.js
git commit -m "Let the sliding lid choose between groove and glued supports"
```

---

### Task 5: Documentación y cierre

**Files:**
- Modify: `README.md` (tabla de parámetros ~líneas 29–38, "Cómo está hecho" ~línea 64, "Verificación" ~línea 72)

**Interfaces:**
- Consumes: todo lo anterior. Sólo texto.

- [ ] **Step 1: README**

1. En la fila "Tapa" de la tabla, cambiar `"Deslizante": la tapa corre dentro de un canal vaciado en laterales y fondo.` por:
   `"Deslizante": la tapa entra por el frente y corre por un canal vaciado en laterales y fondo ("Canal grabado") o sobre dos placas pegadas por dentro de los laterales ("Soportes pegados": caja cerrada con ventana en TOP, sin grabar nada; pensado para material delgado como plywood de 3 mm).`
2. Agregar dos filas después de "Grosor de la tapa (mm)":
   - `| Método del riel | Canal grabado | Solo con tapa deslizante. "Canal grabado" vacía un canal en las paredes. "Soportes pegados" deja las paredes enteras: la tapa corre sobre SUPPORT 1 y 2, pegados por dentro de los laterales y apoyados en la base, y la sujeta por arriba el marco de la ventana de TOP. En modo "interiores", el espacio útil se mide entre soportes. |`
   - `| Marco de la ventana (mm) | grosor + 4.5 | Solo con soportes pegados. Material de TOP alrededor de la ventana, medido desde la cara interior de cada pared. Con "Automático" marcado es el grosor del material (lo que ocupa el soporte) más 4.5 mm de margen. |`
3. En "Profundidad del canal" cambiar `Solo con tapa deslizante.` por `Solo con tapa deslizante y canal grabado.`
4. En "Holgura de deslizamiento" agregar al final: `Con soportes pegados es el juego entre la tapa y TOP, y a cada lado contra los laterales.`
5. En "Cómo está hecho", después de `sliding-box.js` (tapa deslizante), agregar: `` `sliding-support-box.js` (tapa deslizante con soportes pegados), ``.
6. En "Verificación", cambiar `**117 checks**` por el número real que da `test.html` (esperado **138**).

- [ ] **Step 2: Corrida final completa**

1. `test.html`: `✅ 138/138 checks OK`.
2. `ui-check.js` otra vez: mismos resultados que en la Task 4.
3. `git diff main --stat`: sólo `index.html`, `js/ui/app.js`, `js/core/panel.js`, `js/boxes/sliding-support-box.js`, `test.html`, `README.md`, y los docs del spec/plan. **`js/boxes/sliding-box.js` no debe aparecer.**

- [ ] **Step 3: Commit** (sólo si Dani lo autorizó)

```bash
git add README.md
git commit -m "Document the glued-support sliding lid"
```

- [ ] **Step 4: Entregar a Dani**

Reportar: checks, captura, SVG de referencia en el scratchpad, y pedirle la prueba física del spec (cortar la 100×150×80 en plywood de 3 mm). Mencionar aparte el hallazgo de `holeFeature` (dibuja los agujeros redondos `kerf/2` hacia afuera, lo contrario a `rectHoleFeature`), sin cambiarlo.
