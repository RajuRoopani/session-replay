// src/render-term.mjs — ANSI terminal fallback renderer

import { formatDuration } from './parse.mjs';
import { summarize } from './analyze.mjs';

const C = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  dim:    '\x1b[2m',
  red:    '\x1b[31m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  blue:   '\x1b[34m',
  magenta:'\x1b[35m',
  cyan:   '\x1b[36m',
  gray:   '\x1b[90m',
  orange: '\x1b[38;5;214m',
};

const TOOL_COLORS = {
  Bash:     C.yellow,
  Edit:     C.blue,
  Write:    C.green,
  Read:     C.gray,
  Glob:     C.gray,
  Grep:     C.gray,
  WebFetch: C.magenta,
  Task:     C.magenta,
  user:     C.orange,
  thinking: C.gray,
};

export function renderTerminal(events, meta, sessionInfo) {
  const summary = summarize(events, meta);
  const project = sessionInfo?.project ?? 'session';
  const date    = new Date(meta.startTime || Date.now()).toISOString().substring(0, 10);

  const lines = [];

  // Header
  lines.push('');
  lines.push(C.bold + 'Session Replay — ' + project + ' — ' + date + C.reset);
  lines.push(C.gray + '━'.repeat(60) + C.reset);

  // Events
  for (const ev of events) {
    if (ev.isBranchPoint) {
      lines.push(C.orange + '  ─── ⑂  User intervened ───' + C.reset);
    }

    const numStr  = String(ev.step).padStart(3, ' ');
    const toolKey = ev.type === 'user' ? 'user' : ev.type === 'thinking' ? 'thinking' : (ev.tool?.name ?? '');
    const color   = TOOL_COLORS[toolKey] ?? C.reset;
    const summary = termSummary(ev);
    const dur     = ev.durationMs ? C.gray + ' ' + formatDuration(ev.durationMs) + C.reset : '';
    const failed  = ev.failed ? C.red + ' ❌ FAILED' + C.reset : '';

    lines.push(
      C.gray + numStr + C.reset + '  ' +
      color + toolKey.padEnd(10) + C.reset + ' ' +
      summary + dur + failed
    );
  }

  // Footer
  lines.push(C.gray + '━'.repeat(60) + C.reset);
  lines.push(
    C.dim +
    summary.totalSteps + ' steps  ' +
    (summary.filesEdited?.length ?? 0) + ' files  ' +
    summary.errorCount + ' errors  ' +
    formatDuration(summary.durationMs) +
    C.reset
  );
  lines.push('');

  process.stdout.write(lines.join('\n') + '\n');
}

function termSummary(ev) {
  if (ev.type === 'user')     return (ev.text ?? '').substring(0, 70);
  if (ev.type === 'thinking') return C.gray + '(thinking)' + C.reset;
  const t = ev.tool;
  if (!t) return '';
  const n = t.name;
  if (n === 'Bash')    return (t.input.description || t.input.command || '').substring(0, 70);
  if (n === 'Edit' || n === 'Write') return (t.input.file_path ?? '').split('/').pop();
  if (n === 'Read')    return (t.input.file_path ?? '').split('/').pop();
  if (n === 'Glob')    return t.input.pattern ?? '';
  if (n === 'Grep')    return t.input.pattern ?? '';
  if (n === 'WebFetch') return (t.input.url ?? '').substring(0, 60);
  return JSON.stringify(t.input).substring(0, 60);
}
