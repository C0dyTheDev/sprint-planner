// Minimal .xlsx reader: cell values (cached results for formulas), cell fill keys and merged ranges.
// Runs in the browser and in Node without dependencies (ZIP via DecompressionStream).
export type SheetCell = { value: string | number | null; fill: string | null; formula: boolean };
export type Sheet = { name: string; cells: Map<string, SheetCell>; merges: string[] };

const decoder = new TextDecoder();
const u16 = (b: Uint8Array, o: number) => b[o] | (b[o + 1] << 8);
const u32 = (b: Uint8Array, o: number) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;

async function inflate(data: Uint8Array) {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function unzip(zip: Uint8Array) {
  let end = -1;
  for (let i = zip.length - 22; i >= Math.max(0, zip.length - 65557); i--) if (u32(zip, i) === 0x06054b50) { end = i; break; }
  if (end < 0) throw new Error('This file is not a valid .xlsx workbook');
  const files = new Map<string, Uint8Array>();
  let at = u32(zip, end + 16);
  for (let n = u16(zip, end + 10); n > 0; n--) {
    if (u32(zip, at) !== 0x02014b50) throw new Error('This file is not a valid .xlsx workbook');
    const method = u16(zip, at + 10), size = u32(zip, at + 20), nameLength = u16(zip, at + 28), extra = u16(zip, at + 30), comment = u16(zip, at + 32), local = u32(zip, at + 42);
    const name = decoder.decode(zip.subarray(at + 46, at + 46 + nameLength));
    const start = local + 30 + u16(zip, local + 26) + u16(zip, local + 28), raw = zip.subarray(start, start + size);
    if (/\.(xml|rels)$/.test(name)) files.set(name, method === 8 ? await inflate(raw) : raw);
    at += 46 + nameLength + extra + comment;
  }
  return (name: string) => { const f = files.get(name); return f ? decoder.decode(f) : ''; };
}

const unescape = (s: string) => s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, e: string) => e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" } as Record<string, string>)[e.toLowerCase()]);
const attrs = (s: string) => Object.fromEntries([...s.matchAll(/([\w:]+)="([^"]*)"/g)].map(m => [m[1], unescape(m[2])]));
const texts = (s: string) => [...s.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '').matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map(m => unescape(m[1])).join('');

function fillKey(fill: string) {
  const pattern = fill.match(/<patternFill\b([^>]*)/);
  if (!pattern || !/patternType="solid"/.test(pattern[1])) return null;
  const color = fill.match(/<fgColor\b([^>]*)/);
  if (!color) return 'solid';
  const a = attrs(color[1]), tint = a.tint ? ':' + Number(a.tint).toFixed(2) : '';
  return a.rgb ? 'rgb:' + a.rgb.toUpperCase() : a.theme !== undefined ? 'theme:' + a.theme + tint : a.indexed !== undefined ? 'indexed:' + a.indexed + tint : 'solid';
}

export async function readXlsx(data: Uint8Array): Promise<Sheet[]> {
  const file = await unzip(data);
  const shared = [...file('xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m => texts(m[1]));
  const styles = file('xl/styles.xml');
  const fills = [...(styles.match(/<fills\b[\s\S]*?<\/fills>/)?.[0] ?? '').matchAll(/<fill>([\s\S]*?)<\/fill>|<fill\/>/g)].map(m => fillKey(m[1] ?? ''));
  const xfFills = [...(styles.match(/<cellXfs\b[\s\S]*?<\/cellXfs>/)?.[0] ?? '').matchAll(/<xf\b([^>]*)/g)].map(m => fills[Number(attrs(m[1]).fillId ?? 0)] ?? null);
  const rels = Object.fromEntries([...file('xl/_rels/workbook.xml.rels').matchAll(/<Relationship\b([^>]*)/g)].map(m => { const a = attrs(m[1]); return [a.Id, a.Target]; }));
  return [...file('xl/workbook.xml').matchAll(/<sheet\b([^>]*)/g)].map(m => {
    const a = attrs(m[1]), target = rels[a['r:id']] ?? '', path = target.startsWith('/') ? target.slice(1) : 'xl/' + target;
    const xml = file(path), cells = new Map<string, SheetCell>();
    for (const c of xml.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ca = attrs(c[1]), body = c[2] ?? '', raw = body.match(/<v>([\s\S]*?)<\/v>/)?.[1];
      let value: string | number | null = null;
      if (ca.t === 's') value = raw === undefined ? null : shared[Number(raw)] ?? null;
      else if (ca.t === 'inlineStr') value = texts(body);
      else if (ca.t === 'str' || ca.t === 'e') value = raw === undefined ? null : unescape(raw);
      else if (raw !== undefined && raw.trim() !== '') value = Number(raw);
      cells.set(ca.r, { value, fill: xfFills[Number(ca.s ?? 0)] ?? null, formula: /<f\b/.test(body) });
    }
    return { name: a.name, cells, merges: [...xml.matchAll(/<mergeCell\b[^>]*ref="([^"]+)"/g)].map(r => r[1]) };
  });
}

export function columnIndex(ref: string) { let n = 0; for (const ch of ref.match(/^[A-Z]+/)![0]) n = n * 26 + ch.charCodeAt(0) - 64; return n; }
export function cellRef(column: number, row: number) { let s = ''; for (let n = column; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + (n - 1) % 26) + s; return s + row; }
export function excelDate(serial: number) { return new Date(Date.UTC(1899, 11, 30) + Math.round(serial) * 86400000).toISOString().slice(0, 10); }
