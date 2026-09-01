import type { ProjectInfo } from '../../services/project-scanner.js';
import type {
  PendingTraexInitialization,
  TraexInitializationMode,
} from '../../core/traex-initialization.js';
import { t, type Locale } from '../../i18n/index.js';

export const TRAEX_INIT_ACTION_START = 'traex_init_start';
export const TRAEX_INIT_ACTION_CANCEL = 'traex_init_cancel';
export const TRAEX_INIT_ACTION_MANUAL_SELECT = 'traex_init_manual_select';
export const TRAEX_INIT_ACTION_WORKTREE_MULTI_SELECT = 'traex_init_worktree_multi_select';
export const TRAEX_INIT_KEY_TARGET = 'traex_init_target';
export const TRAEX_INIT_KEY_MODE = 'traex_init_mode';

type SelectOption = { text: { tag: 'plain_text'; content: string }; value: string };

function actionValue(
  action: string,
  rootId: string,
  nonce: string,
  extra?: Record<string, unknown>,
): Record<string, unknown> {
  return { action, root_id: rootId, nonce, ...extra };
}

function selectValue(key: string, rootId: string, nonce: string): Record<string, unknown> {
  return { key, root_id: rootId, nonce };
}

function submitButton(rootId: string, nonce: string, locale?: Locale): Record<string, unknown> {
  return {
    tag: 'button',
    name: 'traex_init_start',
    text: { tag: 'plain_text', content: t('card.traex_init.start', undefined, locale) },
    type: 'primary',
    action_type: 'form_submit',
    value: actionValue(TRAEX_INIT_ACTION_START, rootId, nonce),
  };
}

function worktreeMultiForm(worktreeOptions: SelectOption[], rootId: string, nonce: string, locale?: Locale): Record<string, unknown> {
  return {
    tag: 'form',
    name: 'repo_worktree_submit_form',
    elements: [
      {
        tag: 'column_set',
        flex_mode: 'none',
        horizontal_spacing: 'default',
        columns: [
          {
            tag: 'column',
            width: 'weighted',
            weight: 2,
            vertical_align: 'center',
            elements: [{
              tag: 'multi_select_static',
              name: 'repo_worktree_paths',
              required: true,
              width: 'fill',
              placeholder: { tag: 'plain_text', content: t('card.repo.placeholder_worktree_multi', undefined, locale) },
              options: worktreeOptions,
            }],
          },
          {
            tag: 'column',
            width: 'weighted',
            weight: 1,
            vertical_align: 'center',
            elements: [{
              tag: 'input',
              name: 'repo_worktree_branch',
              placeholder: { tag: 'plain_text', content: t('card.repo.worktree_branch_placeholder', undefined, locale) },
            }],
          },
          {
            tag: 'column',
            width: 'auto',
            vertical_align: 'center',
            elements: [{
              tag: 'button',
              name: 'repo_worktree_submit',
              text: { tag: 'plain_text', content: t('card.btn.worktree_repo', undefined, locale) },
              type: 'default',
              action_type: 'form_submit',
              value: actionValue(TRAEX_INIT_ACTION_WORKTREE_MULTI_SELECT, rootId, nonce),
            }],
          },
        ],
      },
    ],
  };
}

export function buildTraexInitializationCard(input: {
  rootId: string;
  pending: PendingTraexInitialization;
  projects: ProjectInfo[];
  locale?: Locale;
  multiPicker?: boolean;
  forgeAvailable?: boolean;
}): string {
  const { rootId, pending, projects, locale, multiPicker, forgeAvailable = true } = input;
  const repoOptions = projects.map((project, index) => ({
    text: {
      tag: 'plain_text',
      content: `📁 ${index + 1}. ${project.name} (${project.branch})${project.type === 'worktree' ? ' [worktree]' : ''}`,
    },
    value: `dir:${project.path}`,
  }));
  const worktreeOptions = projects
    .filter(project => project.type === 'repo')
    .map(project => ({
      text: { tag: 'plain_text' as const, content: `🌿 ${project.name} (${project.branch})` },
      value: project.path,
    }));
  const modeOptions = [
    { text: { tag: 'plain_text', content: t('card.traex_init.start_traex', undefined, locale) }, value: 'traex' },
    { text: { tag: 'plain_text', content: t('card.traex_init.start_pipeline', undefined, locale) }, value: 'forge-pipeline' },
    { text: { tag: 'plain_text', content: t('card.traex_init.start_pilot', undefined, locale) }, value: 'forge-pilot' },
  ] satisfies Array<{ text: { tag: 'plain_text'; content: string }; value: TraexInitializationMode }>;

  const selectedPath = pending.selection.kind === 'worktree'
    ? pending.selection.repoPaths[0]
    : pending.selection.path;
  const selectedTarget = `dir:${selectedPath}`;
  const selectedMode = pending.mode ?? 'traex';
  const selectedLabel = pending.selection.kind === 'worktree'
    ? t('card.traex_init.selection_worktree', { name: pending.selection.label }, locale)
    : pending.selection.kind === 'auto-worktree'
      ? t('card.traex_init.selection_auto_worktree', { path: pending.selection.path }, locale)
      : pending.selection.label;

  const elements: Record<string, unknown>[] = [
    {
      tag: 'markdown',
      content: t('card.traex_init.intro', undefined, locale),
    },
    {
      tag: 'markdown',
      content: `${t('card.traex_init.selected_dir', undefined, locale)} **${selectedLabel}**`,
    },
    ...(repoOptions.length > 0 ? [{
      tag: 'action',
      actions: [{
        tag: 'select_static',
        initial_option: repoOptions.some(option => option.value === selectedTarget) ? selectedTarget : undefined,
        placeholder: { tag: 'plain_text', content: t('card.traex_init.repo_placeholder', undefined, locale) },
        options: repoOptions,
        value: selectValue(TRAEX_INIT_KEY_TARGET, rootId, pending.nonce),
      }],
    }] : []),
    ...(worktreeOptions.length > 0 ? (multiPicker ? [
      worktreeMultiForm(worktreeOptions, rootId, pending.nonce, locale),
      ...(worktreeOptions.length > 1 ? [{
        tag: 'column_set',
        flex_mode: 'none',
        horizontal_spacing: 'default',
        columns: [
          {
            tag: 'column',
            width: 'weighted',
            weight: 1,
            vertical_align: 'center',
            elements: [{ tag: 'div', text: { tag: 'lark_md', content: t('card.repo.worktree_now_multi', undefined, locale) } }],
          },
          {
            tag: 'column',
            width: 'auto',
            vertical_align: 'center',
            elements: [{
              tag: 'button',
              text: { tag: 'plain_text', content: t('card.btn.worktree_to_single', undefined, locale) },
              type: 'default',
              value: { action: 'worktree_toggle_mode', root_id: rootId },
            }],
          },
        ],
      }] : []),
    ] : [{
      tag: 'column_set',
      flex_mode: 'none',
      horizontal_spacing: 'default',
      columns: [
        {
          tag: 'column',
          width: 'weighted',
          weight: 1,
          vertical_align: 'center',
          elements: [{
            tag: 'select_static',
            placeholder: { tag: 'plain_text', content: t('card.repo.placeholder_worktree', undefined, locale) },
            options: worktreeOptions.map(option => ({ ...option, value: `worktree:${option.value}` })),
            value: selectValue(TRAEX_INIT_KEY_TARGET, rootId, pending.nonce),
          }],
        },
        ...(worktreeOptions.length > 1 ? [{
          tag: 'column',
          width: 'auto',
          vertical_align: 'center',
          elements: [{
            tag: 'button',
            text: { tag: 'plain_text', content: t('card.btn.worktree_to_multi', undefined, locale) },
            type: 'default',
            value: { action: 'worktree_toggle_mode', root_id: rootId },
          }],
        }] : []),
      ],
    }]) : []),
    {
      tag: 'form',
      name: 'traex_manual_path_form',
      elements: [
        {
          tag: 'column_set',
          flex_mode: 'none',
          horizontal_spacing: 'default',
          columns: [
            {
              tag: 'column',
              width: 'weighted',
              weight: 1,
              vertical_align: 'center',
              elements: [{
                tag: 'input',
                name: 'traex_init_manual_path',
                placeholder: { tag: 'plain_text', content: t('card.repo.manual_placeholder', undefined, locale) },
              }],
            },
            {
              tag: 'column',
              width: 'auto',
              vertical_align: 'center',
              elements: [{
                tag: 'button',
                name: 'traex_init_manual_submit',
                text: { tag: 'plain_text', content: t('card.btn.manual_repo', undefined, locale) },
                type: 'default',
                action_type: 'form_submit',
                value: actionValue(TRAEX_INIT_ACTION_MANUAL_SELECT, rootId, pending.nonce),
              }],
            },
          ],
        },
      ],
    },
    ...(forgeAvailable ? [{
      tag: 'action',
      actions: [{
        tag: 'select_static',
        initial_option: selectedMode,
        placeholder: { tag: 'plain_text', content: t('card.traex_init.mode_placeholder', undefined, locale) },
        options: modeOptions,
        value: selectValue(TRAEX_INIT_KEY_MODE, rootId, pending.nonce),
      }],
    }] : []),
    {
      tag: 'form',
      name: 'traex_initialization_form',
      elements: [
        {
          tag: 'input',
          name: 'initial_prompt',
          default_value: pending.originalPrompt,
          placeholder: { tag: 'plain_text', content: t('card.traex_init.prompt_placeholder', undefined, locale) },
          input_type: 'multiline_text',
        },
        submitButton(rootId, pending.nonce, locale),
      ],
    },
    {
      tag: 'action',
      actions: [{
        tag: 'button',
        text: { tag: 'plain_text', content: t('card.traex_init.cancel', undefined, locale) },
        type: 'danger',
        value: actionValue(TRAEX_INIT_ACTION_CANCEL, rootId, pending.nonce),
      }],
    },
  ];

  return JSON.stringify({
    config: { wide_screen_mode: true },
    header: {
      template: 'blue',
      title: { tag: 'plain_text', content: t('card.traex_init.title', undefined, locale) },
    },
    elements,
  });
}

export function buildTraexInitializationCancelledCard(locale?: Locale): string {
  return JSON.stringify({
    config: { wide_screen_mode: true },
    header: {
      template: 'grey',
      title: { tag: 'plain_text', content: t('card.traex_init.cancelled_title', undefined, locale) },
    },
    elements: [
      { tag: 'markdown', content: t('card.traex_init.cancelled_body', undefined, locale) },
    ],
  });
}
