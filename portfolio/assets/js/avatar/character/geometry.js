/**
 * Geometry builders for the character: meshed SDF data to BufferGeometry, rounded
 * boxes, swept tubes (brows, lash lines, mouth, cables) and a soft radial shadow texture.
 */
import * as THREE from 'three';

/** BufferGeometry from meshSdf() output, optionally moved into a joint's space. */
export function fromMeshData(data, offset = null) {
  const geometry = new THREE.BufferGeometry();
  const position = data.position;
  if (offset) {
    for (let i = 0; i < position.length; i += 3) {
      position[i] -= offset[0];
      position[i + 1] -= offset[1];
      position[i + 2] -= offset[2];
    }
  }
  geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(data.normal, 3));
  if (data.color) geometry.setAttribute('color', new THREE.BufferAttribute(data.color, 3));
  geometry.setIndex(new THREE.BufferAttribute(data.index, 1));
  geometry.computeBoundingSphere();
  return geometry;
}

/** A tapered rod (cylinder) from point a to point b, with round-ish caps. */
export function rod(a, b, radiusA, radiusB, radial = 12) {
  const start = new THREE.Vector3(...a);
  const end = new THREE.Vector3(...b);
  const length = start.distanceTo(end);
  const geometry = new THREE.CylinderGeometry(radiusA, radiusB, length, radial, 1, false);
  geometry.translate(0, length / 2, 0);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.clone().sub(start).normalize());
  geometry.applyQuaternion(q);
  geometry.translate(start.x, start.y, start.z);
  return geometry;
}

/** Constant vertex colour (for meshes that share a vertex-coloured material). */
export function paint(geometry, rgb = [1, 1, 1]) {
  const count = geometry.getAttribute('position').count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    colors[i * 3] = rgb[0];
    colors[i * 3 + 1] = rgb[1];
    colors[i * 3 + 2] = rgb[2];
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

/**
 * Box with rounded edges: a segmented box whose vertices are pushed onto a rounded
 * shell (inner box + radius), with matching normals.
 */
export function roundedBox(width, height, depth, radius, segments = 4) {
  const r = Math.min(radius, width / 2, height / 2, depth / 2);
  const seg = Math.max(1, segments) * 2;
  const geometry = new THREE.BoxGeometry(width, height, depth, seg, seg, seg);
  const pos = geometry.getAttribute('position');
  const nor = geometry.getAttribute('normal');
  const inner = [width / 2 - r, height / 2 - r, depth / 2 - r];
  const p = [0, 0, 0];
  for (let i = 0; i < pos.count; i += 1) {
    p[0] = pos.getX(i);
    p[1] = pos.getY(i);
    p[2] = pos.getZ(i);
    // Spread the segment rows toward the edges so the rounding gets most of them.
    for (let a = 0; a < 3; a += 1) {
      const half = [width, height, depth][a] / 2;
      const t = p[a] / half;
      const s = Math.sign(t) * Math.pow(Math.abs(t), 0.35);
      p[a] = s * half;
    }
    const q = [0, 1, 2].map((a) => Math.max(-inner[a], Math.min(inner[a], p[a])));
    const d = [p[0] - q[0], p[1] - q[1], p[2] - q[2]];
    const len = Math.hypot(d[0], d[1], d[2]) || 1;
    pos.setXYZ(i, q[0] + (d[0] / len) * r, q[1] + (d[1] / len) * r, q[2] + (d[2] / len) * r);
    nor.setXYZ(i, d[0] / len, d[1] / len, d[2] / len);
  }
  geometry.computeBoundingSphere();
  return geometry;
}

/**
 * A tube swept along points with a rounded-rectangle cross section.
 * @param {number[][]} points centre line
 * @param {{ width: number|((t: number) => number), height: number|((t: number) => number),
 *   up?: number[], radial?: number, roundness?: number }} opts
 *   width runs along the "up" side of the section, height along the outward normal.
 */
export function sweep(points, opts) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(p[0], p[1], p[2])));
  const steps = Math.max(8, opts.steps || 40);
  const radial = Math.max(8, opts.radial || 16);
  const exponent = opts.roundness || 2.6; // superellipse: 2 = ellipse, higher = squarer
  const widthAt = typeof opts.width === 'function' ? opts.width : () => opts.width;
  const heightAt = typeof opts.height === 'function' ? opts.height : () => opts.height;
  const upHint = new THREE.Vector3(...(opts.up || [0, 1, 0]));
  const positions = [];
  const indices = [];
  const tangent = new THREE.Vector3();
  const side = new THREE.Vector3();
  const out = new THREE.Vector3();
  const center = new THREE.Vector3();
  for (let s = 0; s <= steps; s += 1) {
    const t = s / steps;
    curve.getPointAt(t, center);
    curve.getTangentAt(t, tangent);
    side.crossVectors(upHint, tangent).normalize(); // outward-ish when the curve runs sideways
    out.crossVectors(tangent, side).normalize(); // "up" of the section
    const w = widthAt(t) / 2;
    const h = heightAt(t) / 2;
    for (let r = 0; r < radial; r += 1) {
      const a = (r / radial) * Math.PI * 2;
      const c = Math.cos(a);
      const sn = Math.sin(a);
      const cx = Math.sign(c) * Math.pow(Math.abs(c), 2 / exponent);
      const sy = Math.sign(sn) * Math.pow(Math.abs(sn), 2 / exponent);
      positions.push(
        center.x + out.x * cx * w + side.x * sy * h,
        center.y + out.y * cx * w + side.y * sy * h,
        center.z + out.z * cx * w + side.z * sy * h,
      );
    }
  }
  for (let s = 0; s < steps; s += 1) {
    for (let r = 0; r < radial; r += 1) {
      const a = s * radial + r;
      const b = s * radial + ((r + 1) % radial);
      const c = a + radial;
      const d = b + radial;
      indices.push(a, c, b, b, c, d);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  // Normals must point away from the centre line; flip the winding if they do not.
  const mid = Math.floor(steps / 2) * radial;
  curve.getPointAt(Math.floor(steps / 2) / steps, center);
  const n = geometry.getAttribute('normal');
  const p = geometry.getAttribute('position');
  const outward = (p.getX(mid) - center.x) * n.getX(mid) + (p.getY(mid) - center.y) * n.getY(mid) + (p.getZ(mid) - center.z) * n.getZ(mid);
  if (outward < 0) {
    for (let i = 0; i < indices.length; i += 3) [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]];
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
  }
  return geometry;
}

/** Width profile that rounds both ends of a swept tube (t in 0..1). */
export const roundedEnds = (size, end = 0.12) => (t) => {
  const e = Math.min(t, 1 - t) / end;
  return e >= 1 ? size : size * Math.sqrt(Math.max(0.0001, 1 - (1 - e) * (1 - e)));
};

/** Soft round gradient (alpha falls off from the centre): contact shadow or glow. */
export function shadowTexture(size = 128, rgb = '0,0,0') {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable for the contact shadow');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, `rgba(${rgb},0.85)`);
  g.addColorStop(0.45, `rgba(${rgb},0.45)`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
