import { boundingBox, pathFromPoints, round } from '../core/geometry.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const MARGIN = 10;
const GAP = 10;
const COLUMNS = 3;

// One SVG in real millimetres: width/height carry the mm suffix and the viewBox
// repeats the same numbers, so 1 user unit = 1 mm in Inkscape and LightBurn.
export function renderBox(box, { showLabels = true } = {}) {
  const placed = layout(box.panels);
  const sheetWidth = round(placed.width + 2 * MARGIN);
  const sheetHeight = round(placed.height + 2 * MARGIN);

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('xmlns', SVG_NS);
  svg.setAttribute('width', `${sheetWidth}mm`);
  svg.setAttribute('height', `${sheetHeight}mm`);
  svg.setAttribute('viewBox', `0 0 ${sheetWidth} ${sheetHeight}`);

  const cuts = document.createElementNS(SVG_NS, 'g');
  cuts.setAttribute('id', 'cut');
  cuts.setAttribute('fill', 'none');
  cuts.setAttribute('stroke', '#000000');
  cuts.setAttribute('stroke-width', '0.2');

  const labels = document.createElementNS(SVG_NS, 'g');
  labels.setAttribute('id', 'labels');
  labels.setAttribute('fill', '#b0b0b0');
  labels.setAttribute('font-family', 'sans-serif');
  labels.setAttribute('text-anchor', 'middle');

  for (const item of placed.items) {
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('id', item.panel.id);
    path.setAttribute('d', pathFromPoints(item.points));
    cuts.appendChild(path);

    if (showLabels) {
      const bbox = boundingBox(item.points);
      const text = document.createElementNS(SVG_NS, 'text');
      text.setAttribute('x', round(bbox.minX + bbox.width / 2));
      text.setAttribute('y', round(bbox.minY + bbox.height / 2));
      text.setAttribute('font-size', round(Math.min(Math.max(Math.min(bbox.width, bbox.height) / 6, 3), 10)));
      text.setAttribute('dominant-baseline', 'middle');
      text.textContent = item.panel.label;
      labels.appendChild(text);
    }
  }

  svg.appendChild(cuts);
  if (showLabels) svg.appendChild(labels);
  return svg;
}

// Plain row-by-row placement, three panels per row. No nesting optimisation:
// the goal is a readable sheet, not the tightest one.
function layout(panels) {
  const items = [];
  let cursorX = 0;
  let cursorY = 0;
  let rowHeight = 0;
  let sheetWidth = 0;

  panels.forEach((panel, index) => {
    const bbox = boundingBox(panel.points);
    if (index > 0 && index % COLUMNS === 0) {
      cursorY += rowHeight + GAP;
      cursorX = 0;
      rowHeight = 0;
    }
    const dx = MARGIN + cursorX - bbox.minX;
    const dy = MARGIN + cursorY - bbox.minY;
    items.push({
      panel,
      points: panel.points.map((p) => ({ x: p.x + dx, y: p.y + dy })),
    });
    cursorX += bbox.width + GAP;
    sheetWidth = Math.max(sheetWidth, cursorX - GAP);
    rowHeight = Math.max(rowHeight, bbox.height);
  });

  return { items, width: sheetWidth, height: cursorY + rowHeight };
}
