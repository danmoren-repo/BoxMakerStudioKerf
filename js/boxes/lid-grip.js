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

export { EDGE_MARGIN };
