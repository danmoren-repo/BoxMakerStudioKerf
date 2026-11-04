import { computeSegments } from '../core/finger-joint.js';

// Outer dimensions from the requested ones. In "inner" mode the box grows
// around the requested space: one thickness per side in plan, and whatever the
// lid arrangement needs in height — hence heightPad, which the sliding box
// overrides because under its lid there is nothing else.
export function outerDimensions(
  { length, width, height, thickness, dimensionMode },
  heightPad = 2 * thickness,
) {
  const inner = dimensionMode === 'inner';
  return {
    Lo: inner ? length + 2 * thickness : length,
    Wo: inner ? width + 2 * thickness : width,
    Ho: inner ? height + heightPad : height,
  };
}

// Segmentation of one joint span, plus how many tabs the male side grows.
export function jointSegments(span, targetTabWidth) {
  const s = computeSegments(span, targetTabWidth, true);
  return { ...s, tabs: (s.count - 1) / 2 };
}

// Suggested finger width: ~3x material thickness, never under 6 mm, and always
// small enough that the shortest joint still gets at least three segments.
export function autoTabWidthFromSpans(spans, thickness) {
  const preferred = Math.max(3 * thickness, 6);
  const shortest = Math.min(...spans);
  if (!(shortest > 0)) return preferred;
  return Math.min(preferred, shortest / 3);
}

// El kerf contra el grosor NO se valida aquí: en el original va en el mismo
// lote que los chequeos de dimensiones de cada caja, y una caja inválida por
// las dos cosas a la vez tiene que seguir mostrando los dos errores. Se exporta
// el texto para que ese mensaje viva en un solo sitio.
// Un número de verdad y mayor que cero. Lo piden casi todas las
// validaciones: grosores, holguras, medidas de manija.
export const isPositive = (value) => Number.isFinite(value) && value > 0;

export const KERF_TOO_BIG = 'El kerf debe ser menor que el grosor del material.';

export function validateBasics({ t, kerf, tabWidth, Lo, Wo, Ho }) {
  const errors = [];

  if (!isPositive(t)) errors.push('El grosor del material debe ser mayor que 0.');
  if (!Number.isFinite(kerf) || kerf < 0) errors.push('El kerf no puede ser negativo.');
  if (!isPositive(tabWidth)) errors.push('El ancho de espiga debe ser mayor que 0.');
  if (!isPositive(Lo) || !isPositive(Wo) || !isPositive(Ho)) {
    errors.push('Largo, ancho y alto deben ser mayores que 0.');
  }
  return errors;
}

export function validateTabsVsKerf(spans, tabWidth, kerf) {
  const errors = [];
  for (const [name, span] of spans) {
    const { width } = computeSegments(span, tabWidth, true);
    if (width <= kerf * 1.5) {
      errors.push(
        `Las espigas del ${name} quedan de ${width.toFixed(2)} mm, demasiado pequeñas frente a un kerf de ${kerf} mm.`,
      );
    }
  }
  return errors;
}

export function commonWarnings({ jointWidths, t, kerf, tabWidth }) {
  const warnings = [];
  const narrowest = Math.min(...jointWidths);

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

// La tapa puede ser de otro material que la caja: caja de 10 con tapa de 3, o
// tapa de acrílico sobre caja de madera. Sin valor, copia el grosor de pared.
// Un valor presente pero absurdo se deja pasar a propósito, para que la
// validación pueda decirlo en vez de sustituirlo a la espalda del usuario.
export function lidThicknessFor({ thickness, lidThickness }) {
  return Number.isFinite(lidThickness) ? lidThickness : thickness;
}

export const EDGE_MARGIN = 2; // material mínimo alrededor de cualquier corte cerrado

// Las tres tapas con manija —bisagra simple, bisagra doble y deslizante—
// comparten estas medidas y este bulto. Viven acá, y no dentro de la
// bisagra simple, para que tocar una bisagra no arrastre a la deslizante.
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
