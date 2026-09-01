/**
 * Unit tests for Grok cwd bucket resolution (HOME symlink / getcwd mismatch).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync, symlinkSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  encodeGrokCwd,
  grokPromptHistoryPath,
  resolveGrokCwdBucketDir,
} from '../src/services/grok-paths.js';

const ROOT = join(tmpdir(), `botmux-grok-paths-${process.pid}`);

describe('resolveGrokCwdBucketDir / symlink cwd', () => {
  beforeEach(() => {
    process.env.GROK_HOME = ROOT;
    rmSync(ROOT, { recursive: true, force: true });
    mkdirSync(ROOT, { recursive: true });
  });
  afterEach(() => {
    rmSync(ROOT, { recursive: true, force: true });
    delete process.env.GROK_HOME;
  });

  it('finds the physical-cwd bucket when botmux holds a HOME-symlink path', () => {
    const physicalHome = join(ROOT, 'data00-home');
    const logicalHome = join(ROOT, 'home');
    mkdirSync(physicalHome, { recursive: true });
    symlinkSync(physicalHome, logicalHome);

    const physicalCwd = join(physicalHome, 'proj');
    const logicalCwd = join(logicalHome, 'proj');
    mkdirSync(physicalCwd, { recursive: true });
    expect(realpathSync(logicalCwd)).toBe(realpathSync(physicalCwd));

    const physicalBucket = join(ROOT, 'sessions', encodeGrokCwd(physicalCwd));
    mkdirSync(physicalBucket, { recursive: true });
    writeFileSync(join(physicalBucket, 'prompt_history.jsonl'), '');

    expect(join(ROOT, 'sessions', encodeGrokCwd(logicalCwd))).not.toBe(physicalBucket);
    expect(existsSync(join(ROOT, 'sessions', encodeGrokCwd(logicalCwd)))).toBe(false);

    expect(resolveGrokCwdBucketDir(logicalCwd)).toBe(physicalBucket);
    expect(grokPromptHistoryPath(logicalCwd)).toBe(join(physicalBucket, 'prompt_history.jsonl'));
    expect(existsSync(grokPromptHistoryPath(logicalCwd))).toBe(true);
  });

  it('predicts Grok getcwd() bucket when nothing exists on disk yet', () => {
    const physicalHome = join(ROOT, 'data00-home-empty');
    const logicalHome = join(ROOT, 'home-empty');
    mkdirSync(physicalHome, { recursive: true });
    symlinkSync(physicalHome, logicalHome);

    const physicalCwd = join(physicalHome, 'proj');
    const logicalCwd = join(logicalHome, 'proj');
    mkdirSync(physicalCwd, { recursive: true });

    expect(resolveGrokCwdBucketDir(logicalCwd)).toBe(
      join(ROOT, 'sessions', encodeGrokCwd(physicalCwd)),
    );
  });

  it('matches a hashed .cwd marker written with the physical path', () => {
    const physicalHome = join(ROOT, 'data00-home-hash');
    const logicalHome = join(ROOT, 'home-hash');
    mkdirSync(physicalHome, { recursive: true });
    symlinkSync(physicalHome, logicalHome);

    const physicalCwd = join(physicalHome, 'long-proj');
    const logicalCwd = join(logicalHome, 'long-proj');
    mkdirSync(physicalCwd, { recursive: true });

    const hashBucket = join(ROOT, 'sessions', 'phys-hash-abcd');
    mkdirSync(hashBucket, { recursive: true });
    writeFileSync(join(hashBucket, '.cwd'), physicalCwd + '\n');
    writeFileSync(join(hashBucket, 'prompt_history.jsonl'), '');

    expect(resolveGrokCwdBucketDir(logicalCwd)).toBe(hashBucket);
    expect(existsSync(grokPromptHistoryPath(logicalCwd))).toBe(true);
  });
});
