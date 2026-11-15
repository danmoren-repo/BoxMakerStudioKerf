// Etapas de la apertura: el deslizador va de 0 a 1 y cada grupo de piezas
// ocupa un tramo. Primero se va la tapa (y la perilla), luego los divisores,
// al final las paredes. Módulo puro, sin three.js.

export const STAGES = {
  tapa: [0, 0.5],
  saliente: [0, 0.5],
  divisor: [0.2, 0.7],
  cuerpo: [0.3, 1],
};

// Avance (0 a 1) del grupo cuando el deslizador está en s.
export function groupProgress(group, s) {
  const [a, b] = STAGES[group];
  return Math.min(1, Math.max(0, (s - a) / (b - a)));
}
