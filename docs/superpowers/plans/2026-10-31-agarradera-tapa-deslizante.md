# Agarradera de la tapa deslizante — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que la tapa deslizante salga con una lengüeta redondeada sobresaliendo del canto delantero, para poder sacarla con los dedos.

**Architecture:** La tapa deja de generarse con `panelOutline` y pasa a dibujarse punto por punto, igual que la tapa de la bisagra. Las funciones de manija ya existen y se exportan desde `hinged-box.js`; acá sólo se consumen.

**Tech Stack:** JavaScript ES modules, sin dependencias, sin build step. Self-checks en `test.html`.

**Spec:** `docs/superpowers/specs/2026-10-31-agarradera-tapa-deslizante-design.md`.

## Global Constraints

- **Rama:** `divisiones-con-tab`. No commits automáticos, nunca `git push`.
- **Ejes:** X = largo, Y = ancho (dirección en que desliza la tapa), Z = alto.
- **La lengüeta** va centrada en el canto `y = 0` de la tapa y sobresale hacia `y` negativo.
- **Valores por defecto:** ancho 20 mm, profundidad grosor + 5 mm, radio de punta 2 mm. Se toman de `handleWidthFor`, `handleDepthFor` y `handleCornerRadiusFor` de `hinged-box.js`.
- **Mensajes de error (copia exacta):**
  - `El ancho de la manija debe ser mayor que 0.` (ya existe)
  - `La profundidad de la manija debe ser mayor que 0.` (ya existe)
  - `La manija (${hw} mm) es más ancha que la tapa (${lidW} mm): no deja material a los costados.`

## Review Focus

1. **Tapa angosta con manija por defecto.** Una caja de 30 mm de largo con manija de 20 mm no deja material a los costados: debe salir el error, no una tapa partida en dos. Lo cubre la Task 1.
2. **La tapa con bisagra no cambia.** Usa las mismas funciones; tiene que salir idéntica. Lo cubre la Task 1.
3. **Los dos métodos de deslizante.** Canal grabado y soportes pegados tienen tapas de medidas distintas: la lengüeta va centrada en las dos. Lo cubre la Task 2.
4. **La tapa sigue entrando.** La lengüeta no puede quedar dentro del recorrido: el ancho de la tapa, sin contar la lengüeta, no cambia. Lo cubre la Task 2.
5. **Manija con valores raros** (0, negativa, vacía): error claro, no `NaN` en los puntos. Lo cubre la Task 1.

---

### Task 1: La forma, en `sliding-box.js`

**Files:**
- Modify: `js/boxes/sliding-box.js`
- Test: `test.html`

**Interfaces:**
- Produces: `slidingLidPoints({ width, depth, handleWidth, handleDepth, radius }) -> Point[]`, exportada desde `sliding-box.js` para que la use también la caja con soportes.
- Produces: `validateSlidingHandle({ handleWidth, handleDepth, lidWidth, t }) -> string[]`, exportada igual.
- Consumes: `handleWidthFor`, `handleDepthFor`, `handleCornerRadiusFor`, `roundedTabTip` de `./hinged-box.js`.

- [ ] **Step 1: Escribir los checks que fallan**

```js
check('agarradera: la tapa deslizante lleva la lengüeta centrada y sobresaliendo', () => {
  const pts = slidingLidPoints({ width: 100, depth: 80, handleWidth: 20, handleDepth: 8, radius: 2 });
  const ys = pts.map((p) => p.y);
  assert(near(Math.min(...ys), -8), `la punta debería estar en y=-8, dio ${Math.min(...ys)}`);
  assert(near(Math.max(...ys), 80), 'el canto del fondo no cambia');
  const tip = pts.filter((p) => p.y < 0).map((p) => p.x);
  assert(near((Math.min(...tip) + Math.max(...tip)) / 2, 50, 1e-6), 'la lengüeta debería estar centrada');
  assertSimplePolygon(pts, 'tapa deslizante con manija');
});

check('agarradera: sin lengüeta que quepa, validateSlidingHandle da error', () => {
  assert(validateSlidingHandle({ handleWidth: 20, handleDepth: 8, lidWidth: 100, t: 3 }).length === 0, 'cabe de sobra');
  assert(validateSlidingHandle({ handleWidth: 20, handleDepth: 8, lidWidth: 24, t: 3 }).length === 1, '20 + 2x3 no cabe en 24');
  assert(validateSlidingHandle({ handleWidth: 0, handleDepth: 8, lidWidth: 100, t: 3 }).length === 1, 'ancho 0');
  assert(validateSlidingHandle({ handleWidth: 20, handleDepth: -1, lidWidth: 100, t: 3 }).length === 1, 'profundidad negativa');
});

check('agarradera: la tapa con bisagra no cambia (regresión)', () => {
  const b = buildHingedBox(HINGED);
  assert(b.errors.length === 0, b.errors.join('|'));
  const lid = b.panels.find((p) => p.id === 'lid');
  assert(lid.points.some((p) => p.y < 0), 'la manija de la bisagra sigue ahí');
});
```

- [ ] **Step 2: Correr y verificar que fallan**

Run: abrir `http://localhost:8000/test.html` y leer `#summary`.
Expected: `slidingLidPoints is not defined`.

- [ ] **Step 3: Implementar las dos funciones en `js/boxes/sliding-box.js`**

`slidingLidPoints` devuelve el rectángulo `width × depth` en sentido horario con la lengüeta injertada en el canto `y = 0`, centrada: `{0,0}`, inicio de la lengüeta, los puntos de `roundedTabTip` (con `baseY: 0`, `tipY: -handleDepth`), fin de la lengüeta, `{width,0}`, `{width,depth}`, `{0,depth}`.

`validateSlidingHandle` devuelve los tres errores de Global Constraints según corresponda.

- [ ] **Step 4: Correr y verificar que pasan**

---

### Task 2: Cablearla en los dos métodos

**Files:**
- Modify: `js/boxes/sliding-box.js` (la pieza `lid`)
- Modify: `js/boxes/sliding-support-box.js` (la pieza `lid`)
- Test: `test.html`

**Interfaces:**
- Consumes: `slidingLidPoints` y `validateSlidingHandle` de la Task 1.

- [ ] **Step 1: Escribir los checks que fallan**

```js
check('agarradera: los dos métodos de tapa deslizante la llevan', () => {
  for (const [nombre, box] of [['canal', buildSlidingBox(SLIDE)], ['soportes', buildSlidingSupportBox(SUPPORTS)]]) {
    assert(box.errors.length === 0, `${nombre}: ${box.errors.join('|')}`);
    const lid = box.panels.find((p) => p.id === 'lid');
    assert(lid.points.some((p) => p.y < 0), `${nombre}: la tapa debería traer la lengüeta`);
    const xs = lid.points.map((p) => p.x);
    assert(near(Math.min(...xs), 0) && near(Math.max(...xs), lid.width),
      `${nombre}: la lengüeta no debe cambiar el ancho de la tapa`);
  }
});

check('agarradera: una tapa más angosta que la manija da error', () => {
  const b = buildSlidingBox({ ...SLIDE, length: 24 });
  assert(b.errors.some((e) => e.includes('es más ancha que la tapa')), b.errors.join('|') || '(sin errores)');
});
```

- [ ] **Step 2: Correr y verificar que fallan**

- [ ] **Step 3: Implementar**

En las dos cajas: leer `handleWidth` / `handleDepth` con los `*For` de `hinged-box.js`, validar con `validateSlidingHandle` junto al resto de las validaciones, y darle a la pieza `lid` sus `points` con `slidingLidPoints` en vez de dejar que `panelOutline` la saque lisa. El `width` y el `height` de la pieza no cambian.

- [ ] **Step 4: Correr y verificar que pasan**

---

### Task 3: Interfaz y README

**Files:**
- Modify: `index.html`
- Modify: `js/ui/app.js`
- Modify: `README.md`

- [ ] **Step 1: Mostrar los campos de manija también con la tapa deslizante**

En `js/ui/app.js`, los campos de ancho y profundidad de manija hoy sólo se muestran con la bisagra. Separarlos del bloque de la bisagra para que también salgan con la tapa deslizante, sin cambiar lo que ve la bisagra.

- [ ] **Step 2: Decir que sobresale**

En la ayuda del campo y en la tabla del README: la caja cerrada mide lo que dice "Exterior" más la profundidad de la manija hacia el frente.

- [ ] **Step 3: Correr todos los checks y verificar en la app**

Expected: `#summary` sin `✘`. En la app, con tapa deslizante, LID sale con la lengüeta y la caja se puede generar y descargar.
