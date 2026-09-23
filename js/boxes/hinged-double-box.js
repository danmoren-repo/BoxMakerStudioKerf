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
  lidThicknessFor,
  pegSizeFor,
  hingeClearanceFor,
  handleWidthFor,
  handleDepthFor,
  handleCornerRadiusFor,
  EDGE_MARGIN,
} from './hinged-box.js';

// A diferencia de la bisagra simple (una sola tapa apoyada ENCIMA de
// paredes acortadas un grosor), acá las dos mitades de la tapa encajan A
// RAS con la abertura: las paredes frontal y trasera quedan a la altura
// completa Ho, no Ho − tl.
//
// La espiga sigue viviendo a media altura de la mitad cerrada (tl/2 bajo
// el canto superior de la pared). Como la pared YA llega hasta Ho, el
// agujero casi siempre se pasa un poco por encima de ese canto — rh es
// mayor que tl/2 casi siempre, porque la diagonal √(ps²+tl²) crece más
// rápido que tl solo por el término ps². Por eso sigue haciendo falta un
// poste, pero mucho más bajo que el de la bisagra simple: solo cubre esa
// diferencia (rh − tl/2), no el grosor entero de la tapa.
export function hingedDoubleHeights(params) {
  const t = params.thickness;
  const tl = lidThicknessFor(params);
  const ps = pegSizeFor(params);
  const hc = hingeClearanceFor(params);
  const dh = Math.sqrt(ps * ps + tl * tl) + hc;
  const rh = dh / 2;
  const { Lo, Wo, Ho } = outerDimensions(params, t + tl);
  const postHeight = Math.max(0, rh - tl / 2) + EDGE_MARGIN;
  const postWidth = dh + 2 * EDGE_MARGIN;

  return {
    Lo, Wo, Ho, t, tl, ps, hc, dh, rh,
    wallHeight: Ho,
    postHeight,
    postWidth,
  };
}

export function autoTabWidth(params) {
  const { Lo, Wo, t, wallHeight } = hingedDoubleHeights(params);
  return autoTabWidthFromSpans([Lo - 2 * t, Wo - 2 * t, wallHeight - 2 * t], t);
}

export function buildHingedDoubleBox(params) {
  const { kerf, tabWidth } = params;
  const hw = handleWidthFor(params);
  const hd = handleDepthFor(params);
  const hr = handleCornerRadiusFor(params);
  const {
    Lo, Wo, Ho, t, tl, ps, hc, dh, rh, wallHeight, postHeight, postWidth,
  } = hingedDoubleHeights(params);
  const spanX = Lo - 2 * t; // base <-> frontal/trasera
  const spanY = Wo - 2 * t; // base <-> laterales
  const spanZ = wallHeight - 2 * t; // juntas verticales de las esquinas
  const doorWidth = spanX / 2; // ancho de cada mitad de la tapa

  const errors = validate({
    Lo, Wo, Ho, t, tl, ps, hc, kerf, tabWidth, spanX, spanY, spanZ, hw, hd, doorWidth, postWidth,
  });
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

  const specs = [
    {
      id: 'bottom', label: 'BOTTOM', width: spanX, height: spanY,
      edges: {
        top: { gender: 'male', ...SOLID }, bottom: { gender: 'male', ...SOLID },
        left: { gender: 'male', ...SOLID }, right: { gender: 'male', ...SOLID },
      },
    },
  ];

  // Los laterales quedan simples: acá ningún agujero de bisagra vive en
  // ellos (van en frontal/trasera). Misma estructura de juntas que la
  // bisagra simple, sin el poste.
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
    return { id, label, width: spanY, height: wallHeight, edges: spec.edges, points: panelOutline(spec, material) };
  };

  // Cada pared (frontal y trasera) lleva DOS postes, uno cerca de cada
  // extremo, y UNA muesca compartida en el medio (para las dos lengüetas
  // juntas). Como la pared ya está a su altura completa, cada bulto es un
  // simple bulto o muesca sobre el canto superior recto — misma técnica ya
  // probada para la manija de la bisagra simple, sin ninguna topología de
  // hueco-dentro-de-polígono.
  //
  // postStart/postEnd de cada lado: el poste izquierdo empieza exactamente
  // en x = t (donde termina la junta de la esquina) — no es casualidad:
  // postX(true) − postWidth/2 = (t + em + rh) − (rh + em) = t exactamente.
  const postCenterX = (nearLeftEnd) => (nearLeftEnd ? t + EDGE_MARGIN + rh : Lo - t - EDGE_MARGIN - rh);
  const notchStart = Lo / 2 - hw / 2;
  const notchEnd = Lo / 2 + hw / 2;

  const buildFrontBackWall = (id, label) => {
    const basePoints = panelOutline(endWall, material);
    const rest = basePoints.slice(2);
    const leftPostCx = postCenterX(true);
    const rightPostCx = postCenterX(false);
    const leftPostStart = leftPostCx - postWidth / 2;
    const leftPostEnd = leftPostCx + postWidth / 2;
    const rightPostStart = rightPostCx - postWidth / 2;
    const rightPostEnd = rightPostCx + postWidth / 2;

    const top = [
      { x: 0, y: 0 },
      { x: leftPostStart, y: 0 }, { x: leftPostStart, y: -postHeight },
      { x: leftPostEnd, y: -postHeight }, { x: leftPostEnd, y: 0 },
      { x: notchStart, y: 0 }, { x: notchStart, y: hd },
      { x: notchEnd, y: hd }, { x: notchEnd, y: 0 },
      { x: rightPostStart, y: 0 }, { x: rightPostStart, y: -postHeight },
      { x: rightPostEnd, y: -postHeight }, { x: rightPostEnd, y: 0 },
      { x: Lo, y: 0 },
    ];

    const hole = (nearLeftEnd, suffix) => holeFeature({
      id: `hinge-hole-${suffix}`, cx: postCenterX(nearLeftEnd), cy: tl / 2, diameter: dh, kerf,
    });

    return {
      id, label, width: Lo, height: wallHeight + postHeight,
      edges: endWallEdges,
      points: [...top, ...rest],
      features: [hole(true, 'left'), hole(false, 'right')],
    };
  };

  // Cada mitad de la tapa es un rectángulo liso con dos bultos: la espiga
  // (cuadrado macizo, cerca del canto EXTERIOR — el que da a la pared
  // lateral) y la lengüeta (cerca del canto INTERIOR — el que da hacia la
  // otra mitad). `pegNear0` decide de qué lado va cada una: true = espiga
  // cerca de x=0, lengüeta cerca de x=doorWidth (mitad izquierda); false =
  // al revés (mitad derecha) — mismo patrón que ya usa buildSideWall para
  // espejar sus propias juntas entre izquierda y derecha.
  //
  // Las dos espigas (frente y fondo) y las dos mitades de la lengüeta
  // (frente y fondo) son bultos convexos simples sobre cantos rectos —
  // igual que la manija ya implementada — así que no hace falta ninguna
  // técnica nueva, sólo aplicar el mismo bulto cuatro veces por mitad.
  const buildDoor = (id, label, pegNear0) => {
    const pegOffset = EDGE_MARGIN + rh;
    const pegCenter = pegNear0 ? pegOffset : doorWidth - pegOffset;
    const pegStart = pegCenter - ps / 2;
    const pegEnd = pegCenter + ps / 2;
    const tongueHalfWidth = hw / 2;
    // El extremo de la lengüeta que NO llega al propio canto de la mitad
    // (el otro extremo SÍ llega, a x=0 o x=doorWidth exactos).
    const tongueInner = pegNear0 ? doorWidth - tongueHalfWidth : tongueHalfWidth;

    const points = pegNear0
      ? [
        { x: 0, y: 0 },
        { x: pegStart, y: 0 }, { x: pegStart, y: -ps }, { x: pegEnd, y: -ps }, { x: pegEnd, y: 0 },
        { x: tongueInner, y: 0 }, { x: tongueInner, y: -hd }, { x: doorWidth, y: -hd },
        { x: doorWidth, y: spanY + hd },
        { x: tongueInner, y: spanY + hd }, { x: tongueInner, y: spanY },
        { x: pegEnd, y: spanY }, { x: pegEnd, y: spanY + ps }, { x: pegStart, y: spanY + ps }, { x: pegStart, y: spanY },
        { x: 0, y: spanY },
      ]
      : [
        { x: 0, y: -hd },
        { x: tongueInner, y: -hd }, { x: tongueInner, y: 0 },
        { x: pegStart, y: 0 }, { x: pegStart, y: -ps }, { x: pegEnd, y: -ps }, { x: pegEnd, y: 0 },
        { x: doorWidth, y: 0 },
        { x: doorWidth, y: spanY },
        { x: pegEnd, y: spanY }, { x: pegEnd, y: spanY + ps }, { x: pegStart, y: spanY + ps }, { x: pegStart, y: spanY },
        { x: tongueInner, y: spanY }, { x: tongueInner, y: spanY + hd },
        { x: 0, y: spanY + hd },
      ];

    return {
      id, label, width: doorWidth, height: spanY,
      edges: {
        top: { gender: 'plain' }, bottom: { gender: 'plain' },
        left: { gender: 'plain' }, right: { gender: 'plain' },
      },
      points,
    };
  };

  const generic = Object.fromEntries(
    specs.map((spec) => [spec.id, { ...spec, points: panelOutline(spec, material) }]),
  );
  const front = buildFrontBackWall('front', 'FRONT');
  const back = buildFrontBackWall('back', 'BACK');
  const left = buildSideWall('left', 'LEFT', 'left');
  const right = buildSideWall('right', 'RIGHT', 'right');
  const lidLeft = buildDoor('lid-left', 'LID-LEFT', true);
  const lidRight = buildDoor('lid-right', 'LID-RIGHT', false);

  const panels = [generic.bottom, front, left, lidLeft, lidRight, back, right];

  return {
    panels,
    joints,
    errors,
    warnings: warningsFor({
      jointWidths: [joints.x.width, joints.y.width, joints.z.width],
      t, kerf, tabWidth, hc, rh, tl, Lo, hw,
      leftPostEnd: postCenterX(true) + postWidth / 2,
      rightPostStart: postCenterX(false) - postWidth / 2,
      notchStart, notchEnd,
    }),
    outer: { length: Lo, width: Wo, height: Ho },
    inner: { length: spanX, width: spanY, height: wallHeight - t - tl },
    hinge: { pegSize: ps, clearance: hc, holeDiameter: dh, postHeight },
  };
}

function validate({
  Lo, Wo, Ho, t, tl, ps, hc, kerf, tabWidth, spanX, spanY, spanZ, hw, hd, doorWidth, postWidth,
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
  if (spanZ <= 0) {
    errors.push(`Con ${t} mm de material, una caja de ${Ho} mm de alto no deja pared entre la base y las paredes.`);
  }
  if (hw + 2 * EDGE_MARGIN >= Lo) {
    errors.push(`La manija (${hw} mm) es demasiado ancha para el frente: no deja pared a los costados.`);
  }
  if (errors.length > 0) return errors;

  if (doorWidth <= 0 || doorWidth <= postWidth) {
    errors.push(`El material de ${t} mm es demasiado grueso para una caja de ${Lo} mm de largo: no queda espacio para las dos mitades de la tapa.`);
  }
  if (errors.length > 0) return errors;

  errors.push(...validateTabsVsKerf(
    [['largo', spanX], ['ancho', spanY], ['alto', spanZ]],
    tabWidth, kerf,
  ));
  return errors;
}

// Margen para el aviso de "manija cerca del borde", mismo criterio que la
// bisagra simple: el error bloqueante dispara en hw + 2·em >= Lo, avisamos
// cuando falten menos de 10 mm para llegar ahí.
const HANDLE_EDGE_WARNING_MARGIN = 10;

function warningsFor({
  jointWidths, t, kerf, tabWidth, hc, rh, tl, Lo, hw,
  leftPostEnd, rightPostStart, notchStart, notchEnd,
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
  // Cada pared (frontal y trasera) lleva dos postes cerca de sus extremos y
  // una muesca compartida en el medio. Si la caja es corta de largo, los
  // postes pueden invadir la muesca (o directamente pisarse entre sí si
  // Lo es muy chico) — geometría corrupta y silenciosa si no se avisa.
  if (leftPostEnd >= notchStart || notchEnd >= rightPostStart) {
    warnings.push('Los postes de bisagra invaden la muesca de la manija: baja el tamaño de espiga, la holgura, o el ancho de manija.');
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
