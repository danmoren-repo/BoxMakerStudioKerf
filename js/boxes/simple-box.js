import { panelOutline } from '../core/panel.js';
import {
  autoTabWidthFromSpans,
  commonWarnings,
  jointSegments,
  outerDimensions,
  validateBasics,
  validateTabsVsKerf,
} from './shared.js';

// Suggested finger width: ~3x material thickness, never under 6 mm, and always
// small enough that the shortest joint still gets at least three segments.
export function autoTabWidth(params) {
  const { thickness } = params;
  const { Lo, Wo, Ho } = outerDimensions(params);
  const wallHeight = wallHeightFor(Ho, thickness, params.lidType);
  return autoTabWidthFromSpans(
    [wallHeight - 2 * thickness, Lo - 2 * thickness, Wo - 2 * thickness],
    thickness,
  );
}

// Con tapa plana las paredes pierden un grosor: la tapa se apoya encima de su
// canto, así que pared + tapa vuelve a dar el alto exterior pedido.
function wallHeightFor(Ho, thickness, lidType) {
  return lidType === 'flat' ? Ho - thickness : Ho;
}

// A closed six-panel box. The panel spanning a full outer dimension along an
// axis is female on those edges (slots cut inward); the panel that sits inset by
// one thickness on each side is male (tabs reach out into the other's plane).
// Front/Back span X and Z fully, Left/Right are inset in Y, Top/Bottom in both.
export function buildBox(params) {
  const { thickness: t, kerf, tabWidth, lidType = 'finger' } = params;
  const { Lo, Wo, Ho } = outerDimensions(params);
  const flatLid = lidType === 'flat';
  const wallHeight = wallHeightFor(Ho, t, lidType);

  const spanX = Lo - 2 * t; // Front/Back <-> Top/Bottom joints
  const spanY = Wo - 2 * t; // Left/Right <-> Top/Bottom joints
  // El dentado vertical arranca por debajo de la tapa y termina por encima de la
  // base, para que las esquinas de Front/Back queden macizas: si llegara hasta el
  // borde, dos escotaduras perpendiculares se tocarían en la esquina y dejarían
  // ahí una lengüeta más fina que el kerf.
  const spanZ = wallHeight - 2 * t; //  Front/Back <-> Left/Right joints

  const errors = validate({ Lo, Wo, Ho, spanX, spanY, spanZ, t, kerf, tabWidth, flatLid });
  if (errors.length > 0) return { errors, warnings: [], panels: [] };

  const joints = {
    x: jointSegments(spanX, tabWidth),
    y: jointSegments(spanY, tabWidth),
    z: jointSegments(spanZ, tabWidth),
  };

  // Toda junta arranca y termina con material en la pieza hembra. Si arrancara
  // con ranura, las dos ranuras que concurren en una esquina dejarían el bloque
  // de la esquina sujeto solo por medio kerf: una isla que se cae al cortar.
  const SOLID = { startsSolid: true };

  // Con tapa plana el canto superior de las paredes queda liso: no hay nada que
  // encaje ahí, la tapa solo se apoya encima.
  const lidEdge = (spec) => (flatLid ? { gender: 'plain' } : spec);

  const endWall = {
    width: Lo,
    height: wallHeight,
    edges: {
      top: lidEdge({ gender: 'female', jointStart: t, jointSpan: spanX, ...SOLID }),
      bottom: { gender: 'female', jointStart: t, jointSpan: spanX, ...SOLID },
      left: { gender: 'female', jointStart: t, jointSpan: spanZ, ...SOLID },
      right: { gender: 'female', jointStart: t, jointSpan: spanZ, ...SOLID },
    },
  };

  const sideWall = {
    width: spanY,
    height: wallHeight,
    edges: {
      top: lidEdge({ gender: 'female', ...SOLID }),
      bottom: { gender: 'female', ...SOLID },
      left: { gender: 'male', jointStart: t, jointSpan: spanZ, ...SOLID },
      right: { gender: 'male', jointStart: t, jointSpan: spanZ, ...SOLID },
    },
  };

  const cap = {
    width: spanX,
    height: spanY,
    edges: {
      top: { gender: 'male', ...SOLID },
      bottom: { gender: 'male', ...SOLID },
      left: { gender: 'male', ...SOLID },
      right: { gender: 'male', ...SOLID },
    },
  };

  const flatPanel = {
    width: Lo,
    height: Wo,
    edges: {
      top: { gender: 'plain' },
      bottom: { gender: 'plain' },
      left: { gender: 'plain' },
      right: { gender: 'plain' },
    },
  };

  const specs = [
    { id: 'bottom', label: 'BOTTOM', ...cap },
    { id: 'front', label: 'FRONT', ...endWall },
    { id: 'left', label: 'LEFT', ...sideWall },
    { id: 'top', label: 'TOP', ...(flatLid ? flatPanel : cap) },
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
    inner: { length: Lo - 2 * t, width: Wo - 2 * t, height: Ho - 2 * t },
  };
}

function validate({ Lo, Wo, Ho, spanX, spanY, spanZ, t, kerf, tabWidth, flatLid }) {
  const errors = validateBasics({ t, kerf, tabWidth, Lo, Wo, Ho });
  if (errors.length > 0) return errors;

  if (spanX <= 0 || spanY <= 0) {
    errors.push(
      `El material de ${t} mm es demasiado grueso para una caja de ${Lo} × ${Wo} mm: no queda espacio para la tapa.`,
    );
  }
  if (spanZ <= 0) {
    errors.push(flatLid
      ? `Con ${t} mm de material y tapa plana, una caja de ${Ho} mm de alto no deja pared suficiente para las espigas.`
      : `Con ${t} mm de material, una caja de ${Ho} mm de alto no deja pared entre la base y la tapa.`);
  }
  if (errors.length > 0) return errors;

  errors.push(...validateTabsVsKerf(
    [['largo', spanX], ['ancho', spanY], ['alto', spanZ]],
    tabWidth,
    kerf,
  ));
  return errors;
}
