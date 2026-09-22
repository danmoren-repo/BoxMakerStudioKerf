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

export function handleWidthFor({ handleWidth }) {
  return Number.isFinite(handleWidth) ? handleWidth : 20;
}
export function handleDepthFor({ handleDepth }) {
  return Number.isFinite(handleDepth) ? handleDepth : 6;
}
export function handleCornerRadiusFor({ handleCornerRadius }) {
  return Number.isFinite(handleCornerRadius) ? handleCornerRadius : 2;
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
  const hw = handleWidthFor(params);
  const hd = handleDepthFor(params);
  const hr = handleCornerRadiusFor(params);
  const {
    Lo, Wo, Ho, t, tl, dp, hc, rh, wallHeight, postHeight, postWidth,
  } = hingedHeights(params);
  const spanX = Lo - 2 * t; // frente/fondo <-> base
  const spanY = Wo - 2 * t; // laterales <-> base
  const spanZ = wallHeight - 2 * t; // juntas verticales, iguales en las cuatro paredes

  // El ancho de la muesca (dónde el cuello se separa del canto trasero de la
  // tapa) tiene que quedar del mismo ancho que el poste, como dice el
  // comentario de arriba — y no sólo por estética: el disco de la espiga
  // (radio rh, centrado a t/2 del canto) sólo puede bultear hacia adentro
  // del canto, así que su punto más lejano llega a t/2 + rh. Si la muesca
  // fuera más angosta que eso (p.ej. t + em, mucho menor que t/2 + rh con
  // los valores por defecto) el segmento recto que cierra la muesca cruzaría
  // el propio arco de la espiga, dando un contorno que se cruza a sí mismo.
  const notchWidth = postWidth;

  const errors = validate({ Lo, Wo, Ho, t, tl, dp, hc, kerf, tabWidth, spanX, spanY, spanZ, hw, notchWidth });
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

  // La muesca del frente hace juego con la manija de la tapa: juntas dejan un
  // hueco por el que meter el dedo. Se injerta igual que el poste del
  // lateral: los dos primeros puntos de panelOutline son las esquinas del
  // canto superior (acá 'top' es plain, así que no se mezcla con nada más).
  const buildFrontWall = () => {
    const basePoints = panelOutline(endWall, material);
    const rest = basePoints.slice(2);
    return {
      id: 'front', label: 'FRONT', width: Lo, height: wallHeight, edges: endWallEdges,
      points: [
        { x: 0, y: 0 }, { x: handleStart, y: 0 }, { x: handleStart, y: hd },
        { x: handleStart + hw, y: hd }, { x: handleStart + hw, y: 0 }, { x: Lo, y: 0 },
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

  // La muesca no es un simple "bulto" pegado al canto: el poste del lateral,
  // cuando la tapa cierra, sube por encima de Ho en esa esquina (ver más
  // arriba), así que la tapa necesita ahí un HUECO real — un polígono con
  // agujero, no sólo un canto que se abolla hacia adentro o hacia afuera.
  //
  // Tres construcciones anteriores fallaron, cada una encontrada por una
  // revisión independiente (no a simple vista — con scripts que prueban
  // cruces, solapes colineares, aristas que rozan un vértice ajeno, picos
  // adyacentes que se devuelven sobre sí mismos, Y si el disco de la
  // espiga realmente queda del lado MATERIAL del contorno, no del lado
  // VACÍO — las primeras tres pasaban las pruebas de cruces pero fallaban
  // esta última, la más fácil de pasar por alto a mano):
  //   1. Entrada y salida ancladas al MISMO punto del canto trasero a
  //      distinta profundidad → aristas colineares superpuestas, sellaban
  //      el hueco en vez de abrirlo.
  //   2. Diagonales directas del punto de anclaje a los dos extremos del
  //      arco → una diagonal a un punto del círculo que no es tangente
  //      vuelve a entrar al círculo antes de llegar.
  //   3. Dos líneas tangentes (a nearY y farY) ancladas a DOS puntos
  //      distintos del canto trasero → sin cruces ni solapes, pero el
  //      disco de la espiga quedaba del lado VACÍO del contorno (un hueco
  //      donde debía haber espiga) mientras la muesca "vacía" quedaba
  //      MATERIAL — el sentido de giro local del hueco era el opuesto al
  //      que hacía falta, y ningún cambio de qué lado entra o sale primero
  //      lo arreglaba (se probó exhaustivamente): el hueco necesitaba ser
  //      un anillo propio, no un simple recorrido de ida y vuelta por el
  //      mismo canto.
  //
  // Lo que sigue SÍ funciona, verificado con un script que compara cada
  // par de aristas (cruces, solapes, aristas-sobre-vértice-ajeno, picos) Y
  // clasifica el centro del disco y el interior de la muesca por
  // ray-casting: el hueco toca el canto trasero en UN solo punto por
  // esquina (sin volver a visitarlo — visitarlo dos veces, aunque sea el
  // mismo punto, es lo que producía el "pico" del intento 3), y desde ahí
  // se cierra en un solo recorrido: hombro exterior → baja → arco →
  // (queda ya pegado al canto lateral, sigue derecho). La esquina derecha
  // usa el orden inverso (empieza pegada al canto lateral, termina en el
  // hombro exterior) porque el recorrido de la tapa llega primero a la
  // derecha (justo después de (Lo,Wo)) y a la izquierda al final (justo
  // antes de (0,Wo)) — no son simétricas, así que no basta con espejar x.
  //
  // El sentido del arco (qué extremo es "el primero") no sale de un
  // argumento general — salió de probar las combinaciones y quedarse con
  // la que da disco=MATERIAL y muesca=VACÍO. Si se toca esta función, hay
  // que re-verificar con el mismo tipo de script, no repetir el argumento
  // de "la tangente nunca cruza el círculo": eso es necesario pero no
  // alcanza, como demostró el intento 3.
  const buildPegCorner = (isLeft) => {
    const cx = isLeft ? t / 2 : Lo - t / 2;
    const cy = Wo - t - EDGE_MARGIN - rh;
    const nearY = cy - rh;
    const farY = cy + rh;
    if (isLeft) {
      return [
        { x: notchWidth, y: Wo },
        { x: notchWidth, y: nearY },
        ...pegArc(cx, cy, -90, 90), // nearY -> farY, bultea hacia +x
        { x: cx, y: Wo },
      ];
    }
    return [
      { x: cx, y: Wo },
      ...pegArc(cx, cy, 90, 270), // farY -> nearY, bultea hacia -x
      { x: Lo - notchWidth, y: nearY },
      { x: Lo - notchWidth, y: Wo },
    ];
  };

  // La manija es un bulto que sale del canto delantero de la tapa. Sólo
  // tiene sentido redondear las dos esquinas de la PUNTA (las más alejadas
  // del canto) — la base, donde se funde con el canto, no es una esquina:
  // ahí el contorno sigue derecho, igual que en cualquier otro punto del
  // canto delantero.
  //
  // El plan original (`roundedRectPoints`, un rectángulo de 4 esquinas
  // redondeadas y sentido horario) traza un rectángulo CERRADO completo —
  // incluida la arista que falta entre el último punto y el primero,
  // implícita al usarlo como polígono por sí solo. Empalmar ese rectángulo
  // entero entre (handleStart, 0) y (handleStart + hw, 0), como decía el
  // plan, no funciona: mete un bucle cerrado propio en medio del contorno
  // de la tapa, con una costura cerca de la base (la arista entre las dos
  // esquinas "de abajo" del rectángulo, que conecta un lado con el otro
  // cruzando por dentro de la propia manija) que efectivamente se cruza con
  // el resto de la figura. Verificado con un script de cruces de segmentos
  // (mismo tipo que el usado para `buildPegCorner`): con las 4 esquinas,
  // 1 cruce transversal y 1 vértice apoyado sobre una arista ajena, los dos
  // exactamente en esa costura de la base. Con sólo las 2 esquinas de la
  // punta (esta versión), 0 y 0.
  const handleCapPoints = (x, width, tipY, radius, steps = 6) => {
    const arc = (cx, cy, fromDeg, toDeg) => {
      const pts = [];
      for (let i = 0; i <= steps; i++) {
        const a = ((fromDeg + (toDeg - fromDeg) * (i / steps)) * Math.PI) / 180;
        pts.push({ x: cx + radius * Math.cos(a), y: cy + radius * Math.sin(a) });
      }
      return pts;
    };
    return [
      ...arc(x + radius, tipY + radius, 180, 270),
      ...arc(x + width - radius, tipY + radius, 270, 360),
    ];
  };

  const lidWithPegs = () => {
    const handle = handleCapPoints(handleStart, hw, -hd, hr);
    return [
      { x: 0, y: 0 }, { x: handleStart, y: 0 }, ...handle, { x: handleStart + hw, y: 0 },
      { x: Lo, y: 0 }, { x: Lo, y: Wo },
      ...buildPegCorner(false),
      ...buildPegCorner(true),
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
    { id: 'back', label: 'BACK', ...endWall },
  ];

  const generic = Object.fromEntries(
    specs.map((spec) => [spec.id, { ...spec, points: panelOutline(spec, material) }]),
  );
  const front = buildFrontWall();
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
  const panels = [generic.bottom, front, left, lid, generic.back, right];

  return {
    panels,
    joints,
    errors,
    warnings: warningsFor({
      jointWidths: [joints.x.width, joints.y.width, joints.z.width],
      t, kerf, tabWidth, hc, rh,
    }),
    outer: { length: Lo, width: Wo, height: Ho },
    inner: { length: spanX, width: spanY, height: wallHeight - t },
    hinge: { pegDiameter: dp, clearance: hc, holeDiameter: dp + hc, postHeight },
  };
}

function validate({
  Lo, Wo, Ho, t, tl, dp, hc, kerf, tabWidth, spanX, spanY, spanZ, hw, notchWidth,
}) {
  const errors = validateBasics({ t, kerf, tabWidth, Lo, Wo, Ho });
  if (errors.length > 0) return errors;

  const positive = (v) => Number.isFinite(v) && v > 0;
  if (!positive(tl)) errors.push('El grosor de la tapa debe ser mayor que 0.');
  if (!positive(dp)) errors.push('El diámetro de la espiga debe ser mayor que 0.');
  if (!Number.isFinite(hc) || hc < 0) errors.push('La holgura del agujero no puede ser negativa.');
  if (!positive(hw)) errors.push('El ancho de la manija debe ser mayor que 0.');
  if (errors.length > 0) return errors;

  if (kerf >= t) errors.push(KERF_TOO_BIG);
  if (spanX <= 0 || spanY <= 0) {
    errors.push(`El material de ${t} mm es demasiado grueso para una caja de ${Lo} × ${Wo} mm: no queda espacio dentro.`);
  }
  if (spanZ <= 0) {
    errors.push(`Con ${t} mm de material, una caja de ${Ho} mm de alto no deja pared entre la base y la tapa.`);
  }
  if (hw + 2 * notchWidth >= Lo) {
    errors.push(`La manija (${hw} mm) es demasiado ancha para el frente: choca con las espigas de bisagra de las esquinas.`);
  }
  if (errors.length > 0) return errors;

  errors.push(...validateTabsVsKerf(
    [['largo', spanX], ['ancho', spanY], ['alto', spanZ]],
    tabWidth, kerf,
  ));
  return errors;
}

function warningsFor({ jointWidths, t, kerf, tabWidth, hc, rh }) {
  const warnings = commonWarnings({ jointWidths, t, kerf, tabWidth });
  if (hc < 0.1) {
    warnings.push(`Holgura del agujero de ${hc} mm: la bisagra va a quedar dura, puede no girar.`);
  }
  if (hc > 2) {
    warnings.push(`Holgura del agujero de ${hc} mm: la bisagra va a quedar floja, con bamboleo notorio.`);
  }
  if (t >= 6 && rh < t) {
    warnings.push(`Con ${t} mm de material, poco material puede quedar alrededor del agujero: revisa el diámetro de espiga.`);
  }
  return warnings;
}
