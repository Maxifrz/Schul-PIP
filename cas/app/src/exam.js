// The exam mode: a fresh, empty project that cannot be left without ending the exam, with a visible banner and
// clock, rules for what the calculator may do (with or without CAS, programs, spreadsheet, 3D), nothing to open,
// save, share or paste in from outside, and everything done during the exam wiped at its end.

export const PROFILES = {
  cas: { label: 'Mit CAS', text: 'Alles Rechnen erlaubt, auch exakt und symbolisch.' },
  gtr: { label: 'Ohne CAS (GTR)', text: 'Nur Zahlenwerte, wie ein grafikfähiger Taschenrechner: Graphen, Tabellen, Statistik und numerisches Lösen gehen; Ergebnisse mit Variablen (Ableitungen, Umformungen) nicht.' },
  wtr: { label: 'Wissenschaftlich (WTR)', text: 'Nur Zahlenwerte, ohne Grafik, 3D und Tabelle.' },
};

export const DEFAULT_OPTIONS = { programs: false, table: true, space: true };

/** Whether a view may be shown in an exam */
export function viewAllowed(exam, view) {
  if (!exam) return true;
  if (view === 'graph' || view === 'both') return exam.profile !== 'wtr';
  if (view === 'space') return exam.profile !== 'wtr' && exam.options.space;
  if (view === 'table') return exam.profile !== 'wtr' && exam.options.table;
  return true;
}

/** Categories of commands an exam leaves out */
export function blockedCategories(exam) {
  if (!exam) return new Set();
  const out = new Set();
  if (!exam.options.programs) out.add('Programme');
  if (exam.profile !== 'cas') ['Algebra', 'Transformationen', 'Vektoranalysis', 'Differentialgleichungen'].forEach((c) => out.add(c));
  return out;
}

/**
 * Checks a result against the exam rules. Without CAS a result may only be a number (or numbers): exact values
 * show as decimals, anything with a free variable is refused; definitions (f(x) = …, a = 2) stay allowed.
 */
export function examResult(exam, result, hasVariables) {
  if (!exam || exam.profile === 'cas' || !result || !result.ok) return result;
  if (result.kind === 'definition' || result.kind === 'analysis' || result.kind === 'boolean') return result;
  if (hasVariables) return { ok: false, error: 'Im Prüfungsmodus ohne CAS gibt es nur Zahlenwerte.' };
  if (result.approxLatex) return { ...result, latex: result.kind === 'solutions' ? result.approxLatex.replace(/^L\\approx/, 'L=') : result.approxLatex, approxLatex: null };
  return result;
}

export function formatDuration(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const two = (n) => String(n).padStart(2, '0');
  return `${two(Math.floor(s / 3600))}:${two(Math.floor((s % 3600) / 60))}:${two(s % 60)}`;
}
