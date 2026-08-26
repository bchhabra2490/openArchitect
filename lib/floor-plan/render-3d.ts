"use client";

import type { FloorPlan } from "./types";
import type { DisplayLayers } from "./layers";
import { DEFAULT_DISPLAY_LAYERS } from "./layers";
import { buildFloorPlan3d, WALL_HEIGHT, type Mesh3D } from "./build-3d";

export type FloorPlan3dHandle = {
  downloadGlb: (filename: string) => Promise<void>;
  dispose: () => void;
};

function triggerDownload(buffer: ArrayBuffer, filename: string) {
  const blob = new Blob([buffer], { type: "model/gltf-binary" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export async function mountFloorPlan3d(
  canvas: HTMLCanvasElement,
  plan: FloorPlan,
  layers: DisplayLayers = DEFAULT_DISPLAY_LAYERS,
): Promise<FloorPlan3dHandle> {
  const THREE = await import("three");
  const { OrbitControls } = await import("three/examples/jsm/controls/OrbitControls.js");
  const { GLTFExporter } = await import("three/examples/jsm/exporters/GLTFExporter.js");

  const model = buildFloorPlan3d(plan, layers);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#cfd8e3");

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);
  camera.position.set(
    model.center.x + model.radius * 0.85,
    WALL_HEIGHT * 2.2,
    model.center.z + model.radius * 0.95,
  );

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = false;

  const controls = new OrbitControls(camera, canvas);
  controls.target.set(model.center.x, model.center.y, model.center.z);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI * 0.48;
  controls.minDistance = 4;
  controls.maxDistance = 80;
  controls.update();

  scene.add(new THREE.AmbientLight(0xffffff, 0.7));
  const sun = new THREE.DirectionalLight(0xfff4e0, 1.15);
  sun.position.set(model.center.x - 8, 14, model.center.z - 6);
  scene.add(sun);
  const fill = new THREE.HemisphereLight(0xd7e7ff, 0xb9a990, 0.45);
  scene.add(fill);

  const root = new THREE.Group();
  root.name = "floor-plan";
  const geometries = new Map<string, InstanceType<typeof THREE.BoxGeometry>>();
  const materials = new Map<string, InstanceType<typeof THREE.MeshLambertMaterial>>();

  function meshFrom(spec: Mesh3D) {
    const geoKey = `${spec.sx.toFixed(3)}:${spec.sy.toFixed(3)}:${spec.sz.toFixed(3)}`;
    let geometry = geometries.get(geoKey);
    if (!geometry) {
      geometry = new THREE.BoxGeometry(spec.sx, spec.sy, spec.sz);
      geometries.set(geoKey, geometry);
    }
    const matKey = `${spec.color}:${spec.opacity ?? 1}`;
    let material = materials.get(matKey);
    if (!material) {
      material = new THREE.MeshLambertMaterial({
        color: spec.color,
        transparent: (spec.opacity ?? 1) < 1,
        opacity: spec.opacity ?? 1,
        depthWrite: (spec.opacity ?? 1) >= 1,
      });
      materials.set(matKey, material);
    }
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(spec.cx, spec.cy, spec.cz);
    mesh.name = spec.name;
    root.add(mesh);
  }

  for (const spec of model.meshes) meshFrom(spec);
  scene.add(root);

  function resize() {
    const parent = canvas.parentElement;
    const width = parent?.clientWidth || canvas.clientWidth || 640;
    const height = parent?.clientHeight || canvas.clientHeight || 480;
    camera.aspect = width / Math.max(1, height);
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  }

  resize();
  const observer = new ResizeObserver(resize);
  if (canvas.parentElement) observer.observe(canvas.parentElement);

  let frame = 0;
  function tick() {
    frame = window.requestAnimationFrame(tick);
    controls.update();
    renderer.render(scene, camera);
  }
  tick();

  return {
    downloadGlb: (filename) =>
      new Promise((resolve, reject) => {
        const exporter = new GLTFExporter();
        exporter.parse(
          root,
          (result) => {
            if (!(result instanceof ArrayBuffer)) {
              reject(new Error("GLB export did not return binary data."));
              return;
            }
            triggerDownload(result, filename);
            resolve();
          },
          (error) => {
            reject(error instanceof Error ? error : new Error("Could not export GLB."));
          },
          { binary: true },
        );
      }),
    dispose: () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      renderer.dispose();
      for (const geometry of geometries.values()) geometry.dispose();
      for (const material of materials.values()) material.dispose();
    },
  };
}
