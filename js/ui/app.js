import { buildBox, autoTabWidth } from '../boxes/simple-box.js';
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

let currentSvg = null;
let currentBox = null;

function readParams() {
  const number = (id) => parseFloat(document.getElementById(id).value);
  const params = {
    length: number('length'),
    width: number('width'),
    height: number('height'),
    thickness: number('thickness'),
    kerf: number('kerf'),
    dimensionMode: form.elements.dimensionMode.value,
    lidType: form.elements.lidType.value,
    tabWidth: number('tabWidth'),
  };

  tabWidthEl.disabled = tabAutoEl.checked;
  if (tabAutoEl.checked) {
    params.tabWidth = round(autoTabWidth(params), 1);
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
  const box = buildBox(params);

  warningsEl.replaceChildren();
  showMessages(box.errors, 'error');
  showMessages(box.warnings, 'warning');

  if (box.errors.length > 0) {
    preview.replaceChildren();
    summaryEl.textContent = '';
    downloadBtn.disabled = true;
    currentSvg = null;
    currentBox = null;
    return;
  }

  currentBox = box;
  currentSvg = renderBox(box);
  preview.replaceChildren(currentSvg);
  downloadBtn.disabled = false;

  const dims = (d) => `${round(d.length, 1)} × ${round(d.width, 1)} × ${round(d.height, 1)} mm`;
  summaryEl.textContent =
    `Exterior ${dims(box.outer)} · Interior ${dims(box.inner)} · ` +
    `Hoja ${currentSvg.getAttribute('width')} × ${currentSvg.getAttribute('height')} · ` +
    `Espigas ${box.joints.x.tabs}/${box.joints.y.tabs}/${box.joints.z.tabs} por junta (largo/ancho/alto)`;
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
  const lid = form.elements.lidType.value === 'flat' ? '-tapaplana' : '';
  downloadSvg(currentSvg, `boxmaker-${round(length, 1)}x${round(width, 1)}x${round(height, 1)}-t${thickness}${lid}.svg`);
});

recompute();
