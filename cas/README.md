# Rechenkern

The calculator and the calculations in notes run on [Giac](https://www-fourier.univ-grenoble-alpes.fr/~parisse/giac.html),
the computer algebra system behind Xcas, by Bernard Parisse and Renée De Graeve (Institut Fourier, Université Grenoble
Alpes), licensed under the GNU GPL version 3 or later. That is why Schul-PIP as a whole is under the GPL 3 too (see
`LICENSE` in the repository root).

- `web/giacwasm.js`: Giac 1.9.0 compiled to WebAssembly by its authors, unchanged, from
  <https://www-fourier.univ-grenoble-alpes.fr/~parisse/giac/giacwasm.js> (SHA-256
  `96cbb37bfe1060ffd9a56f72ab1cc61cf2400577ca9bb13e0992e03f603da378`). Its source code is the Giac source release at
  <https://www-fourier.univ-grenoble-alpes.fr/~parisse/giac/giac-1.9.0.tar.gz>.
- `web/cas.js`: German commands, results in school notation and the analysis for the function plotter.
- `web/cas.html`: loads both in the app's hidden web view (WKWebView on iOS, WebView on Android).
- `app/`: the calculator app itself (CAS view, formula editor, command search; `src/geometry.js` and
  `src/space.js`: shapes and values of geometric objects in the plane and in space, exact and symbolic; `src/graph/`: the objects of the rows, the 2D graphics, construction
  tools, sliders and animation, the 3D view; `src/stats.js`: statistics, distributions, regressions, tests and seeded simulations in plain
  JavaScript, `src/statcommands.js` the German commands on top of it, `src/charts.js` what the chart commands draw; `src/table.js` and
  `src/table-view.js`: the spreadsheet, whose cells are Giac variables; `src/chem/`: the chemical CAS, see `docs/chemistry-cas.md`), plain ES modules bundled with esbuild into `web/mathe.js` and `web/mathe.css`
  (`cd cas/app && npm ci && npm run build`). Its tests: `npm test` (expressions, plotting maths, engine against the real Giac, statistics against table values, the spreadsheet) and
  `test/chem/*.test.mjs` (the chemistry engine, no Giac needed) and
  `test/ui/smoke.mjs`, `test/ui/chemistry.mjs`, `test/ui/graph.mjs`, `test/ui/geometry.mjs`, `test/ui/space.mjs`, `test/ui/stats.mjs`, `test/ui/program.mjs`, `test/ui/exam.mjs`, `test/ui/numerics.mjs`, `test/ui/comfort.mjs`, `test/ui/extras.mjs` (the page in Chromium through Playwright). The bundle is committed, so the app builds need no Node.
- `web/mathe.html`: the calculator page both apps show in the Rechner tab; it talks to the app through a small bridge
  (`webkit.messageHandlers.mathe` on iOS, `MatheBridge` on Android) for storing projects and sharing.
- Third-party code in the bundle: [MathLive](https://github.com/arnog/mathlive) 0.110 (MIT, formula editor and
  keyboard, with the KaTeX fonts under the SIL Open Font License) and [three.js](https://github.com/mrdoob/three.js)
  (MIT, the 3D view). Both are compatible with the GPL.
- `test/cas.test.js`: runs `cas.js` against the real Giac: `node cas/test/cas.test.js`.
