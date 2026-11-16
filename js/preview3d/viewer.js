// Visor 3D de la caja armada. Coloca cada pieza con su pose (pose.js) y su
// sólido (piece-geometry.js). Se carga sólo cuando se abre la pestaña "3D".
// Los colores salen de css/studio-kerf-tokens.css, leídos del contenedor.
import * as THREE from '../../vendor/three/three.module.min.js';
import { OrbitControls } from '../../vendor/three/OrbitControls.js';
import { buildPieceGeometry } from './piece-geometry.js';
import { poseBasis, openTransform } from '../core/pose.js';
import { groupProgress } from './open-stages.js';

export const MSG_ERRORS = 'Corrige los errores para ver la caja en 3D.';
export const MSG_NO_POSE = 'Esta caja todavía no tiene vista 3D.';
export const MSG_CONTEXT_LOST = 'La vista 3D se interrumpió. Recarga la página para verla de nuevo.';
export const MSG_NO_WEBGL = 'Tu navegador no puede mostrar la vista 3D (WebGL apagado).';

// Opacidad del contorno de las piezas (--paper al 25 %).
const OUTLINE_OPACITY = 0.25;
// Los grabados flotan un pelo sobre la cara +Z para que no parpadeen.
const ENGRAVE_LIFT = 0.02;
// Dirección desde la que mira la cámara, en múltiplos del tamaño de la caja.
const VIEW_DIR = new THREE.Vector3(1.1, -1.6, 1.0);

function readTokens(el) {
  const cs = getComputedStyle(el);
  const color = (name) => new THREE.Color(cs.getPropertyValue(name).trim() || undefined);
  return {
    ink: color('--ink'),
    sheet: color('--sheet'),
    sheetDeep: color('--sheet-deep'),
    paper: color('--paper'),
    engrave: color('--engrave'),
    ember: color('--ember'),
  };
}

// Matriz de la pieza: columnas [X Y Z origen] de su pose.
function poseMatrix(pose) {
  const b = poseBasis(pose);
  const v = (p) => new THREE.Vector3(p.x, p.y, p.z);
  return new THREE.Matrix4().makeBasis(v(b.x), v(b.y), v(b.z)).setPosition(v(pose.origin));
}

// Matriz de apertura (desliz o giro alrededor de un pivote) para f en [0,1].
function openMatrix(pose, f) {
  const t = openTransform(pose, f);
  const m = new THREE.Matrix4().makeTranslation(t.offset.x, t.offset.y, t.offset.z);
  if (t.swing) {
    const { axis, pivot, angle } = t.swing;
    const rot = new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(axis.x, axis.y, axis.z), angle);
    m.multiply(new THREE.Matrix4().makeTranslation(pivot.x, pivot.y, pivot.z))
      .multiply(rot)
      .multiply(new THREE.Matrix4().makeTranslation(-pivot.x, -pivot.y, -pivot.z));
  }
  return m;
}

function disposeTree(root) {
  root.traverse((obj) => {
    obj.geometry?.dispose();
    const mats = Array.isArray(obj.material) ? obj.material : obj.material ? [obj.material] : [];
    for (const m of mats) m.dispose();
  });
}

export function createViewer(container) {
  const message = document.createElement('p');
  message.className = 'viewer3d-message';
  message.hidden = true;
  container.appendChild(message);

  let currentMessage = null;
  const setMessage = (text) => {
    currentMessage = text;
    message.textContent = text ?? '';
    message.hidden = text === null;
  };

  // Sin WebGL: no se lanza nada, sólo se avisa.
  const canvas = document.createElement('canvas');
  const attrs = { antialias: true, preserveDrawingBuffer: true };
  const gl = canvas.getContext('webgl2', attrs) ?? canvas.getContext('webgl', attrs);
  let renderer = null;
  if (gl) {
    try {
      renderer = new THREE.WebGLRenderer({ canvas, context: gl, ...attrs });
    } catch {
      renderer = null;
    }
  }
  if (!renderer) {
    setMessage(MSG_NO_WEBGL);
    return {
      show() {},
      onPick() {},
      toPNG: () => Promise.resolve(null),
      reframe() {},
      setOpen() {},
      bounds: () => new THREE.Box3(),
      pieceBounds: () => new THREE.Box3(),
      stats: () => ({ meshes: 0, message: currentMessage }),
      dispose() { message.remove(); },
    };
  }

  canvas.className = 'viewer3d-canvas';
  container.insertBefore(canvas, message);
  renderer.setPixelRatio(window.devicePixelRatio || 1);

  const tokens = readTokens(container);
  const scene = new THREE.Scene();
  scene.background = tokens.ink;

  // Luz: hemisférica suave + una direccional. Sin sombras.
  const hemi = new THREE.HemisphereLight();
  hemi.color.copy(tokens.ink);
  hemi.groundColor.copy(tokens.sheetDeep);
  hemi.intensity = 2.2;
  scene.add(hemi);
  const sun = new THREE.DirectionalLight();
  sun.intensity = 1.6;
  sun.position.set(0.6, -1, 1.4);
  scene.add(sun);

  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 10000);
  camera.up.set(0, 0, 1);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;

  const content = new THREE.Group();
  scene.add(content);
  let pieces = []; // { object, pose, label }
  let hovered = null; // pieza (Group) pintada de --ember
  let pickCb = () => {};
  let openFraction = 0;
  // El encuadre automático se hace sólo la primera vez: al recalcular se
  // respeta la vista que dejó Dani; "Reencuadrar" vuelve al encuadre.
  let shownOnce = false;
  const frame = { center: new THREE.Vector3(), size: 100 };

  // Dibujo bajo demanda: un cuadro cuando algo cambia; el amortiguado de
  // OrbitControls vuelve a pedir cuadros mientras la cámara se sigue moviendo.
  let rafId = 0;
  const render = () => {
    rafId = 0;
    controls.update();
    renderer.render(scene, camera);
  };
  const requestRender = () => {
    if (!rafId) rafId = requestAnimationFrame(render);
  };
  controls.addEventListener('change', requestRender);

  const resize = () => {
    const w = container.clientWidth, h = container.clientHeight;
    if (w === 0 || h === 0) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    requestRender();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  resize();

  function clear() {
    hovered = null;
    canvas.style.cursor = '';
    disposeTree(content);
    content.clear();
    pieces = [];
  }

  function applyOpen() {
    for (const { object, pose } of pieces) {
      object.matrix.multiplyMatrices(openMatrix(pose, groupProgress(pose.group, openFraction)), poseMatrix(pose));
      object.matrixWorldNeedsUpdate = true;
    }
  }

  function reframe() {
    const { center, size } = frame;
    camera.position.copy(VIEW_DIR).multiplyScalar(size).add(center);
    camera.near = size / 100;
    camera.far = size * 100;
    camera.updateProjectionMatrix();
    controls.target.copy(center);
    // Frena el giro que quedaba por el amortiguado; si no, la cámara sigue
    // girando un poco después de reencuadrar.
    // Ojo: _sphericalDelta y _panOffset son campos privados de OrbitControls
    // r180 (el vendorizado); con `?.` no se rompe si una versión los cambia.
    controls._sphericalDelta?.set(0, 0, 0);
    controls._panOffset?.set(0, 0, 0);
    controls.update();
    requestRender();
  }

  // Pieza (Group) bajo el puntero, o null. Usa las matrices actuales, así que
  // respeta la apertura. Las capas de una pieza comparten Group: se resalta
  // la pieza entera, no una capa.
  const raycaster = new THREE.Raycaster();
  function pieceAt(event) {
    if (pieces.length === 0) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    const ndc = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    camera.updateMatrixWorld(true);
    content.updateMatrixWorld(true);
    raycaster.setFromCamera(ndc, camera);
    const meshes = [];
    content.traverse((obj) => { if (obj.isMesh) meshes.push(obj); });
    const hit = raycaster.intersectObjects(meshes, false)[0];
    return hit ? pieces.find((p) => p.object === hit.object.parent) ?? null : null;
  }

  // Cada malla tiene sus propios materiales (se crean en buildPiece), así que
  // pintar una pieza no toca a las demás.
  function setHover(piece) {
    if ((piece?.object ?? null) === hovered) return;
    const paint = (object, color) => object?.traverse((obj) => {
      if (obj.isMesh) obj.material[0].color.copy(color);
    });
    paint(hovered, tokens.sheet);
    hovered = piece?.object ?? null;
    paint(hovered, tokens.ember);
    canvas.style.cursor = hovered ? 'pointer' : '';
    requestRender();
  }

  // Clic = pulsar y soltar casi en el mismo lugar; si el puntero se movió es
  // un giro de cámara y no cuenta.
  const CLICK_SLOP = 5;
  let downAt = null;
  const onDown = (e) => { downAt = { x: e.clientX, y: e.clientY }; };
  const onUp = (e) => {
    const d = downAt;
    downAt = null;
    if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > CLICK_SLOP) return;
    pickCb(pieceAt(e)?.label ?? null);
  };
  const onMove = (e) => { if (e.buttons === 0) setHover(pieceAt(e)); };
  const onLeave = () => setHover(null);
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerleave', onLeave);
  // Si el navegador pierde el contexto WebGL, se avisa en vez de dejar el lienzo en blanco.
  const onContextLost = (e) => {
    e.preventDefault();
    setMessage(MSG_CONTEXT_LOST);
  };
  canvas.addEventListener('webglcontextlost', onContextLost);

  function buildPiece(panel) {
    const { layers, engraves } = buildPieceGeometry(panel);
    const T = panel.pose.thickness;
    const object = new THREE.Group();
    object.name = panel.id ?? '';
    object.matrixAutoUpdate = false;
    for (const layer of layers) {
      // ExtrudeGeometry: grupo 0 = tapas (caras), grupo 1 = lados (cantos).
      const materials = [
        new THREE.MeshStandardMaterial({ color: tokens.sheet, roughness: 0.9, metalness: 0 }),
        new THREE.MeshStandardMaterial({ color: tokens.sheetDeep, roughness: 0.9, metalness: 0 }),
      ];
      object.add(new THREE.Mesh(layer.geometry, materials));
      const edges = new THREE.EdgesGeometry(layer.geometry, 30);
      object.add(new THREE.LineSegments(edges, new THREE.LineBasicMaterial({
        color: tokens.paper, transparent: true, opacity: OUTLINE_OPACITY,
      })));
    }
    for (const pts of engraves) {
      const z = T / 2 + ENGRAVE_LIFT;
      const geometry = new THREE.BufferGeometry().setFromPoints(pts.map((p) => new THREE.Vector3(p.x, p.y, z)));
      object.add(new THREE.LineLoop(geometry, new THREE.LineBasicMaterial({ color: tokens.engrave })));
    }
    return object;
  }

  function show(box) {
    clear();
    if (!box || (box.errors && box.errors.length > 0)) {
      setMessage(MSG_ERRORS);
      requestRender();
      return;
    }
    // Si falta la pose de cualquier pieza no se dibuja nada: una caja con una
    // parte ausente parecería correcta y engañaría.
    if ((box.panels ?? []).some((panel) => !panel.pose)) {
      setMessage(MSG_NO_POSE);
      requestRender();
      return;
    }
    try {
      for (const panel of box.panels ?? []) {
        const object = buildPiece(panel);
        content.add(object);
        pieces.push({ object, pose: panel.pose, label: panel.label ?? panel.id ?? '' });
      }
    } catch (e) {
      clear();
      setMessage(`No se pudo armar la vista 3D: ${e.message}`);
      requestRender();
      return;
    }
    setMessage(null);

    // Encuadre sobre la caja armada (cerrada), luego la apertura actual.
    const saved = openFraction;
    openFraction = 0;
    applyOpen();
    content.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(content);
    if (!bounds.isEmpty()) {
      bounds.getCenter(frame.center);
      const s = bounds.getSize(new THREE.Vector3());
      frame.size = Math.max(s.x, s.y, s.z);
    }
    openFraction = saved;
    applyOpen();
    if (!shownOnce && !bounds.isEmpty()) {
      shownOnce = true;
      reframe();
    }
    requestRender();
  }
  return {
    show,
    reframe,
    // cb(label) al hacer clic en una pieza; cb(null) al hacerlo en el vacío.
    onPick(cb) { pickCb = typeof cb === 'function' ? cb : () => {}; },
    // Dibuja y pide el blob en la misma tarea: con preserveDrawingBuffer el
    // lienzo conserva el cuadro, pero así no depende de eso.
    toPNG() {
      return new Promise((resolve, reject) => {
        try {
          controls.update();
          renderer.render(scene, camera);
          canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('No se pudo generar el PNG.'))), 'image/png');
        } catch (e) {
          reject(e);
        }
      });
    },
    setOpen(f) {
      openFraction = Math.min(1, Math.max(0, Number(f) || 0));
      applyOpen();
      requestRender();
    },
    // Caja envolvente en el mundo de toda la escena, o de una pieza por su id.
    bounds() {
      content.updateMatrixWorld(true);
      return new THREE.Box3().setFromObject(content);
    },
    pieceBounds(id) {
      content.updateMatrixWorld(true);
      const object = content.children.find((o) => o.name === id);
      return object ? new THREE.Box3().setFromObject(object) : new THREE.Box3();
    },
    stats() {
      let meshes = 0;
      content.traverse((obj) => { if (obj.isMesh) meshes += 1; });
      return { meshes, message: currentMessage };
    },
    dispose() {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;
      observer.disconnect();
      for (const [type, fn] of [['pointerdown', onDown], ['pointerup', onUp], ['pointermove', onMove], ['pointerleave', onLeave]]) {
        canvas.removeEventListener(type, fn);
      }
      canvas.removeEventListener('webglcontextlost', onContextLost);
      controls.removeEventListener('change', requestRender);
      controls.dispose();
      clear();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
      message.remove();
    },
  };
}
