import { buildBox, autoTabWidth as simpleTabWidth } from '../boxes/simple-box.js';
import { buildSlidingBox, autoTabWidth as slidingTabWidth } from '../boxes/sliding-box.js';
import {
  buildSlidingSupportBox, autoTabWidth as slidingSupportTabWidth, windowFrameFor,
} from '../boxes/sliding-support-box.js';
import { buildHingedBox, autoTabWidth as hingedTabWidth } from '../boxes/hinged-box.js';
import { buildHingedDoubleBox, autoTabWidth as hingedDoubleTabWidth } from '../boxes/hinged-double-box.js';
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
const grooveField = document.getElementById('grooveField');
const windowFrameField = document.getElementById('windowFrameField');
const windowFrameEl = document.getElementById('windowFrame');
const windowFrameAutoEl = document.getElementById('windowFrameAuto');
const engraveNote = document.getElementById('engraveNote');
const hingedFields = document.getElementById('hingedFields');
const pegSizeEl = document.getElementById('pegSize');
const pegSizeAutoEl = document.getElementById('pegSizeAuto');
const hingeClearanceEl = document.getElementById('hingeClearance');
const handleWidthEl = document.getElementById('handleWidth');
const handleDepthEl = document.getElementById('handleDepth');
const handleDepthAutoEl = document.getElementById('handleDepthAuto');
const flatFields = document.getElementById('flatFields');
const gripEl = document.getElementById('grip');
const gripFields = document.getElementById('gripFields');
const gripDiameterEl = document.getElementById('gripDiameter');
const gripStemSpanEl = document.getElementById('gripStemSpan');
const lengthDividersEl = document.getElementById('lengthDividers');
const heightDividersEl = document.getElementById('heightDividers');

// Cada tipo de tapa trae su generador y su cálculo de espiga automática: el
// tramo de junta más corto no es el mismo en una caja cerrada que en una con
// el frente rebajado. La tapa deslizante tiene dos generadores, uno por
// método de riel.
const BUILDERS = {
  sliding: { build: buildSlidingBox, autoTab: slidingTabWidth },
  slidingSupports: { build: buildSlidingSupportBox, autoTab: slidingSupportTabWidth },
  hinged: { build: buildHingedBox, autoTab: hingedTabWidth },
  hingedDouble: { build: buildHingedDoubleBox, autoTab: hingedDoubleTabWidth },
  default: { build: buildBox, autoTab: simpleTabWidth },
};
const builderKey = ({ lidType, slideMethod }) => (
  lidType === 'sliding' && slideMethod === 'supports' ? 'slidingSupports' : lidType
);
const builderFor = (params) => BUILDERS[builderKey(params)] ?? BUILDERS.default;

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
    lengthDividers: number('lengthDividers'),
    heightDividers: number('heightDividers'),
  };

  slidingFields.hidden = !sliding;

  if (sliding) {
    lidThicknessEl.disabled = lidThicknessAutoEl.checked;
    if (lidThicknessAutoEl.checked) lidThicknessEl.value = params.thickness;
    params.lidThickness = parseFloat(lidThicknessEl.value);
    params.slideClearance = number('slideClearance');

    params.slideMethod = form.elements.slideMethod.value;
    const supports = params.slideMethod === 'supports';
    grooveField.hidden = supports;
    windowFrameField.hidden = !supports;

    if (supports) {
      params.windowFrameAuto = windowFrameAutoEl.checked;
      windowFrameEl.disabled = windowFrameAutoEl.checked;
      if (windowFrameAutoEl.checked) {
        windowFrameEl.value = round(windowFrameFor({ thickness: params.thickness }), 2);
      }
      params.windowFrame = parseFloat(windowFrameEl.value);
    } else {
      params.grooveDepthAuto = grooveAutoEl.checked;
      grooveDepthEl.disabled = grooveAutoEl.checked;
      if (grooveAutoEl.checked) {
        grooveDepthEl.value = round(Math.min(params.thickness / 2, 6), 2);
      }
      params.grooveDepth = parseFloat(grooveDepthEl.value);
    }
  }

  // La bisagra simple y la doble comparten exactamente los mismos campos
  // (tamaño de espiga, holgura, ancho/profundidad de manija) y las mismas
  // fórmulas por defecto — mismo bloque de campos para las dos.
  const hinged = lidType === 'hinged' || lidType === 'hingedDouble';
  hingedFields.hidden = !hinged;

  if (hinged) {
    pegSizeEl.disabled = pegSizeAutoEl.checked;
    if (pegSizeAutoEl.checked) pegSizeEl.value = round(params.thickness, 2);
    params.pegSize = parseFloat(pegSizeEl.value);
    params.hingeClearance = number('hingeClearance');
    params.handleWidth = number('handleWidth');

    handleDepthEl.disabled = handleDepthAutoEl.checked;
    if (handleDepthAutoEl.checked) handleDepthEl.value = round(params.thickness + 5, 1);
    params.handleDepth = parseFloat(handleDepthEl.value);
  }

  const flat = lidType === 'flat';
  flatFields.hidden = !flat;
  if (flat) {
    params.grip = gripEl.checked;
    gripFields.hidden = !params.grip;
    if (params.grip) {
      params.gripDiameter = parseFloat(gripDiameterEl.value);
      params.gripStemSpan = parseFloat(gripStemSpanEl.value);
    }
  }

  tabWidthEl.disabled = tabAutoEl.checked;
  if (tabAutoEl.checked) {
    params.tabWidth = round(builderFor(params).autoTab(params), 1);
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
  const box = builderFor(params).build(params);

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
  const Nc = Number.isFinite(params.lengthDividers) ? params.lengthDividers : 0;
  const Ns = Number.isFinite(params.heightDividers) ? params.heightDividers : 0;
  const compartments = (Nc > 0 || Ns > 0) ? ` · Compartimentos ${Nc + 1} × ${Ns + 1}` : '';
  summaryEl.textContent =
    `Exterior ${dims(box.outer)}${realHeight} · Interior ${dims(box.inner)} · ` +
    `Hoja ${currentSvg.getAttribute('width')} × ${currentSvg.getAttribute('height')} · ` +
    `Espigas ${box.joints.x.tabs}/${box.joints.y.tabs}/${box.joints.z.tabs} por junta (largo/ancho/alto)${compartments}`;

  if (box.groove) {
    engraveNote.textContent =
      `Los rectángulos rojos se vacían a ${round(box.groove.depth, 2)} mm de profundidad: ` +
      'no son cortes pasantes. En LightBurn entran en su propia capa por color.';
    engraveNote.hidden = false;
  } else if (box.supports) {
    engraveNote.textContent =
      'Pega SUPPORT 1 y 2 por dentro de LEFT y RIGHT, apoyados sobre BOTTOM, antes de cerrar la caja con TOP.';
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
  const SUFFIXES = {
    flat: '-tapaplana',
    sliding: '-deslizante',
    slidingSupports: '-deslizante-soportes',
    hinged: '-bisagra',
    hingedDouble: '-bisagra-doble',
  };
  const lid = SUFFIXES[builderKey({
    lidType: form.elements.lidType.value,
    slideMethod: form.elements.slideMethod.value,
  })] ?? '';
  downloadSvg(currentSvg, `boxmaker-${round(length, 1)}x${round(width, 1)}x${round(height, 1)}-t${thickness}${lid}.svg`);
});

recompute();
