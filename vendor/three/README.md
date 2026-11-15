# three.js vendorizado

Copia local de three.js para la vista 3D de BoxMaker. No hay CDN, bundler ni paso de build: los archivos se cargan directo con `import` desde el navegador, y solo cuando se abre la pestaña 3D.

- Versión: 0.180.0
- Tarball: https://registry.npmjs.org/three/-/three-0.180.0.tgz
- sha256 del tarball: `ad66d724565ee29a2467277fa84daa5ed0211d6b8d446e9ef29f6bae0cd14144`

## Archivos y de dónde salen

| Archivo | Origen dentro del tarball |
|---|---|
| `three.module.min.js` | `package/build/three.module.min.js` |
| `three.core.min.js` | `package/build/three.core.min.js` (lo importa `three.module.min.js`) |
| `OrbitControls.js` | `package/examples/jsm/controls/OrbitControls.js` (con un parche, ver abajo) |
| `LICENSE` | `package/LICENSE` (MIT) |

## Parche a OrbitControls.js

El original importa `'three'`, que un navegador sin bundler no sabe resolver. Se cambia esa única línea para que apunte al archivo local:

```bash
sed -i '' "s#^} from 'three';#} from './three.module.min.js';#" vendor/three/OrbitControls.js
```

Comprobación: `grep -c "three.module.min.js" vendor/three/OrbitControls.js` debe dar `1`.

## Pesos

| Archivo | Disco | Red (brotli) |
|---|---|---|
| `three.module.min.js` | 339 KB | 66 KB |
| `three.core.min.js` | 381 KB | 81 KB |
| `OrbitControls.js` | 39 KB | 7 KB |
| **Total** | **759 KB** | **≈154 KB** |

## Cómo actualizar

1. Bajar el tarball de la nueva versión a una carpeta temporal vacía, fuera del repo.
2. Verificar su sha256 contra el publicado por npm (`shasum -a 256 archivo.tgz`) antes de extraer.
3. Copiar los cuatro archivos de la tabla de arriba a `vendor/three/`.
4. Aplicar el parche `sed` a `OrbitControls.js` y comprobarlo.
5. Actualizar versión y sha256 en este README, y la versión esperada (`THREE.REVISION`) en `test.html`.
6. Abrir `test.html` y confirmar que todos los checks pasan.
