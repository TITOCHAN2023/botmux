import { describe, expect, it } from 'vitest';
import { buildTraexInitializationCard } from '../src/im/lark/traex-initialization-card.js';
import type { PendingTraexInitialization } from '../src/core/traex-initialization.js';
import type { ProjectInfo } from '../src/services/project-scanner.js';

function walk(node: unknown, out: Record<string, unknown>[] = []): Record<string, unknown>[] {
  if (!node || typeof node !== 'object') return out;
  const record = node as Record<string, unknown>;
  out.push(record);
  for (const value of Object.values(record)) {
    if (Array.isArray(value)) value.forEach(item => walk(item, out));
    else if (value && typeof value === 'object') walk(value, out);
  }
  return out;
}

describe('TraeX 统一初始化卡', () => {
  const pending: PendingTraexInitialization = {
    nonce: 'nonce-1',
    ownerOpenId: 'ou_owner',
    originalPrompt: '帮我实现统一初始化卡',
    promptPrefix: '',
    selection: {
      kind: 'directory',
      path: '/repo/alpha',
      label: 'alpha (main)',
      pinWorkingDir: true,
    },
  };
  const projects: ProjectInfo[] = [
    { name: 'alpha', path: '/repo/alpha', type: 'repo', branch: 'main' },
    { name: 'gamma', path: '/repo/gamma', type: 'repo', branch: 'main' },
    { name: 'beta', path: '/repo/beta', type: 'worktree', branch: 'feat/beta' },
  ];

  it('保留最新版 repo 卡的目录能力，并额外提供 Forge 启动方式', () => {
    const card = JSON.parse(buildTraexInitializationCard({
      rootId: 'om_root',
      pending,
      projects,
      locale: 'zh',
    }));
    const nodes = walk(card);

    const targetSelects = nodes.filter(node =>
      node.tag === 'select_static'
      && (node.value as Record<string, unknown> | undefined)?.key === 'traex_init_target');
    expect(targetSelects).toHaveLength(2);
    expect((targetSelects[0]?.options as Array<Record<string, unknown>>).map(option => option.value))
      .toEqual(['dir:/repo/alpha', 'dir:/repo/gamma', 'dir:/repo/beta']);
    expect((targetSelects[1]?.options as Array<Record<string, unknown>>).map(option => option.value))
      .toEqual(['worktree:/repo/alpha', 'worktree:/repo/gamma']);

    const worktreeToggle = nodes.find(node =>
      node.tag === 'button'
      && (node.value as Record<string, unknown> | undefined)?.action === 'worktree_toggle_mode');
    expect(worktreeToggle).toBeDefined();

    const manualForm = nodes.find(node => node.tag === 'form' && node.name === 'traex_manual_path_form');
    expect(manualForm).toBeDefined();
    expect(nodes.find(node => node.tag === 'input' && node.name === 'traex_init_manual_path')).toBeDefined();
    expect(nodes.find(node =>
      node.tag === 'button'
      && (node.value as Record<string, unknown> | undefined)?.action === 'traex_init_manual_select')).toBeDefined();

    const mode = nodes.find(node =>
      node.tag === 'select_static'
      && (node.value as Record<string, unknown> | undefined)?.key === 'traex_init_mode');
    expect(mode).toMatchObject({ initial_option: 'traex' });
    expect((mode?.options as Array<Record<string, unknown>>).map(option => option.value))
      .toEqual(['traex', 'forge-pipeline', 'forge-pilot']);
    expect(nodes.find(node => node.tag === 'input' && node.name === 'initial_prompt')).toMatchObject({
      default_value: pending.originalPrompt,
      input_type: 'multiline_text',
    });

    expect(nodes.find(node =>
      node.action_type === 'form_submit'
      && (node.value as Record<string, unknown> | undefined)?.action === 'traex_init_start')).toMatchObject({
      name: 'traex_init_start',
      value: { action: 'traex_init_start' },
    });
  });

  it('路径/运行方式控件在启动表单外暂存，启动表单只提交提示词和启动动作', () => {
    const card = JSON.parse(buildTraexInitializationCard({
      rootId: 'om_root',
      pending,
      projects,
      locale: 'zh',
    }));
    const nodes = walk(card);
    const form = nodes.find(node => node.tag === 'form' && node.name === 'traex_initialization_form')!;
    const formNodes = walk(form);

    expect(formNodes.find(node => node.tag === 'select_static')).toBeUndefined();
    expect(formNodes.find(node => node.tag === 'input' && node.name === 'traex_init_manual_path')).toBeUndefined();
    expect(formNodes.find(node => node.tag === 'input' && node.name === 'initial_prompt')).toBeDefined();
    expect(formNodes.find(node => node.action_type === 'form_submit')).toBeDefined();
  });

  it('Forge 不可用时不渲染启动方式选择框', () => {
    const card = JSON.parse(buildTraexInitializationCard({
      rootId: 'om_root',
      pending,
      projects,
      locale: 'zh',
      forgeAvailable: false,
    }));
    const nodes = walk(card);

    expect(nodes.find(node =>
      node.tag === 'select_static'
      && (node.value as Record<string, unknown> | undefined)?.key === 'traex_init_mode')).toBeUndefined();
    expect(nodes.find(node => node.tag === 'input' && node.name === 'initial_prompt')).toBeDefined();
    expect(nodes.find(node =>
      node.action_type === 'form_submit'
      && (node.value as Record<string, unknown> | undefined)?.action === 'traex_init_start')).toBeDefined();
  });

  it('多仓模式渲染 multi_select 表单，但仍保留启动表单', () => {
    const card = JSON.parse(buildTraexInitializationCard({
      rootId: 'om_root',
      pending,
      projects,
      locale: 'zh',
      multiPicker: true,
    }));
    const nodes = walk(card);

    const multiSelect = nodes.find(node => node.tag === 'multi_select_static' && node.name === 'repo_worktree_paths');
    expect(multiSelect).toBeDefined();
    expect((multiSelect?.options as Array<Record<string, unknown>>).map(option => option.value))
      .toEqual(['/repo/alpha', '/repo/gamma']);
    expect(nodes.find(node => node.tag === 'input' && node.name === 'repo_worktree_branch')).toBeDefined();
    expect(nodes.find(node =>
      node.tag === 'button'
      && (node.value as Record<string, unknown> | undefined)?.action === 'traex_init_worktree_multi_select')).toBeDefined();
    expect(nodes.find(node => node.tag === 'form' && node.name === 'traex_initialization_form')).toBeDefined();
  });

  it('使用稳定的 config/elements 卡片结构，启动表单不嵌套布局容器', () => {
    const card = JSON.parse(buildTraexInitializationCard({
      rootId: 'om_root',
      pending,
      projects,
      locale: 'zh',
    }));
    const nodes = walk(card);
    const form = nodes.find(node => node.tag === 'form' && node.name === 'traex_initialization_form')!;
    const formNodes = walk(form);

    expect(card.schema).toBeUndefined();
    expect(card.body).toBeUndefined();
    expect(Array.isArray(card.elements)).toBe(true);
    expect(formNodes.find(node => node.tag === 'column_set')).toBeUndefined();
    expect(JSON.stringify(card)).not.toContain('primary_filled');
  });
});
