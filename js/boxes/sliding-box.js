import { panelOutline, pocketFeature } from '../core/panel.js';
import {
  autoTabWidthFromSpans,
  commonWarnings,
  jointSegments,
  KERF_TOO_BIG,
  outerDimensions,
  validateBasics,
  validateTabsVsKerf,
} from './shared.js';

const DEFAULT_CLEARANCE = 0.2;
const MAX_AUTO_GROOVE_DEPTH = 6;

// La tapa puede ser de otro material que la caja: caja de 10 con tapa de 3, o
// tapa de acrílico sobre caja de madera. Sin valor, copia el grosor de pared.
// Un valor presente pero absurdo se deja pasar a propósito, para que la
// validación pueda decirlo en vez de sustituirlo a la espalda del usuario.
export function lidThicknessFor({ thickness, lidThickness }) {
  return Number.isFinite(lidThickness) ? lidThickness : thickness;
}

// Automática: media pared, con tope, para no fresar más hondo de lo que hace
// falta en maciza gruesa. La tapa no agarra mejor por eso, y es tiempo de
// máquina. Con la casilla desmarcada manda el valor escrito, bueno o malo.
export function grooveDepthFor({ thickness, grooveDepth, grooveDepthAuto = true }) {
  if (!grooveDepthAuto && Number.isFinite(grooveDepth)) return grooveDepth;
  return Math.min(thickness / 2, MAX_AUTO_GROOVE_DEPTH);
}

// Ho se mide del suelo a la cara superior de la tapa, con la tapa apoyada en el
// piso del canal. La holgura va por encima de la tapa: así esa cota da exacta y
// lo que crece es el reborde. Laterales y fondo sobresalen h + t por encima.
export function slidingHeights(params) {
  const t = params.thickness;
  const tl = lidThicknessFor(params);
  const h = Number.isFinite(params.slideClearance) ? params.slideClearance : DEFAULT_CLEARANCE;
  const p = grooveDepthFor(params);
  const { Lo, Wo, Ho } = outerDimensions(params, t + tl);

  return {
    Lo, Wo, Ho, t, tl, h, p,
    grooveFloor: Ho - tl,
    grooveTop: Ho + h,
    wallHeight: Ho + h + t,
    frontHeight: Ho - tl,
    innerHeight: Ho - tl - t,
  };
}

// El tramo de junta más corto es el del frente, que es más bajo que el resto.
export function autoTabWidth(params) {
  const { Lo, Wo, t, frontHeight } = slidingHeights(params);
  return autoTabWidthFromSpans(
    [frontHeight - 2 * t, Lo - 2 * t, Wo - 2 * t],
    t,
  );
}

export function buildSlidingBox(params) {
  const { kerf, tabWidth } = params;
  const {
    Lo, Wo, Ho, t, tl, h, p,
    grooveFloor, grooveTop, wallHeight, frontHeight, innerHeight,
  } = slidingHeights(params);

  const spanX = Lo - 2 * t; // frente/fondo <-> base
  const spanY = Wo - 2 * t; // laterales <-> base
  const spanZFront = frontHeight - 2 * t; // frente <-> laterales
  const spanZBack = wallHeight - 2 * t; // fondo <-> laterales

  const errors = validate({
    Lo, Wo, Ho, t, tl, h, p, kerf, tabWidth,
    spanX, spanY, spanZFront, spanZBack, frontHeight,
  });
  if (errors.length > 0) return { errors, warnings: [], panels: [] };

  const joints = {
    x: jointSegments(spanX, tabWidth),
    y: jointSegments(spanY, tabWidth),
    z: jointSegments(spanZFront, tabWidth),
    zBack: jointSegments(spanZBack, tabWidth),
  };

  // Toda junta arranca y termina con material en la pieza hembra, para que las
  // esquinas no queden colgando de medio kerf.
  const SOLID = { startsSolid: true };

  // La tapa se dibuja una holgura más chica que el hueco donde vive: si llegara
  // al fondo de los tres canales entraría a presión y no deslizaría.
  const grip = p - h;
  const grooveHeight = tl + h;
  // El canal es una banda horizontal; en coordenadas de pieza, y = 0 es el canto
  // superior de la pared, así que z se lee al revés.
  const grooveY = wallHeight - grooveTop;

  const sideWall = (id, label) => ({
    id,
    label,
    width: spanY,
    height: wallHeight,
    edges: {
      top: { gender: 'plain' },
      bottom: { gender: 'female', ...SOLID },
      left: { gender: 'male', jointStart: t, jointSpan: spanZFront, ...SOLID },
      right: { gender: 'male', jointStart: t, jointSpan: spanZBack, ...SOLID },
    },
    features: [pocketFeature({
      id: 'groove',
      x: 0, y: grooveY,
      width: spanY, height: grooveHeight,
      depth: p,
    })],
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
    sideWall('left', 'LEFT'),
    {
      id: 'lid', label: 'LID',
      width: spanX + 2 * grip,
      height: spanY + grip + t,
      edges: {
        top: { gender: 'plain' },
        bottom: { gender: 'plain' },
        left: { gender: 'plain' },
        right: { gender: 'plain' },
      },
    },
    {
      id: 'back', label: 'BACK',
      width: Lo, height: wallHeight,
      edges: {
        top: { gender: 'plain' },
        bottom: { gender: 'female', jointStart: t, jointSpan: spanX, ...SOLID },
        left: { gender: 'female', jointStart: t, jointSpan: spanZBack, ...SOLID },
        right: { gender: 'female', jointStart: t, jointSpan: spanZBack, ...SOLID },
      },
      // El canal del fondo es más ancho que el hueco interior porque las
      // esquinas de la tapa viven en los tres canales a la vez. Deja margen
      // t − p a cada canto: la misma pared que queda detrás de los laterales.
      features: [pocketFeature({
        id: 'groove',
        x: t - p, y: grooveY,
        width: Lo - 2 * t + 2 * p, height: grooveHeight,
        depth: p,
      })],
    },
    sideWall('right', 'RIGHT'),
  ];

  const material = { thickness: t, kerf, tabWidth };
  const panels = specs.map((spec) => ({ ...spec, points: panelOutline(spec, material) }));
  const lid = panels.find((panel) => panel.id === 'lid');

  return {
    panels,
    joints,
    errors,
    warnings: warningsFor({
      jointWidths: [joints.x.width, joints.y.width, joints.z.width, joints.zBack.width],
      t, kerf, tabWidth, p, h, tl,
      lidWidth: lid.width, lidDepth: lid.height,
    }),
    outer: { length: Lo, width: Wo, height: Ho },
    inner: { length: spanX, width: spanY, height: innerHeight },
    realOuterHeight: wallHeight,
    groove: { depth: p, clearance: h, floor: grooveFloor, top: grooveTop, grip },
    lid: { thickness: tl, width: lid.width, depth: lid.height },
  };
}

function validate() {
  return [];
}

function warningsFor({ jointWidths, t, kerf, tabWidth }) {
  return commonWarnings({ jointWidths, t, kerf, tabWidth });
}
