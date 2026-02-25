// src/render-html.mjs — generate + save the HTML replay file

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { buildHtml } from './template.mjs';
import { formatDuration } from './parse.mjs';
import { summarize } from './analyze.mjs';

const REPLAYS_DIR = path.join(os.homedir(), '.session-replays');

/** Render and save a replay. Returns the output HTML path. */
export function renderHtml(events, meta, sessionInfo) {
  const summary = summarize(events, meta);

  const branch = getGitBranch(meta.cwd);
  const project = sessionInfo?.project ?? path.basename(meta.cwd ?? '');
  const date = new Date(meta.startTime || Date.now()).toISOString().substring(0, 10);

  const replayData = {
    events,
    meta: {
      ...meta,
      branch,
      project,
      date,
      sessionId: meta.sessionId,
    },
    summary,
  };

  const html = buildHtml(replayData);

  // Save to ~/.session-replays/{session-id}.html
  fs.mkdirSync(REPLAYS_DIR, { recursive: true });
  const outPath = path.join(
    REPLAYS_DIR,
    `${meta.sessionId ?? 'session'}.html`
  );
  fs.writeFileSync(outPath, html, 'utf8');
  return outPath;
}

/** Open a file in the default browser */
export function openInBrowser(filePath) {
  const url = 'file://' + filePath;
  try {
    const platform = process.platform;
    if (platform === 'darwin') execSync(`open "${filePath}"`, { stdio: 'ignore' });
    else if (platform === 'linux') execSync(`xdg-open "${filePath}"`, { stdio: 'ignore' });
    else if (platform === 'win32') execSync(`start "" "${filePath}"`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function getGitBranch(cwd) {
  if (!cwd) return 'unknown';
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', {
      cwd, stdio: ['ignore', 'pipe', 'ignore']
    }).toString().trim();
  } catch {
    return 'unknown';
  }
}
