// Posiciones a distancias iguales dentro de un tramo, sin tocar los
// extremos: con `count` divisores, el tramo queda partido en `count + 1`
// partes iguales y cada divisor cae en un borde interno entre dos partes.
// Con count=0 no hay ninguna posición — el panel sale liso más abajo.
export function evenPositions(span, count) {
  const positions = [];
  for (let i = 1; i <= count; i += 1) positions.push((i * span) / (count + 1));
  return positions;
}

// Rectángulo width × height, recorrido en sentido horario, con una muesca
// rectangular entallada hacia ADENTRO desde el borde IZQUIERDO (u = 0) por
// cada posición en `positions`, hasta `notchDepth`. Sin posiciones, es un
// rectángulo liso (el caso de un solo tipo de divisor, sin cruces — ver
// spec, "Uno.svg"). Usada por DIVIDER-L: `width` es spanY, `height` es el
// alto interior libre, y cada posición es la altura (eje Z) de un divisor
// de alto que lo cruza.
export function buildLengthDividerPoints({
  width, height, notchDepth, notchWidth, positions,
}) {
  const half = notchWidth / 2;
  // Se recorre en sentido horario: tras las 3 primeras esquinas, el borde
  // izquierdo se camina de abajo (y = height) hacia arriba (y = 0), así
  // que las muescas se insertan ordenadas de mayor a menor y.
  const sorted = [...positions].sort((a, b) => b - a);
  const points = [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height },
  ];
  for (const p of sorted) {
    points.push({ x: 0, y: p + half });
    points.push({ x: notchDepth, y: p + half });
    points.push({ x: notchDepth, y: p - half });
    points.push({ x: 0, y: p - half });
  }
  return points;
}

// Igual que `buildLengthDividerPoints`, pero la muesca se entalla desde el
// borde DE ABAJO (v = height) hacia arriba — el lado OPUESTO, a propósito:
// así, en cualquier cruce, lo que le falta a un DIVIDER-L es justo lo que
// le sobra a un DIVIDER-H, y encajan a media madera (ver spec, "Las dos
// piezas"). Usada por DIVIDER-H: `width` es spanX, `height` es spanY, y
// cada posición es el largo (eje X) de un divisor de largo que lo cruza.
export function buildHeightDividerPoints({
  width, height, notchDepth, notchWidth, positions,
}) {
  const half = notchWidth / 2;
  // Tras las 3 primeras esquinas, el borde de abajo se camina de derecha
  // (x = width) a izquierda (x = 0), así que las muescas se insertan
  // ordenadas de mayor a menor x.
  const sorted = [...positions].sort((a, b) => b - a);
  const points = [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
  ];
  for (const p of sorted) {
    points.push({ x: p + half, y: height });
    points.push({ x: p + half, y: height - notchDepth });
    points.push({ x: p - half, y: height - notchDepth });
    points.push({ x: p - half, y: height });
  }
  return points;
}
