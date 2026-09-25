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
import {
  buildDividerPanels, validateDividers, dividerWarnings,
} from './dividers.js';

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

  const lengthDividers = Number.isFinite(params.lengthDividers) ? params.lengthDividers : 0;
  const heightDividers = Number.isFinite(params.heightDividers) ? params.heightDividers : 0;

  const errors = validate({
    Lo, Wo, Ho, t, tl, h, p, kerf, tabWidth,
    spanX, spanY, spanZFront, spanZBack, frontHeight,
  });
  if (errors.length === 0) {
    errors.push(...validateDividers({ lengthDividers, heightDividers, spanY, t }));
  }
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

  // Los dos laterales NO son la misma pieza: son espejo uno del otro. El canal
  // va en la cara interior, y una pieza grabada sólo tiene canal en una cara; si
  // se emitieran idénticas habría que girar una 180° para meter su canal hacia
  // dentro, y ese giro intercambia el frente con el fondo. Mirando cada cara
  // interior desde dentro de la caja, en el lateral izquierdo el frente queda a
  // la izquierda del dibujo y en el derecho queda a la derecha. Como el frente
  // es más bajo que el fondo, sus juntas verticales miden distinto, así que
  // equivocar el lado le presentaría al frente la junta del fondo y la caja no
  // montaría. En la caja cerrada esto no pasaba porque ambas juntas medían igual.
  // La arista 'left' recorre la pieza de piso hacia arriba (su u coincide con z
  // sin importar cuánto mida la pieza), pero 'right' recorre de arriba hacia
  // abajo: su jointStart se cuenta desde el CANTO SUPERIOR PROPIO. El fondo y
  // los laterales comparten alto (wallHeight), así que ahí da igual qué arista
  // toque a cuál. El frente es más bajo, así que cuando su junta cae en la
  // arista 'right' de un lateral (el lateral derecho, con este espejo) hay que
  // correr el arranque el sobrante de altura entre lateral y frente para que
  // siga midiéndose desde el piso; si no, la espiga sube 6+ mm y queda al aire.
  const sideWall = (id, label, frontEdge) => {
    const backEdge = frontEdge === 'left' ? 'right' : 'left';
    const frontJointStart = frontEdge === 'left' ? t : wallHeight - t - spanZFront;
    return {
      id,
      label,
      width: spanY,
      height: wallHeight,
      edges: {
        top: { gender: 'plain' },
        bottom: { gender: 'female', ...SOLID },
        [frontEdge]: { gender: 'male', jointStart: frontJointStart, jointSpan: spanZFront, ...SOLID },
        [backEdge]: { gender: 'male', jointStart: t, jointSpan: spanZBack, ...SOLID },
      },
      // El canal recorre la pieza entera, así que es simétrico y no cambia con
      // el espejo: es lo único de la pieza que sí puede ser idéntico en ambos.
      features: [pocketFeature({
        id: 'groove',
        x: 0, y: grooveY,
        width: spanY, height: grooveHeight,
        depth: p,
      })],
    };
  };

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
    sideWall('right', 'RIGHT', 'right'),
  ];

  const material = { thickness: t, kerf, tabWidth };
  const panels = specs.map((spec) => ({ ...spec, points: panelOutline(spec, material) }));
  const lid = panels.find((panel) => panel.id === 'lid');
  panels.push(...buildDividerPanels({
    spanX, spanY, dividerHeight: innerHeight, t, kerf, lengthDividers, heightDividers,
  }));

  return {
    panels,
    joints,
    errors,
    warnings: [
      ...warningsFor({
        jointWidths: [joints.x.width, joints.y.width, joints.z.width, joints.zBack.width],
        t, kerf, tabWidth, p, h, tl, backSegment: joints.zBack.width,
        lidWidth: lid.width, lidDepth: lid.height,
      }),
      ...dividerWarnings({ lengthDividers, heightDividers, spanX, dividerHeight: innerHeight, t }),
    ],
    outer: { length: Lo, width: Wo, height: Ho },
    inner: { length: spanX, width: spanY, height: innerHeight },
    realOuterHeight: wallHeight,
    groove: { depth: p, clearance: h, floor: grooveFloor, top: grooveTop, grip },
    lid: { thickness: tl, width: lid.width, depth: lid.height },
  };
}

function validate({
  Lo, Wo, Ho, t, tl, h, p, kerf, tabWidth,
  spanX, spanY, spanZFront, spanZBack, frontHeight,
}) {
  const errors = validateBasics({ t, kerf, tabWidth, Lo, Wo, Ho });
  if (errors.length > 0) return errors;

  const positive = (value) => Number.isFinite(value) && value > 0;
  if (!positive(tl)) errors.push('El grosor de la tapa debe ser mayor que 0.');
  if (!Number.isFinite(h) || h < 0) errors.push('La holgura de deslizamiento no puede ser negativa.');
  if (!positive(p)) errors.push('La profundidad del canal debe ser mayor que 0.');
  if (errors.length > 0) return errors;

  // Kerf y geometría van en un solo lote: una caja inválida por varios motivos
  // los muestra todos, en vez de obligar a arreglarlos de uno en uno.
  if (kerf >= t) errors.push(KERF_TOO_BIG);
  if (p >= t) {
    errors.push(`Un canal de ${p} mm atraviesa una pared de ${t} mm. Baja la profundidad del canal.`);
  }
  if (h >= p) {
    errors.push(
      `Con una holgura de ${h} mm y un canal de ${p} mm de profundidad, la tapa no llega a agarrarse en la ranura.`,
    );
  }
  if (spanX <= 0 || spanY <= 0) {
    errors.push(
      `El material de ${t} mm es demasiado grueso para una caja de ${Lo} × ${Wo} mm: no queda espacio dentro.`,
    );
  }
  if (frontHeight <= 0) {
    errors.push(`Una caja de ${Ho} mm de alto es más baja que su propia tapa de ${tl} mm.`);
  } else if (spanZFront <= 0) {
    errors.push(
      `El frente queda de ${frontHeight.toFixed(1)} mm: no deja pared entre la base y el canal para las espigas.`,
    );
  }
  if (errors.length > 0) return errors;

  errors.push(...validateTabsVsKerf(
    [
      ['largo', spanX],
      ['ancho', spanY],
      ['alto del frente', spanZFront],
      ['alto del fondo', spanZBack],
    ],
    tabWidth,
    kerf,
  ));

  // La espiga del lateral asoma dentro del fondo justo por donde tiene que
  // pasar la esquina trasera de la tapa, y ahí no hay canal que la libere: el
  // canal del lateral recorre el cuerpo de la pieza, no sus espigas. Lo que
  // deja el hueco libre es que la junta arranca sin espiga (startsSolid), así
  // que bajo el canto superior queda un tramo entero de material sin asomar.
  // Si ese tramo es más corto que la banda del canal, la espiga tapa el paso y
  // la tapa se queda a medio entrar. Con tapa del mismo grosor que la pared y
  // espiga automática el tramo mide ~3 grosores y sobra; muerde con tapas
  // gruesas sobre paredes finas, o con un ancho de espiga manual pequeño.
  const backSegment = jointSegments(spanZBack, tabWidth).width;
  if (backSegment < tl + h) {
    errors.push(
      `Las espigas del fondo miden ${backSegment.toFixed(2)} mm y el canal de la tapa ocupa ${(tl + h).toFixed(2)} mm: la espiga del lateral tapa la esquina por donde entra la tapa. Sube el ancho de espiga, baja el grosor de la tapa o baja la holgura. Puede hacer falta más de una: el ancho de espiga tiene techo, porque la junta nunca baja de cinco tramos.`,
    );
  }
  return errors;
}

function warningsFor({ jointWidths, t, kerf, tabWidth, p, h, tl, lidWidth, lidDepth, backSegment }) {
  const warnings = commonWarnings({ jointWidths, t, kerf, tabWidth });
  const behind = t - p;
  const narrowestLid = Math.min(lidWidth, lidDepth);

  if (behind < 1.5) {
    warnings.push(
      `Detrás del canal quedan ${behind.toFixed(2)} mm de pared: puede reventar al meter la tapa.`,
    );
  }
  if (h === 0) {
    warnings.push('Holgura en 0: la tapa entrará a presión y no va a deslizar.');
  }
  if (h > 0.5) {
    warnings.push(`Holgura de ${h} mm: la tapa va a bailar dentro del canal.`);
  }
  if (narrowestLid / tl > 60) {
    warnings.push(
      `La tapa de ${tl} mm mide ${narrowestLid.toFixed(0)} mm de lado: se va a pandear en el medio.`,
    );
  }
  if (t < 2) {
    warnings.push(`El reborde sobre el canal vale un grosor (${t} mm) y queda frágil.`);
  }
  // La espiga acaba en su medida nominal, así que un margen positivo ya deja
  // pasar la tapa. Pero un margen por debajo del kerf es del tamaño del error
  // de la propia máquina: pasa, y raspa.
  const clearsTab = backSegment - (tl + h);
  if (clearsTab >= 0 && clearsTab < kerf) {
    warnings.push(
      `La esquina de la tapa pasa a ${clearsTab.toFixed(2)} mm de la espiga del lateral, menos que el kerf (${kerf} mm): va a rozar. Sube el ancho de espiga.`,
    );
  }
  return warnings;
}
