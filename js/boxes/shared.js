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
export const KERF_TOO_BIG = 'El kerf debe ser menor que el grosor del material.';

export function validateBasics({ t, kerf, tabWidth, Lo, Wo, Ho }) {
  const errors = [];
  const positive = (value) => Number.isFinite(value) && value > 0;

  if (!positive(t)) errors.push('El grosor del material debe ser mayor que 0.');
  if (!Number.isFinite(kerf) || kerf < 0) errors.push('El kerf no puede ser negativo.');
  if (!positive(tabWidth)) errors.push('El ancho de espiga debe ser mayor que 0.');
  if (!positive(Lo) || !positive(Wo) || !positive(Ho)) {
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
