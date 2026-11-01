# Divisores en la tapa con bisagra doble — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que la tapa con bisagra doble acepte divisores como los otros cuatro tipos de tapa, sin que ninguno trabe el giro de las dos mitades.

**Architecture:** En esta tapa el eje de cada mitad va de adelante hacia atrás, así que el recorte de esquina pasa del divisor de largo al de ancho — el espejo de la bisagra simple. Para que el recorte quepa, las dos placas intercambian desde qué canto se entallan, con un parámetro nuevo de `buildDividerPanels`. El resto es el mismo cableado que ya tienen las otras cajas.

**Tech Stack:** JavaScript ES modules, sin dependencias, sin build step. Self-checks en `test.html`.

**Spec:** `docs/superpowers/specs/2026-10-31-divisores-bisagra-doble-design.md`.

## Global Constraints

- **Rama:** `divisiones-con-tab`. No commits automáticos, nunca `git push`.
- **Ejes:** X = largo, Y = ancho, Z = alto. FRONT/BACK miden `Lo` de ancho; LEFT/RIGHT miden `spanY`.
- **Recorte de esquina:** `{ width: 2 * pivotInset, depth: pivotInset - tl / 2 }`, con `pivotInset = EDGE_MARGIN + rh`.
- **Umbral de la franja barrida:** el **alcance horizontal**, o sea `topCut.width`, nunca `topCut.depth`.
- **En la bisagra doble** el recorte va en el divisor de **ancho** y la comprobación de franja en el de **largo**. En la simple, al revés (como hoy).
- **Mensaje de error de la bisagra doble (copia exacta):** `Un divisor de largo queda dentro de la franja que barre la tapa al abrir: usa menos divisores de largo.`
- **En FRONT/BACK de la bisagra doble**, `y = 0` es el canto superior de la pared y los postes van en `y` negativo: las ranuras se sitúan contra `wallHeight`, y los obstáculos son los dos agujeros de bisagra y la muesca central.

## Review Focus

1. **Caja sin divisores con bisagra doble.** Debe salir idéntica a hoy. Lo cubre la Task 3.
2. **Las otras cuatro tapas no cambian.** El parámetro nuevo es opcional. Lo cubre la Task 1.
3. **Divisor de largo pegado al lateral.** Con muchos divisores de largo, uno cae en la franja barrida: error, no tapa trabada. Lo cubre la Task 3.
4. **La franja de la bisagra simple, con el umbral bueno.** Un divisor de ancho entre el umbral viejo y el nuevo debe dar error ahora y no antes. Lo cubre la Task 2.
5. **Ranura de cejilla contra el poste, el agujero o la muesca central.** Debe salir `slotTooClose`, no una pared debilitada. Lo cubre la Task 3.

---

### Task 1: `buildDividerPanels` aprende a recortar la otra placa

**Files:**
- Modify: `js/boxes/dividers.js`
- Test: `test.html`

**Interfaces:**
- Produces: `buildDividerPanels({ ..., topCornerCut, topCornerCutOn })`, donde `topCornerCutOn` es `'length'` (por defecto, lo de hoy) o `'width'`. Con `'width'`, el recorte va en la placa de ancho, que pasa a entallarse desde ABAJO, y la de largo desde ARRIBA.

- [ ] **Step 1: Escribir los checks que fallan**

```js
check('divisores: topCornerCutOn width recorta la placa de ancho e intercambia los cantos', () => {
  const args = {
    spanX: 144, spanY: 44, dividerHeight: 114, t: 3, kerf: 0.1,
    lengthDividers: 1, widthDividers: 1, topCornerCut: { width: 10, depth: 4 },
  };
  const porDefecto = buildDividerPanels(args);
  const enAncho = buildDividerPanels({ ...args, topCornerCutOn: 'width' });
  const cut = (panels, id) => panels.find((p) => p.id === id).points.some((p) => near(p.y, 4));
  assert(cut(porDefecto, 'divider-l1'), 'por defecto el recorte va en la placa de largo');
  assert(cut(enAncho, 'divider-w1'), 'con "width" el recorte va en la placa de ancho');
  // Si el recorte se mudó, la muesca de cruce tiene que haberse mudado también.
  const w = enAncho.find((p) => p.id === 'divider-w1').points;
  assert(w.some((p) => near(p.y, 114)), 'la placa de ancho ahora entalla desde abajo');
  const l = enAncho.find((p) => p.id === 'divider-l1').points;
  assert(l.some((p) => near(p.y, 0)) && l.some((p) => near(p.y, 57)), 'la placa de largo ahora entalla desde arriba');
  for (const p of enAncho) assertSimplePolygon(p.points, p.id);
});

check('divisores: sin topCornerCutOn, nada cambia (regresión)', () => {
  const args = {
    spanX: 144, spanY: 44, dividerHeight: 114, t: 3, kerf: 0.1, lengthDividers: 2, widthDividers: 1,
  };
  assert(JSON.stringify(buildDividerPanels(args)) === JSON.stringify(buildDividerPanels({ ...args, topCornerCutOn: 'length' })),
    'el valor por defecto debería ser "length"');
});
```

- [ ] **Step 2: Correr y verificar que fallan**

- [ ] **Step 3: Implementar**

En `buildDividerPanels`, derivar de `topCornerCutOn` qué canto entalla cada placa y a cuál se le pasa `topCornerCut`. Nada más cambia.

- [ ] **Step 4: Correr y verificar que pasan**

---

### Task 2: Arreglar el umbral de la franja en la bisagra simple

**Files:**
- Modify: `js/boxes/hinged-box.js`
- Test: `test.html`

- [ ] **Step 1: Escribir el check que falla**

```js
check('bisagra: la franja barrida se mide por su alcance horizontal, no por el hundimiento', () => {
  const b = buildHingedBox({ ...HINGED, lengthDividers: 0, widthDividers: 1 });
  const cut = b.dividerTopCutDepth;
  assert(Number.isFinite(cut), 'la caja debería reportar la profundidad del recorte');
  // Un divisor de ancho justo por dentro del alcance horizontal (2 * pivotInset)
  // pero por fuera del hundimiento tiene que dar error.
  const n = Math.ceil(b.inner.width / (2.2 * cut)) + 1;
  const malo = buildHingedBox({ ...HINGED, lengthDividers: 0, widthDividers: n });
  assert(malo.errors.includes(sweptBandError()),
    `con ${n} divisores de ancho uno cae en la franja: ${malo.errors.join(' | ') || '(sin errores)'}`);
});
```

- [ ] **Step 2: Correr y verificar que falla**

- [ ] **Step 3: Implementar**

Cambiar la comprobación para que compare contra `dividerTopCut.width` en vez de `dividerTopCut.depth`, y exportar también ese valor en el objeto devuelto para que la prueba lo pueda leer.

- [ ] **Step 4: Correr y verificar que pasa**

---

### Task 3: Cablear los divisores en `hinged-double-box.js`

**Files:**
- Modify: `js/boxes/hinged-double-box.js`
- Modify: `js/boxes/dividers.js` (mensaje nuevo)
- Test: `test.html`

**Interfaces:**
- Consumes: todo lo de las Tasks 1 y 2.
- Produces: `sweptBandLengthError()` en `dividers.js`, con el texto exacto de Global Constraints.

- [ ] **Step 1: Escribir los checks que fallan**

```js
check('bisagra doble: acepta divisores de largo y de ancho', () => {
  const b = buildHingedDoubleBox({ ...DOUBLE, lengthDividers: 1, widthDividers: 1 });
  assert(b.errors.length === 0, b.errors.join(' | '));
  assert(b.panels.some((p) => p.id === 'divider-l1'), 'falta DIVIDER-L1');
  assert(b.panels.some((p) => p.id === 'divider-w1'), 'falta DIVIDER-W1');
});

check('bisagra doble: el recorte de esquina va en el divisor de ancho', () => {
  const b = buildHingedDoubleBox({ ...DOUBLE, lengthDividers: 0, widthDividers: 1 });
  const w = b.panels.find((p) => p.id === 'divider-w1');
  assert(w.points.length > 4, 'la placa de ancho debería traer los recortes de esquina');
});

check('bisagra doble: sin divisores sale idéntica a no pasar el parámetro (regresión)', () => {
  const sin = buildHingedDoubleBox({ ...DOUBLE });
  const cero = buildHingedDoubleBox({ ...DOUBLE, lengthDividers: 0, widthDividers: 0 });
  assert(JSON.stringify(sin.panels) === JSON.stringify(cero.panels), 'los paneles deberían ser idénticos');
});

check('bisagra doble: un divisor de largo en la franja barrida da error', () => {
  const b = buildHingedDoubleBox({ ...DOUBLE, lengthDividers: 60, widthDividers: 0 });
  assert(b.errors.includes(sweptBandLengthError()),
    `esperaba el error de la franja: ${b.errors.join(' | ') || '(sin errores)'}`);
});

check('bisagra doble: con cejilla, las ranuras respetan postes, agujeros y muesca', () => {
  const b = buildHingedDoubleBox({ ...DOUBLE, lengthDividers: 1, widthDividers: 1, dividerMode: 'tabbed' });
  assert(b.errors.length === 0, b.errors.join(' | '));
  const front = b.panels.find((p) => p.id === 'front');
  assert(front.features.some((f) => f.id === 'divider-slot-l1'), 'falta la ranura en FRONT');
  assert(front.features.some((f) => f.id.startsWith('hinge-hole')), 'FRONT conserva sus agujeros de bisagra');
});
```

- [ ] **Step 2: Correr y verificar que fallan**

- [ ] **Step 3: Implementar**

Leer `lengthDividers` / `widthDividers`, calcular `innerHeight = wallHeight - t - tl` y `pivotInset = EDGE_MARGIN + rh`, validar con `validateDividers`, comprobar la franja contra `2 * pivotInset` en las posiciones de los divisores de largo, planear las cejillas con `planDividerTabs` (pasándole `topCutDepth` del recorte), situar las ranuras — las de largo en FRONT/BACK contra `wallHeight` con los agujeros y la muesca central como obstáculos, las de ancho en LEFT/RIGHT —, y añadir los paneles con `buildDividerPanels` usando `topCornerCutOn: 'width'`. Sumar `dividerWarnings` a los avisos.

- [ ] **Step 4: Correr y verificar que pasan**

---

### Task 4: Cerrar

- [ ] **Step 1: Correr todos los checks**

Expected: `#summary` sin `✘`.

- [ ] **Step 2: Verificar en la app**

Tapa con bisagra doble, 1 divisor de largo y 1 de ancho: salen DIVIDER-L1 y DIVIDER-W1, y con "Fijos con cejilla" también.

- [ ] **Step 3: README**

Quitar "reutilizado por los cuatro tipos de tapa" de la línea de `dividers.js`: ya son cinco.
