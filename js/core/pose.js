// Contrato de la pose: dónde y cómo está cada pieza en la caja armada.
// Matemática pura (sin three.js). Cada constructor de cajas declara una
// pose por pieza con este módulo, y el visor 3D la usa para colocarla.
//
// Convenciones (todo en milímetros, ángulos en radianes, vectores {x, y, z}):
//
// - Ejes: x = largo, y = ancho, z = alto hacia arriba; frente en y = −Wo/2,
//   fondo en y = +Wo/2; en planta el origen es el centro de la caja; en
//   altura z = 0 es la cara de abajo de BOTTOM.
// - Marco local de cada pieza: X = x_svg, Y = −y_svg (se voltea el eje
//   vertical del SVG), Z = grosor, extrusión centrada de −grosor/2 a +grosor/2.
// - El giro se declara con dos vectores: normal = hacia dónde mira la cara +Z
//   (la que el SVG muestra); up = hacia dónde apunta +Y; X = up × normal.
//   Siempre rotación pura, nunca espejo.
// - Convención de cara interior: en toda pieza que tenga un rebaje o un
//   grabado, normal apunta hacia el interior de la caja. (Es lo que garantiza
//   que los laterales espejo de la deslizante queden bien.)
// - origin = dónde cae la esquina (0,0) de la pieza; rectOrigin convierte
//   "centro del rectángulo [0,ancho]×[0,alto] de la pieza" a origin.
// - thickness = grosor con que se extruye la pieza (las tapas pueden tener
//   otro grosor que las paredes).

export const GROUPS = ['cuerpo', 'tapa', 'divisor', 'saliente'];

const EPS = 1e-9;

const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a, b) => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const scale = (a, k) => ({ x: a.x * k, y: a.y * k, z: a.z * k });

const isVec = (v) => v && [v.x, v.y, v.z].every((n) => typeof n === 'number' && Number.isFinite(n));
const isUnit = (v) => Math.abs(Math.hypot(v.x, v.y, v.z) - 1) <= EPS;
const copy = (v) => Object.freeze({ x: v.x, y: v.y, z: v.z });

function requireVec(v, name) {
  if (!isVec(v)) throw new Error(`pose: ${name} debe ser un vector {x, y, z}`);
}
function requireUnit(v, name) {
  requireVec(v, name);
  if (!isUnit(v)) throw new Error(`pose: ${name} debe medir 1`);
}

// Atajos para armar `open`.
export function slide(dir, distance) {
  return { kind: 'slide', dir, distance };
}
export function swing(axis, pivot, angleDeg) {
  return { kind: 'swing', axis, pivot, angle: (angleDeg * Math.PI) / 180 };
}

function validateOpen(open) {
  if (!open || typeof open !== 'object') throw new Error('pose: open es obligatorio');
  if (open.kind === 'slide') {
    requireUnit(open.dir, 'open.dir');
    if (typeof open.distance !== 'number' || !Number.isFinite(open.distance)) {
      throw new Error('pose: open.distance debe ser un número');
    }
    return Object.freeze({ kind: 'slide', dir: copy(open.dir), distance: open.distance });
  }
  if (open.kind === 'swing') {
    requireUnit(open.axis, 'open.axis');
    requireVec(open.pivot, 'open.pivot');
    if (typeof open.angle !== 'number' || !Number.isFinite(open.angle)) {
      throw new Error('pose: open.angle debe ser un número');
    }
    return Object.freeze({ kind: 'swing', axis: copy(open.axis), pivot: copy(open.pivot), angle: open.angle });
  }
  throw new Error("pose: open.kind debe ser 'slide' o 'swing'");
}

// Valida y devuelve la pose congelada.
export function makePose({ origin, normal, up, group, thickness, open }) {
  requireVec(origin, 'origin');
  requireUnit(normal, 'normal');
  requireUnit(up, 'up');
  if (Math.abs(dot(normal, up)) > EPS) throw new Error('pose: normal y up deben ser perpendiculares');
  if (!GROUPS.includes(group)) throw new Error(`pose: group debe ser uno de ${GROUPS.join(', ')}`);
  if (typeof thickness !== 'number' || !(thickness > 0)) throw new Error('pose: thickness debe ser positivo');
  return Object.freeze({
    origin: copy(origin), normal: copy(normal), up: copy(up),
    group, thickness, open: validateOpen(open),
  });
}

// Esquina (0,0) de la pieza a partir del centro de su rectángulo [0,width]×[0,height].
export function rectOrigin({ center, width, height, normal, up }) {
  const X = cross(up, normal);
  return add(sub(center, scale(X, width / 2)), scale(up, height / 2));
}

// Base del marco local: x = up × normal, y = up, z = normal.
export function poseBasis(pose) {
  return { x: cross(pose.up, pose.normal), y: { ...pose.up }, z: { ...pose.normal } };
}

// Punto del SVG (con su altura dentro del grosor) a coordenadas del mundo.
export function toWorld(pose, { x, y }, zLocal = 0) {
  const b = poseBasis(pose);
  return add(add(add(pose.origin, scale(b.x, x)), scale(b.y, -y)), scale(b.z, zLocal));
}

// Transformación de apertura para f en [0,1].
export function openTransform(pose, f) {
  const o = pose.open;
  if (o.kind === 'slide') return { offset: scale(o.dir, o.distance * f), swing: null };
  return {
    offset: { x: 0, y: 0, z: 0 },
    swing: { axis: o.axis, pivot: o.pivot, angle: o.angle * f },
  };
}

// Aplica la apertura a un punto del mundo (Rodrigues alrededor de pivot).
export function applyOpen(pose, worldPoint, f) {
  const t = openTransform(pose, f);
  let p = add(worldPoint, t.offset);
  if (t.swing) {
    const { axis: k, pivot, angle } = t.swing;
    const v = sub(p, pivot);
    const c = Math.cos(angle), s = Math.sin(angle);
    const r = add(add(scale(v, c), scale(cross(k, v), s)), scale(k, dot(k, v) * (1 - c)));
    p = add(pivot, r);
  }
  return p;
}
