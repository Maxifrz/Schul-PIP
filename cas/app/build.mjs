// Bundles the calculator app into cas/web: mathe.js (app, MathLive, three.js), mathe.css and MathLive's fonts.
// cas/web ships flat into the iOS bundle and the Android assets, so every file sits next to mathe.html.
import { build } from 'esbuild';
import { copyFileSync, readdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const web = new URL('../web/', import.meta.url).pathname;
await build({
  entryPoints: ['src/main.js'],
  bundle: true,
  format: 'iife',
  minify: true,
  target: ['safari15', 'chrome90'],
  outfile: join(web, 'mathe.js'),
  legalComments: 'eof',
  logLevel: 'warning',
});
const fonts = 'node_modules/mathlive/fonts';
for (const file of readdirSync(fonts)) copyFileSync(join(fonts, file), join(web, file));
// MathLive's formula CSS for rendered answers, pointing at the fonts next to it.
const mathlive = readFileSync('node_modules/mathlive/mathlive-static.css', 'utf8').replace(/url\(fonts\//g, 'url(');
writeFileSync(join(web, 'mathe.css'), mathlive + '\n' + readFileSync('src/styles.css', 'utf8'));
console.log('built', join(web, 'mathe.js'));
