/**
 * Turns a signed distance function into a smooth triangle mesh (surface nets).
 *
 * 1. Sample the SDF on a grid. Blocks far from the surface are filled from one
 *    sample at their centre, so only the thin band around the surface is evaluated.
 * 2. One vertex per grid cell that the surface crosses (average of the edge crossings),
 *    then one Newton step moves it onto the true surface.
 * 3. Normals come from the SDF gradient, so shading is perfectly smooth (sculpted clay).
 * 4. Optional ambient occlusion from a "context" SDF (soft darkening in creases), baked
 *    into vertex colours together with an optional colour function.
 *
 * The work yields to the browser every few milliseconds so the loading screen stays smooth.
 */

const BLOCK = 4;
const AO_FLOOR = 0.42; // creases darken, but clay never goes fully black
const LIPSCHITZ = 1.5; // safety factor: blended / approximate SDFs can change faster than 1 per unit
const EDGES = [
  [0, 1], [2, 3], [4, 5], [6, 7], // along x
  [0, 2], [1, 3], [4, 6], [5, 7], // along y
  [0, 4], [1, 5], [2, 6], [3, 7], // along z
];
const CORNERS = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];

/** Cooperative yielding: call tick() often; it only yields once the slice is used up. */
export function createBudget(sliceMs = 10) {
  let start = performance.now();
  const yieldNow = () => new Promise((resolve) => {
    if (typeof MessageChannel === 'function') {
      const channel = new MessageChannel();
      channel.port1.onmessage = () => { channel.port1.close(); resolve(); };
      channel.port2.postMessage(0);
    } else {
      setTimeout(resolve, 0);
    }
  });
  return {
    async tick() {
      if (performance.now() - start < sliceMs) return;
      await yieldNow();
      start = performance.now();
    },
  };
}

function makeGrid(min, max, cell) {
  const nx = Math.max(2, Math.ceil((max[0] - min[0]) / cell) + 1);
  const ny = Math.max(2, Math.ceil((max[1] - min[1]) / cell) + 1);
  const nz = Math.max(2, Math.ceil((max[2] - min[2]) / cell) + 1);
  return { nx, ny, nz, x0: min[0], y0: min[1], z0: min[2], h: cell };
}

function fillBlock(values, g, range, value) {
  const { nx, ny } = g;
  for (let k = range[4]; k <= range[5]; k += 1) {
    for (let j = range[2]; j <= range[3]; j += 1) {
      const row = nx * (j + ny * k);
      for (let i = range[0]; i <= range[1]; i += 1) values[i + row] = value;
    }
  }
}

function evalBlock(values, g, range, sdf) {
  const { nx, ny, x0, y0, z0, h } = g;
  for (let k = range[4]; k <= range[5]; k += 1) {
    const z = z0 + k * h;
    for (let j = range[2]; j <= range[3]; j += 1) {
      const y = y0 + j * h;
      const row = nx * (j + ny * k);
      for (let i = range[0]; i <= range[1]; i += 1) values[i + row] = sdf(x0 + i * h, y, z);
    }
  }
}

async function sampleGrid(sdf, g, budget) {
  const { nx, ny, nz, x0, y0, z0, h } = g;
  const values = new Float32Array(nx * ny * nz);
  const far = ((BLOCK * h * Math.sqrt(3)) / 2 + 2 * h) * LIPSCHITZ;
  const range = new Int32Array(6);
  for (let k0 = 0; k0 < nz - 1; k0 += BLOCK) {
    for (let j0 = 0; j0 < ny - 1; j0 += BLOCK) {
      for (let i0 = 0; i0 < nx - 1; i0 += BLOCK) {
        range[0] = i0; range[1] = Math.min(i0 + BLOCK, nx - 1);
        range[2] = j0; range[3] = Math.min(j0 + BLOCK, ny - 1);
        range[4] = k0; range[5] = Math.min(k0 + BLOCK, nz - 1);
        const d = sdf(x0 + ((range[0] + range[1]) / 2) * h, y0 + ((range[2] + range[3]) / 2) * h, z0 + ((range[4] + range[5]) / 2) * h);
        if (Math.abs(d) > far) fillBlock(values, g, range, d);
        else evalBlock(values, g, range, sdf);
      }
    }
    await budget.tick();
  }
  return values;
}

function growable(initial) {
  let data = new Float32Array(initial);
  let length = 0;
  return {
    push3(a, b, c) {
      if (length + 3 > data.length) {
        const next = new Float32Array(data.length * 2);
        next.set(data);
        data = next;
      }
      data[length] = a;
      data[length + 1] = b;
      data[length + 2] = c;
      length += 3;
    },
    get length() { return length; },
    view() { return data.subarray(0, length); },
  };
}

/** One vertex per crossed cell, at the average of its edge crossings. */
async function placeVertices(values, g, budget) {
  const { nx, ny, nz, x0, y0, z0, h } = g;
  const cx = nx - 1;
  const cy = ny - 1;
  const cellVertex = new Int32Array(cx * cy * (nz - 1)).fill(-1);
  const positions = growable(4096 * 3);
  const v = new Float32Array(8);
  let count = 0;
  for (let k = 0; k < nz - 1; k += 1) {
    for (let j = 0; j < cy; j += 1) {
      for (let i = 0; i < cx; i += 1) {
        let mask = 0;
        for (let c = 0; c < 8; c += 1) {
          const o = CORNERS[c];
          v[c] = values[(i + o[0]) + nx * ((j + o[1]) + ny * (k + o[2]))];
          if (v[c] < 0) mask |= 1 << c;
        }
        if (mask === 0 || mask === 255) continue;
        let sx = 0;
        let sy = 0;
        let sz = 0;
        let n = 0;
        for (let e = 0; e < 12; e += 1) {
          const a = EDGES[e][0];
          const b = EDGES[e][1];
          if ((v[a] < 0) === (v[b] < 0)) continue;
          const t = v[a] / (v[a] - v[b]);
          const ca = CORNERS[a];
          const cb = CORNERS[b];
          sx += ca[0] + (cb[0] - ca[0]) * t;
          sy += ca[1] + (cb[1] - ca[1]) * t;
          sz += ca[2] + (cb[2] - ca[2]) * t;
          n += 1;
        }
        cellVertex[i + cx * (j + cy * k)] = count;
        positions.push3(x0 + (i + sx / n) * h, y0 + (j + sy / n) * h, z0 + (k + sz / n) * h);
        count += 1;
      }
    }
    await budget.tick();
  }
  return { cellVertex, positions: positions.view().slice(), count };
}

/** Quads (two triangles) around every grid edge the surface crosses. */
function buildFaces(values, g, cellVertex) {
  const { nx, ny, nz } = g;
  const cx = nx - 1;
  const cy = ny - 1;
  const cell = (i, j, k) => cellVertex[i + cx * (j + cy * k)];
  const out = [];
  const dims = [nx, ny, nz];
  const p = [0, 0, 0];
  for (let k = 0; k < nz; k += 1) {
    for (let j = 0; j < ny; j += 1) {
      for (let i = 0; i < nx; i += 1) {
        const v0 = values[i + nx * (j + ny * k)];
        for (let axis = 0; axis < 3; axis += 1) {
          p[0] = i; p[1] = j; p[2] = k;
          if (p[axis] + 1 >= dims[axis]) continue;
          const u = (axis + 1) % 3;
          const w = (axis + 2) % 3;
          if (p[u] < 1 || p[w] < 1 || p[u] >= dims[u] - 1 || p[w] >= dims[w] - 1) continue;
          p[axis] += 1;
          const v1 = values[p[0] + nx * (p[1] + ny * p[2])];
          p[axis] -= 1;
          if ((v0 < 0) === (v1 < 0)) continue;
          const a = cell(p[0], p[1], p[2]);
          p[u] -= 1;
          const b = cell(p[0], p[1], p[2]);
          p[w] -= 1;
          const c = cell(p[0], p[1], p[2]);
          p[u] += 1;
          const d = cell(p[0], p[1], p[2]);
          if (a < 0 || b < 0 || c < 0 || d < 0) continue;
          if (v0 < 0) out.push(a, b, c, a, c, d);
          else out.push(a, c, b, a, d, c);
        }
      }
    }
  }
  return out;
}

/**
 * Drop triangles whose three vertices are all hidden (inside another part, e.g. the
 * scalp under the hair), then drop the vertices nobody uses any more.
 */
async function cullHidden(positions, count, faces, hiddenAt, budget) {
  const hidden = new Uint8Array(count);
  for (let n = 0; n < count; n += 1) {
    const o = n * 3;
    hidden[n] = hiddenAt(positions[o], positions[o + 1], positions[o + 2]) ? 1 : 0;
    if ((n & 1023) === 0) await budget.tick();
  }
  const kept = [];
  const remap = new Int32Array(count).fill(-1);
  let next = 0;
  for (let t = 0; t < faces.length; t += 3) {
    const a = faces[t];
    const b = faces[t + 1];
    const c = faces[t + 2];
    if (hidden[a] && hidden[b] && hidden[c]) continue;
    for (const v of [a, b, c]) {
      if (remap[v] < 0) { remap[v] = next; next += 1; }
      kept.push(remap[v]);
    }
  }
  const packed = new Float32Array(next * 3);
  for (let n = 0; n < count; n += 1) {
    const r = remap[n];
    if (r < 0) continue;
    packed[r * 3] = positions[n * 3];
    packed[r * 3 + 1] = positions[n * 3 + 1];
    packed[r * 3 + 2] = positions[n * 3 + 2];
  }
  return { positions: packed, count: next, faces: kept };
}

/** Newton step onto the surface, gradient normals, optional AO + colour. */
async function refine(sdf, positions, count, h, opts, budget) {
  const normals = new Float32Array(count * 3);
  const colors = opts.color || opts.ao ? new Float32Array(count * 3) : null;
  const e = h * 0.5;
  const maxMove = h * 0.9;
  const rgb = [1, 1, 1];
  for (let n = 0; n < count; n += 1) {
    const o = n * 3;
    let x = positions[o];
    let y = positions[o + 1];
    let z = positions[o + 2];
    const d = sdf(x, y, z);
    let gx = sdf(x + e, y, z) - sdf(x - e, y, z);
    let gy = sdf(x, y + e, z) - sdf(x, y - e, z);
    let gz = sdf(x, y, z + e) - sdf(x, y, z - e);
    const g2 = gx * gx + gy * gy + gz * gz;
    if (g2 > 1e-14) {
      const s = (d * 2 * e) / g2;
      let mx = gx * s;
      let my = gy * s;
      let mz = gz * s;
      const m = Math.sqrt(mx * mx + my * my + mz * mz);
      if (m > maxMove) { mx *= maxMove / m; my *= maxMove / m; mz *= maxMove / m; }
      x -= mx; y -= my; z -= mz;
      gx = sdf(x + e, y, z) - sdf(x - e, y, z);
      gy = sdf(x, y + e, z) - sdf(x, y - e, z);
      gz = sdf(x, y, z + e) - sdf(x, y, z - e);
    }
    const gl = Math.sqrt(gx * gx + gy * gy + gz * gz) || 1;
    positions[o] = x; positions[o + 1] = y; positions[o + 2] = z;
    normals[o] = gx / gl; normals[o + 1] = gy / gl; normals[o + 2] = gz / gl;
    if (colors) shadeVertex(opts, x, y, z, normals, o, rgb, colors);
    if ((n & 255) === 0) await budget.tick();
  }
  return { normals, colors };
}

function shadeVertex(opts, x, y, z, normals, o, rgb, colors) {
  const nx = normals[o];
  const ny = normals[o + 1];
  const nz = normals[o + 2];
  rgb[0] = 1; rgb[1] = 1; rgb[2] = 1;
  if (opts.color) opts.color(x, y, z, nx, ny, nz, rgb);
  let occlusion = 1;
  if (opts.ao) {
    const { sdf, step, steps, strength } = opts.ao;
    let sum = 0;
    let weight = 1;
    for (let s = 1; s <= steps; s += 1) {
      const dist = step * s;
      sum += weight * Math.max(0, dist - sdf(x + nx * dist, y + ny * dist, z + nz * dist));
      weight *= 0.5;
    }
    occlusion = Math.max(AO_FLOOR, 1 - (strength * sum) / step);
  }
  colors[o] = rgb[0] * occlusion;
  colors[o + 1] = rgb[1] * occlusion;
  colors[o + 2] = rgb[2] * occlusion;
}

/**
 * @param {(x: number, y: number, z: number) => number} sdf
 * @param {{ min: number[], max: number[], cell: number,
 *   color?: (x, y, z, nx, ny, nz, out: number[]) => void,
 *   ao?: { sdf: Function, step: number, steps: number, strength: number },
 *   cull?: (x, y, z) => boolean, budget?: { tick(): Promise<void> } }} opts
 * @returns {Promise<{ position: Float32Array, normal: Float32Array, color: Float32Array|null,
 *   index: Uint16Array|Uint32Array, vertexCount: number, triangleCount: number }>}
 */
export async function meshSdf(sdf, opts) {
  if (typeof sdf !== 'function') throw new Error('meshSdf needs a distance function');
  if (!(opts && opts.cell > 0 && opts.min && opts.max)) throw new Error('meshSdf needs min, max and cell');
  const budget = opts.budget || createBudget();
  const g = makeGrid(opts.min, opts.max, opts.cell);
  const values = await sampleGrid(sdf, g, budget);
  const placed = await placeVertices(values, g, budget);
  if (!placed.count) throw new Error('meshSdf found no surface inside the bounds');
  let mesh = { positions: placed.positions, count: placed.count, faces: buildFaces(values, g, placed.cellVertex) };
  await budget.tick();
  if (typeof opts.cull === 'function') mesh = await cullHidden(mesh.positions, mesh.count, mesh.faces, opts.cull, budget);
  if (!mesh.count) throw new Error('meshSdf culled the whole surface');
  const { positions, count, faces } = mesh;
  const { normals, colors } = await refine(sdf, positions, count, g.h, opts, budget);
  const index = count > 65535 ? new Uint32Array(faces) : new Uint16Array(faces);
  return { position: positions, normal: normals, color: colors, index, vertexCount: count, triangleCount: faces.length / 3 };
}
