// src/store.mjs — find Claude Code session transcripts
// Transcripts live at: ~/.claude/projects/{project-slug}/{session-id}.jsonl
// Project slug = CWD with '/' replaced by '-'

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const CLAUDE_PROJECTS_DIR = path.join(os.homedir(), '.claude', 'projects');

/** Convert a CWD path to Claude's project slug format */
function cwdToSlug(cwd) {
  return cwd.replace(/\//g, '-');
}

/** Get the project directory for a given CWD */
function projectDir(cwd) {
  return path.join(CLAUDE_PROJECTS_DIR, cwdToSlug(cwd));
}

/** List all sessions for the current project, most recent first */
export function listSessions(cwd) {
  const dir = projectDir(cwd);
  if (!fs.existsSync(dir)) return [];

  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.jsonl'))
    .map(f => {
      const fullPath = path.join(dir, f);
      const stat = fs.statSync(fullPath);
      return {
        id:      f.replace('.jsonl', ''),
        path:    fullPath,
        date:    stat.mtime.toISOString().substring(0, 10),
        mtime:   stat.mtime.getTime(),
        project: path.basename(cwd),
      };
    })
    .sort((a, b) => b.mtime - a.mtime);
}

/** Most recent session for the current project */
export function latestSession(cwd) {
  const sessions = listSessions(cwd);
  return sessions[0] ?? null;
}

/** Find a session by full or partial ID, searching all projects */
export function findSession(id, cwd) {
  // Try current project first
  if (cwd) {
    const inProject = listSessions(cwd).find(
      s => s.id === id || s.id.startsWith(id)
    );
    if (inProject) return inProject;
  }

  // Fall back: search all projects
  if (!fs.existsSync(CLAUDE_PROJECTS_DIR)) return null;

  for (const slug of fs.readdirSync(CLAUDE_PROJECTS_DIR)) {
    const dir = path.join(CLAUDE_PROJECTS_DIR, slug);
    if (!fs.statSync(dir).isDirectory()) continue;

    const match = fs.readdirSync(dir)
      .filter(f => f.endsWith('.jsonl'))
      .find(f => f.startsWith(id) || f.includes(id));

    if (match) {
      const fullPath = path.join(dir, match);
      const stat = fs.statSync(fullPath);
      return {
        id:      match.replace('.jsonl', ''),
        path:    fullPath,
        date:    stat.mtime.toISOString().substring(0, 10),
        mtime:   stat.mtime.getTime(),
        project: slug.split('-').pop(),
      };
    }
  }

  return null;
}

/** List all sessions across all projects */
export function listAllSessions() {
  if (!fs.existsSync(CLAUDE_PROJECTS_DIR)) return [];

  const all = [];
  for (const slug of fs.readdirSync(CLAUDE_PROJECTS_DIR)) {
    const dir = path.join(CLAUDE_PROJECTS_DIR, slug);
    if (!fs.statSync(dir).isDirectory()) continue;

    const project = slug.replace(/^-/, '').split('-').slice(-2).join('/');
    fs.readdirSync(dir)
      .filter(f => f.endsWith('.jsonl'))
      .forEach(f => {
        const fullPath = path.join(dir, f);
        const stat = fs.statSync(fullPath);
        all.push({
          id:      f.replace('.jsonl', ''),
          path:    fullPath,
          date:    stat.mtime.toISOString().substring(0, 10),
          mtime:   stat.mtime.getTime(),
          project,
        });
      });
  }
  return all.sort((a, b) => b.mtime - a.mtime);
}
