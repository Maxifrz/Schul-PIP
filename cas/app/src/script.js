// Scripts on objects: what happens when an object is tapped or changes, and when a button (knopf) is pressed.
// One command per line, in German:
//
//   a = a + 1                 setze a = 3 · setze A = (2|3)
//   zeige P · verstecke P     erzeuge Q(1|2) · lösche Q
//   starte a · stoppe a       starte alle · stoppe alle · zurücksetzen
//   meldung Treffer bei {a}   wenn a > 5 dann setze a = 0 sonst meldung weiter
//
// The app hands in what the commands do (`api`); this file only reads the lines.

export const SCRIPT_HELP = [
  ['a = a + 1', 'Wert eines Reglers oder einer Variablen setzen (auch: setze a = 3)'],
  ['setze A = (2|3)', 'Punkt versetzen'],
  ['zeige P · verstecke P', 'Objekt ein- oder ausblenden'],
  ['erzeuge Q(1|2)', 'neue Zeile (jedes Objekt, jede Rechnung)'],
  ['lösche Q', 'Zeile des Objekts löschen'],
  ['starte a · stoppe a', 'Animation eines Reglers (oder: alle)'],
  ['zurücksetzen', 'alle Regler und Punkte auf den Anfang'],
  ['meldung Text {a}', 'kurze Meldung; {…} wird ausgerechnet'],
  ['wenn a > 5 dann … sonst …', 'Bedingung vor einem Befehl'],
];

const NAME = '([A-Za-zÄÖÜäöüß_][\\wÄÖÜäöüß]*)';

/**
 * Runs a script. `api`: set(name, expr) · point(name, x, y) · visible(name, bool) · create(text) · remove(name)
 * · animate(name | null, play) · reset() · message(text) · value(expr) → number · test(expr) → boolean.
 * Returns the lines that failed, with their message.
 */
export function runScript(text, api, depth = 0) {
  const failed = [];
  if (depth > 5) return [{ line: 0, error: 'Skripte rufen sich zu oft gegenseitig auf.' }];
  const lines = String(text || '').split('\n');
  lines.forEach((raw, i) => {
    const line = raw.replace(/(#|\/\/).*$/, '').trim();
    if (!line) return;
    try {
      command(line, api);
    } catch (e) {
      failed.push({ line: i + 1, error: e.message || String(e) });
    }
  });
  return failed;
}

function command(line, api) {
  let m;
  if ((m = /^wenn\s+(.+?)\s+dann\s+(.+?)(?:\s+sonst\s+(.+))?$/i.exec(line))) {
    const yes = api.test(m[1].replace(/([^<>=!:])=(?!=)/g, '$1=='));
    if (yes) command(m[2], api);
    else if (m[3]) command(m[3], api);
    return;
  }
  if ((m = new RegExp(`^(?:setze\\s+)?${NAME}\\s*(?:=|:=|\\s+auf\\s+)\\s*\\(\\s*(.+?)\\s*[|;]\\s*(.+?)\\s*\\)$`, 'i').exec(line))) {
    api.point(m[1], api.value(m[2]), api.value(m[3]));
    return;
  }
  if ((m = new RegExp(`^(?:setze\\s+)?${NAME}\\s*(?:=|:=|\\s+auf\\s+)\\s*(.+)$`, 'i').exec(line))) {
    api.set(m[1], m[2]);
    return;
  }
  if ((m = new RegExp(`^(zeige|verstecke|blende\\s+aus)\\s+${NAME}$`, 'i').exec(line))) {
    api.visible(m[2], m[1].toLowerCase() === 'zeige');
    return;
  }
  if ((m = /^erzeuge\s+(.+)$/i.exec(line))) {
    api.create(m[1]);
    return;
  }
  if ((m = new RegExp(`^(?:lösche|loesche|entferne)\\s+${NAME}$`, 'i').exec(line))) {
    api.remove(m[1]);
    return;
  }
  if ((m = new RegExp(`^(starte|stoppe|stopp|anhalten)\\s+${NAME}$`, 'i').exec(line))) {
    const name = m[2].toLowerCase() === 'alle' ? null : m[2];
    api.animate(name, m[1].toLowerCase() === 'starte');
    return;
  }
  if (/^(zurücksetzen|zuruecksetzen|reset)$/i.test(line)) {
    api.reset();
    return;
  }
  if ((m = /^meldung\s+(.+)$/i.exec(line))) {
    api.message(m[1].replace(/\{([^{}]+)\}/g, (all, expr) => {
      const v = api.value(expr);
      return Number.isFinite(v) ? String(Number(v.toPrecision(10))).replace('.', ',') : all;
    }));
    return;
  }
  throw new Error(`„${line}“ verstehe ich nicht.`);
}
