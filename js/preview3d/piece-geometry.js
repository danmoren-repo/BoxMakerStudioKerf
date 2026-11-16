// De contorno a sólido: convierte el contorno de corte de una pieza (más sus
// agujeros pasantes, rebajes y grabados de superficie) en sólidos de three.js,
// en el marco local de la pieza: X = x_svg, Y = −y_svg, Z = grosor centrado
// (de −grosor/2 a +grosor/2). Los rebajes se abren por la cara +Z (la dibujada).
import * as THREE from '../../vendor/three/three.module.min.js';

// El SVG tiene el eje vertical hacia abajo; el marco local lo tiene hacia arriba.
const flip = (pts) => pts.map((p) => ({ x: p.x, y: -p.y }));
const toVec = (pts) => pts.map((p) => new THREE.Vector2(p.x, p.y));

// Una capa = el contorno extruido de z0 a z1, con `holes` como agujeros.
function buildLayer(outline, holes, z0, z1) {
  const shape = new THREE.Shape(toVec(outline));
  for (const h of holes) shape.holes.push(new THREE.Path(toVec(h)));
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: z1 - z0, bevelEnabled: false });
  geometry.translate(0, 0, z0);
  return { geometry, z0, z1, holeCount: holes.length };
}

export function buildPieceGeometry(panel) {
  const T = panel.pose.thickness;
  const outline = flip(panel.points);
  const features = (panel.features || []).filter((f) => f && f.kind && f.layer && Array.isArray(f.points));

  const through = features.filter((f) => f.kind === 'hole').map((f) => flip(f.points));
  const pockets = features.filter((f) => f.kind === 'pocket');
  // Grabados de superficie: cualquier otro feature de la capa 'engrave' (sin profundidad).
  const engraves = features
    .filter((f) => f.kind !== 'hole' && f.kind !== 'pocket' && f.layer === 'engrave')
    .map((f) => flip(f.points));

  const half = T / 2;
  if (pockets.length === 0) {
    return { layers: [buildLayer(outline, through, -half, half)], engraves };
  }

  const p = pockets[0].depth;
  if (pockets.some((f) => f.depth !== p)) {
    throw new Error(`${panel.id ?? 'pieza'}: los rebajes tienen profundidades distintas, no se puede armar el sólido`);
  }
  const mid = half - p;
  return {
    layers: [
      buildLayer(outline, through, -half, mid),
      buildLayer(outline, [...through, ...pockets.map((f) => flip(f.points))], mid, half),
    ],
    engraves,
  };
}
