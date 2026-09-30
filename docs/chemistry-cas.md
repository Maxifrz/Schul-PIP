# Chemical CAS

The calculator ("Rechner") has a chemistry layer next to the algebra system: formulas, reactions, amounts, acids and
bases, equilibria, redox, electrochemistry, thermodynamics, kinetics, gases and titration curves, with the working
shown. It is plain JavaScript in `cas/app/src/chem/`, runs offline, needs no Giac for its own calculations and is
bundled into `cas/web/mathe.js` with the rest of the calculator page (iOS and Android use the same bundle).

It is written for school chemistry (Sek. II). Where a model stops being valid it says so instead of answering.

## How a chemistry input is recognised

`Engine.evaluateFree` (`cas/app/src/engine.js`) asks `runChemistry` (`chem/commands.js`) first:

1. **A command call** `name(arguments)` whose name is a chemistry command (German name, alias, or a case-sensitive
   short form such as `M`, `n`, `pH`, `Ka`, `ΔH`). Text rows and the formula editor both work: LaTeX
   (`H_2SO_4`, `\rightarrow`, `\rightleftharpoons`, `Fe^{3+}`, `\mathrm{mol}`) is turned into text by `chem/latex.js`.
2. **A bare reaction equation** (`Fe + O2 -> Fe2O3`, with `->`, `→`, `⇌`, `<=>`): balanced; a redox skeleton that needs
   H⁺/H₂O falls back to the redox balancing.
3. **A German sentence** ("Wie viel mol sind 10 g NaCl?", "Berechne den pH-Wert einer 0,1 M Essigsäure"):
   `parseChemicalIntent` (`chem/intent.js`) turns it into a command; the row shows what was understood. The parser
   never calculates.
4. **Chemistry inside a calculation**: `2*M(NaCl)` becomes `2*(58.44…)` and Giac goes on; the unit is shown next to
   the result.

Everything else goes to the mathematics as before. Short names are guarded: `M(…)`, `n(…)`, `c(…)`, `m(…)`, `V(…)`,
`E0`, `dH` … are chemistry only if an argument names a substance and the student has not defined that name
(`M = 5` makes `M(2)` a product; `c(t) = t^2+1` stays a function).

## Command language

Arguments are separated by `;` (a decimal comma is part of a number). `key=value` are options. A *given* is written
`10 g Fe`, `Fe: 10 g`, `m(Fe) = 10 g`, `HCl: 0,1 mol/L 50 mL` or `c0(N2) = 1 mol/L` (`0` = start value).

| Area | Commands (short forms) | Example |
|---|---|---|
| Substances | `molmasse` (`M`), `zusammensetzung`, `element`, `stoffinfo` | `molmasse(H2SO4)` → 98,079 g/mol |
| Quantities | `stoffmenge` (`n`), `masse` (`m`), `konzentration` (`c`), `stoffvolumen` (`V`), `verdünnung`, `einheitenumrechnung` | `n(NaCl; 10 g)` |
| Reactions | `ausgleichen`, `stöchiometrie`, `limitierenderstoff`, `ausbeute` | `ausgleichen(Fe + O2 -> Fe2O3)` → `4 Fe + 3 O2 -> 2 Fe2O3` |
| Acids and bases | `phwert` (`pH`), `pohwert` (`pOH`), `puffer`, `säurekonstante` (`Ka`, `pKa`), `basenkonstante` (`Kb`, `pKb`), `ionenprodukt` (`Kw`), `oxonium`, `titration`, `speziesverteilung` | `pH(CH3COOH; 0,1 mol/L)` |
| Equilibrium | `gleichgewicht`, `gleichgewichtskonstante` (`Kc`, `Kp`), `löslichkeit`, `löslichkeitsprodukt` (`Ksp`), `fällung` | `gleichgewicht(N2 + 3 H2 <=> 2 NH3; Kc=0,5; c(N2)=1 mol/L; c(H2)=3 mol/L)` |
| Redox, electrochemistry | `redox`, `oxidationszahl`, `standardpotential` (`E0`, `E°`), `zellspannung`, `nernst`, `elektrolyse` | `redox(MnO4- + Fe2+ -> Mn2+ + Fe3+)` |
| Thermodynamics | `reaktionsenthalpie` (`ΔH`, `dH`), `reaktionsentropie` (`ΔS`), `freieenthalpie` (`ΔG`), `gibbs`, `hess`, `vanthoff` | `reaktionsenthalpie(N2 + 3 H2 -> 2 NH3)` |
| Kinetics | `kinetik`, `reaktionsordnung`, `arrhenius` | `kinetik(Ordnung=1; k=0,05 1/s; c0=0,8 mol/L; t=20 s)` |
| Gases | `gasgesetz`, `boyle`, `charles`, `gaylussac`, `avogadro`, `gasgleichung`, `molvolumen`, `gasdichte`, `vanderwaals`, `isotherme` | `gasgesetz(n=1 mol; T=273,15 K; p=101325 Pa)` |

`Befehle` in the calculator lists all of them (category **Chemie**) with syntax, explanation and an example to run.

## Result object

Every command returns a `ChemicalResult` (`chem/result.js`):

```js
{ type, title, ok,
  result:   { value, unit, dimension } | { text, latex, equation … },
  values:   { name: { value, unit } | { text } },      // further named answers
  steps:    [{ label, lines: [{ latex, text }] }],       // built from the numbers actually used
  warnings: [{ code, message }],
  assumptions: [string], sources: [string],
  table, plot, actions }
```

The engine wraps it as `{ ok, kind: 'analysis', rows, steps, table, shapes, actions, chem }`; the CAS view shows the
answer and named values, the working under "Rechenweg" (foldable), warnings in the error colour, assumptions and
sources, buttons for the next step and "Rechenweg kopieren".

## Errors

Errors are `ChemError` with a stable code and a German message; the engine answers `{ ok: false, code, error }`.

| Code | Meaning |
|---|---|
| `CHEM_FORMULA_INVALID` | not a formula (brackets, characters) |
| `CHEM_UNKNOWN_ELEMENT` | a symbol that is no element (`Xy2`, `CL`) |
| `CHEM_UNKNOWN_SUBSTANCE` | neither formula nor a name from the database |
| `CHEM_INVALID_CHARGE` | malformed or impossible charge |
| `CHEM_UNIT_MISMATCH` | wrong dimension or unknown unit (`5 g` in `mL`, k in the wrong unit) |
| `CHEM_NO_SOLUTION` | no solution (element on one side only, contradictory data) |
| `CHEM_MULTIPLE_SOLUTIONS` | not unique (several independent balancings, dependent Hess reactions) |
| `CHEM_NEGATIVE_CONCENTRATION` | given or resulting concentration below zero |
| `CHEM_UNBALANCED_REACTION` | typed coefficients that do not balance, where a balanced equation is required |
| `CHEM_MISSING_CONSTANT` | a needed number or constant is missing (K, volume, …) |
| `CHEM_OUTSIDE_MODEL` | the model does not apply (order 5, temperature outside the table, …) |
| `CHEM_DATA_UNAVAILABLE` | the database has nothing for it (no Ksp, no thermodynamic data for that phase) |

Warnings use the same codes; e.g. Henderson–Hasselbalch outside its range is a warning, not an error.

## Formulas

`parseFormula` (`chem/formula.js`) reads brackets (`Ca(OH)2`, `K4[Fe(CN)6]`), charges (`Fe3+`, `Fe^3+`, `SO4^2-`,
`SO42-`, `NH4+`, Unicode `SO₄²⁻`), hydrates (`CuSO4·5H2O`, `CuSO4.5H2O`), isotopes (`13C`, `14CO2`, only where a mass
number is plausible), phase tags (`(s) (l) (g) (aq)`) and the electron (`e-`). The rule that decides `Fe3+` (charge 3)
versus `NH4+` (ammonium) versus `SO42-`: a digit run directly after a single element symbol is a charge; after a longer
body a two-digit tail is index plus charge (`SO42-`), a single digit stays an index (`NH4+`). Write `^` (`Fe^3+`) when in
doubt.

## Units, quantities, precision

Units (`chem/units.js`) are a factor and a vector of exponents of kg, m, s, mol, K, A: `mol/L`, `M`, `mmol/L`,
`J/(mol·K)`, `kJ/mol`, `1/s`, `bar`, `atm`, `Torr`, `°C` … Mixing dimensions is `CHEM_UNIT_MISMATCH`, not a number.
`°C` exists only as a standalone temperature. Conversions are rounded to 15 significant digits.

Everything is calculated with full double precision; rounding happens only when a number is shown. Each result shows 4
significant digits (3 decimals for molar masses). If the given numbers carry fewer significant digits, a step
"Signifikante Stellen" shows the answer rounded accordingly; the value itself is never changed.

## Methods

- **Balancing** (`balance.js`, `rational.js`): atom and charge matrix, exact null space over `BigInt` fractions; a unique
  strictly positive direction, scaled to the smallest whole numbers. Zero or several independent solutions are errors.
- **Stoichiometry** (`stoich.js`): extent ξ = n/ν per reactant; the smallest is the limiting reagent (ties are
  reported); excess, formed masses, gas volumes (ideal gas; without T and p: 0 °C, 101 325 Pa, stated as an
  assumption), yield η. Given products with reactants are read as actual yield, given products alone as targets.
- **Acids and bases** (`acidbase.js`): the charge balance
  `[H⁺] + Σ spectators + Σ C·(mean charge of each acid/base system) − Kw/[H⁺] = 0` has exactly one root (each term
  rises with [H⁺]); bisection on lg [H⁺]. Strong acids/bases, weak, polyprotic (also strong first step, H₂SO₄),
  amphoteric salts, buffers and mixtures with volumes all go through it. School formulas (pH = −lg c,
  pH = ½(pKa − lg c), Henderson–Hasselbalch) are shown next to the exact value and marked valid or not.
  Ideal solutions (activity = concentration).
- **Equilibrium** (`equilibrium.js`): one reaction: `a_i = a_i⁰ + ν_i ξ`, ln Q − ln K rises strictly with ξ, so there is
  one root inside the range where no activity is negative (bisection, with an exact refinement when a reactant nearly
  vanishes). Several reactions: damped Newton on the convex function whose gradient is ln Q − ln K, started inside the
  positive region. Pure solids and liquids have activity 1. Kp with p/p° (bar), Kc with c/c°.
- **Solubility** (`ksp.js`): the ion product rises with the dissolved amount; common ions, fixed pH (OH⁻ fixed,
  anions of weak acids protonated), precipitation on mixing (Q vs Ksp, amount precipitated).
- **Redox** (`oxidation.js`, `redox.js`): oxidation numbers by the school rules (peroxides, superoxides, hydrides,
  average numbers, Fe₃O₄ = +8/3); the half-reactions are balanced with H₂O, H⁺ (or OH⁻) and e⁻ as an exact null-space
  problem, the electrons matched and the halves added. Skeletons that do not split into one oxidation and one
  reduction are balanced as a whole and say so.
- **Electrochemistry** (`electro.js`): 51 standard potentials; cell = higher potential is the cathode; Nernst with
  activities; ΔG° = −zFE°, K = exp(zFE°/RT); Faraday's laws for m, t, I or a gas volume.
- **Thermodynamics** (`thermo.js`): ΔH°, ΔS°, ΔG° from formation data (per phase), ΔG = ΔH − TΔS at other
  temperatures (assumption stated), K = exp(−ΔG°/RT), switching temperature; Hess: the target as an exact rational
  combination of given reactions; van 't Hoff.
- **Kinetics** (`kinetics.js`): integrated laws of order 0–3, half-life, k with unit check; the order from data (best
  straight line among c, ln c, 1/c, 1/c² against t, with R²); Arrhenius from two values, forwards, or a fitted series.
- **Gases** (`gas.js`): ideal gas for any missing quantity, Boyle, Charles, Gay-Lussac, Avogadro, combined law,
  molar volume, density; van der Waals for p, T, n, and V (the roots of the cubic; below the critical temperature the
  larger root is the gas and the others are reported).
- **Titration** (`titration.js`): every point of the curve is the exact charge-balance solution of the mixture
  (analyte and strong titrant, volumes added); equivalence points are the volumes k·n₀/c where the curve is clearly
  steeper than in the buffer region; half-equivalence pH, indicators whose transition range fits the jump.
- **Plots** (`plots.js`): titration curve, concentration–time, linearisation, Arrhenius line, distribution diagram,
  p–V isotherm. The result carries its shapes; the graphics view draws them like any other chart.

## Data

All data is local JSON in `chem/data/`, each file with `version`, `source` and `reference`:

| File | Content | Source |
|---|---|---|
| `elements.json` | 118 elements: mass, electronegativity, common oxidation states, names (DE/EN) | IUPAC abridged atomic weights (sulphur 32,066 as in the CRC Handbook), Pauling EN |
| `isotopes.json` | nuclide masses of the isotopes named at school | AME2016 / NUBASE2016 (Wang et al. 2017) |
| `substances.json` | 242 substances: formula, name, phase, ΔfH°, ΔfG°, S°, pKa/pKb, Ksp, ions, density | NIST WebBook, CRC Handbook (298,15 K) |
| `redox.json` | 51 standard potentials | CRC Handbook |
| `gases.json` | van der Waals a, b | CRC Handbook |

A property a substance does not have is absent; asking for it gives `CHEM_DATA_UNAVAILABLE`, never an invented number.
To add a substance, add it to `substances.json` (`test/chem/data-units.test.mjs` checks charge and atom balance of the
ions, positive Ksp, ordered pKa).

## User interface

- **Keyboard**: the layer "Chemie" of the formula keyboard: `H₂ O₂ N₂ CO₂ SO₄²⁻ NH₄⁺`, `→ ⇌ ↑ ↓ Δ e⁻`, units
  `mol g L mL M K °C bar`, `pH Ka Kb Ksp E° ΔH ΔG`, sub- and superscripts.
- **Reaction editor**: while a row holds a reaction equation, the buttons *Ausgleichen*, *Stöchiometrie*, *Redox*,
  *Thermodynamik* appear under it.
- **Results**: answer, named values, the working (foldable), warnings, assumptions, sources; buttons for the next
  step; ↳ takes the number into a new row.
- **Diagrams**: commands with a plot appear in the graphics view.

## Tests

`cd cas/app && npm test` runs all suites (about 130 tests); `test/chem/*.test.mjs` needs no Giac:

- `formula`, `data-units` (elements, database consistency, units, quantities, number formatting)
- `balance`, `stoich`, `acidbase`, `equilibrium`, `redox`, `physical` (electrochemistry, thermodynamics, kinetics,
  gases, titration, diagrams, numerics)
- `commands` with `golden.json`: every documented command runs its own example; golden values are computed
  independently of the engine (textbook value or closed formula); error codes; LaTeX; intents.
- `test/chemistry.test.mjs`: the chemistry inside the calculator's engine with Giac; mathematics unchanged.
- `test/ui/chemistry.mjs`: the page in Chromium (input, results, diagram in the graphics, reaction editor, keyboard).

Properties are tested as invariants, not only as examples: balanced equations conserve every element and the charge;
the acid-base solution satisfies the charge balance; equilibrium concentrations satisfy the mass action law and are
never negative; the sum of oxidation numbers is the charge for every formula of the database; titration curves rise
monotonically.

## Known limitations

- Ideal solutions: activities equal concentrations; no ionic-strength corrections.
- Metal-ion hydrolysis (Fe³⁺, Al³⁺) and complexation are not part of the acid-base model (a warning is shown);
  complexes can be written as equilibria (`gleichgewicht`).
- Thermodynamic data is tabulated for 298,15 K only; other temperatures assume constant ΔH° and ΔS° (stated), and phase
  changes between are not modelled.
- Acid constants are 25 °C values; `Kw(T)` is tabulated for 0–100 °C.
- Oxidation numbers follow the school rules; unusual structures (many peroxo bridges, clusters) may be refused with
  `CHEM_OUTSIDE_MODEL`. Equations with several independent redox couples are balanced as a whole, without separate
  half-reactions.
- Titration: strong titrants only; a single analyte system.
- Kinetics: orders 0–3 (integer); no mechanisms or parallel reactions.
- Gas volumes without T and p use 0 °C and 101 325 Pa; the ideal gas law is used unless van der Waals is asked for.
- The German intent parser understands a fixed set of phrases, not free language.
- The database holds common school substances (242), not a general compound library.
