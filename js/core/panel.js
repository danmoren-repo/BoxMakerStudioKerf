import { dedupePoints } from './geometry.js';
import { edgeProfile } from './finger-joint.js';

// Rectangle walked clockwise in SVG coordinates (y grows downward). Each entry
// maps the edge-local (u, v) frame onto panel coordinates: u along the edge,
// v away from the panel.
const EDGES = [
  { key: 'top', origin: () => ({ x: 0, y: 0 }), dir: { x: 1, y: 0 }, out: { x: 0, y: -1 }, axis: 'width' },
  { key: 'right', origin: (w) => ({ x: w, y: 0 }), dir: { x: 0, y: 1 }, out: { x: 1, y: 0 }, axis: 'height' },
  { key: 'bottom', origin: (w, h) => ({ x: w, y: h }), dir: { x: -1, y: 0 }, out: { x: 0, y: 1 }, axis: 'width' },
  { key: 'left', origin: (w, h) => ({ x: 0, y: h }), dir: { x: 0, y: -1 }, out: { x: -1, y: 0 }, axis: 'height' },
];

export function panelOutline(panel, material) {
  const points = [];

  for (const edge of EDGES) {
    const spec = panel.edges[edge.key] ?? { gender: 'plain' };
    const edgeLength = edge.axis === 'width' ? panel.width : panel.height;
    const profile = edgeProfile({
      edgeLength,
      gender: spec.gender,
      thickness: material.thickness,
      kerf: material.kerf,
      targetTabWidth: material.tabWidth,
      jointStart: spec.jointStart ?? 0,
      jointSpan: spec.jointSpan ?? edgeLength,
      startsSolid: spec.startsSolid ?? false,
    });
    const origin = edge.origin(panel.width, panel.height);
    for (const p of profile) {
      points.push({
        x: origin.x + edge.dir.x * p.u + edge.out.x * p.v,
        y: origin.y + edge.dir.y * p.u + edge.out.y * p.v,
      });
    }
  }

  return dedupePoints(points);
}

// A rectangular interior contour of the panel, in the same local coordinates as
// its outline. `depth` is how far it is hollowed into the material: it is not a
// through cut, so it never carries kerf compensation.
export function pocketFeature({ id, x, y, width, height, depth, layer = 'engrave' }) {
  return {
    id,
    layer,
    kind: 'pocket',
    depth,
    points: [
      { x, y },
      { x: x + width, y },
      { x: x + width, y: y + height },
      { x, y: y + height },
    ],
  };
}
