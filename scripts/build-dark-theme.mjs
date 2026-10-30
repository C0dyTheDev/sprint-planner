// Generates app/dark.css from app/globals.css: every rule that sets a colour is repeated under
// `.dark` with a dark counterpart. Run `pnpm theme:dark` after changing colours in globals.css;
// hand-tuned exceptions live in DARK_OVERRIDES below.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = new URL('..', import.meta.url);
const SOURCE = fileURLToPath(new URL('app/globals.css', root)), TARGET = fileURLToPath(new URL('app/dark.css', root));

// sRGB <-> OKLab (https://bottosson.github.io/posts/oklab/)
const lin = c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4, gam = c => c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
function toLab([r, g, b]) {
  [r, g, b] = [r, g, b].map(v => lin(v / 255));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b), s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
function fromLab([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3, s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s].map(gam);
}
// Keeps hue, reduces chroma until the colour fits in sRGB.
function lab(L, a, b) {
  for (let k = 1; k >= 0; k -= 0.02) { const rgb = fromLab([L, a * k, b * k]); if (rgb.every(v => v >= -0.0005 && v <= 1.0005)) return rgb.map(v => Math.round(Math.min(1, Math.max(0, v)) * 255)); }
  return fromLab([L, 0, 0]).map(v => Math.round(Math.min(1, Math.max(0, v)) * 255));
}
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v)), mix = (x, y, t) => x + (y - x) * t;

// Backgrounds and borders. Near-whites are surfaces and keep their order (page darkest, white panels on top);
// light greys are borders and fills, so they become lighter than the panels they sit on. Strong colours keep their lightness.
function surface([L, a, b]) {
  const chroma = Math.hypot(a, b), t = clamp((chroma - 0.04) / 0.05, 0, 1);
  const dark = L >= 0.975 ? 0.17 + (Math.min(L, 1) - 0.975) / 0.025 * 0.055 : clamp(0.24 + (0.975 - L) * 1.25, 0.24, 0.9);
  return lab(mix(dark, L * 0.92, t), a, b);
}
// Text: dark becomes light with a softer tint; near-white text sits on coloured fills and stays white.
function text([L, a, b]) {
  if (L > 0.9) return lab(L, a, b);
  const soften = Math.hypot(a, b) < 0.08 ? 0.5 : 1;
  return lab(clamp(0.92 - (L - 0.31) * 0.822, 0.4, 0.95), a * soften, b * soften);
}

const hex = n => n.toString(16).padStart(2, '0');
function parseColor(token) {
  const named = { white: 'ffffff', black: '000000' }[token.toLowerCase()];
  let h = named ?? token.slice(1);
  if (h.length === 3 || h.length === 4) h = [...h].map(c => c + c).join('');
  return { rgb: [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)), alpha: h.length === 8 ? h.slice(6) : '' };
}
function mapColor(token, kind) {
  const { rgb, alpha } = parseColor(token);
  if (kind === 'shadow') return '#000000' + (alpha ? hex(Math.min(255, Math.round(parseInt(alpha, 16) * 2.2))) : '');
  const out = (kind === 'text' ? text : surface)(toLab(rgb));
  return '#' + out.map(hex).join('') + alpha;
}
const COLOR = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b|\b(?:white|black)\b/g, HAS_COLOR = new RegExp(COLOR.source);
function kindOf(prop) {
  if (prop === 'box-shadow' || prop === 'text-shadow') return 'shadow';
  if (['color', 'fill', 'stroke', 'caret-color', '-webkit-text-fill-color'].includes(prop)) return 'text';
  if (prop.startsWith('--')) return /foreground|^--muted$/.test(prop) ? 'text' : 'surface';
  return 'surface';
}

function splitDeclarations(body) {
  const out = []; let depth = 0, start = 0;
  for (let i = 0; i < body.length; i++) { const c = body[i]; if (c === '(') depth++; else if (c === ')') depth--; else if (c === ';' && depth === 0) { out.push(body.slice(start, i)); start = i + 1; } }
  out.push(body.slice(start));
  return out.map(d => d.trim()).filter(Boolean);
}
const prefix = selector => selector.split(',').map(s => s.trim()).map(s => s === ':root' || s === 'html' ? '.dark' : s.startsWith('body') ? '.dark ' + s : '.dark ' + s).join(',');

// Walks the stylesheet: rules inside @media stay inside @media; @theme, @import and @keyframes are skipped.
function build(css) {
  css = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const out = [];
  function walk(src) {
    let i = 0, buffer = '';
    const rules = [];
    while (i < src.length) {
      const c = src[i];
      if (c === ';' && !buffer.includes('{')) { buffer = ''; i++; continue; }
      if (c !== '{') { buffer += c; i++; continue; }
      let depth = 1, j = i + 1;
      while (j < src.length && depth) { if (src[j] === '{') depth++; else if (src[j] === '}') depth--; j++; }
      const head = buffer.trim(), body = src.slice(i + 1, j - 1);
      buffer = ''; i = j;
      if (head.startsWith('@media') || head.startsWith('@supports')) { const inner = walk(body); if (inner.length) rules.push(`${head}{${inner.join('')}}`); continue; }
      if (head.startsWith('@')) continue;
      const decls = splitDeclarations(body).map(d => { const at = d.indexOf(':'); return [d.slice(0, at).trim(), d.slice(at + 1).trim()]; }).filter(([, v]) => HAS_COLOR.test(v)).map(([p, v]) => `${p}:${v.replace(COLOR, t => mapColor(t, kindOf(p)))}`);
      if (decls.length) rules.push(`${prefix(head)}{${decls.join(';')}}`);
    }
    return rules;
  }
  for (const rule of walk(css)) out.push(rule);
  return out;
}

const DARK_OVERRIDES = `
/* Hand-tuned: employee avatars keep their pastel colour, so their initials stay dark. */
.dark .avatar{color:#26313b;border-color:#ffffff22}
.dark{color-scheme:dark}
.dark input[type=date]::-webkit-calendar-picker-indicator{filter:invert(.8)}
`;

export function darkStylesheet() {
  return `/* Generated by scripts/build-dark-theme.mjs from globals.css — do not edit; change the generator or globals.css and run pnpm theme:dark. */\n${build(readFileSync(SOURCE, 'utf8')).join('\n')}\n${DARK_OVERRIDES.trim()}\n`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) { writeFileSync(TARGET, darkStylesheet()); console.log('Wrote app/dark.css'); }
