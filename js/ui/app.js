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
const verticalClearanceField = document.getElementById('verticalClearanceField');
const windowFrameAutoEl = document.getElementById('windowFrameAuto');
const engraveNote = document.getElementById('engraveNote');
const hingedFields = document.getElementById('hingedFields');
const handleFields = document.getElementById('handleFields');
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
const dividerModeField = document.getElementById('dividerModeField');
const tabPieces = document.getElementById('tabPieces');
const tab3d = document.getElementById('tab3d');
const preview3d = document.getElementById('preview3d');
const reframeBtn = document.getElementById('reframeBtn');
const openControl = document.getElementById('openControl');
const openSlider = document.getElementById('openSlider');
const pngBtn = document.getElementById('pngBtn');
const pieceLabel = document.getElementById('pieceLabel');
const dimsPanel = document.getElementById('dimsPanel');

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
// Vista 3D: three.js se carga sólo la primera vez que se abre la pestaña.
let viewer = null;
let viewerLoading = null;
let lastBox = null; // la última caja calculada, también si trae errores
let view3dOpen = false;

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
    widthDividers: number('widthDividers'),
    dividerMode: form.elements.dividerMode.value,
  };

  // El tipo de divisor sólo importa si hay al menos uno.
  const anyDivider = (params.lengthDividers || 0) > 0 || (params.widthDividers || 0) > 0;
  dividerModeField.hidden = !anyDivider;

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
    // La holgura vertical sólo existe en el método de soportes: con canal
    // grabado, el alto del canal ya lo fija la holgura lateral.
    verticalClearanceField.hidden = !supports;
    if (supports) params.verticalClearance = number('verticalClearance');

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
  }

  // La manija la llevan la tapa con bisagra (entra en una muesca del frente)
  // y la deslizante (sobresale al aire para poder tirar de ella). Mismos
  // campos y mismos valores por defecto en las dos.
  const handled = hinged || sliding;
  handleFields.hidden = !handled;

  if (handled) {
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

// Nombre de la pieza elegida en la vista 3D (null = clic en el vacío).
function showPieceName(label) {
  pieceLabel.textContent = label ?? '';
  pieceLabel.hidden = !label;
}

// Medidas interiores y volumen, en la vista 3D. Se oculta si la caja tiene errores.
function showDims(box) {
  if (!box || box.errors.length > 0) {
    dimsPanel.hidden = true;
    return;
  }
  const { length, width, height } = box.inner;
  const liters = round((length * width * height) / 1e6, 2);
  dimsPanel.textContent =
    `Interior ${round(length, 1)} × ${round(width, 1)} × ${round(height, 1)} mm · ${liters} L`;
  dimsPanel.hidden = false;
}

// Nombre del archivo descargado (SVG o PNG): medidas exteriores, grosor y tipo de tapa.
function exportFileName(box, ext) {
  const { length, width, height } = box.outer;
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
  return `boxmaker-${round(length, 1)}x${round(width, 1)}x${round(height, 1)}-t${thickness}${lid}.${ext}`;
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
  lastBox = box;
  // El visor 3D nunca debe congelar la vista de piezas si algo inesperado falla.
  try {
    if (view3dOpen && viewer) viewer.show(box);
  } catch (e) {
    console.error(e);
  }
  showPieceName(null);
  showDims(box);
  pngBtn.disabled = !viewer || box.errors.length > 0;

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
  const Ns = Number.isFinite(params.widthDividers) ? params.widthDividers : 0;
  const compartments = (Nc > 0 || Ns > 0) ? ` · Compartimentos ${Nc + 1} × ${Ns + 1}` : '';
  summaryEl.textContent =
    `Exterior ${dims(box.outer)}${realHeight} · Interior ${dims(box.inner)} · ` +
    `Hoja ${currentSvg.getAttribute('width')} × ${currentSvg.getAttribute('height')} · ` +
    `Espigas ${box.joints.x.tabs}/${box.joints.y.tabs}/${box.joints.z.tabs} por junta (largo/ancho/alto)${compartments}`;

  // Las notas de armado se suman: una caja con soportes y divisores fijos
  // necesita las dos.
  const notes = [];
  if (box.groove) {
    notes.push(
      `Los rectángulos rojos se vacían a ${round(box.groove.depth, 2)} mm de profundidad: ` +
      'no son cortes pasantes. En LightBurn entran en su propia capa por color.',
    );
  } else if (box.supports) {
    notes.push('Pega SUPPORT 1 y 2 por dentro de LEFT y RIGHT, apoyados sobre BOTTOM, antes de cerrar la caja con TOP.');
  }
  if (box.dividerTabs) {
    notes.push('Arma los divisores junto con las paredes: mete sus cejillas en las ranuras y pega sólo paredes y tapas.');
    const key = builderKey(params);
    if (key === 'hinged') notes.push('Monta la tapa al poner LEFT y RIGHT.');
    if (key === 'slidingSupports') notes.push('Pega cada SUPPORT a su lateral usando un divisor de ancho en su ranura como guía.');
  }
  engraveNote.textContent = notes.join(' ');
  engraveNote.hidden = notes.length === 0;
}

// Pestañas "Piezas | 3D".
function selectTab(open3d) {
  view3dOpen = open3d;
  tabPieces.setAttribute('aria-selected', String(!open3d));
  tab3d.setAttribute('aria-selected', String(open3d));
  tabPieces.tabIndex = open3d ? -1 : 0;
  tab3d.tabIndex = open3d ? 0 : -1;
  preview.hidden = open3d;
  preview3d.hidden = !open3d;
  reframeBtn.hidden = !open3d;
  pngBtn.hidden = !open3d;
  openControl.hidden = !open3d;
  if (open3d) open3dView();
}

let loadErrorEl = null;
async function open3dView() {
  loadErrorEl?.remove();
  loadErrorEl = null;
  try {
    if (!viewerLoading) {
      viewerLoading = import('../preview3d/viewer.js').then(({ createViewer }) => {
        viewer = createViewer(preview3d);
        viewer.onPick(showPieceName);
      });
    }
    await viewerLoading;
  } catch (e) {
    viewerLoading = null;
    // El error va en su propio elemento: no se borran las etiquetas del contenedor.
    loadErrorEl = document.createElement('p');
    loadErrorEl.className = 'viewer3d-message';
    loadErrorEl.textContent = 'No se pudo cargar la vista 3D. Recarga la página para intentarlo de nuevo.';
    preview3d.appendChild(loadErrorEl);
    console.error(e);
    return;
  }
  // El visor nuevo arranca cerrado: se le pasa lo que marca el deslizador.
  viewer.setOpen(openSlider.value / 100);
  pngBtn.disabled = !lastBox || lastBox.errors.length > 0;
  if (view3dOpen && lastBox) viewer.show(lastBox);
}

tabPieces.addEventListener('click', () => selectTab(false));
tab3d.addEventListener('click', () => selectTab(true));
// Flechas izquierda/derecha para moverse entre pestañas (patrón ARIA de tabs).
for (const tab of [tabPieces, tab3d]) {
  tab.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const other = tab === tabPieces ? tab3d : tabPieces;
    other.focus();
    selectTab(other === tab3d);
  });
}
reframeBtn.addEventListener('click', () => viewer?.reframe());
pngBtn.addEventListener('click', async () => {
  if (!viewer || !lastBox || lastBox.errors.length > 0) return;
  try {
    const blob = await viewer.toPNG();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = exportFileName(lastBox, 'png');
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  } catch (e) {
    console.error(e);
  }
});
openSlider.addEventListener('input', () => viewer?.setOpen(openSlider.value / 100));

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
  downloadSvg(currentSvg, exportFileName(currentBox, 'svg'));
});

recompute();
