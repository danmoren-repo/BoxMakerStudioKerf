import { panelOutline } from '../core/panel.js';
import {
  autoTabWidthFromSpans,
  commonWarnings,
  jointSegments,
  KERF_TOO_BIG,
  outerDimensions,
  validateBasics,
  validateTabsVsKerf,
} from './shared.js';

// La tapa puede ser de otro grosor que la caja. Sin valor, copia la pared.
export function lidThicknessFor({ thickness, lidThickness }) {
  return Number.isFinite(lidThickness) ? lidThickness : thickness;
}

// Ho es la distancia de la base a la cara superior de la tapa cerrada, igual
// que en las otras tapas. Las cuatro paredes quedan a Ho − tl, como la tapa
// plana: la tapa se apoya encima y queda a ras.
export function hingedHeights(params) {
  const t = params.thickness;
  const tl = lidThicknessFor(params);
  const { Lo, Wo, Ho } = outerDimensions(params, t + tl);
  return { Lo, Wo, Ho, t, tl, wallHeight: Ho - tl };
}

export function autoTabWidth(params) {
  const { Lo, Wo, t, wallHeight } = hingedHeights(params);
  return autoTabWidthFromSpans([Lo - 2 * t, Wo - 2 * t, wallHeight - 2 * t], t);
}

export function buildHingedBox(params) {
  const { kerf, tabWidth } = params;
  const { Lo, Wo, Ho, t, tl, wallHeight } = hingedHeights(params);
  const spanX = Lo - 2 * t; // frente/fondo <-> base
  const spanY = Wo - 2 * t; // laterales <-> base
  const spanZ = wallHeight - 2 * t; // juntas verticales, iguales en las cuatro paredes

  const errors = validate({ Lo, Wo, Ho, t, tl, kerf, tabWidth, spanX, spanY, spanZ });
  if (errors.length > 0) return { errors, warnings: [], panels: [] };

  const joints = {
    x: jointSegments(spanX, tabWidth),
    y: jointSegments(spanY, tabWidth),
    z: jointSegments(spanZ, tabWidth),
  };

  const SOLID = { startsSolid: true };
  const endWall = {
    width: Lo, height: wallHeight,
    edges: {
      top: { gender: 'plain' },
      bottom: { gender: 'female', jointStart: t, jointSpan: spanX, ...SOLID },
      left: { gender: 'female', jointStart: t, jointSpan: spanZ, ...SOLID },
      right: { gender: 'female', jointStart: t, jointSpan: spanZ, ...SOLID },
    },
  };
  const sideWall = {
    width: spanY, height: wallHeight,
    edges: {
      top: { gender: 'plain' },
      bottom: { gender: 'female', ...SOLID },
      left: { gender: 'male', jointStart: t, jointSpan: spanZ, ...SOLID },
      right: { gender: 'male', jointStart: t, jointSpan: spanZ, ...SOLID },
    },
  };

  const specs = [
    {
      id: 'bottom', label: 'BOTTOM', width: spanX, height: spanY,
      edges: {
        top: { gender: 'male', ...SOLID }, bottom: { gender: 'male', ...SOLID },
        left: { gender: 'male', ...SOLID }, right: { gender: 'male', ...SOLID },
      },
    },
    { id: 'front', label: 'FRONT', ...endWall },
    { id: 'left', label: 'LEFT', ...sideWall },
    {
      id: 'lid', label: 'LID', width: Lo, height: Wo,
      edges: {
        top: { gender: 'plain' }, bottom: { gender: 'plain' },
        left: { gender: 'plain' }, right: { gender: 'plain' },
      },
    },
    { id: 'back', label: 'BACK', ...endWall },
    { id: 'right', label: 'RIGHT', ...sideWall },
  ];

  const material = { thickness: t, kerf, tabWidth };
  const panels = specs.map((spec) => ({ ...spec, points: panelOutline(spec, material) }));

  return {
    panels,
    joints,
    errors,
    warnings: commonWarnings({
      jointWidths: [joints.x.width, joints.y.width, joints.z.width],
      t, kerf, tabWidth,
    }),
    outer: { length: Lo, width: Wo, height: Ho },
    inner: { length: spanX, width: spanY, height: wallHeight - t },
  };
}

function validate({ Lo, Wo, Ho, t, tl, kerf, tabWidth, spanX, spanY, spanZ }) {
  const errors = validateBasics({ t, kerf, tabWidth, Lo, Wo, Ho });
  if (errors.length > 0) return errors;

  const positive = (v) => Number.isFinite(v) && v > 0;
  if (!positive(tl)) errors.push('El grosor de la tapa debe ser mayor que 0.');
  if (errors.length > 0) return errors;

  if (kerf >= t) errors.push(KERF_TOO_BIG);
  if (spanX <= 0 || spanY <= 0) {
    errors.push(`El material de ${t} mm es demasiado grueso para una caja de ${Lo} × ${Wo} mm: no queda espacio dentro.`);
  }
  if (spanZ <= 0) {
    errors.push(`Con ${t} mm de material, una caja de ${Ho} mm de alto no deja pared entre la base y la tapa.`);
  }
  if (errors.length > 0) return errors;

  errors.push(...validateTabsVsKerf(
    [['largo', spanX], ['ancho', spanY], ['alto', spanZ]],
    tabWidth, kerf,
  ));
  return errors;
}
