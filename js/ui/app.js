import { buildBox, autoTabWidth as simpleTabWidth } from '../boxes/simple-box.js';
import { buildSlidingBox, autoTabWidth as slidingTabWidth } from '../boxes/sliding-box.js';
import { renderBox } from '../render/svg-render.js';
import { downloadSvg } from '../render/export.js';
import { round } from '../core/geometry.js';

const form = document.getElementById('params');
const preview = document.getElementById('preview');
const warningsEl = document.getElementById('warnings');
const summaryEl = document.getElementById('summary');
const downloadBtn = document.getElementById('downloadBtn');
const tabAutoEl = document.getElementById('tabAuto');
const tabWidthEl = document.getElementById('tabWidth');
const slidingFields = document.getElementById('slidingFields');
const lidThicknessEl = document.getElementById('lidThickness');
const lidThicknessAutoEl = document.getElementById('lidThicknessAuto');
const grooveDepthEl = document.getElementById('grooveDepth');
const grooveAutoEl = document.getElementById('grooveAuto');
const engraveNote = document.getElementById('engraveNote');

// Cada tipo de tapa trae su generador y su cálculo de espiga automática: el
// tramo de junta más corto no es el mismo en una caja cerrada que en una con
// el frente rebajado.
const BUILDERS = {
  sliding: { build: buildSlidingBox, autoTab: slidingTabWidth },
  default: { build: buildBox, autoTab: simpleTabWidth },
};
const builderFor = (lidType) => BUILDERS[lidType] ?? BUILDERS.default;

let currentSvg = null;
let currentBox = null;

function readParams() {
  const number = (id) => parseFloat(document.getElementById(id).value);
  const lidType = form.elements.lidType.value;
  const sliding = lidType === 'sliding';

  const params = {
    length: number('length'),
    width: number('width'),
    height: number('height'),
    thickness: number('thickness'),
    kerf: number('kerf'),
    dimensionMode: form.elements.dimensionMode.value,
    lidType,
    tabWidth: number('tabWidth'),
  };

  slidingFields.hidden = !sliding;

  if (sliding) {
    lidThicknessEl.disabled = lidThicknessAutoEl.checked;
    if (lidThicknessAutoEl.checked) lidThicknessEl.value = params.thickness;
    params.lidThickness = parseFloat(lidThicknessEl.value);

    params.grooveDepthAuto = grooveAutoEl.checked;
    grooveDepthEl.disabled = grooveAutoEl.checked;
    if (grooveAutoEl.checked) {
      grooveDepthEl.value = round(Math.min(params.thickness / 2, 6), 2);
    }
    params.grooveDepth = parseFloat(grooveDepthEl.value);
    params.slideClearance = number('slideClearance');
  }

  tabWidthEl.disabled = tabAutoEl.checked;
  if (tabAutoEl.checked) {
    params.tabWidth = round(builderFor(lidType).autoTab(params), 1);
    tabWidthEl.value = params.tabWidth;
  }
  return params;
}

function showMessages(messages, className) {
  for (const message of messages) {
    const el = document.createElement('div');
    el.className = className;
    el.textContent = message;
    warningsEl.appendChild(el);
  }
}

function recompute() {
  const params = readParams();
  const box = builderFor(params.lidType).build(params);

  warningsEl.replaceChildren();
  showMessages(box.errors, 'error');
  showMessages(box.warnings, 'warning');

  if (box.errors.length > 0) {
    preview.replaceChildren();
    summaryEl.textContent = '';
    downloadBtn.disabled = true;
    engraveNote.hidden = true;
    currentSvg = null;
    currentBox = null;
    return;
  }

  currentBox = box;
  currentSvg = renderBox(box);
  preview.replaceChildren(currentSvg);
  downloadBtn.disabled = false;

  const dims = (d) => `${round(d.length, 1)} × ${round(d.width, 1)} × ${round(d.height, 1)} mm`;
  const realHeight = box.realOuterHeight
    ? ` (alto real con reborde: ${round(box.realOuterHeight, 1)})`
    : '';
  summaryEl.textContent =
    `Exterior ${dims(box.outer)}${realHeight} · Interior ${dims(box.inner)} · ` +
    `Hoja ${currentSvg.getAttribute('width')} × ${currentSvg.getAttribute('height')} · ` +
    `Espigas ${box.joints.x.tabs}/${box.joints.y.tabs}/${box.joints.z.tabs} por junta (largo/ancho/alto)`;

  if (box.groove) {
    engraveNote.textContent =
      `Los rectángulos rojos se vacían a ${round(box.groove.depth, 2)} mm de profundidad: ` +
      'no son cortes pasantes. En LightBurn entran en su propia capa por color.';
    engraveNote.hidden = false;
  } else {
    engraveNote.hidden = true;
  }
}

function debounce(fn, delay) {
  let timer;
  return () => {
    clearTimeout(timer);
    timer = setTimeout(fn, delay);
  };
}

form.addEventListener('input', debounce(recompute, 150));
form.addEventListener('change', recompute);

downloadBtn.addEventListener('click', () => {
  if (!currentSvg || !currentBox) return;
  const { length, width, height } = currentBox.outer;
  const thickness = document.getElementById('thickness').value;
  const SUFFIXES = { flat: '-tapaplana', sliding: '-deslizante' };
  const lid = SUFFIXES[form.elements.lidType.value] ?? '';
  downloadSvg(currentSvg, `boxmaker-${round(length, 1)}x${round(width, 1)}x${round(height, 1)}-t${thickness}${lid}.svg`);
});

recompute();
