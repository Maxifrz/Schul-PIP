// Copies the fonts the iOS app bundles (all under the SIL Open Font License) into public/fonts, so the desktop app
// looks the same. Runs before every dev start and build.
import { cpSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const source = join(here, '..', '..', 'Lernwerk', 'Resources', 'Fonts');
const target = join(here, '..', 'public', 'fonts');
if (!existsSync(source)) throw new Error(`Fonts not found at ${source}`);
mkdirSync(target, { recursive: true });
for (const name of readdirSync(source)) {
  if (/^(HankenGrotesk|IBMPlexMono|Jersey10|OFL-HankenGrotesk|OFL-IBMPlexMono|OFL-Jersey10).*\.(ttf|txt)$/.test(name)) cpSync(join(source, name), join(target, name));
}
console.log(`fonts copied to ${target}`);

// pdf.js needs the metric-compatible standard fonts and the character maps to draw PDFs that do not embed their fonts.
const pdfjs = join(here, '..', 'node_modules', 'pdfjs-dist');
for (const folder of ['standard_fonts', 'cmaps']) {
  if (existsSync(join(pdfjs, folder))) cpSync(join(pdfjs, folder), join(here, '..', 'public', 'pdfjs', folder), { recursive: true });
}
