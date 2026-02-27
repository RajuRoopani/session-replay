'use strict';

const vscode = require('vscode');
const fs     = require('fs');
const path   = require('path');
const os     = require('os');

// ── Constants ──────────────────────────────────────────────────────────────────

const REPLAYS_DIR   = path.join(os.homedir(), '.session-replays');
const DOWNLOADS_DIR = path.join(os.homedir(), 'Downloads');

// ── Extension state ────────────────────────────────────────────────────────────

let currentPanel    = null;  // vscode.WebviewPanel | null
let currentFilePath = null;  // string | null
let dirWatcher      = null;  // fs.FSWatcher | null
let fileWatcher     = null;  // fs.FSWatcher | null

// ── activate / deactivate ─────────────────────────────────────────────────────

function activate(context) {
  // Status bar button
  const bar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  bar.text    = '$(history) Session Replay';
  bar.tooltip = 'Open latest Claude Code session replay (⌘⇧R)';
  bar.command = 'sessionReplay.openLatest';
  bar.show();
  context.subscriptions.push(bar);

  // Commands
  context.subscriptions.push(
    vscode.commands.registerCommand('sessionReplay.openLatest', openLatest),
    vscode.commands.registerCommand('sessionReplay.pick',       pickSession)
  );

  // Watch ~/.session-replays/ for new sessions
  startDirWatcher(context);
}

function deactivate() {
  stopDirWatcher();
  stopFileWatcher();
}

// ── Commands ───────────────────────────────────────────────────────────────────

async function openLatest() {
  const filePath = getLatestSessionPath();
  if (!filePath) {
    vscode.window.showWarningMessage(
      'No session replays found. Run a Claude Code session first.',
      'View Setup Docs'
    ).then(choice => {
      if (choice === 'View Setup Docs') {
        vscode.env.openExternal(
          vscode.Uri.parse('https://github.com/RajuRoopani/session-replay')
        );
      }
    });
    return;
  }
  openSession(filePath);
}

async function pickSession() {
  const sessions = listSessionFiles();
  if (!sessions.length) {
    vscode.window.showWarningMessage('No session replays found.');
    return;
  }

  const items = sessions.map(s => ({
    label:       s.label,
    description: s.description,
    detail:      s.detail,
    filePath:    s.filePath,
  }));

  const chosen = await vscode.window.showQuickPick(items, {
    placeHolder:      'Select a session replay to open',
    matchOnDescription: true,
    matchOnDetail:      true,
  });

  if (chosen) openSession(chosen.filePath);
}

// ── WebviewPanel ───────────────────────────────────────────────────────────────

function openSession(filePath) {
  // Reuse existing panel
  if (currentPanel) {
    currentPanel.reveal(vscode.ViewColumn.Beside);
    loadFileIntoPanel(filePath);
    return;
  }

  currentPanel = vscode.window.createWebviewPanel(
    'sessionReplay',
    'Session Replay',
    vscode.ViewColumn.Beside,
    {
      enableScripts:           true,
      retainContextWhenHidden: true,
      localResourceRoots:      [],
    }
  );

  currentPanel.webview.onDidReceiveMessage(handleWebviewMessage);

  currentPanel.onDidDispose(() => {
    currentPanel    = null;
    currentFilePath = null;
    stopFileWatcher();
  });

  loadFileIntoPanel(filePath);
}

function loadFileIntoPanel(filePath) {
  if (!currentPanel) return;

  let html;
  try {
    html = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    vscode.window.showErrorMessage(`Session Replay: could not read file — ${err.message}`);
    return;
  }

  currentFilePath = filePath;

  const meta = extractMeta(html);
  currentPanel.title = meta
    ? `Replay: ${meta.project} · ${meta.date}`
    : `Session Replay — ${path.basename(filePath, '.html').slice(0, 8)}`;

  currentPanel.webview.html = adaptForVSCode(html);
  startFileWatcher(filePath);
}

// ── HTML adaptation ────────────────────────────────────────────────────────────
//
// The generated HTML is self-contained but needs two injections for VS Code:
//
//   1. A CSP <meta> so VS Code's webview sandbox allows inline scripts/styles.
//   2. A second <script> block (before </body>) that overrides window.forkFrom
//      to use acquireVsCodeApi().postMessage() instead of a Blob download.
//
// Top-level `const` declarations in a classic <script> block share the same
// global lexical scope with subsequent <script> blocks in Chromium. So the
// adapter can freely read DATA, events, meta from the first block and override
// the forkFrom function declaration.

function adaptForVSCode(html) {
  // 1. Inject CSP after <meta charset="UTF-8">
  const csp = `<meta http-equiv="Content-Security-Policy" ` +
    `content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">`;
  const afterCharset = html.indexOf('<meta charset="UTF-8">') +
    '<meta charset="UTF-8">'.length;
  html = html.slice(0, afterCharset) + '\n' + csp + html.slice(afterCharset);

  // 2. Inject adapter script before </body>
  const adapter = buildAdapterScript();
  html = html.replace('</body>', adapter + '\n</body>');

  return html;
}

function buildAdapterScript() {
  return `<script>
(function () {
  'use strict';

  // acquireVsCodeApi() is injected by VS Code and can only be called once.
  const vscode = acquireVsCodeApi();

  // The first <script> block defined forkFrom as a function declaration, which
  // puts it on the global object. We replace it here so that onclick="forkFrom(N)"
  // attributes (which look up forkFrom in global scope at click time) use our
  // version, which sends a postMessage to the extension host instead of trying
  // to trigger a Blob download (which doesn't work reliably in webviews).
  //
  // We also read DATA, events, meta directly — they are top-level const/destructured
  // vars from the first script block, visible in this block via shared global scope.
  window.forkFrom = function forkFrom(stepNum) {
    try {
      const evts  = DATA.events;
      const m     = DATA.meta;

      const prior = evts.filter(e => e.step <= stepNum);

      const files = [...new Set(
        prior
          .filter(e => e.tool && (e.tool.name === 'Edit' || e.tool.name === 'Write'))
          .map(e => e.tool.input.file_path)
      )];

      const cmds = prior
        .filter(e => e.tool && e.tool.name === 'Bash')
        .slice(-5)
        .map(e => '  $ ' + (e.tool.input.command || ''));

      const userEvents = prior.filter(e => e.type === 'user');
      const lastUser   = userEvents.length
        ? (userEvents[userEvents.length - 1].text || '')
        : '';

      const atStep = prior[prior.length - 1];
      const atDesc = atStep && atStep.tool
        ? atStep.tool.name + ': ' + (atStep.tool.input.file_path || atStep.tool.input.command || '')
        : (atStep && atStep.text) || '';

      const md = [
        '# Session Fork \u2014 ' + (m.project || 'unknown') + ' from step ' + stepNum,
        '',
        '## What happened before this point (steps 1\u2013' + stepNum + ')',
        '',
        '**Files changed:**',
        files.length
          ? files.map(f => '- ' + f).join('\\n')
          : '- (none)',
        '',
        '**Last commands run:**',
        cmds.length ? cmds.join('\\n') : '  (none)',
        '',
        '**Last user message:**',
        '> ' + lastUser,
        '',
        '## At step ' + stepNum,
        'The agent was executing: ' + atDesc,
        '',
        '## Continue from here',
        'Pick up this session from step ' + stepNum + '. The files listed above have been modified.',
        'Branch: '  + (m.branch    || 'unknown'),
        'Session: ' + (m.sessionId || 'unknown'),
      ].join('\\n');

      vscode.postMessage({
        command:  'fork',
        filename: 'fork-step-' + stepNum + '.md',
        content:  md,
      });
    } catch (err) {
      console.error('[session-replay] forkFrom error:', err);
    }
  };

  // ── Replay from here — opens a new VS Code terminal and starts claude ──────
  window.replayFromHere = function replayFromHere(stepNum) {
    try {
      const evts = DATA.events;
      const m    = DATA.meta;

      const prior = evts.filter(e => e.step <= stepNum);

      const files = [...new Set(
        prior
          .filter(e => e.tool && (e.tool.name === 'Edit' || e.tool.name === 'Write'))
          .map(e => e.tool.input.file_path)
      )];

      const cmds = prior
        .filter(e => e.tool && e.tool.name === 'Bash')
        .slice(-5)
        .map(e => '  $ ' + (e.tool.input.command || ''));

      const userEvents = prior.filter(e => e.type === 'user');
      const lastUser   = userEvents.length
        ? (userEvents[userEvents.length - 1].text || '')
        : '';

      const atStep = prior[prior.length - 1];
      const atDesc = atStep && atStep.tool
        ? atStep.tool.name + ': ' + (atStep.tool.input.file_path || atStep.tool.input.command || '')
        : (atStep && atStep.text) || '';

      const md = [
        '# Session Fork \u2014 ' + (m.project || 'unknown') + ' from step ' + stepNum,
        '',
        '## What happened before this point (steps 1\u2013' + stepNum + ')',
        '',
        '**Files changed:**',
        files.length ? files.map(f => '- ' + f).join('\n') : '- (none)',
        '',
        '**Last commands run:**',
        cmds.length ? cmds.join('\n') : '  (none)',
        '',
        '**Last user message:**',
        '> ' + lastUser,
        '',
        '## At step ' + stepNum,
        'The agent was executing: ' + atDesc,
        '',
        '## Continue from here',
        'Pick up this session from step ' + stepNum + '. The files listed above have been modified.',
        'Branch: '  + (m.branch    || 'unknown'),
        'Session: ' + (m.sessionId || 'unknown'),
      ].join('\n');

      vscode.postMessage({
        command:  'replayTerminal',
        step:     stepNum,
        content:  md,
        cwd:      m.cwd     || '',
        project:  m.project || 'unknown',
      });
    } catch (err) {
      console.error('[session-replay] replayFromHere error:', err);
    }
  };
})();
</script>`;
}

// ── Handle messages from webview ───────────────────────────────────────────────

async function handleWebviewMessage(msg) {
  if (msg.command === 'replayTerminal') {
    await handleReplayTerminal(msg);
    return;
  }
  if (msg.command !== 'fork') return;

  const destPath = path.join(DOWNLOADS_DIR, msg.filename);

  try {
    fs.writeFileSync(destPath, msg.content, 'utf8');
  } catch (err) {
    vscode.window.showErrorMessage(`Session Replay: could not save fork — ${err.message}`);
    return;
  }

  const uri = vscode.Uri.file(destPath);
  const doc = await vscode.workspace.openTextDocument(uri);
  await vscode.window.showTextDocument(doc, {
    viewColumn:    vscode.ViewColumn.Active,
    preserveFocus: false,
  });

  vscode.window.showInformationMessage(
    `Fork saved: ${msg.filename}`,
    'Show in Finder'
  ).then(action => {
    if (action === 'Show in Finder') {
      vscode.commands.executeCommand('revealFileInOS', uri);
    }
  });
}

// ── Replay terminal ────────────────────────────────────────────────────────────

async function handleReplayTerminal(msg) {
  // Write fork prompt to a temp file so we can pass it cleanly to claude.
  const tmpFile = path.join(os.tmpdir(), `session-replay-fork-step-${msg.step}.md`);
  try {
    fs.writeFileSync(tmpFile, msg.content, 'utf8');
  } catch (err) {
    vscode.window.showErrorMessage(`Session Replay: could not write fork prompt — ${err.message}`);
    return;
  }

  const cwd = (msg.cwd && fs.existsSync(msg.cwd)) ? msg.cwd : os.homedir();

  const terminal = vscode.window.createTerminal({
    name: `↺ ${msg.project} · step ${msg.step}`,
    cwd,
  });

  terminal.show();

  // cd into the project dir, then launch claude with the fork prompt as the
  // initial message. Using `cat file` via $() passes multi-line content safely.
  terminal.sendText(`claude "$(cat '${tmpFile}')"`);
}

// ── Directory watcher — notify on new sessions ─────────────────────────────────

function startDirWatcher(context) {
  if (!fs.existsSync(REPLAYS_DIR)) {
    // Poll until the directory appears (first-time setup)
    const t = setInterval(() => {
      if (fs.existsSync(REPLAYS_DIR)) {
        clearInterval(t);
        _watchDirNow(context);
      }
    }, 5000);
    context.subscriptions.push({ dispose: () => clearInterval(t) });
    return;
  }
  _watchDirNow(context);
}

function _watchDirNow(context) {
  const known = new Set(
    fs.readdirSync(REPLAYS_DIR)
      .filter(f => f.endsWith('.html'))
      .map(f => path.join(REPLAYS_DIR, f))
  );

  try {
    dirWatcher = fs.watch(REPLAYS_DIR, (eventType, filename) => {
      if (!filename || !filename.endsWith('.html')) return;
      const full = path.join(REPLAYS_DIR, filename);

      if (eventType === 'rename' && !known.has(full)) {
        // Wait for the write to complete before reading
        setTimeout(() => {
          if (!fs.existsSync(full)) return;
          known.add(full);

          const html = fs.readFileSync(full, 'utf8');
          const meta = extractMeta(html);
          const label = meta
            ? `${meta.project} — ${meta.totalSteps} steps`
            : filename.replace('.html', '').slice(0, 8);

          vscode.window.showInformationMessage(
            `New session replay ready: ${label}`,
            'Open'
          ).then(choice => {
            if (choice === 'Open') openSession(full);
          });
        }, 600);
      }
    });

    dirWatcher.on('error', err =>
      console.error('[session-replay] dir watcher error:', err)
    );

    context.subscriptions.push({ dispose: stopDirWatcher });
  } catch (err) {
    console.error('[session-replay] could not start dir watcher:', err);
  }
}

function stopDirWatcher() {
  if (dirWatcher) { dirWatcher.close(); dirWatcher = null; }
}

// ── Per-file watcher — auto-refresh panel when session HTML changes ─────────────

function startFileWatcher(filePath) {
  stopFileWatcher();
  try {
    fileWatcher = fs.watch(filePath, eventType => {
      if (eventType !== 'change') return;
      clearTimeout(fileWatcher._t);
      fileWatcher._t = setTimeout(() => {
        if (currentPanel && currentFilePath === filePath) {
          loadFileIntoPanel(filePath);
        }
      }, 400);
    });
    fileWatcher.on('error', () => { fileWatcher = null; });
  } catch (_) { /* best-effort */ }
}

function stopFileWatcher() {
  if (fileWatcher) { fileWatcher.close(); fileWatcher = null; }
}

// ── Session file helpers ───────────────────────────────────────────────────────

function listSessionFiles() {
  if (!fs.existsSync(REPLAYS_DIR)) return [];

  return fs.readdirSync(REPLAYS_DIR)
    .filter(f => f.endsWith('.html'))
    .map(f => {
      const full = path.join(REPLAYS_DIR, f);
      const stat = fs.statSync(full);
      let meta = null;
      try { meta = extractMeta(fs.readFileSync(full, 'utf8')); } catch (_) {}

      const sid = f.replace('.html', '');
      return {
        filePath:    full,
        mtime:       stat.mtime.getTime(),
        label:       meta
          ? `$(history)  ${meta.project}   [${meta.date}]`
          : `$(history)  ${sid.slice(0, 8)}…`,
        description: meta
          ? [
              `${meta.totalSteps} steps`,
              meta.errorCount > 0 ? `⚠ ${meta.errorCount} errors` : null,
              `branch: ${meta.branch}`,
            ].filter(Boolean).join('  ·  ')
          : '',
        detail: meta
          ? `${sid.slice(0, 8)}…  ·  ${fmtDur(meta.durationMs)}`
          : full,
      };
    })
    .sort((a, b) => b.mtime - a.mtime);
}

function getLatestSessionPath() {
  const s = listSessionFiles();
  return s.length ? s[0].filePath : null;
}

// ── Metadata extraction ────────────────────────────────────────────────────────
//
// The DATA line is always `const DATA = <json>;` on a single line.
// We parse just that line to extract project/branch/date/summary stats.
// Parsing the full 650KB JSON is intentional — we need all fields.

function extractMeta(html) {
  const prefix = 'const DATA = ';
  const start  = html.indexOf(prefix);
  if (start === -1) return null;

  const lineEnd = html.indexOf('\n', start);
  const raw     = html.slice(start + prefix.length, lineEnd).replace(/;$/, '');

  try {
    const obj = JSON.parse(raw);
    const m   = obj.meta    || {};
    const s   = obj.summary || {};
    return {
      project:    m.project   || 'unknown',
      branch:     m.branch    || 'unknown',
      date:       m.date      || '',
      sessionId:  m.sessionId || '',
      totalSteps: s.totalSteps  || 0,
      errorCount: s.errorCount  || 0,
      durationMs: s.durationMs  || m.durationMs || 0,
    };
  } catch (_) {
    return null;
  }
}

function fmtDur(ms) {
  if (!ms) return '';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return s > 0 ? `${s}s` : '<1s';
}

module.exports = { activate, deactivate };
