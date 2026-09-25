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
- `test/cas.test.js`: runs `cas.js` against the real Giac: `node cas/test/cas.test.js`.
