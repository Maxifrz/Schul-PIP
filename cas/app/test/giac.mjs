// Loads the real Giac (cas/web/giacwasm.js) with cas.js into Node, once for all tests.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const web = new URL('../../web/', import.meta.url).pathname;
let loading = null;

export function loadGiac() {
  if (loading) return loading;
  loading = new Promise((resolve) => {
    globalThis.require = createRequire(import.meta.url);
    globalThis.__dirname = web;
    vm.runInThisContext(readFileSync(web + 'cas.js', 'utf8'), { filename: 'cas.js' });
    globalThis.Module = {
      print: (line) => globalThis.CAS.captured(line),
      printErr: (line) => globalThis.CAS.captured(line),
      onRuntimeInitialized() {
        globalThis.CAS.init(globalThis.Module.cwrap('caseval', 'string', ['string']));
        resolve(globalThis.CAS);
      },
    };
    vm.runInThisContext(readFileSync(web + 'giacwasm.js', 'utf8'), { filename: 'giacwasm.js' });
  });
  return loading;
}
