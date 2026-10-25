/**
 * A QR code for the shared result card (the website draws it in src/components/challenge/shareCard.ts, the app in
 * apps/mobile): the site's address as the card prints it, so a phone can open
 * it from the image. Plain arithmetic, no library: byte mode, error correction level M (about 15% of the code may be
 * lost), the smallest version from 1 to 10 that holds the text, and the mask with the lowest penalty, as ISO/IEC 18004
 * specifies (the same steps as Project Nayuki's QR Code generator). Returns the modules, dark as true, without the
 * quiet zone round them, which the caller leaves light.
 */

/** Per version 1–10, level M: error correction codewords per block, and the number of blocks. */
const ECC_PER_BLOCK = [10, 16, 26, 18, 24, 16, 18, 22, 22, 26];
const BLOCKS = [1, 1, 1, 2, 2, 4, 4, 4, 5, 5];
/** Level M's two format bits. */
const LEVEL_M = 0;

export function qrCode(text: string): boolean[][] {
  const bytes = new TextEncoder().encode(text);
  let version = 1;
  for (; version <= 10; version++) if (4 + (version < 10 ? 8 : 16) + bytes.length * 8 <= dataCodewords(version) * 8) break;
  if (version > 10) throw new Error("Too long for the card's QR code");

  // The data: byte mode, its length, the bytes, a terminator, then padding to the capacity.
  const capacity = dataCodewords(version) * 8;
  const bits: number[] = [];
  const push = (value: number, length: number) => {
    for (let i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1);
  };
  push(0b0100, 4);
  push(bytes.length, version < 10 ? 8 : 16);
  for (const b of bytes) push(b, 8);
  push(0, Math.min(4, capacity - bits.length));
  push(0, (8 - (bits.length % 8)) % 8);
  for (let pad = 0xec; bits.length < capacity; pad ^= 0xec ^ 0x11) push(pad, 8);
  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));

  const codewords = withErrorCorrection(data, version);
  const size = version * 4 + 17;
  const dark = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const reserved = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const set = (x: number, y: number, on: boolean) => {
    dark[y][x] = on;
    reserved[y][x] = true;
  };
  drawFunctionPatterns(version, size, set);
  placeData(codewords, size, dark, reserved);

  // Each mask in turn; the one with the lowest penalty stays.
  let best: { penalty: number; modules: boolean[][] } | null = null;
  for (let mask = 0; mask < 8; mask++) {
    const modules = dark.map((row, y) => row.map((on, x) => (reserved[y][x] ? on : on !== masked(mask, x, y))));
    drawFormatBits(mask, size, (x, y, on) => (modules[y][x] = on));
    const penalty = penaltyOf(modules);
    if (!best || penalty < best.penalty) best = { penalty, modules };
  }
  return best!.modules;
}

/** The modules left for data and error correction in a version, in whole codewords. */
function rawCodewords(version: number): number {
  let modules = (16 * version + 128) * version + 64;
  if (version >= 2) {
    const align = Math.floor(version / 7) + 2;
    modules -= (25 * align - 10) * align - 55;
    if (version >= 7) modules -= 36;
  }
  return Math.floor(modules / 8);
}

function dataCodewords(version: number): number {
  return rawCodewords(version) - ECC_PER_BLOCK[version - 1] * BLOCKS[version - 1];
}

/** The data split into blocks, each with its Reed–Solomon codewords, interleaved. */
function withErrorCorrection(data: readonly number[], version: number): number[] {
  const blocks = BLOCKS[version - 1];
  const eccLength = ECC_PER_BLOCK[version - 1];
  const raw = rawCodewords(version);
  const shortBlocks = blocks - (raw % blocks);
  const shortLength = Math.floor(raw / blocks);
  const divisor = rsDivisor(eccLength);
  const all: number[][] = [];
  for (let i = 0, k = 0; i < blocks; i++) {
    const dataLength = shortLength - eccLength + (i < shortBlocks ? 0 : 1);
    const block = data.slice(k, k + dataLength);
    k += dataLength;
    const ecc = rsRemainder(block, divisor);
    // Short blocks get a placeholder, skipped below, so every block's codewords line up.
    if (i < shortBlocks) block.push(-1);
    all.push([...block, ...ecc]);
  }
  const result: number[] = [];
  for (let i = 0; i < all[0].length; i++)
    all.forEach((block, j) => {
      if (i !== shortLength - eccLength || j >= shortBlocks) result.push(block[i]);
    });
  return result;
}

function gfMultiply(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z;
}

function rsDivisor(degree: number): number[] {
  const result = new Array<number>(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      result[j] = gfMultiply(result[j], root);
      if (j + 1 < degree) result[j] ^= result[j + 1];
    }
    root = gfMultiply(root, 0x02);
  }
  return result;
}

function rsRemainder(data: readonly number[], divisor: readonly number[]): number[] {
  const result = new Array<number>(divisor.length).fill(0);
  for (const b of data) {
    const factor = b ^ result.shift()!;
    result.push(0);
    divisor.forEach((coef, i) => (result[i] ^= gfMultiply(coef, factor)));
  }
  return result;
}

/** Finder, separator, timing and alignment patterns, the version's bits (7 and up), and room for the format bits. */
function drawFunctionPatterns(version: number, size: number, set: (x: number, y: number, on: boolean) => void) {
  for (let i = 0; i < size; i++) {
    set(6, i, i % 2 === 0);
    set(i, 6, i % 2 === 0);
  }
  for (const [cx, cy] of [
    [3, 3],
    [size - 4, 3],
    [3, size - 4],
  ])
    for (let dy = -4; dy <= 4; dy++)
      for (let dx = -4; dx <= 4; dx++) {
        const [x, y] = [cx + dx, cy + dy];
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        if (x >= 0 && x < size && y >= 0 && y < size) set(x, y, d !== 2 && d !== 4);
      }
  const align = alignmentPositions(version, size);
  for (let i = 0; i < align.length; i++)
    for (let j = 0; j < align.length; j++) {
      // Not where a finder is.
      if ((i === 0 && j === 0) || (i === 0 && j === align.length - 1) || (i === align.length - 1 && j === 0)) continue;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(align[i] + dx, align[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
  // Reserved for the format bits (drawn with each mask), with the dark module.
  drawFormatBits(0, size, set);
  if (version >= 7) {
    let rem = version;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const bits = (version << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const on = ((bits >>> i) & 1) === 1;
      const [a, b] = [size - 11 + (i % 3), Math.floor(i / 3)];
      set(a, b, on);
      set(b, a, on);
    }
  }
}

function alignmentPositions(version: number, size: number): number[] {
  if (version === 1) return [];
  const count = Math.floor(version / 7) + 2;
  const step = Math.ceil((version * 4 + 4) / (count * 2 - 2)) * 2;
  const result = [6];
  for (let pos = size - 7; result.length < count; pos -= step) result.splice(1, 0, pos);
  return result;
}

function drawFormatBits(mask: number, size: number, set: (x: number, y: number, on: boolean) => void) {
  const data = (LEVEL_M << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  const bits = ((data << 10) | rem) ^ 0x5412;
  const bit = (i: number) => ((bits >>> i) & 1) === 1;
  for (let i = 0; i <= 5; i++) set(8, i, bit(i));
  set(8, 7, bit(6));
  set(8, 8, bit(7));
  set(7, 8, bit(8));
  for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
  for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(i));
  for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(i));
  set(8, size - 8, true);
}

/** The codewords' bits in the zigzag order, two columns at a time from the bottom right, round the reserved modules. */
function placeData(codewords: readonly number[], size: number, dark: boolean[][], reserved: boolean[][]) {
  let i = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++)
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (!reserved[y][x] && i < codewords.length * 8) {
          dark[y][x] = ((codewords[i >>> 3] >>> (7 - (i & 7))) & 1) === 1;
          i++;
        }
      }
  }
}

function masked(mask: number, x: number, y: number): boolean {
  switch (mask) {
    case 0:
      return (x + y) % 2 === 0;
    case 1:
      return y % 2 === 0;
    case 2:
      return x % 3 === 0;
    case 3:
      return (x + y) % 3 === 0;
    case 4:
      return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
    case 5:
      return ((x * y) % 2) + ((x * y) % 3) === 0;
    case 6:
      return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
    default:
      return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
  }
}

/** The standard's penalty: long runs, 2×2 blocks, finder-like patterns, and an imbalance of dark and light. */
function penaltyOf(modules: readonly (readonly boolean[])[]): number {
  const size = modules.length;
  let penalty = 0;
  const lines = [...modules, ...modules.map((_, x) => modules.map((row) => row[x]))];
  const finderLike = [
    [true, false, true, true, true, false, true, false, false, false, false],
    [false, false, false, false, true, false, true, true, true, false, true],
  ];
  for (const line of lines) {
    for (let i = 0, run = 1; i < size; i++, run++)
      if (i === size - 1 || line[i] !== line[i + 1]) {
        if (run >= 5) penalty += run - 2;
        run = 0;
      }
    for (let i = 0; i + 11 <= size; i++) if (finderLike.some((p) => p.every((on, k) => line[i + k] === on))) penalty += 40;
  }
  for (let y = 0; y + 1 < size; y++)
    for (let x = 0; x + 1 < size; x++) {
      const c = modules[y][x];
      if (c === modules[y][x + 1] && c === modules[y + 1][x] && c === modules[y + 1][x + 1]) penalty += 3;
    }
  const darkCount = modules.reduce((n, row) => n + row.filter(Boolean).length, 0);
  const total = size * size;
  penalty += (Math.ceil(Math.abs(darkCount * 20 - total * 10) / total) - 1) * 10;
  return penalty;
}
