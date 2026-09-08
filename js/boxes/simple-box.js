import { panelOutline } from '../core/panel.js';
import { computeSegments } from '../core/finger-joint.js';

// Suggested finger width: ~3x material thickness, never under 6 mm, and always
// small enough that the shortest joint still gets at least three segments.
export function autoTabWidth({ length, width, height, thickness, dimensionMode }) {
  const { Lo, Wo, Ho } = outerDimensions({ length, width, height, thickness, dimensionMode });
  const shortestSpan = Math.min(Ho - 2 * thickness, Lo - 2 * thickness, Wo - 2 * thickness);
  if (!(shortestSpan > 0)) return Math.max(3 * thickness, 6);
  return Math.min(Math.max(3 * thickness, 6), shortestSpan / 3);
}

export function outerDimensions({ length, width, height, thickness, dimensionMode }) {
  const pad = dimensionMode === 'inner' ? 2 * thickness : 0;
  return { Lo: length + pad, Wo: width + pad, Ho: height + pad };
}

// A closed six-panel box. The panel spanning a full outer dimension along an
// axis is female on those edges (slots cut inward); the panel that sits inset by
// one thickness on each side is male (tabs reach out into the other's plane).
// Front/Back span X and Z fully, Left/Right are inset in Y, Top/Bottom in both.
export function buildBox(params) {
  const { thickness: t, kerf, tabWidth } = params;
  const { Lo, Wo, Ho } = outerDimensions(params);

  const spanX = Lo - 2 * t; // Front/Back <-> Top/Bottom joints
  const spanY = Wo - 2 * t; // Left/Right <-> Top/Bottom joints
  // El dentado vertical arranca por debajo de la tapa y termina por encima de la
  // base, para que las esquinas de Front/Back queden macizas: si llegara hasta el
  // borde, dos escotaduras perpendiculares se tocarían en la esquina y dejarían
  // ahí una lengüeta más fina que el kerf.
  const spanZ = Ho - 2 * t; //  Front/Back <-> Left/Right joints

  const errors = validate({ Lo, Wo, Ho, spanX, spanY, spanZ, t, kerf, tabWidth });
  if (errors.length > 0) return { errors, warnings: [], panels: [] };

  const segments = (span) => {
    const s = computeSegments(span, tabWidth, true);
    return { ...s, tabs: (s.count - 1) / 2 };
  };
  const joints = { x: segments(spanX), y: segments(spanY), z: segments(spanZ) };

  // Toda junta arranca y termina con material en la pieza hembra. Si arrancara
  // con ranura, las dos ranuras que concurren en una esquina dejarían el bloque
  // de la esquina sujeto solo por medio kerf: una isla que se cae al cortar.
  const SOLID = { startsSolid: true };

  const endWall = {
    width: Lo,
    height: Ho,
    edges: {
      top: { gender: 'female', jointStart: t, jointSpan: spanX, ...SOLID },
      bottom: { gender: 'female', jointStart: t, jointSpan: spanX, ...SOLID },
      left: { gender: 'female', jointStart: t, jointSpan: spanZ, ...SOLID },
      right: { gender: 'female', jointStart: t, jointSpan: spanZ, ...SOLID },
    },
  };

  const sideWall = {
    width: spanY,
    height: Ho,
    edges: {
      top: { gender: 'female', ...SOLID },
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

  const specs = [
    { id: 'bottom', label: 'BOTTOM', ...cap },
    { id: 'front', label: 'FRONT', ...endWall },
    { id: 'left', label: 'LEFT', ...sideWall },
    { id: 'top', label: 'TOP', ...cap },
    { id: 'back', label: 'BACK', ...endWall },
    { id: 'right', label: 'RIGHT', ...sideWall },
  ];

  const material = { thickness: t, kerf, tabWidth };
  const panels = specs.map((spec) => ({ ...spec, points: panelOutline(spec, material) }));

  return {
    panels,
    joints,
    errors,
    warnings: collectWarnings({ joints, t, kerf, tabWidth }),
    outer: { length: Lo, width: Wo, height: Ho },
    inner: { length: Lo - 2 * t, width: Wo - 2 * t, height: Ho - 2 * t },
  };
}

function validate({ Lo, Wo, Ho, spanX, spanY, spanZ, t, kerf, tabWidth }) {
  const errors = [];
  const positive = (value) => Number.isFinite(value) && value > 0;

  if (!positive(t)) errors.push('El grosor del material debe ser mayor que 0.');
  if (!Number.isFinite(kerf) || kerf < 0) errors.push('El kerf no puede ser negativo.');
  if (!positive(tabWidth)) errors.push('El ancho de espiga debe ser mayor que 0.');
  if (!positive(Lo) || !positive(Wo) || !positive(Ho)) {
    errors.push('Largo, ancho y alto deben ser mayores que 0.');
  }
  if (errors.length > 0) return errors;

  if (kerf >= t) errors.push('El kerf debe ser menor que el grosor del material.');
  if (spanX <= 0 || spanY <= 0) {
    errors.push(
      `El material de ${t} mm es demasiado grueso para una caja de ${Lo} × ${Wo} mm: no queda espacio para la tapa.`,
    );
  }
  if (spanZ <= 0) {
    errors.push(
      `Con ${t} mm de material, una caja de ${Ho} mm de alto no deja pared entre la base y la tapa.`,
    );
  }
  if (errors.length > 0) return errors;

  for (const [name, span] of [['largo', spanX], ['ancho', spanY], ['alto', spanZ]]) {
    const { width } = computeSegments(span, tabWidth, true);
    if (width <= kerf * 1.5) {
      errors.push(
        `Las espigas del ${name} quedan de ${width.toFixed(2)} mm, demasiado pequeñas frente a un kerf de ${kerf} mm.`,
      );
    }
  }
  return errors;
}

function collectWarnings({ joints, t, kerf, tabWidth }) {
  const warnings = [];
  const narrowest = Math.min(joints.x.width, joints.y.width, joints.z.width);

  if (narrowest < 2) {
    warnings.push(
      `Alguna espiga queda de ${narrowest.toFixed(2)} mm: muy frágil para cortar. Sube el ancho de espiga.`,
    );
  }
  if (tabWidth < 1.5 * t) {
    warnings.push(
      `El ancho de espiga (${tabWidth} mm) es menor que 1.5 veces el grosor (${t} mm); la junta queda débil.`,
    );
  }
  if (tabWidth > 6 * t) {
    warnings.push(
      `El ancho de espiga (${tabWidth} mm) es más de 6 veces el grosor (${t} mm); pocas espigas y ensamble flojo.`,
    );
  }
  if (kerf === 0) {
    warnings.push('Kerf en 0: las piezas quedarán flojas al cortarlas. Mide el kerf real de tu láser.');
  }
  return warnings;
}
