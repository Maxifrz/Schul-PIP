// The 3D view: a coordinate system in space with the scene's objects, drawn with three.js. Drag to turn it, pinch
// or scroll to zoom, two fingers or the right mouse button to move it; perspective or orthographic projection.
// Everything the sliders move is drawn again while they move.

import {
  WebGLRenderer, Scene as ThreeScene, PerspectiveCamera, OrthographicCamera, Group, Color, Vector3, AmbientLight,
  DirectionalLight, BufferGeometry, Float32BufferAttribute, LineBasicMaterial, LineDashedMaterial, Line, LineSegments,
  Mesh, MeshPhongMaterial, SphereGeometry, CylinderGeometry, ConeGeometry, DoubleSide, Sprite, SpriteMaterial,
  CanvasTexture, Quaternion, Plane,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { h } from '../ui.js';
import { styleOf, isVisible, SPACE_TYPES } from './scene.js';
import { coordinate } from './plot.js';

export const DEFAULT_SETTINGS_3D = { range: 5, grid: true, axes: true, box: false, perspective: true };

const FONT = "'Work Sans', -apple-system, system-ui, sans-serif";

export class SpaceView {
  constructor({ scene, onViewChange }) {
    this.scene = scene;
    this.onViewChange = onViewChange || (() => {});
    this.settings = { ...DEFAULT_SETTINGS_3D };
    this.canvasHolder = h('div.space-stage');
    this.tools = h('div.graph-tools');
    this.overlay = h('div.graph-overlay', {}, this.tools);
    this.message = h('div.space-message');
    this.el = h('section.space', {}, h('div.graph-stage', {}, this.canvasHolder, this.overlay, this.message));
    this.ready = false;
    this.frame = 0;
    this.version = -1;
    this.labelCache = new Map();
    const observer = new ResizeObserver(() => this.resize());
    observer.observe(this.canvasHolder);
  }

  /** WebGL is set up only when the view is first shown. */
  init() {
    if (this.ready) return true;
    try {
      this.renderer = new WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    } catch (e) {
      this.message.textContent = '3D-Grafik ist auf diesem Gerät nicht verfügbar (WebGL fehlt).';
      return false;
    }
    this.renderer.setPixelRatio(window.devicePixelRatio || 1);
    // Surfaces and planes end at the edge of the coordinate box.
    this.renderer.localClippingEnabled = true;
    this.canvasHolder.append(this.renderer.domElement);
    this.three = new ThreeScene();
    this.three.add(new AmbientLight(0xffffff, 0.75));
    const light = new DirectionalLight(0xffffff, 0.9);
    light.position.set(6, -4, 10);
    this.three.add(light);
    const back = new DirectionalLight(0xffffff, 0.35);
    back.position.set(-6, 5, -4);
    this.three.add(back);
    this.frameGroup = new Group();
    this.objectGroup = new Group();
    this.three.add(this.frameGroup, this.objectGroup);
    this.perspective = new PerspectiveCamera(40, 1, 0.1, 1000);
    this.orthographic = new OrthographicCamera(-10, 10, 10, -10, 0.1, 1000);
    for (const camera of [this.perspective, this.orthographic]) camera.up.set(0, 0, 1);
    this.camera = this.settings.perspective ? this.perspective : this.orthographic;
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.addEventListener('change', () => this.redraw());
    this.controls.addEventListener('end', () => this.onViewChange(this.settings));
    this.ready = true;
    this.resetView();
    this.resize();
    return true;
  }

  setSettings(settings) {
    this.settings = { ...DEFAULT_SETTINGS_3D, ...(settings || {}) };
    if (!this.ready) return;
    this.useCamera();
    this.version = -1;
    this.redraw();
  }

  useCamera() {
    const next = this.settings.perspective ? this.perspective : this.orthographic;
    if (next === this.camera) return;
    next.position.copy(this.camera.position);
    next.quaternion.copy(this.camera.quaternion);
    this.camera = next;
    this.controls.object = next;
    this.fitOrthographic();
    this.controls.update();
  }

  /** The school view: x towards the viewer on the left, y to the right, z up. */
  resetView() {
    if (!this.ready) return;
    const r = this.settings.range;
    this.perspective.position.set(r * 3.6, r * 2.1, r * 2.3);
    this.orthographic.position.copy(this.perspective.position);
    this.orthographic.zoom = 1;
    this.controls.target.set(0, 0, 0);
    this.controls.update();
    this.fitOrthographic();
    this.redraw();
  }

  fitOrthographic() {
    if (!this.width) return;
    const r = this.settings.range * 1.6;
    const aspect = this.width / this.height;
    Object.assign(this.orthographic, { left: -r * aspect, right: r * aspect, top: r, bottom: -r });
    this.orthographic.updateProjectionMatrix();
  }

  zoom(factor) {
    if (!this.ready) return;
    if (this.camera === this.orthographic) {
      this.orthographic.zoom /= factor;
      this.orthographic.updateProjectionMatrix();
    } else {
      const offset = this.camera.position.clone().sub(this.controls.target).multiplyScalar(factor);
      this.camera.position.copy(this.controls.target).add(offset);
    }
    this.controls.update();
    this.redraw();
  }

  resize() {
    const rect = this.canvasHolder.getBoundingClientRect();
    if (!rect.width || !rect.height || !this.ready) return;
    this.width = rect.width;
    this.height = rect.height;
    this.renderer.setSize(rect.width, rect.height);
    this.perspective.aspect = rect.width / rect.height;
    this.perspective.updateProjectionMatrix();
    this.fitOrthographic();
    this.redraw();
  }

  redraw() {
    if (!this.ready || this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.draw();
    });
  }

  colors() {
    const style = getComputedStyle(document.documentElement);
    const v = (name, fallback) => style.getPropertyValue(name).trim() || fallback;
    return { ink: v('--ink', '#16150F'), muted: v('--muted', '#6E6B62'), line: v('--line2', 'rgba(0,0,0,0.16)'), surface: v('--surface', '#ffffff'), dark: document.documentElement.dataset.theme === 'dark' };
  }

  draw() {
    if (!this.width) return;
    if (this.controls.enableDamping) this.controls.update();
    // The objects are built again each frame something moved: the scene's version or a slider.
    const key = this.scene.version + ':' + [...this.scene.params.values()].map((p) => p.value).join(',') + ':' + JSON.stringify(this.settings) + ':' + this.theme;
    if (key !== this.version) {
      this.version = key;
      this.build();
    }
    this.renderer.render(this.three, this.camera);
  }

  build() {
    const colors = this.colors();
    this.theme = document.documentElement.dataset.theme || 'light';
    for (const group of [this.frameGroup, this.objectGroup]) {
      for (const child of [...group.children]) {
        group.remove(child);
        dispose(child);
      }
    }
    this.buildFrame(colors);
    const objects = this.scene.objects.filter((o) => SPACE_TYPES.has(o.type) && isVisible(o));
    this.message.textContent = objects.length ? '' : 'Noch nichts im Raum. Probiere A(1|2|3), E: x + y + z = 3, kugel((0|0|0), 2) oder f(x, y) = x² − y².';
    for (const object of objects) {
      try {
        const built = this.buildObject(object, styleOf(object), colors);
        if (built) this.objectGroup.add(built);
      } catch (e) {
        // An object that cannot be drawn right now is left out.
      }
    }
  }

  buildFrame(colors) {
    const r = this.settings.range;
    const ink = new Color(colors.ink);
    if (this.settings.grid) {
      const points = [];
      for (let k = -r; k <= r; k++) {
        points.push(-r, k, 0, r, k, 0, k, -r, 0, k, r, 0);
      }
      const grid = new LineSegments(geometry(points), new LineBasicMaterial({ color: new Color(colors.muted), transparent: true, opacity: 0.25 }));
      this.frameGroup.add(grid);
    }
    if (this.settings.box) {
      const c = [-r, r];
      const points = [];
      for (const a of c) for (const b of c) {
        points.push(-r, a, b, r, a, b, a, -r, b, a, r, b, a, b, -r, a, b, r);
      }
      this.frameGroup.add(new LineSegments(geometry(points), new LineBasicMaterial({ color: new Color(colors.muted), transparent: true, opacity: 0.35 })));
    }
    if (!this.settings.axes) return;
    const axes = [[1, 0, 0, 'x'], [0, 1, 0, 'y'], [0, 0, 1, 'z']];
    for (const [x, y, z, name] of axes) {
      const end = new Vector3(x, y, z).multiplyScalar(r + 1);
      this.frameGroup.add(new Line(geometry([-x * (r + 0.5), -y * (r + 0.5), -z * (r + 0.5), end.x, end.y, end.z]), new LineBasicMaterial({ color: ink })));
      this.frameGroup.add(arrowHead(end, new Vector3(x, y, z), 0.35, ink));
      this.frameGroup.add(this.label(name, end.clone().add(new Vector3(x, y, z).multiplyScalar(0.5)), colors.ink, 20, true));
      const step = r > 8 ? Math.ceil(r / 5) : 1;
      for (let k = -r; k <= r; k += step) {
        if (!k) continue;
        const at = new Vector3(x * k, y * k, z * k);
        const tick = z ? [at.x - 0.08, at.y, at.z, at.x + 0.08, at.y, at.z] : [at.x, at.y, at.z - 0.08, at.x, at.y, at.z + 0.08];
        this.frameGroup.add(new Line(geometry(tick), new LineBasicMaterial({ color: ink })));
        const offset = z ? new Vector3(-0.3, -0.3, 0) : new Vector3(0, 0, -0.35);
        this.frameGroup.add(this.label(String(k).replace('-', '−'), at.add(offset), colors.muted, 13));
      }
    }
  }

  /** A text that always faces the camera */
  label(text, position, color, size = 14, bold = false) {
    const key = `${text}|${color}|${size}|${bold}`;
    let texture = this.labelCache.get(key);
    if (!texture) {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const font = `${bold ? 'italic 600' : '500'} ${size * 2}px ${FONT}`;
      ctx.font = font;
      const width = Math.ceil(ctx.measureText(text).width) + 8;
      canvas.width = width;
      canvas.height = size * 2 + 12;
      ctx.font = font;
      ctx.fillStyle = color;
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 4, canvas.height / 2);
      texture = new CanvasTexture(canvas);
      texture.userData = { width: canvas.width, height: canvas.height };
      this.labelCache.set(key, texture);
    }
    const sprite = new Sprite(new SpriteMaterial({ map: texture, depthTest: false, transparent: true }));
    const scale = 0.012 * (this.settings.range / 5);
    sprite.scale.set(texture.userData.width * scale, texture.userData.height * scale, 1);
    sprite.position.copy(position);
    sprite.renderOrder = 10;
    sprite.userData.keepTexture = true;
    return sprite;
  }

  buildObject(object, style, colors) {
    const color = new Color(style.color);
    const r = this.settings.range;
    const group = new Group();
    const edge = r * 1.05;
    const clippingPlanes = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].map((n) => new Plane(new Vector3(...n), edge));
    const surface = (opacity = 0.75) => new MeshPhongMaterial({ color, side: DoubleSide, transparent: opacity < 1, opacity, shininess: 40, depthWrite: opacity >= 1, clippingPlanes });
    const lineMaterial = () => (style.dash === 'solid'
      ? new LineBasicMaterial({ color, linewidth: style.width })
      : new LineDashedMaterial({ color, dashSize: style.dash === 'dot' ? 0.05 : 0.25, gapSize: 0.15 }));
    const addLabel = (at) => {
      if (style.label && (object.name || style.caption)) group.add(this.label(greek(style.caption || object.name), new Vector3(...at).add(new Vector3(0.25, 0.25, 0.25)), colors.ink, 15, true));
    };
    switch (object.type) {
      case 'point3': {
        const p = object.at();
        if (!p.every(Number.isFinite)) return null;
        const ball = new Mesh(new SphereGeometry(0.06 * style.pointSize * (r / 5) / 2, 16, 12), new MeshPhongMaterial({ color }));
        ball.position.set(...p);
        group.add(ball);
        addLabel(p);
        return group;
      }
      case 'line3':
      case 'segment3':
      case 'vector3': {
        const a = object.a();
        const b = object.b();
        if (![...a, ...b].every(Number.isFinite)) return null;
        let start = a;
        let end = b;
        if (object.type === 'line3') {
          // a + t·b, cut to the box
          const [t0, t1] = clipLine(a, b, r * 1.2);
          if (!(t1 > t0)) return null;
          start = a.map((v, i) => v + t0 * b[i]);
          end = a.map((v, i) => v + t1 * b[i]);
        }
        const line = new Line(geometry([...start, ...end]), lineMaterial());
        line.computeLineDistances();
        group.add(line);
        if (object.type === 'vector3') {
          const direction = new Vector3(...end).sub(new Vector3(...start));
          group.add(arrowHead(new Vector3(...end), direction.normalize(), 0.3 * (r / 5), color));
        }
        addLabel(object.type === 'line3' ? end.map((v, i) => (v + start[i]) / 2 + (end[i] - start[i]) * 0.3) : end.map((v, i) => (v + start[i]) / 2));
        return group;
      }
      case 'plane': {
        const n = object.n();
        const d = object.d();
        const length = Math.hypot(...n);
        if (!length || !Number.isFinite(d)) return null;
        const unit = n.map((v) => v / length);
        const foot = new Vector3(...unit).multiplyScalar(d / length);
        const mesh = new Mesh(squareGeometry(r * 1.8), surface(style.fill > 0 && style.fill !== 0.18 ? style.fill : 0.4));
        mesh.quaternion.copy(new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), new Vector3(...unit)));
        mesh.position.copy(foot);
        group.add(mesh);
        addLabel([foot.x + r * 0.6, foot.y + r * 0.6, foot.z]);
        return group;
      }
      case 'sphere': {
        const c = object.center();
        const radius = object.radius();
        if (!(radius > 0)) return null;
        const mesh = new Mesh(new SphereGeometry(radius, 48, 32), surface(0.55));
        mesh.position.set(...c);
        group.add(mesh);
        addLabel(c.map((v) => v + radius * 0.75));
        return group;
      }
      case 'cylinder':
      case 'cone': {
        const a = new Vector3(...object.a());
        const b = new Vector3(...object.b());
        const radius = object.radius();
        const axis = b.clone().sub(a);
        const height = axis.length();
        if (!(radius > 0) || !height) return null;
        const shape = object.type === 'cylinder' ? new CylinderGeometry(radius, radius, height, 48, 1) : new ConeGeometry(radius, height, 48, 1);
        const mesh = new Mesh(shape, surface(0.65));
        // Three's cylinders stand on the y axis around the origin.
        mesh.quaternion.copy(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), axis.clone().normalize()));
        mesh.position.copy(a.clone().add(axis.multiplyScalar(0.5)));
        group.add(mesh);
        return group;
      }
      case 'solid': {
        const corners = object.corners.map((c) => c());
        if (!corners.every((c) => c.every(Number.isFinite))) return null;
        const positions = [];
        for (const face of object.faces) {
          for (let i = 1; i + 1 < face.length; i++) positions.push(...corners[face[0]], ...corners[face[i]], ...corners[face[i + 1]]);
        }
        const mesh = new Mesh(geometry(positions, true), surface(0.55));
        group.add(mesh);
        const edges = [];
        for (const face of object.faces) face.forEach((k, i) => edges.push(...corners[k], ...corners[face[(i + 1) % face.length]]));
        group.add(new LineSegments(geometry(edges), new LineBasicMaterial({ color })));
        return group;
      }
      case 'curve3': {
        const from = object.from();
        const to = object.to();
        const points = [];
        for (let i = 0; i <= 600; i++) {
          const t = from + ((to - from) * i) / 600;
          const p = [object.X(t), object.Y(t), object.Z(t)];
          if (p.every(Number.isFinite)) points.push(...p);
        }
        const line = new Line(geometry(points), lineMaterial());
        line.computeLineDistances();
        group.add(line);
        return group;
      }
      case 'surface': {
        const f = object.f;
        const n = 64;
        const limit = r * 2;
        const grid = (i, j) => {
          const x = -r + (2 * r * i) / n;
          const y = -r + (2 * r * j) / n;
          return [x, y, f(x, y)];
        };
        group.add(gridMesh(grid, n, n, limit, surface(0.8)));
        return group;
      }
      case 'psurface': {
        const [u0, u1, v0, v1] = object.range();
        const n = 64;
        const grid = (i, j) => {
          const u = u0 + ((u1 - u0) * i) / n;
          const v = v0 + ((v1 - v0) * j) / n;
          return [object.X(u, v), object.Y(u, v), object.Z(u, v)];
        };
        group.add(gridMesh(grid, n, n, r * 4, surface(0.8)));
        return group;
      }
      case 'isurface': {
        const triangles = marchingTetrahedra(object.F, -r, r, 28);
        if (!triangles.length) return null;
        group.add(new Mesh(geometry(triangles, true), surface(0.7)));
        return group;
      }
      case 'field': {
        const step = r / 2.5;
        const arrows = [];
        const heads = [];
        let longest = 0;
        const samples = [];
        for (let x = -r; x <= r + 1e-9; x += step) for (let y = -r; y <= r + 1e-9; y += step) for (let z = -r; z <= r + 1e-9; z += step) {
          const v = [object.P(x, y, z), object.Q(x, y, z), object.R(x, y, z)];
          if (!v.every(Number.isFinite)) continue;
          longest = Math.max(longest, Math.hypot(...v));
          samples.push([[x, y, z], v]);
        }
        if (!longest) return null;
        for (const [p, v] of samples) {
          const k = (step * 0.8) / longest;
          const end = p.map((c, i) => c + v[i] * k);
          arrows.push(...p, ...end);
          if (Math.hypot(...v) > 1e-9) heads.push(arrowHead(new Vector3(...end), new Vector3(...v).normalize(), 0.12 * (r / 5), color));
        }
        group.add(new LineSegments(geometry(arrows), new LineBasicMaterial({ color })));
        heads.forEach((head) => group.add(head));
        return group;
      }
      default:
        return null;
    }
  }

  /** The view as a PNG (base64) */
  png() {
    if (!this.ready) return null;
    this.version = -1;
    this.draw();
    return this.renderer.domElement.toDataURL('image/png').replace(/^data:image\/png;base64,/, '');
  }
}

function geometry(points, normals = false) {
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(points, 3));
  if (normals) g.computeVertexNormals();
  return g;
}

function squareGeometry(size) {
  const s = size;
  return geometry([-s, -s, 0, s, -s, 0, s, s, 0, -s, -s, 0, s, s, 0, -s, s, 0], true);
}

function arrowHead(tip, direction, size, color) {
  const cone = new Mesh(new ConeGeometry(size * 0.35, size, 16), new MeshPhongMaterial({ color }));
  cone.quaternion.copy(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), direction.clone().normalize()));
  cone.position.copy(tip.clone().sub(direction.clone().normalize().multiplyScalar(size / 2)));
  return cone;
}

/** The t range of a + t·b inside the cube [−r, r]³ */
function clipLine(a, b, r) {
  let t0 = -Infinity;
  let t1 = Infinity;
  for (let i = 0; i < 3; i++) {
    if (Math.abs(b[i]) < 1e-12) {
      if (Math.abs(a[i]) > r) return [1, 0];
      continue;
    }
    const lo = (-r - a[i]) / b[i];
    const hi = (r - a[i]) / b[i];
    t0 = Math.max(t0, Math.min(lo, hi));
    t1 = Math.min(t1, Math.max(lo, hi));
  }
  return [t0, t1];
}

/** A surface from a grid of points; cells with undefined or far away points are left out. */
function gridMesh(at, nu, nv, limit, material) {
  const points = [];
  for (let i = 0; i <= nu; i++) {
    points.push([]);
    for (let j = 0; j <= nv; j++) {
      const p = at(i, j);
      points[i].push(p.every((v) => Number.isFinite(v) && Math.abs(v) <= limit) ? p : null);
    }
  }
  const positions = [];
  for (let i = 0; i < nu; i++) {
    for (let j = 0; j < nv; j++) {
      const a = points[i][j];
      const b = points[i + 1][j];
      const c = points[i + 1][j + 1];
      const d = points[i][j + 1];
      if (a && b && c) positions.push(...a, ...b, ...c);
      if (a && c && d) positions.push(...a, ...c, ...d);
    }
  }
  return new Mesh(geometry(positions, true), material);
}

/**
 * Triangles of F(x, y, z) = 0 in the cube [lo, hi]³ (marching tetrahedra: every grid cube split into six
 * tetrahedra, each cut by the surface into one or two triangles).
 */
export function marchingTetrahedra(F, lo, hi, n) {
  const step = (hi - lo) / n;
  const value = new Float64Array((n + 1) ** 3);
  const index = (i, j, k) => (i * (n + 1) + j) * (n + 1) + k;
  for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) for (let k = 0; k <= n; k++) {
    let v;
    try {
      v = F(lo + i * step, lo + j * step, lo + k * step);
    } catch (e) {
      v = NaN;
    }
    value[index(i, j, k)] = v;
  }
  const corners = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0], [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]];
  const tets = [[0, 5, 1, 6], [0, 1, 2, 6], [0, 2, 3, 6], [0, 3, 7, 6], [0, 7, 4, 6], [0, 4, 5, 6]];
  const out = [];
  const point = (c, i, j, k) => [lo + (i + c[0]) * step, lo + (j + c[1]) * step, lo + (k + c[2]) * step];
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) for (let k = 0; k < n; k++) {
    const v = corners.map((c) => value[index(i + c[0], j + c[1], k + c[2])]);
    if (v.some((x) => !Number.isFinite(x))) continue;
    if (v.every((x) => x > 0) || v.every((x) => x <= 0)) continue;
    for (const t of tets) {
      const inside = t.filter((c) => v[c] <= 0);
      const outside = t.filter((c) => v[c] > 0);
      if (!inside.length || !outside.length) continue;
      const cut = (a, b) => {
        const pa = point(corners[a], i, j, k);
        const pb = point(corners[b], i, j, k);
        const s = v[a] / (v[a] - v[b]);
        return pa.map((x, m) => x + (pb[m] - x) * s);
      };
      if (inside.length === 1 || outside.length === 1) {
        const [single, others] = inside.length === 1 ? [inside[0], outside] : [outside[0], inside];
        out.push(...cut(single, others[0]), ...cut(single, others[1]), ...cut(single, others[2]));
      } else {
        const [a, b] = inside;
        const [c, d] = outside;
        const p1 = cut(a, c);
        const p2 = cut(a, d);
        const p3 = cut(b, d);
        const p4 = cut(b, c);
        out.push(...p1, ...p2, ...p3, ...p1, ...p3, ...p4);
      }
    }
  }
  return out;
}

function dispose(object) {
  object.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      if (child.material.map && !child.userData.keepTexture) child.material.map.dispose();
      child.material.dispose();
    }
  });
}

const GREEK = { alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', phi: 'φ', psi: 'ψ', omega: 'ω' };

function greek(name) {
  return GREEK[name] || name;
}

export { coordinate };
