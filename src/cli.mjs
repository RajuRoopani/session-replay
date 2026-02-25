#!/usr/bin/env node
// src/cli.mjs — session-replay entry point

import { parseTranscript } from './parse.mjs';
import { analyze } from './analyze.mjs';
import { renderHtml, openInBrowser } from './render-html.mjs';
import { renderTerminal } from './render-term.mjs';
import { latestSession, findSession, listAllSessions, listSessions } from './store.mjs';

const [,, command, ...args] = process.argv;

function parseArgs(args) {
  const opts = { terminal: false, positional: [] };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--terminal' || args[i] === '-t') { opts.terminal = true; continue; }
    if (args[i] === '--cwd') { opts.cwd = args[++i]; continue; }
    opts.positional.push(args[i]);
  }
  return opts;
}

const opts = parseArgs(args);
const cwd  = opts.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd();

// ── Route commands ────────────────────────────────────────────────────────────

if (!command || command === 'show') {
  const id      = opts.positional[0];
  const session = id ? findSession(id, cwd) : latestSession(cwd);

  if (!session) {
    console.error('No session found.' + (id ? ` (id: ${id})` : ''));
    console.error('Run "session-replay list" to see available sessions.');
    process.exit(1);
  }

  await replay(session, opts);

} else if (command === 'list') {
  const sessions = listAllSessions();

  if (!sessions.length) {
    console.log('No sessions found in ~/.claude/projects/');
    process.exit(0);
  }

  console.log('\nAvailable sessions:\n');
  sessions.slice(0, 20).forEach(s => {
    console.log(`  ${s.id.substring(0, 8)}…  ${s.date}  ${s.project}`);
  });
  console.log(`\n  Use: session-replay show <id>`);

} else if (command === 'export') {
  const id      = opts.positional[0];
  const session = id ? findSession(id, cwd) : latestSession(cwd);

  if (!session) {
    console.error('No session found.');
    process.exit(1);
  }

  const { events, meta } = await parseAndAnalyze(session.path);
  const htmlPath = renderHtml(events, meta, session);
  const html = (await import('node:fs')).readFileSync(htmlPath, 'utf8');
  process.stdout.write(html);

} else if (command === 'fork') {
  const id   = opts.positional[0];
  const step = parseInt(opts.positional[1], 10);

  if (!id || isNaN(step)) {
    console.error('Usage: session-replay fork <session-id> <step-number>');
    process.exit(1);
  }

  const session = findSession(id, cwd);
  if (!session) { console.error('Session not found:', id); process.exit(1); }

  const { events, meta } = await parseAndAnalyze(session.path);
  const forkMd = buildForkPrompt(events, meta, session, step);
  process.stdout.write(forkMd);

} else {
  console.error(`session-replay: unknown command "${command}"`);
  console.error('Usage: session-replay [show|list|export|fork] [options]');
  process.exit(1);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function parseAndAnalyze(transcriptPath) {
  const { events, meta } = await parseTranscript(transcriptPath);
  analyze(events);
  return { events, meta };
}

async function replay(session, opts) {
  process.stderr.write(`Loading session ${session.id.substring(0, 8)}…\n`);

  const { events, meta } = await parseAndAnalyze(session.path);

  if (opts.terminal) {
    renderTerminal(events, meta, session);
    return;
  }

  const htmlPath = renderHtml(events, meta, session);
  process.stderr.write(`Replay saved: ${htmlPath}\n`);

  const opened = openInBrowser(htmlPath);
  if (!opened) {
    process.stderr.write(`Could not open browser. Use --terminal flag or open:\n  ${htmlPath}\n`);
    renderTerminal(events, meta, session);
  }
}

function buildForkPrompt(events, meta, session, stepNum) {
  const prior = events.filter(e => e.step <= stepNum);
  const files = [...new Set(
    prior.filter(e => e.tool && ['Edit','Write'].includes(e.tool.name))
         .map(e => e.tool.input.file_path)
  )];
  const cmds = prior
    .filter(e => e.tool?.name === 'Bash')
    .slice(-5)
    .map(e => '  $ ' + e.tool.input.command);
  const lastUser = prior.filter(e => e.type === 'user').pop()?.text ?? '';
  const atStep   = prior[prior.length - 1];
  const atDesc   = atStep?.tool
    ? `${atStep.tool.name}: ${atStep.tool.input.file_path ?? atStep.tool.input.command ?? ''}`
    : atStep?.text ?? '';

  return `# Session Fork — ${session.project} from step ${stepNum}

## What happened before this point (steps 1–${stepNum})

**Files changed:**
${files.map(f => '- ' + f).join('\n') || '- (none)'}

**Last ${Math.min(5, cmds.length)} commands run:**
${cmds.join('\n') || '  (none)'}

**Last user message:**
> ${lastUser}

## At step ${stepNum}
The agent was executing: ${atDesc}

## Continue from here
Pick up this session from step ${stepNum}. The files listed above have been modified.
Branch: ${meta.branch ?? 'unknown'}
Session ID: ${meta.sessionId ?? 'unknown'}
`;
}
