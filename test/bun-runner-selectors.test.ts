import { describe, expect, it } from 'vitest';

/**
 * Guards the source-text selectors in `scripts/run-bun-tests.mjs` that decide which
 * files the bun leg may run.
 *
 * WHY: a selector that is too narrow SILENTLY SKIPS files (the population count
 * still looks healthy — this repo has already shipped that bug three times: a
 * comment-matching over-exclusion, a bare `\binject\b` that deferred 20 innocent
 * files, and a name-based mock-factory pattern that missed a callback spelled
 * `orig`). One that is too broad quietly drops files that would otherwise run. Both
 * failure modes are invisible in the summary line, so the selectors need their own
 * two-sided guard.
 *
 * Kept as literal copies of the runner's regexes rather than imported: the runner is
 * a plain `.mjs` script with top-level `await` and side effects at import time, so
 * importing it here would execute a test run. The `keeps this in sync` case below is
 * what catches drift between the two copies.
 */

const UNSUPPORTED = /\bvi\s*\.\s*(doMock|doUnmock|resetModules|hoisted)\b|\bimportOriginal\b|\bimportActual\b/;
const IMPORTS_INJECT = /import\s*\{[^}]*\binject\b[^}]*\}\s*from\s*['"]vitest['"]/s;
const MOCK_FACTORY_TAKES_ORIGINAL =
  /\bvi\s*\.\s*mock\s*\([^,]+,\s*(?:async\s*)?\(\s*[A-Za-z_$][\w$]*/;

function excluded(source: string): boolean {
  return UNSUPPORTED.test(source) || IMPORTS_INJECT.test(source)
    || MOCK_FACTORY_TAKES_ORIGINAL.test(source);
}

describe('bun runner exclusion selectors', () => {
  it.each([
    // The feature is defined by SHAPE — a factory that takes the original-module
    // argument — not by what the parameter happens to be called.
    ['vi.mock factory taking the original under the conventional name', "vi.mock('./x.js', async (importOriginal) => ({}));"],
    ['…under a non-conventional name (the case that leaked to CI)', "vi.mock('./x.js', async (orig) => ({}));"],
    ['…without async', "vi.mock('./x.js', (importOriginal) => ({}));"],
    ['vi.doMock at all', "vi.doMock('./x.js', () => ({}));"],
    ['vi.resetModules at all', 'vi.resetModules();'],
    ['vi.hoisted at all', 'const v = vi.hoisted(() => 1);'],
    ['a named import of inject from vitest', "import { it, inject } from 'vitest';"],
  ])('excludes: %s', (_label, source) => {
    expect(excluded(source)).toBe(true);
  });

  it.each([
    // The supported form: a factory that does NOT ask for the original module.
    ['zero-argument mock factory', "vi.mock('./x.js', () => ({ a: 1 }));"],
    ['zero-argument async factory', "vi.mock('./x.js', async () => ({ a: 1 }));"],
    ['bare vi.mock with no factory', "vi.mock('./x.js');"],
    // Ordinary callbacks must not be mistaken for a mock factory.
    ['an unrelated callback after a vi.mock', "vi.mock('./x.js');\narr.map((item) => item + 1);"],
    ['vi.fn with a parameter', 'const f = vi.fn((a) => a);'],
    ['spyOn mockImplementation', "vi.spyOn(o, 'm').mockImplementation((x) => x);"],
    ['mockImplementation after a bare vi.mock', "vi.mock('./x.js');\nthing.mockImplementation((v) => v);"],
    // Prose must never decide whether a file runs.
    ['the word inject in a test title', "it('does not inject anything', () => {});"],
    ['a script name containing inject', "const s = 'inject-optional-binaries.mjs';"],
  ])('keeps runnable: %s', (_label, source) => {
    expect(excluded(source)).toBe(false);
  });

  it('keeps this file in sync with the runner script', async () => {
    const { readFileSync } = await import('node:fs');
    const runner = readFileSync('scripts/run-bun-tests.mjs', 'utf8');
    // If the runner's regexes are edited without updating the copies above, this
    // fails — which is the point. Compare source text, not behaviour, so a changed
    // pattern is caught even when both happen to agree on today's corpus.
    for (const re of [UNSUPPORTED, IMPORTS_INJECT, MOCK_FACTORY_TAKES_ORIGINAL]) {
      expect(runner).toContain(re.source);
    }
  });
});
