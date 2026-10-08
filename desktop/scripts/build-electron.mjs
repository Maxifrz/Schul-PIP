// Bundles the main process and the preload script (CommonJS, Electron's own modules left out).
import { build } from 'esbuild';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const common = { bundle: true, platform: 'node', target: 'node22', format: 'cjs', external: ['electron'], logLevel: 'info' };
await build({ ...common, entryPoints: [join(root, 'electron/main.ts')], outfile: join(root, 'dist-electron/main.cjs') });
await build({ ...common, entryPoints: [join(root, 'electron/preload.ts')], outfile: join(root, 'dist-electron/preload.cjs') });
