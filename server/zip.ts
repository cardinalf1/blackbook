// A minimal ZIP writer and reader for the question-bank backup: a few named files, deflate or
// stored, no encryption, no ZIP64. Enough for Blackbook's own zips, strict about everything else,
// so a damaged or foreign file gives a clear error instead of a partial import.

import { deflateRawSync, inflateRawSync } from 'node:zlib';

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = (CRC_TABLE[(c ^ (data[i] as number)) & 0xff] as number) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export interface ZipEntryInput {
  name: string;
  data: Uint8Array;
}

/** DOS date and time for the entry headers. */
function dosDateTime(d: Date): { date: number; time: number } {
  const year = Math.max(1980, d.getFullYear());
  return {
    date: ((year - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
  };
}

export function writeZip(entries: readonly ZipEntryInput[], now: Date = new Date()): Uint8Array {
  const { date, time } = dosDateTime(now);
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const e of entries) {
    const name = Buffer.from(e.name, 'utf8');
    const compressed = deflateRawSync(e.data, { level: 6 });
    const crc = crc32(e.data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // UTF-8 names
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(e.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, name, compressed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(time, 12);
    central.writeUInt16LE(date, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(e.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, name);
    offset += local.length + name.length + compressed.length;
  }
  const centralSize = centrals.reduce((n, b) => n + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  return new Uint8Array(Buffer.concat([...locals, ...centrals, end]));
}

export class ZipError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ZipError';
  }
}

export function looksLikeZip(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}

/**
 * Reads every entry. Throws ZipError for anything damaged or unsupported. `maxBytes` caps each
 * entry's unpacked size (a guard against a zip bomb).
 */
export function readZip(input: Uint8Array, maxBytes = 400 * 1024 * 1024, maxEntries = 16): Map<string, Uint8Array> {
  const buf = Buffer.from(input.buffer, input.byteOffset, input.byteLength);
  const damaged = (why: string) => new ZipError(`The zip file is damaged or not a Blackbook backup (${why}).`);
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 0xffff); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw damaged('no directory');
  const count = buf.readUInt16LE(eocd + 10);
  const cdSize = buf.readUInt32LE(eocd + 12);
  const cdOffset = buf.readUInt32LE(eocd + 16);
  if (count > maxEntries) throw damaged('too many files');
  if (cdOffset + cdSize > eocd) throw damaged('directory out of range');
  const out = new Map<string, Uint8Array>();
  let p = cdOffset;
  for (let i = 0; i < count; i++) {
    if (p + 46 > buf.length || buf.readUInt32LE(p) !== 0x02014b50) throw damaged('bad directory entry');
    const flags = buf.readUInt16LE(p + 8);
    const method = buf.readUInt16LE(p + 10);
    const crc = buf.readUInt32LE(p + 16);
    const csize = buf.readUInt32LE(p + 20);
    const usize = buf.readUInt32LE(p + 24);
    const nlen = buf.readUInt16LE(p + 28);
    const xlen = buf.readUInt16LE(p + 30);
    const clen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nlen);
    p += 46 + nlen + xlen + clen;
    if (flags & 0x1) throw new ZipError('The zip file is password-protected. Blackbook backups never are.');
    if (usize > maxBytes || csize === 0xffffffff) throw damaged('file too large');
    if (local + 30 > buf.length || buf.readUInt32LE(local) !== 0x04034b50) throw damaged('bad file header');
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    if (start + csize > buf.length) throw damaged('file cut short');
    const raw = buf.subarray(start, start + csize);
    let data: Buffer;
    if (method === 0) data = Buffer.from(raw);
    else if (method === 8) {
      try {
        data = inflateRawSync(raw, { maxOutputLength: maxBytes });
      } catch {
        throw damaged('could not unpack');
      }
    } else throw damaged(`unsupported packing ${method}`);
    if (data.length !== usize || crc32(data) !== crc) throw damaged(`${name} does not match its checksum`);
    out.set(name, new Uint8Array(data));
  }
  return out;
}
