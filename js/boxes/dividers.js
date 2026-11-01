import { EPS } from '../core/geometry.js';

// Posiciones a distancias iguales dentro de un tramo, sin tocar los
// extremos: con `count` divisores, el tramo queda partido en `count + 1`
// partes iguales y cada divisor cae en un borde interno entre dos partes.
// Con count=0 no hay ninguna posición — el panel sale liso más abajo.
export function evenPositions(span, count) {
  const positions = [];
  for (let i = 1; i <= count; i += 1) positions.push((i * span) / (count + 1));
  return positions;
}

// Los dos tipos de divisor son la MISMA clase de pieza: una placa vertical
// que va del piso hasta justo debajo de la tapa. La de largo se para a lo
// ancho de la caja, la de ancho a lo largo; lo único que las distingue es
// desde qué canto se entalla la ranura de cruce. En cualquier cruce, lo que
// le falta a una es justo lo que le sobra a la otra, y encajan a media
// madera (spec 2026-10-31).
//
// Rectángulo width × height recorrido en sentido horario. `notchEdge` dice
// desde qué canto se entallan las ranuras de cruce: `'bottom'` (la placa de
// largo) o `'top'` (la de ancho). Sin posiciones sale un rectángulo liso.
// `topCornerCut` ({ width, depth }), opcional y sólo con `notchEdge:
// 'bottom'`, recorta un rectángulo en las dos esquinas superiores — deja
// paso a una tapa que gira hacia adentro de la caja.
// `tab` ({ width, y, protrude }), opcional, agrega una cejilla en cada
// extremo (x = 0 y x = width): `width` ya trae el kerf sumado, `y` es su
// centro en coordenadas de pieza.
export function buildDividerPoints({
  width, height, notchEdge, notchDepth, notchWidth, positions, topCornerCut, tab,
}) {
  const half = notchWidth / 2;
  const cut = topCornerCut;
  // El canto de arriba se camina de izquierda a derecha, así que sus
  // ranuras se insertan ordenadas de menor a mayor x.
  const topEdge = [];
  if (notchEdge === 'top') {
    topEdge.push({ x: 0, y: 0 });
    for (const p of [...positions].sort((a, b) => a - b)) {
      topEdge.push({ x: p - half, y: 0 });
      topEdge.push({ x: p - half, y: notchDepth });
      topEdge.push({ x: p + half, y: notchDepth });
      topEdge.push({ x: p + half, y: 0 });
    }
    topEdge.push({ x: width, y: 0 });
  } else if (cut) {
    topEdge.push(
      { x: 0, y: cut.depth }, { x: cut.width, y: cut.depth }, { x: cut.width, y: 0 },
      { x: width - cut.width, y: 0 }, { x: width - cut.width, y: cut.depth },
      { x: width, y: cut.depth },
    );
  } else {
    topEdge.push({ x: 0, y: 0 }, { x: width, y: 0 });
  }

  const points = [
    ...topEdge,
    ...(tab ? rightTabBump(width, tab) : []),
    { x: width, y: height },
  ];
  // El canto de abajo se camina de derecha a izquierda: ranuras de mayor a
  // menor x.
  if (notchEdge === 'bottom') {
    for (const p of [...positions].sort((a, b) => b - a)) {
      points.push({ x: p + half, y: height });
      points.push({ x: p + half, y: height - notchDepth });
      points.push({ x: p - half, y: height - notchDepth });
      points.push({ x: p - half, y: height });
    }
  }
  points.push({ x: 0, y: height });
  if (tab) points.push(...leftTabBump(tab));
  return points;
}

// Cejilla en el canto x = width, recorrido hacia abajo (y creciente).
function rightTabBump(width, { width: w, y, protrude }) {
  return [
    { x: width, y: y - w / 2 },
    { x: width + protrude, y: y - w / 2 },
    { x: width + protrude, y: y + w / 2 },
    { x: width, y: y + w / 2 },
  ];
}

// Cejilla en el canto x = 0, recorrido hacia arriba (y decreciente).
function leftTabBump({ width: w, y, protrude }) {
  return [
    { x: 0, y: y + w / 2 },
    { x: -protrude, y: y + w / 2 },
    { x: -protrude, y: y - w / 2 },
    { x: 0, y: y - w / 2 },
  ];
}

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
  lengthDividers, widthDividers, dividerHeight, t,
}) {
  const Nl = resolveCount(lengthDividers);
  const Nw = resolveCount(widthDividers);
  const errors = [];

  if (!isDividerCount(Nl) || !isDividerCount(Nw)) {
    errors.push('La cantidad de divisores debe ser un número entero de 0 en adelante.');
    return errors;
  }
  // La ranura de cruce llega hasta la mitad del alto: si eso no supera el
  // grosor del material, la muesca deja un filo más fino que su propio ancho,
  // o directamente se cruza con la muesca opuesta.
  if (Nl > 0 && Nw > 0 && dividerHeight / 2 <= t) {
    errors.push(
      `El alto interior de ${dividerHeight.toFixed(1)} mm es demasiado bajo para cruzar divisores de largo y de ancho: la ranura no deja material suficiente.`,
    );
  }
  return errors;
}

export function dividerWarnings({
  lengthDividers, widthDividers, spanX, spanY, t,
}) {
  const Nl = resolveCount(lengthDividers);
  const Nw = resolveCount(widthDividers);
  const warnings = [];

  if (Nl > 0) {
    const compartment = spanX / (Nl + 1);
    if (compartment < MIN_COMPARTMENT_RATIO * t) {
      warnings.push(
        `Los compartimentos de largo quedan de ${compartment.toFixed(1)} mm, muy angostos para ${t} mm de material.`,
      );
    }
  }
  if (Nw > 0) {
    const compartment = spanY / (Nw + 1);
    if (compartment < MIN_COMPARTMENT_RATIO * t) {
      warnings.push(
        `Los compartimentos de ancho quedan de ${compartment.toFixed(1)} mm, muy angostos para ${t} mm de material.`,
      );
    }
  }
  return warnings;
}

// `tabs`, opcional, es lo que devuelve planDividerTabs (anchos nominales):
// aquí se les suma el kerf, igual que a un dedo macho. La altura de la
// cejilla se mide desde el canto de abajo, y en coordenadas de pieza y = 0
// es el canto de arriba: de ahí el `dividerHeight - center`.
// `topCornerCutOn` dice a cuál de las dos placas se le recortan las esquinas
// superiores. En la bisagra simple es la de largo (el valor por defecto): el
// eje va de lado a lado pegado al fondo, y es esa placa la que llega hasta la
// pared trasera. En la bisagra doble es la de ancho, porque ahí cada mitad
// gira sobre un eje de adelante hacia atrás pegado a su lateral.
//
// El recorte vive en el canto de ARRIBA, igual que las muescas de la placa de
// ancho — y no caben los dos en el mismo canto. En vez de complicar el dibujo,
// las dos placas intercambian desde qué canto se entallan: al cruce a media
// madera sólo le importa que sean cantos opuestos, no cuál es cuál. Así la
// placa que lleva el recorte siempre entalla desde abajo.
export function buildDividerPanels({
  spanX, spanY, dividerHeight, t, kerf, lengthDividers, widthDividers,
  topCornerCut, topCornerCutOn = 'length', tabs,
}) {
  const Nl = resolveCount(lengthDividers);
  const Nw = resolveCount(widthDividers);
  if (Nl === 0 && Nw === 0) return [];

  const notchDepth = dividerHeight / 2;
  const notchWidth = t - kerf; // ranura compensada de kerf, como una arista hembra

  const cutOnWidth = topCornerCutOn === 'width';
  const lengthPoints = buildDividerPoints({
    width: spanY,
    height: dividerHeight,
    notchEdge: cutOnWidth ? 'top' : 'bottom',
    notchDepth,
    notchWidth,
    positions: evenPositions(spanY, Nw),
    topCornerCut: cutOnWidth ? undefined : topCornerCut,
    tab: tabs?.length ? {
      width: tabs.length.width + kerf,
      y: dividerHeight - tabs.length.center,
      protrude: tabs.length.protrude,
    } : undefined,
  });
  const widthPoints = buildDividerPoints({
    width: spanX,
    height: dividerHeight,
    notchEdge: cutOnWidth ? 'bottom' : 'top',
    notchDepth,
    notchWidth,
    positions: evenPositions(spanX, Nl),
    topCornerCut: cutOnWidth ? topCornerCut : undefined,
    tab: tabs?.width ? {
      width: tabs.width.width + kerf,
      y: dividerHeight - tabs.width.center,
      protrude: tabs.width.protrude,
    } : undefined,
  });

  const panels = [];
  for (let i = 1; i <= Nl; i += 1) {
    panels.push({ id: `divider-l${i}`, label: `DIVIDER-L${i}`, points: lengthPoints });
  }
  for (let j = 1; j <= Nw; j += 1) {
    panels.push({ id: `divider-w${j}`, label: `DIVIDER-W${j}`, points: widthPoints });
  }
  return panels;
}

// ── Divisores fijos con cejilla ──
// Cada divisor lleva una cejilla por extremo que entra en una ranura pasante
// de la pared: guía y sostiene sin pegamento (spec 2026-10-26).

export const NO_TAB_ROOM = 'No hay espacio para la cejilla de los divisores: el alto interior no alcanza, o se lo come el recorte de la tapa con bisagra.';
export const slotTooClose = (label, t) => `La ranura de un divisor en ${label} queda a menos de ${t} mm de otro corte de la pared.`;
export const sweptBandError = () => 'Un divisor de ancho queda dentro de la franja que barre la tapa al abrir: usa menos divisores de ancho.';
export const sweptBandLengthError = () => 'Un divisor de largo queda dentro de la franja que barre la tapa al abrir: usa menos divisores de largo.';

export function resolveDividerMode(mode) {
  return mode === 'tabbed' ? 'tabbed' : 'loose';
}

// Altura del centro de la cejilla, medida desde el canto de abajo de la
// placa. Las ranuras de cruce ya no compiten por la altura (son verticales),
// así que la cejilla va siempre a media altura salvo que el recorte superior
// de la tapa con bisagra se la coma; en ese caso, la altura libre más
// cercana a la media, y en empate la de abajo, que sostiene mejor (decisión
// de Dani). Los dos tipos de divisor usan la misma altura, así la caja se ve
// pareja por dentro.
export function tabCenter({
  dividerHeight: H, tabWidth, t, topCutDepth = 0,
}) {
  const r = tabWidth / 2 + t;
  if (H - r < r - EPS) return null;
  // Tocar el borde de la zona prohibida está permitido: deja `t` justo.
  let allowed = [[r, H - r]];
  if (topCutDepth > 0) {
    const limit = H - topCutDepth - r;
    allowed = allowed
      .map(([s, e]) => [s, Math.min(e, limit)])
      .filter(([s, e]) => e >= s - EPS);
  }
  if (allowed.length === 0) return null;

  const mid = H / 2;
  if (allowed.some(([s, e]) => mid >= s - EPS && mid <= e + EPS)) return mid;
  let best = null;
  for (const c of allowed.flat()) {
    if (best === null) { best = c; continue; }
    const d = Math.abs(c - mid);
    const dBest = Math.abs(best - mid);
    if (d < dBest - EPS || (Math.abs(d - dBest) <= EPS && c < best)) best = c;
  }
  return best;
}

// Decide las cejillas de los divisores (anchos nominales, sin kerf) y
// valida que quepan. En modo suelto, o sin divisores, no hay nada que hacer.
export function planDividerTabs({
  dividerMode, lengthDividers, widthDividers, spanX, spanY, dividerHeight, t,
  lengthTabWidth, widthTabWidth, widthProtrude = t, topCutDepth = 0,
}) {
  const Nl = resolveCount(lengthDividers);
  const Nw = resolveCount(widthDividers);
  if (resolveDividerMode(dividerMode) !== 'tabbed' || (Nl === 0 && Nw === 0)) {
    return { errors: [], tabs: null };
  }

  const widths = [Nl > 0 ? lengthTabWidth : 0, Nw > 0 ? widthTabWidth : 0];
  const center = tabCenter({
    dividerHeight, tabWidth: Math.max(...widths), t, topCutDepth,
  });
  if (center === null) return { errors: [NO_TAB_ROOM], tabs: null };

  // El conflicto ahora es horizontal: entre la raíz de la cejilla, que está
  // en el extremo de la placa, y la primera ranura de cruce. Hace falta un
  // grosor de material entre las dos, o sea medio compartimento de 1.5t.
  const errors = [];
  let length = null;
  let width = null;
  if (Nl > 0) {
    if (Nw > 0 && spanY / (Nw + 1) < 1.5 * t - EPS) errors.push(slotTooClose('FRONT/BACK', t));
    else length = { width: lengthTabWidth, center, protrude: t };
  }
  if (Nw > 0) {
    if (Nl > 0 && spanX / (Nl + 1) < 1.5 * t - EPS) errors.push(slotTooClose('LEFT/RIGHT', t));
    else width = { width: widthTabWidth, center, protrude: widthProtrude };
  }
  if (errors.length > 0) return { errors, tabs: null };
  return { errors, tabs: { length, width } };
}

// ¿Cabe esta ranura (nominal) en la pared? Necesita `t` de material alrededor:
// dentro de la zona con material y lejos de cualquier otro corte. Tocar el
// límite exacto está permitido.
export function slotFits(rect, { bounds, t, obstacles = [] }) {
  const ex = {
    x0: rect.x0 - t, y0: rect.y0 - t, x1: rect.x1 + t, y1: rect.y1 + t,
  };
  if (ex.x0 < bounds.x0 - EPS || ex.y0 < bounds.y0 - EPS
    || ex.x1 > bounds.x1 + EPS || ex.y1 > bounds.y1 + EPS) return false;
  return obstacles.every((o) => ex.x1 <= o.x0 + EPS || ex.x0 >= o.x1 - EPS
    || ex.y1 <= o.y0 + EPS || ex.y0 >= o.y1 - EPS);
}

export function featureBounds(feature) {
  const xs = feature.points.map((p) => p.x);
  const ys = feature.points.map((p) => p.y);
  return {
    x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys),
  };
}
