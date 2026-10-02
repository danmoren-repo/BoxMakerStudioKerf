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
import {
  buildDividerPanels, validateDividers, dividerWarnings,
} from './dividers.js';

// La tapa puede ser de otro grosor que la caja. Sin valor, copia la pared.
export function lidThicknessFor({ thickness, lidThickness }) {
  return Number.isFinite(lidThickness) ? lidThickness : thickness;
}

const DEFAULT_HINGE_CLEARANCE = 0.5;
export const EDGE_MARGIN = 2; // material mínimo alrededor de cualquier corte cerrado
// Juego entre el canto de la tapa y la cara interior de la pared donde gira,
// para que no roce al abrir. La espiga se alarga lo mismo, así su punta sigue
// a ras de la cara exterior de la pared.
export const LID_SIDE_GAP = 0.2;

// La espiga es un cuadrado macizo del mismo grosor que el material — no un
// diámetro aparte, no un múltiplo. 3 mm de material → espiga de 3 mm.
export function pegSizeFor({ thickness, pegSize }) {
  return Number.isFinite(pegSize) ? pegSize : thickness;
}

export function hingeClearanceFor({ hingeClearance }) {
  return Number.isFinite(hingeClearance) ? hingeClearance : DEFAULT_HINGE_CLEARANCE;
}

export function handleWidthFor({ handleWidth }) {
  return Number.isFinite(handleWidth) ? handleWidth : 20;
}
export function handleDepthFor({ thickness, handleDepth }) {
  return Number.isFinite(handleDepth) ? handleDepth : thickness + 5;
}
export function handleCornerRadiusFor({ handleCornerRadius }) {
  return Number.isFinite(handleCornerRadius) ? handleCornerRadius : 2;
}

// Los dos vértices redondeados de la PUNTA de un bulto rectangular que
// sobresale desde `baseY` hasta `tipY` — hacia arriba (tipY < baseY, la
// manija de la bisagra simple) o hacia abajo (tipY > baseY, cada mitad de
// la lengüeta de la bisagra doble, que sobresale a la vez por el frente y
// por el fondo). Sólo tiene sentido redondear la punta: la base, donde el
// bulto se funde con el canto recto, no es una esquina — ahí el contorno
// sigue derecho, igual que en cualquier otro punto de ese canto.
//
// El plan original (`roundedRectPoints`, un rectángulo de 4 esquinas
// redondeadas y sentido horario) traza un rectángulo CERRADO completo —
// incluida la arista que falta entre el último punto y el primero,
// implícita al usarlo como polígono por sí solo. Empalmar ese rectángulo
// entero entre la base y la base, como decía el plan, no funciona: mete un
// bucle cerrado propio en medio del contorno de la tapa, con una costura
// cerca de la base (la arista entre las dos esquinas "de abajo" del
// rectángulo, que conecta un lado con el otro cruzando por dentro del
// propio bulto) que efectivamente se cruza con el resto de la figura.
// Verificado con un script de cruces de segmentos (mismo tipo usado en el
// historial de este archivo para verificar contornos armados a mano): con
// las 4 esquinas, 1 cruce transversal y 1 vértice apoyado sobre una arista
// ajena, los dos exactamente en esa costura de la base. Con sólo las 2
// esquinas de la punta (esta versión), 0 y 0.
//
// Devuelve los puntos en el mismo sentido en que se recorren de `x` a
// `x + width` (izquierda a derecha); si el contorno que la usa camina esa
// punta al revés (de `x + width` a `x`), el llamador debe invertir el
// arreglo con `.reverse()` — invertir el orden de los puntos conserva la
// forma pero camina la misma curva en sentido contrario, que es
// exactamente lo que hace falta ahí.
export function roundedTabTip({
  x, width, baseY, tipY, radius, steps = 6,
}) {
  const up = tipY < baseY;
  const cy = up ? tipY + radius : tipY - radius;
  const [a1From, a1To, a2From, a2To] = up ? [180, 270, 270, 360] : [180, 90, 90, 0];
  const arc = (cx, fromDeg, toDeg) => {
    const pts = [];
    for (let i = 0; i <= steps; i += 1) {
      const a = ((fromDeg + (toDeg - fromDeg) * (i / steps)) * Math.PI) / 180;
      pts.push({ x: cx + radius * Math.cos(a), y: cy + radius * Math.sin(a) });
    }
    return pts;
  };
  return [
    ...arc(x + radius, a1From, a1To),
    ...arc(x + width - radius, a2From, a2To),
  ];
}

// Ho es la distancia de la base a la cara superior de la tapa cerrada, igual
// que en las otras tapas. Las cuatro paredes llegan a Ho y la tapa queda
// ADENTRO de la abertura, a ras del canto (mismo esquema que el generador de
// Vector Painter): si se apoyara encima, la parte de la tapa que queda detrás
// del eje bajaría contra la pared trasera al abrir y la trabaría.
//
// El eje de giro está a tl/2 bajo el canto de las paredes. El agujero casi
// siempre se pasa por encima de ese canto (rh > tl/2), así que el lateral
// lleva un poste en la esquina trasera que cubre esa diferencia más el
// margen de material (em).
//
// El agujero NO puede ser del tamaño de la espiga más un poco: la espiga
// (un cuadrado macizo) gira dentro del agujero al abrir/cerrar la tapa, y
// al girar su sección — un rectángulo ps × tl visto de frente, por el eje
// de giro — barre un círculo cuyo radio es media diagonal, no medio lado.
// Un agujero justo al lado ps trabaría la bisagra a mitad de camino. Por
// eso dh sale de la diagonal (ps, tl), no de ps solo.
export function hingedHeights(params) {
  const t = params.thickness;
  const tl = lidThicknessFor(params);
  const ps = pegSizeFor(params);
  const hc = hingeClearanceFor(params);
  const dh = Math.sqrt(ps * ps + tl * tl) + hc;
  const rh = dh / 2;
  const { Lo, Wo, Ho } = outerDimensions(params, t + tl);
  const postHeight = Math.max(0, rh - tl / 2) + EDGE_MARGIN;
  const postWidth = dh + 2 * EDGE_MARGIN;
  // Distancia del eje a la cara interior de la pared trasera.
  const pivotInset = EDGE_MARGIN + rh;

  return {
    Lo, Wo, Ho, t, tl, ps, hc, dh, rh,
    wallHeight: Ho,
    postHeight,
    postWidth,
    pivotInset,
  };
}

export function autoTabWidth(params) {
  const { Lo, Wo, t, wallHeight } = hingedHeights(params);
  return autoTabWidthFromSpans([Lo - 2 * t, Wo - 2 * t, wallHeight - 2 * t], t);
}

export function buildHingedBox(params) {
  const { kerf, tabWidth } = params;
  const hw = handleWidthFor(params);
  const hd = handleDepthFor(params);
  const hr = handleCornerRadiusFor(params);
  const {
    Lo, Wo, Ho, t, tl, ps, hc, dh, rh, wallHeight, postHeight, postWidth, pivotInset,
  } = hingedHeights(params);
  const spanX = Lo - 2 * t; // frente/fondo <-> base
  const spanY = Wo - 2 * t; // laterales <-> base
  const spanZ = wallHeight - 2 * t; // juntas verticales, iguales en las cuatro paredes
  const innerHeight = wallHeight - t - tl;
  // La tapa vive dentro de la abertura, con juego g contra laterales y
  // frente. lidX0/lidY0 son dónde arranca, en absolutos de la caja.
  const g = LID_SIDE_GAP;
  const lidW = Lo - 2 * t - 2 * g;
  const lidX0 = t + g;
  const lidY0 = t + g;
  const pegOut = t + g;
  // Canto trasero: las esquinas traseras de la tapa giran en un círculo de
  // radio pivotInset − g alrededor del eje, así que nunca tocan la pared
  // trasera (que está a pivotInset del eje).
  const pivotY = Wo - t - pivotInset;
  const swingRadius = pivotInset - g;
  const backReach = Math.sqrt(Math.max(0, swingRadius ** 2 - (tl / 2) ** 2));
  const lidD = pivotY + backReach - lidY0;
  // La manija atraviesa la muesca del frente con juego g a cada lado; la
  // muesca mide lo mismo que la tapa de hondo, así la manija se apoya en su
  // fondo y sostiene la tapa a ras.
  const handleW = hw - 2 * g;
  const handleOut = hd + g;
  // Igual que en la bisagra doble: un radio mayor que media punta cruza los
  // dos arcos entre sí y rompe el contorno, así que se acota a la manija.
  const handleRadius = Math.min(hr, handleW / 2, handleOut / 2);
  const lengthDividers = Number.isFinite(params.lengthDividers) ? params.lengthDividers : 0;
  const heightDividers = Number.isFinite(params.heightDividers) ? params.heightDividers : 0;

  const errors = validate({
    Lo, Wo, Ho, t, tl, ps, hc, kerf, tabWidth, spanX, spanY, spanZ, hw, hd, lidW,
    swingRadius, innerHeight,
  });
  if (errors.length === 0) {
    errors.push(...validateDividers({ lengthDividers, heightDividers, spanY, t }));
  }
  if (errors.length > 0) return { errors, warnings: [], panels: [] };

  const joints = {
    x: jointSegments(spanX, tabWidth),
    y: jointSegments(spanY, tabWidth),
    z: jointSegments(spanZ, tabWidth),
  };

  const SOLID = { startsSolid: true };
  const material = { thickness: t, kerf, tabWidth };
  const endWallEdges = {
    top: { gender: 'plain' },
    bottom: { gender: 'female', jointStart: t, jointSpan: spanX, ...SOLID },
    left: { gender: 'female', jointStart: t, jointSpan: spanZ, ...SOLID },
    right: { gender: 'female', jointStart: t, jointSpan: spanZ, ...SOLID },
  };
  const endWall = { width: Lo, height: wallHeight, edges: endWallEdges };

  // Se declara acá (y no junto al resto de la manija, más abajo) porque
  // buildFrontWall ya la necesita para su propia muesca.
  const handleStart = Lo / 2 - hw / 2;

  // La muesca del frente deja pasar la manija de la tapa. Se injerta igual
  // que el poste del lateral: los dos primeros puntos de panelOutline son las
  // esquinas del canto superior (acá 'top' es plain, así que no se mezcla
  // con nada más).
  const buildFrontWall = () => {
    const basePoints = panelOutline(endWall, material);
    const rest = basePoints.slice(2);
    return {
      id: 'front', label: 'FRONT', width: Lo, height: wallHeight, edges: endWallEdges,
      points: [
        { x: 0, y: 0 }, { x: handleStart, y: 0 }, { x: handleStart, y: tl },
        { x: handleStart + hw, y: tl }, { x: handleStart + hw, y: 0 }, { x: Lo, y: 0 },
        ...rest,
      ],
    };
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

    const holeCenterX = isLeft ? spanY - pivotInset : pivotInset;
    const hole = holeFeature({
      id: 'hinge-hole', cx: holeCenterX, cy: postHeight + tl / 2, diameter: dh, kerf,
    });

    return {
      id, label, width: spanY, height: wallHeight + postHeight,
      edges: spec.edges, points, features: [hole],
    };
  };

  // Cada espiga es un cuadrado macizo de lado ps que sale directo del canto
  // LATERAL de la tapa (izquierdo o derecho), no del trasero — el trasero
  // (el eje de giro) queda intacto. Es un bulto convexo simple sobre un
  // canto por lo demás recto: mismo tipo de injerto que ya usa la manija
  // en el canto delantero (sin arcos, sin huecos, sin la topología de
  // polígono-con-agujero que hacía falta para el diseño anterior — un
  // disco viviendo dentro de un entalle tallado en la esquina, que llevó
  // tres rondas de arreglos antes de salir bien y aun así no era el
  // mecanismo que hacía falta).
  //
  // El centro de la espiga tiene que coincidir con el centro del agujero de
  // su lateral: el eje (pivotY, en absolutos), pasado a coordenadas de la
  // tapa.
  const pegBump = (isLeft) => {
    const cy = pivotY - lidY0;
    const near = cy - ps / 2;
    const far = cy + ps / 2;
    const edgeX = isLeft ? 0 : lidW;
    const outX = isLeft ? -pegOut : lidW + pegOut;
    // El recorrido de la tapa sube por el canto derecho (y creciente) y
    // baja por el izquierdo (y decreciente) — cada uno entra al bulto por
    // el extremo que le toca primero según ese sentido.
    return isLeft
      ? [{ x: edgeX, y: far }, { x: outX, y: far }, { x: outX, y: near }, { x: edgeX, y: near }]
      : [{ x: edgeX, y: near }, { x: outX, y: near }, { x: outX, y: far }, { x: edgeX, y: far }];
  };

  const lidWithPegs = () => {
    const lidHandleStart = handleStart + g - lidX0;
    const handle = roundedTabTip({
      x: lidHandleStart, width: handleW, baseY: 0, tipY: -handleOut, radius: handleRadius,
    });
    // Rectángulo lidW × lidD en sentido horario: manija injertada en el canto
    // delantero (y = 0), espiga derecha injertada en el canto derecho
    // (x = lidW, subiendo), canto trasero (y = lidD) intacto, espiga izquierda
    // injertada en el canto izquierdo (x = 0, bajando).
    return [
      { x: 0, y: 0 }, { x: lidHandleStart, y: 0 }, ...handle, { x: lidHandleStart + handleW, y: 0 },
      { x: lidW, y: 0 },
      ...pegBump(false),
      { x: lidW, y: lidD },
      { x: 0, y: lidD },
      ...pegBump(true),
    ];
  };

  // Al abrir, la cola de la tapa (lo que queda detrás del eje) baja dentro
  // de la caja: barre un círculo de radio swingRadius alrededor del eje y,
  // pasados los 90°, avanza también por delante del eje. Los divisores de
  // largo llegan hasta la pared trasera, así que se les recorta la esquina
  // superior para que no la traben. Se recortan las DOS esquinas (frente y
  // fondo) para que la pieza no tenga un lado correcto de montaje.
  const dividerTopCut = {
    width: 2 * pivotInset,
    depth: pivotInset - tl / 2,
  };

  const specs = [
    {
      id: 'bottom', label: 'BOTTOM', width: spanX, height: spanY,
      edges: {
        top: { gender: 'male', ...SOLID }, bottom: { gender: 'male', ...SOLID },
        left: { gender: 'male', ...SOLID }, right: { gender: 'male', ...SOLID },
      },
    },
    { id: 'back', label: 'BACK', ...endWall },
  ];

  const generic = Object.fromEntries(
    specs.map((spec) => [spec.id, { ...spec, points: panelOutline(spec, material) }]),
  );
  const front = buildFrontWall();
  const left = buildSideWall('left', 'LEFT', 'left');
  const right = buildSideWall('right', 'RIGHT', 'right');
  const lid = {
    id: 'lid', label: 'LID', width: lidW, height: lidD,
    edges: {
      top: { gender: 'plain' }, bottom: { gender: 'plain' },
      left: { gender: 'plain' }, right: { gender: 'plain' },
    },
    points: lidWithPegs(),
  };
  const dividerPanels = buildDividerPanels({
    spanX, spanY, dividerHeight: innerHeight, t, kerf, lengthDividers, heightDividers,
    topCornerCut: dividerTopCut,
  });
  const panels = [generic.bottom, front, left, lid, generic.back, right, ...dividerPanels];

  return {
    panels,
    joints,
    errors,
    warnings: [
      ...warningsFor({
        jointWidths: [joints.x.width, joints.y.width, joints.z.width],
        t, kerf, tabWidth, hc, rh, postWidth, spanY, hw, Lo,
      }),
      ...dividerWarnings({ lengthDividers, heightDividers, spanX, dividerHeight: innerHeight, t }),
    ],
    outer: { length: Lo, width: Wo, height: Ho },
    inner: { length: spanX, width: spanY, height: innerHeight },
    hinge: { pegSize: ps, clearance: hc, holeDiameter: dh, postHeight },
  };
}

function validate({
  Lo, Wo, Ho, t, tl, ps, hc, kerf, tabWidth, spanX, spanY, spanZ, hw, hd, lidW,
  swingRadius, innerHeight,
}) {
  const errors = validateBasics({ t, kerf, tabWidth, Lo, Wo, Ho });
  if (errors.length > 0) return errors;

  const positive = (v) => Number.isFinite(v) && v > 0;
  if (!positive(tl)) errors.push('El grosor de la tapa debe ser mayor que 0.');
  if (!positive(ps)) errors.push('El tamaño de la espiga debe ser mayor que 0.');
  if (!Number.isFinite(hc) || hc < 0) errors.push('La holgura del agujero no puede ser negativa.');
  if (!positive(hw)) errors.push('El ancho de la manija debe ser mayor que 0.');
  if (!positive(hd)) errors.push('La profundidad de la manija debe ser mayor que 0.');
  if (errors.length > 0) return errors;

  if (kerf >= t) errors.push(KERF_TOO_BIG);
  if (spanX <= 0 || spanY <= 0) {
    errors.push(`El material de ${t} mm es demasiado grueso para una caja de ${Lo} × ${Wo} mm: no queda espacio dentro.`);
  }
  if (spanZ <= 0 || innerHeight <= 0) {
    errors.push(`Con ${t} mm de material, una caja de ${Ho} mm de alto no deja pared entre la base y la tapa.`);
  }
  if (swingRadius <= tl / 2) {
    errors.push('La tapa es demasiado gruesa para la espiga: no queda sitio detrás del eje para que gire. Sube el tamaño de espiga o la holgura.');
  }
  // La manija (y su muesca a juego en la pared frontal) viven en el canto
  // delantero, lejos de las espigas (que ahora salen de los cantos
  // laterales, cerca del trasero) — ya no hay colisión posible entre las
  // dos. Lo único que sigue haciendo falta es que quede algo de pared
  // sólida a cada lado de la muesca del frente.
  if (hw + 2 * EDGE_MARGIN >= Lo) {
    errors.push(`La manija (${hw} mm) es demasiado ancha para el frente: no deja pared a los costados.`);
  } else if (hw - 2 * LID_SIDE_GAP <= 0 || hw >= lidW) {
    errors.push(`La manija (${hw} mm) es más ancha que la tapa (${lidW.toFixed(1)} mm entre laterales).`);
  }
  if (errors.length > 0) return errors;

  errors.push(...validateTabsVsKerf(
    [['largo', spanX], ['ancho', spanY], ['alto', spanZ]],
    tabWidth, kerf,
  ));
  return errors;
}

// Margen para el aviso de "manija cerca del borde": el error bloqueante
// dispara en hw + 2·em >= Lo. Avisamos cuando falten menos de 10 mm para
// llegar ahí (umbral elegido a ojo, no viene del spec) — bastante para
// cubrir cambios chicos de handleWidth que dejarían poca pared a los
// costados sin llegar a agotarla, pero sin disparar con el handleWidth por
// defecto (20 mm), muy por debajo del umbral en la caja canónica (76 mm de
// umbral con los valores por defecto, a 56 mm de distancia).
const HANDLE_EDGE_WARNING_MARGIN = 10;

function warningsFor({
  jointWidths, t, kerf, tabWidth, hc, rh, postWidth, spanY, hw, Lo,
}) {
  const warnings = commonWarnings({ jointWidths, t, kerf, tabWidth });
  if (hc < 0.1) {
    warnings.push(`Holgura del agujero de ${hc} mm: la bisagra va a quedar dura, puede no girar.`);
  }
  if (hc > 2) {
    warnings.push(`Holgura del agujero de ${hc} mm: la bisagra va a quedar floja, con bamboleo notorio.`);
  }
  if (t >= 6 && rh < t) {
    warnings.push(`Con ${t} mm de material, poco material puede quedar alrededor del agujero: revisa el tamaño de espiga.`);
  }
  // Los dos postes (uno por esquina trasera) viven dentro del mismo ancho de
  // pared spanY; si juntos no caben (2 * postWidth >= spanY) se solapan y
  // postNear en buildSideWall da negativo, sacando puntos fuera del propio
  // ancho declarado del panel — geometría corrupta y silenciosa.
  if (Number.isFinite(postWidth) && Number.isFinite(spanY) && 2 * postWidth >= spanY) {
    warnings.push('Los postes de las dos esquinas traseras se pisan: baja el tamaño de espiga, la holgura, o el margen.');
  }
  if (
    Number.isFinite(hw) && Number.isFinite(Lo)
    && Lo - 2 * EDGE_MARGIN - hw > 0
    && Lo - 2 * EDGE_MARGIN - hw <= HANDLE_EDGE_WARNING_MARGIN
  ) {
    warnings.push(`La manija (${hw} mm) puede quedar muy cerca del borde del frente.`);
  }
  return warnings;
}
