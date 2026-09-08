import { EPS } from './geometry.js';

export const MIN_SEGMENTS = 3;

// Splits a joint span into an odd number of equal segments, so the pattern is
// palindromic: both ends of the span behave the same, and a mating edge
// traversed in the opposite direction still lines up.
// `startsSolid` shifts the phase so the joint begins (and ends) with untouched
// material instead of a tab/slot. A shifted joint needs five segments to still
// carry two tabs.
export function computeSegments(span, targetTabWidth, startsSolid = false) {
  const minimum = startsSolid ? 5 : MIN_SEGMENTS;
  let count = Math.round(span / targetTabWidth);
  if (!Number.isFinite(count) || count < minimum) count = minimum;
  if (count % 2 === 0) count += 1;
  return { count, width: span / count };
}

// Profile of one panel edge, in edge-local coordinates: u runs 0..edgeLength
// along the edge, +v points away from the panel. Male edges grow tabs outward,
// female edges cut slots inward; both use the same segmentation, so a tab lands
// in its slot. Kerf is applied as a half-kerf outward offset of every cut line:
// the male tab is drawn one kerf wider and the female slot one kerf narrower,
// so both end up at the nominal width once the beam has eaten its share.
export function edgeProfile({
  edgeLength,
  gender,
  thickness,
  kerf = 0,
  targetTabWidth,
  jointStart = 0,
  jointSpan = edgeLength,
  startsSolid = false,
}) {
  const points = [{ u: 0, v: 0 }];

  if (gender !== 'male' && gender !== 'female') {
    points.push({ u: edgeLength, v: 0 });
    return points;
  }

  const { count, width } = computeSegments(jointSpan, targetTabWidth, startsSolid);
  const half = kerf / 2;
  const depth = gender === 'male' ? thickness : -thickness;

  for (let i = startsSolid ? 1 : 0; i < count; i += 2) {
    const nominalStart = jointStart + i * width;
    const nominalEnd = nominalStart + width;
    // Una feature que nace en la esquina de la pieza se dibuja hasta la esquina:
    // el medio kerf de compensación dejaría ahí una lengüeta más fina que el haz.
    const start = nominalStart <= EPS
      ? 0
      : (gender === 'male' ? nominalStart - half : nominalStart + half);
    const end = nominalEnd >= edgeLength - EPS
      ? edgeLength
      : (gender === 'male' ? nominalEnd + half : nominalEnd - half);
    points.push(
      { u: start, v: 0 },
      { u: start, v: depth },
      { u: end, v: depth },
      { u: end, v: 0 },
    );
  }

  points.push({ u: edgeLength, v: 0 });
  return points;
}

// Nominal (kerf-free) intervals covered by tabs, used by the self-checks to
// prove that a mating pair of edges interlocks.
export function jointIntervals({ jointStart = 0, jointSpan, targetTabWidth, startsSolid = false }) {
  const { count, width } = computeSegments(jointSpan, targetTabWidth, startsSolid);
  const intervals = [];
  for (let i = startsSolid ? 1 : 0; i < count; i += 2) {
    intervals.push([jointStart + i * width, jointStart + (i + 1) * width]);
  }
  return intervals;
}
