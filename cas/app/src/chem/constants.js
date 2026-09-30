// Physical constants (CODATA 2018) and the standard state used by the engine. Each has its source, so a result can say
// where a number came from.

export const CONSTANTS = Object.freeze({
  R: { value: 8.314462618, unit: 'J/(mol·K)', name: 'universelle Gaskonstante', source: 'CODATA 2018' },
  F: { value: 96485.33212, unit: 'C/mol', name: 'Faraday-Konstante', source: 'CODATA 2018' },
  NA: { value: 6.02214076e23, unit: '1/mol', name: 'Avogadro-Konstante', source: 'SI 2019 (exakt)' },
  kB: { value: 1.380649e-23, unit: 'J/K', name: 'Boltzmann-Konstante', source: 'SI 2019 (exakt)' },
  e: { value: 1.602176634e-19, unit: 'C', name: 'Elementarladung', source: 'SI 2019 (exakt)' },
});

/** 25 °C, 1 bar: the standard state of the thermodynamic tables */
export const STANDARD = Object.freeze({ T: 298.15, p: 1e5, c: 1000 /* mol/m³ = 1 mol/L */ });
/** Normal conditions of gas volumes in schools: 0 °C, 101 325 Pa */
export const NORMAL = Object.freeze({ T: 273.15, p: 101325 });
/** Ion product of water at 25 °C */
export const KW_25 = 1e-14;
export const DEFAULT_TEMPERATURE = 298.15;
