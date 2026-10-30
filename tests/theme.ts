import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
// @ts-ignore -- plain ES module script
import {darkStylesheet} from '../scripts/build-dark-theme.mjs';
const generated:string=darkStylesheet();
assert.equal(readFileSync('app/dark.css','utf8'),generated,'app/dark.css is out of date: run pnpm theme:dark');
assert.match(generated,/^\.dark\{--background:#[0-9a-f]{6};--foreground:#[0-9a-f]{6}/m);assert.match(generated,/^\.dark \.panel\{/m);assert(!/\.dark \.dark/.test(generated));
console.log('✓ Dark theme stylesheet is generated from globals.css and up to date');
