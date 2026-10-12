// The shared course texts must be identical to the Swift strings they are exported from.
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const script = resolve(__dirname, '../../../scripts/export-courses.mjs');

describe('content/courses', () => {
  it('matches the Swift sources', () => {
    expect(() => execFileSync('node', [script, '--check'], { stdio: 'pipe' })).not.toThrow();
  });
});
