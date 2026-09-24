import { EDGE_MARGIN } from './hinged-box.js';
import { panelOutline } from '../core/panel.js';

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
