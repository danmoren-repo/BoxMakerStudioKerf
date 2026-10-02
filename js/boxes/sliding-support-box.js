import { panelOutline, rectHoleFeature } from '../core/panel.js';
import {
  autoTabWidthFromSpans,
  commonWarnings,
  jointSegments,
  KERF_TOO_BIG,
  validateBasics,
  validateTabsVsKerf,
} from './shared.js';
import {
  buildDividerPanels, validateDividers, dividerWarnings,
} from './dividers.js';
import { lidThicknessFor } from './sliding-box.js';

const DEFAULT_CLEARANCE = 0.2;
// Margen de seguridad del marco de la ventana, por encima del grosor que ya
// ocupa el soporte (decisión con Dani: grosor + 4.5 mm).
const FRAME_MARGIN = 4.5;
// El tramo delantero del marco cruza la entrada de la tapa sujeto sólo por
// sus puntas. Por debajo de 1/20 de su largo se avisa que puede quebrarse.
const FRONT_BAR_RATIO = 20;

// Automático: grosor del material (lo que ocupa el soporte) + margen. Con la
// casilla desmarcada manda el valor escrito, bueno o malo: la validación lo
// juzga en vez de corregirlo a la espalda del usuario.
export function windowFrameFor({ thickness, windowFrame, windowFrameAuto = true }) {
  if (!windowFrameAuto && Number.isFinite(windowFrame)) return windowFrame;
  return thickness + FRAME_MARGIN;
}

// Ho es la altura total, de la cara de abajo de BOTTOM a la de arriba de TOP:
// aquí nada sobresale por encima de la tapa. La tapa apoya directo sobre los
// soportes y la holgura queda entre la tapa y TOP. El canto de los soportes
// y el de FRONT coinciden (railTop): la tapa entra a ras por encima de FRONT.
// En modo interiores el espacio útil se mide ENTRE SOPORTES, así que el
// largo suma 2 paredes + 2 soportes.
export function slidingSupportHeights(params) {
  const t = params.thickness;
  const tl = lidThicknessFor(params);
  const h = Number.isFinite(params.slideClearance) ? params.slideClearance : DEFAULT_CLEARANCE;
  const m = windowFrameFor(params);
  const inner = params.dimensionMode === 'inner';
  const Lo = inner ? params.length + 4 * t : params.length;
  const Wo = inner ? params.width + 2 * t : params.width;
  const Ho = inner ? params.height + 2 * t + tl + h : params.height;
  const railTop = Ho - t - h - tl;

  return {
    Lo, Wo, Ho, t, tl, h, m,
    railTop,
    frontHeight: railTop,
    supportHeight: railTop - t,
    innerHeight: railTop - t,
  };
}

// El tramo de junta más corto es el del frente, que es más bajo que el resto.
export function autoTabWidth(params) {
  const { Lo, Wo, t, frontHeight } = slidingSupportHeights(params);
  return autoTabWidthFromSpans([frontHeight - 2 * t, Lo - 2 * t, Wo - 2 * t], t);
}

export function buildSlidingSupportBox(params) {
  const { kerf, tabWidth } = params;
  const {
    Lo, Wo, Ho, t, tl, h, m, frontHeight, supportHeight, innerHeight,
  } = slidingSupportHeights(params);

  const spanX = Lo - 2 * t; // entre laterales: BOTTOM/TOP <-> frente/fondo
  const spanY = Wo - 2 * t; // entre frente y fondo: BOTTOM/TOP <-> laterales
  const spanZ = Ho - 2 * t; // fondo <-> laterales
  const spanZFront = frontHeight - 2 * t; // frente <-> laterales
  const usableX = spanX - 2 * t; // entre soportes

  const lengthDividers = Number.isFinite(params.lengthDividers) ? params.lengthDividers : 0;
  const heightDividers = Number.isFinite(params.heightDividers) ? params.heightDividers : 0;

  const errors = validate({
    Lo, Wo, Ho, t, tl, h, m, kerf, tabWidth,
    spanX, spanY, spanZ, spanZFront, frontHeight, supportHeight,
  });
  if (errors.length === 0) {
    errors.push(...validateDividers({ lengthDividers, heightDividers, spanY, t }));
  }
  if (errors.length > 0) return { errors, warnings: [], panels: [] };

  const joints = {
    x: jointSegments(spanX, tabWidth),
    y: jointSegments(spanY, tabWidth),
    z: jointSegments(spanZ, tabWidth),
    zFront: jointSegments(spanZFront, tabWidth),
  };

  // Toda junta arranca y termina con material en la pieza hembra, para que las
  // esquinas no queden colgando de medio kerf.
  const SOLID = { startsSolid: true };

  // Los laterales son espejo uno del otro por el mismo motivo que en el canal
  // grabado (ver sliding-box.js): FRONT es más bajo que BACK, así que sus
  // juntas verticales miden distinto. La arista 'right' recorre la pieza de
  // arriba hacia abajo, así que su arranque se cuenta desde el canto superior
  // propio y hay que correrlo para que la junta siga midiéndose desde el piso.
  // A diferencia del canal grabado, el canto superior es hembra: ahí encaja TOP.
  const sideWall = (id, label, frontEdge) => {
    const backEdge = frontEdge === 'left' ? 'right' : 'left';
    const frontJointStart = frontEdge === 'left' ? t : Ho - t - spanZFront;
    return {
      id,
      label,
      width: spanY,
      height: Ho,
      edges: {
        top: { gender: 'female', ...SOLID },
        bottom: { gender: 'female', ...SOLID },
        [frontEdge]: { gender: 'male', jointStart: frontJointStart, jointSpan: spanZFront, ...SOLID },
        [backEdge]: { gender: 'male', jointStart: t, jointSpan: spanZ, ...SOLID },
      },
    };
  };

  // TOP es la tapa de la caja cerrada, alargada un grosor hacia el frente para
  // quedar a ras de la cara de FRONT (que ya no llega hasta ella: por debajo
  // pasa la tapa). Su canto delantero ('top', y = 0) va liso. La arista 'left'
  // se recorre del fondo al frente y la 'right' del frente al fondo: en las dos,
  // la junta cubre spanY y el grosor sobrante queda en el extremo del frente.
  // La ventana se mide desde la cara interior de cada pared: en y, la cara
  // interior de FRONT está a t del canto delantero de TOP.
  const top = {
    id: 'top',
    label: 'TOP',
    width: spanX,
    height: spanY + t,
    edges: {
      top: { gender: 'plain' },
      bottom: { gender: 'male', ...SOLID },
      left: { gender: 'male', jointStart: 0, jointSpan: spanY, ...SOLID },
      right: { gender: 'male', jointStart: t, jointSpan: spanY, ...SOLID },
    },
    features: [rectHoleFeature({
      id: 'window',
      x: m,
      y: t + m,
      width: spanX - 2 * m,
      height: spanY - 2 * m,
      kerf,
    })],
  };

  const plainEdges = {
    top: { gender: 'plain' },
    bottom: { gender: 'plain' },
    left: { gender: 'plain' },
    right: { gender: 'plain' },
  };

  // Placa pegada por dentro de cada lateral, apoyada en BOTTOM: su canto de
  // arriba es el riel, y queda a la altura exacta sin medir al pegarla.
  const support = (n) => ({
    id: `support-${n}`,
    label: `SUPPORT ${n}`,
    width: spanY,
    height: supportHeight,
    edges: plainEdges,
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
    sideWall('left', 'LEFT', 'left'),
    top,
    {
      id: 'back', label: 'BACK',
      width: Lo, height: Ho,
      edges: {
        top: { gender: 'female', jointStart: t, jointSpan: spanX, ...SOLID },
        bottom: { gender: 'female', jointStart: t, jointSpan: spanX, ...SOLID },
        left: { gender: 'female', jointStart: t, jointSpan: spanZ, ...SOLID },
        right: { gender: 'female', jointStart: t, jointSpan: spanZ, ...SOLID },
      },
    },
    sideWall('right', 'RIGHT', 'right'),
    support(1),
    support(2),
    // La tapa corre entre los laterales con holgura a cada lado, y va del
    // fondo a la cara exterior de FRONT.
    {
      id: 'lid', label: 'LID',
      width: spanX - 2 * h,
      height: spanY - h + t,
      edges: plainEdges,
    },
  ];

  const material = { thickness: t, kerf, tabWidth };
  const panels = specs.map((spec) => ({ ...spec, points: panelOutline(spec, material) }));
  const lid = panels.find((panel) => panel.id === 'lid');
  panels.push(...buildDividerPanels({
    spanX: usableX, spanY, dividerHeight: innerHeight, t, kerf, lengthDividers, heightDividers,
  }));

  return {
    panels,
    joints,
    errors,
    warnings: [
      ...warningsFor({
        jointWidths: [joints.x.width, joints.y.width, joints.z.width, joints.zFront.width],
        t, kerf, tabWidth, h, tl, m, spanX,
        lidWidth: lid.width, lidDepth: lid.height,
      }),
      ...dividerWarnings({ lengthDividers, heightDividers, spanX: usableX, dividerHeight: innerHeight, t }),
    ],
    outer: { length: Lo, width: Wo, height: Ho },
    inner: { length: usableX, width: spanY, height: innerHeight },
    lid: { thickness: tl, width: lid.width, depth: lid.height },
    supports: { width: spanY, height: supportHeight, count: 2 },
    window: { width: spanX - 2 * m, depth: spanY - 2 * m, frame: m },
  };
}

function validate({
  Lo, Wo, Ho, t, tl, h, m, kerf, tabWidth,
  spanX, spanY, spanZ, spanZFront, frontHeight, supportHeight,
}) {
  const errors = validateBasics({ t, kerf, tabWidth, Lo, Wo, Ho });
  if (errors.length > 0) return errors;

  const positive = (value) => Number.isFinite(value) && value > 0;
  if (!positive(tl)) errors.push('El grosor de la tapa debe ser mayor que 0.');
  if (!Number.isFinite(h) || h < 0) errors.push('La holgura de deslizamiento no puede ser negativa.');
  if (!Number.isFinite(m)) errors.push('El marco de la ventana debe ser un número.');
  if (errors.length > 0) return errors;

  // Kerf y geometría van en un solo lote: una caja inválida por varios motivos
  // los muestra todos, en vez de obligar a arreglarlos de uno en uno.
  if (kerf >= t) errors.push(KERF_TOO_BIG);
  if (h >= t) {
    errors.push(
      `Con una holgura de ${h} mm y material de ${t} mm, la tapa ya no se apoya sobre los soportes. Baja la holgura.`,
    );
  }
  if (m - h <= 0) {
    errors.push(
      `Un marco de ${m} mm con ${h} mm de holgura no sujeta la tapa: se caería por la ventana. Sube el marco.`,
    );
  }
  if (spanX <= 2 * t || spanY <= 0) {
    errors.push(
      `El material de ${t} mm es demasiado grueso para una caja de ${Lo} × ${Wo} mm: no queda espacio entre los soportes.`,
    );
  } else if (spanX - 2 * m <= 0 || spanY - 2 * m <= 0) {
    errors.push(
      `Un marco de ${m} mm se come la ventana en una caja de ${Lo} × ${Wo} mm. Baja el marco.`,
    );
  }
  if (supportHeight <= 0) {
    errors.push(
      `Una caja de ${Ho} mm de alto es demasiado baja para su base, su tapa de ${tl} mm y TOP: no quedan soportes.`,
    );
  } else if (spanZFront <= 0) {
    errors.push(
      `El frente queda de ${frontHeight.toFixed(1)} mm: no deja pared entre la base y la tapa para las espigas.`,
    );
  }
  if (errors.length > 0) return errors;

  errors.push(...validateTabsVsKerf(
    [
      ['largo', spanX],
      ['ancho', spanY],
      ['alto del frente', spanZFront],
      ['alto del fondo', spanZ],
    ],
    tabWidth,
    kerf,
 ));
  return errors;
}

function warningsFor({
  jointWidths, t, kerf, tabWidth, h, tl, m, spanX, lidWidth, lidDepth,
}) {
  const warnings = commonWarnings({ jointWidths, t, kerf, tabWidth });
  // El tramo del marco sobre la entrada de la tapa no tiene FRONT debajo: lo
  // sujetan sólo sus dos puntas, encajadas en los laterales.
  const frontBar = t + m;
  if (frontBar < spanX / FRONT_BAR_RATIO) {
    warnings.push(
      `El tramo del marco sobre la entrada de la tapa mide ${frontBar.toFixed(1)} mm de ancho para ${spanX.toFixed(0)} mm de largo, y sólo lo sujetan sus puntas: puede quebrarse. Sube el marco de la ventana.`,
    );
  }
  if (h === 0) {
    warnings.push('Holgura en 0: la tapa entrará a presión y no va a deslizar.');
  }
  if (h > 0.5) {
    warnings.push(`Holgura de ${h} mm: la tapa va a bailar entre los soportes y el marco.`);
  }
  const narrowestLid = Math.min(lidWidth, lidDepth);
  if (narrowestLid / tl > 60) {
    warnings.push(
      `La tapa de ${tl} mm mide ${narrowestLid.toFixed(0)} mm de lado: se va a pandear en el medio.`,
    );
  }
  return warnings;
}
