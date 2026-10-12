#!/usr/bin/env node
// The language courses are written once, as Swift multiline strings in Lernwerk/Services/Learn/Languages/*/*Course.swift.
// Desktop and Android read the same text from content/courses/<id>.txt. This script writes those files from the Swift
// sources, and with --check fails if a file differs from its Swift string, so the copies cannot drift apart.
//
// A file is the Swift string plus one final newline (the string itself ends without one).
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const languages = join(root, 'Lernwerk/Services/Learn/Languages');
const target = join(root, 'content/courses');

/** The text of `static let source = """ ... """`, with the indentation of the closing delimiter removed as Swift does. */
export function swiftSource(file) {
  const lines = readFileSync(file, 'utf8').split('\n');
  const start = lines.findIndex((line) => /static let source = """\s*$/.test(line));
  if (start < 0) throw new Error(`${file}: no multiline source string`);
  const end = lines.findIndex((line, index) => index > start && /^\s*"""\s*$/.test(line));
  if (end < 0) throw new Error(`${file}: the string is not closed`);
  const indent = lines[end].match(/^(\s*)"""/)[1];
  const body = lines.slice(start + 1, end).map((line) => {
    if (line.trim() === '') return '';
    if (!line.startsWith(indent)) throw new Error(`${file}: a line is indented less than the closing delimiter`);
    return line.slice(indent.length);
  });
  if (body.some((line) => line.includes('\\') || line.includes('"""'))) throw new Error(`${file}: backslash or triple quote in the course text`);
  return body.join('\n');
}

export function courseSources() {
  const found = [];
  for (const folder of readdirSync(languages, { withFileTypes: true })) {
    if (!folder.isDirectory()) continue;
    for (const name of readdirSync(join(languages, folder.name))) {
      if (!name.endsWith('Course.swift')) continue;
      const text = swiftSource(join(languages, folder.name, name));
      const id = text.match(/^course:\s*(\S+)\s*$/m)?.[1];
      if (!id) throw new Error(`${name}: no course: line`);
      found.push({ id, text: text + '\n', swift: `Lernwerk/Services/Learn/Languages/${folder.name}/${name}` });
    }
  }
  return found.sort((a, b) => a.id.localeCompare(b.id));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes('--check');
  mkdirSync(target, { recursive: true });
  let bad = 0;
  for (const course of courseSources()) {
    const file = join(target, `${course.id}.txt`);
    if (check) {
      if (!existsSync(file) || readFileSync(file, 'utf8') !== course.text) {
        console.error(`content/courses/${course.id}.txt differs from ${course.swift}`);
        bad += 1;
      }
    } else {
      writeFileSync(file, course.text);
      console.log(`wrote content/courses/${course.id}.txt`);
    }
  }
  if (bad > 0) {
    console.error('Run: node scripts/export-courses.mjs');
    process.exit(1);
  }
}
