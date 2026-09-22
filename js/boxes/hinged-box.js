import { holeFeature, panelOutline } from '../core/panel.js';
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

const DEFAULT_PEG_DIAMETER_FACTOR = 4; // dp por defecto = 4 × t
const DEFAULT_HINGE_CLEARANCE = 1;
export const EDGE_MARGIN = 2; // material mínimo alrededor de cualquier corte cerrado

export function pegDiameterFor({ thickness, pegDiameter }) {
  return Number.isFinite(pegDiameter) ? pegDiameter : DEFAULT_PEG_DIAMETER_FACTOR * thickness;
}

export function hingeClearanceFor({ hingeClearance }) {
  return Number.isFinite(hingeClearance) ? hingeClearance : DEFAULT_HINGE_CLEARANCE;
}

// Ho es la distancia de la base a la cara superior de la tapa cerrada, igual
// que en las otras tapas. Las cuatro paredes quedan a Ho − tl, como la tapa
// plana: la tapa se apoya encima y queda a ras.
//
// La espiga es plana y vive exactamente a la altura de la tapa cerrada. Para
// que el agujero del lateral quede cerrado (con material por encima, no
// abierto al canto) el lateral tiene que llegar más alto que Ho − tl en la
// esquina trasera. postHeight es cuánto: media tapa hasta el centro del
// agujero (tl/2), más el radio del agujero (rh), más el margen de material
// que tiene que quedar por encima (em).
export function hingedHeights(params) {
  const t = params.thickness;
  const tl = lidThicknessFor(params);
  const dp = pegDiameterFor(params);
  const hc = hingeClearanceFor(params);
  const rh = (dp + hc) / 2;
  const { Lo, Wo, Ho } = outerDimensions(params, t + tl);
  const postHeight = tl / 2 + rh + EDGE_MARGIN;
  const postWidth = dp + hc + 2 * EDGE_MARGIN;

  return {
    Lo, Wo, Ho, t, tl, dp, hc, rh,
    wallHeight: Ho - tl,
    postHeight,
    postWidth,
  };
}

export function autoTabWidth(params) {
  const { Lo, Wo, t, wallHeight } = hingedHeights(params);
  return autoTabWidthFromSpans([Lo - 2 * t, Wo - 2 * t, wallHeight - 2 * t], t);
}

export function buildHingedBox(params) {
  const { kerf, tabWidth } = params;
  const {
    Lo, Wo, Ho, t, tl, dp, hc, rh, wallHeight, postHeight, postWidth,
  } = hingedHeights(params);
  const spanX = Lo - 2 * t; // frente/fondo <-> base
  const spanY = Wo - 2 * t; // laterales <-> base
  const spanZ = wallHeight - 2 * t; // juntas verticales, iguales en las cuatro paredes

  const errors = validate({ Lo, Wo, Ho, t, tl, dp, hc, kerf, tabWidth, spanX, spanY, spanZ });
  if (errors.length > 0) return { errors, warnings: [], panels: [] };

  const joints = {
    x: jointSegments(spanX, tabWidth),
    y: jointSegments(spanY, tabWidth),
    z: jointSegments(spanZ, tabWidth),
  };

  const SOLID = { startsSolid: true };
  const material = { thickness: t, kerf, tabWidth };
  const endWall = {
    width: Lo, height: wallHeight,
    edges: {
      top: { gender: 'plain' },
      bottom: { gender: 'female', jointStart: t, jointSpan: spanX, ...SOLID },
      left: { gender: 'female', jointStart: t, jointSpan: spanZ, ...SOLID },
      right: { gender: 'female', jointStart: t, jointSpan: spanZ, ...SOLID },
    },
  };

  // El poste sólo sobresale en la esquina trasera; el resto del canto sigue a
  // wallHeight. Se arma el lateral normal (sin poste) y se le injerta el bulto
  // en el canto superior, que en panelOutline son siempre los dos primeros
  // puntos del contorno (el canto 'top' no lleva espigas, así que no se mezcla
  // con nada del resto de la pieza).
  const buildSideWall = (id, label, frontEdge) => {
    const isLeft = frontEdge === 'left';
    const backEdge = isLeft ? 'right' : 'left';
    const spec = {
      width: spanY, height: wallHeight,
      edges: {
        top: { gender: 'plain' },
        bottom: { gender: 'female', ...SOLID },
        [frontEdge]: { gender: 'male', jointStart: t, jointSpan: spanZ, ...SOLID },
        [backEdge]: { gender: 'male', jointStart: t, jointSpan: spanZ, ...SOLID },
      },
    };
    const basePoints = panelOutline(spec, material);
    // basePoints[0] y [1] son las dos esquinas del canto superior, en ese
    // orden de recorrido (sentido horario). El resto de la pieza (aristas
    // right/bottom/left) no cambia de forma, sólo se corre postHeight hacia
    // abajo para que el nuevo y=0 sea el canto superior del poste.
    const rest = basePoints.slice(2).map((p) => ({ x: p.x, y: p.y + postHeight }));
    const postNear = isLeft ? spanY - postWidth : postWidth;
    const backX = isLeft ? spanY : 0;
    const frontCorner = { x: isLeft ? 0 : spanY, y: postHeight };
    const nearPoint = { x: postNear, y: postHeight };
    const stepUp = { x: postNear, y: 0 };
    const backCorner = { x: backX, y: 0 };
    const top = isLeft
      ? [frontCorner, nearPoint, stepUp, backCorner]
      : [backCorner, stepUp, nearPoint, frontCorner];
    const points = [...top, ...rest];

    const holeCenterX = isLeft ? spanY - EDGE_MARGIN - rh : EDGE_MARGIN + rh;
    const hole = holeFeature({
      id: 'hinge-hole', cx: holeCenterX, cy: EDGE_MARGIN + rh, diameter: dp + hc, kerf,
    });

    return {
      id, label, width: spanY, height: wallHeight + postHeight,
      edges: spec.edges, points, features: [hole],
    };
  };

  // Cada espiga es una pestaña redondeada (un rectángulo terminado en
  // semicírculo) que sale de la tapa hacia la esquina trasera y encaja en el
  // agujero de su lateral. Vive dentro de una muesca del mismo ancho que el
  // poste correspondiente, para que el poste tenga sitio cuando la tapa
  // cierra. El disco queda centrado en (t/2, Wo − t − em − rh) para la
  // esquina izquierda, espejado para la derecha — el mismo centro, en
  // coordenadas absolutas de la caja, que el agujero de su lateral.
  const pegArc = (cx, cy, fromDeg, toDeg, steps = 16) => {
    const pts = [];
    for (let i = 0; i <= steps; i++) {
      const a = ((fromDeg + (toDeg - fromDeg) * (i / steps)) * Math.PI) / 180;
      pts.push({ x: cx + rh * Math.cos(a), y: cy + rh * Math.sin(a) });
    }
    return pts;
  };

  // El ancho de la muesca (dónde el cuello se separa del canto trasero de la
  // tapa) tiene que quedar del mismo ancho que el poste, como dice el
  // comentario de arriba — y no sólo por estética: el disco de la espiga
  // (radio rh, centrado a t/2 del canto) sólo puede bultear hacia adentro
  // del canto, así que su punto más lejano llega a t/2 + rh. Si la muesca
  // fuera más angosta que eso (p.ej. t + em, mucho menor que t/2 + rh con
  // los valores por defecto) el segmento recto que cierra la muesca cruzaría
  // el propio arco de la espiga, dando un contorno que se cruza a sí mismo.
  const notchWidth = postWidth;

  // Cómo se cierra la muesca sin cruzar el propio arco de la espiga:
  //
  // Entra por el hombro exterior (a notchWidth del canto lateral), baja
  // hasta farY = cy + rh — la altura del punto MÁS ALTO del círculo de la
  // espiga — y cruza en línea recta hasta (cx, farY). Esa línea es TANGENTE
  // al círculo: para cualquier x, la distancia al cuadrado desde (x, farY)
  // hasta el centro (cx, cy) es (x − cx)² + rh² ≥ rh², así que nunca entra
  // al círculo, sólo lo toca en x = cx (misma cuenta en nearY = cy − rh, el
  // punto más bajo). Sigue el arco hasta (cx, nearY) y desde ahí sube
  // derecho por x = cx hasta el canto trasero otra vez. Esa subida tampoco
  // cruza el arco: la recta x = cx sólo toca el círculo en nearY y farY —
  // sus dos únicos puntos con esa x — que son justo los vértices donde la
  // subida empalma con el arco.
  //
  // La primera versión enganchaba entrada y salida al MISMO punto (attachX,
  // Wo): dos tramos verticales a la misma x pero distinta profundidad,
  // colineares y superpuestos — sellaban el hueco en vez de abrirlo. La
  // corrección directa (unir ese punto a los dos extremos del arco con
  // diagonales) tampoco sirve: una diagonal a un punto del círculo que no es
  // tangente pasa por su interior antes de llegar (verificado a mano, y
  // también por el agente que retomó este arreglo tras el primer intento).
  // Sólo las líneas TANGENTES evitan volver a cruzar el arco.
  //
  // La subida final llega a (cx, Wo), no a (0, Wo) — x = 0, el canto lateral
  // de la tapa, queda intacto de punta a punta, sin que la espiga lo toque.
  const buildPegCorner = (isLeft) => {
    const cx = isLeft ? t / 2 : Lo - t / 2;
    const cy = Wo - t - EDGE_MARGIN - rh;
    const nearY = cy - rh;
    const farY = cy + rh;
    // El arco sale en el orden que pide el recorrido: la izquierda entra
    // por farY (viniendo del hombro exterior) y sale por nearY (hacia
    // arriba, derecho por x = cx); la derecha, al revés (entra por nearY,
    // viniendo derecho por x = cx, y sale por farY, hacia el hombro
    // exterior).
    const points = isLeft ? pegArc(cx, cy, 90, -90) : pegArc(cx, cy, 270, 90);
    return { cx, nearY, farY, points };
  };

  const lidWithPegs = () => {
    const right = buildPegCorner(false);
    const left = buildPegCorner(true);
    // Rectángulo Lo × Wo en sentido horario, con las dos muescas+espiga
    // injertadas en el canto trasero (de (Lo,Wo) a (0,Wo)): la derecha
    // primero, la izquierda después, porque el recorrido va de x=Lo hacia
    // x=0 en ese tramo. Cada una entra derecho por x = cx (sin tocar el
    // canto lateral) y sale por el hombro exterior a notchWidth del canto,
    // o al revés — ver el comentario de buildPegCorner.
    return [
      { x: 0, y: 0 }, { x: Lo, y: 0 }, { x: Lo, y: Wo },
      { x: right.cx, y: Wo }, { x: right.cx, y: right.nearY },
      ...right.points,
      { x: Lo - notchWidth, y: right.farY }, { x: Lo - notchWidth, y: Wo },
      { x: notchWidth, y: Wo }, { x: notchWidth, y: left.farY },
      ...left.points,
      { x: left.cx, y: Wo },
      { x: 0, y: Wo },
    ];
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
    { id: 'back', label: 'BACK', ...endWall },
  ];

  const generic = Object.fromEntries(
    specs.map((spec) => [spec.id, { ...spec, points: panelOutline(spec, material) }]),
  );
  const left = buildSideWall('left', 'LEFT', 'left');
  const right = buildSideWall('right', 'RIGHT', 'right');
  const lid = {
    id: 'lid', label: 'LID', width: Lo, height: Wo,
    edges: {
      top: { gender: 'plain' }, bottom: { gender: 'plain' },
      left: { gender: 'plain' }, right: { gender: 'plain' },
    },
    points: lidWithPegs(),
  };
  const panels = [generic.bottom, generic.front, left, lid, generic.back, right];

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
    hinge: { pegDiameter: dp, clearance: hc, holeDiameter: dp + hc, postHeight },
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
