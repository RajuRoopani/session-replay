// src/parse.mjs — JSONL transcript → linked TimelineEvent[]
// Two-pass parse:
//   Pass 1: collect all entries, build tool_use_id → result map
//   Pass 2: emit chronological events with paired tool_use + result

import fs from 'node:fs';
import readline from 'node:readline';

/**
 * Parse a Claude Code JSONL transcript into a timeline.
 * @param {string} transcriptPath
 * @returns {Promise<{ events: TimelineEvent[], meta: SessionMeta }>}
 */
export async function parseTranscript(transcriptPath) {
  const raw = [];

  const rl = readline.createInterface({
    input: fs.createReadStream(transcriptPath, 'utf8'),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    const t = line.trim();
    if (!t) continue;
    try { raw.push(JSON.parse(t)); } catch { continue; }
  }

  // Pass 1: build result map  { tool_use_id → { stdout, stderr, interrupted, content } }
  const resultMap = new Map();
  for (const entry of raw) {
    if (entry.type !== 'user') continue;
    const content = entry.message?.content;
    if (!Array.isArray(content)) continue;
    for (const block of content) {
      if (block.type === 'tool_result' && block.tool_use_id) {
        resultMap.set(block.tool_use_id, {
          content:     typeof block.content === 'string' ? block.content : JSON.stringify(block.content),
          stdout:      entry.toolUseResult?.stdout ?? '',
          stderr:      entry.toolUseResult?.stderr ?? '',
          interrupted: entry.toolUseResult?.interrupted ?? false,
          timestamp:   entry.timestamp,
        });
      }
    }
  }

  // Pass 2: emit events
  const events = [];
  let step = 0;

  // Track session metadata
  let sessionId = null;
  let cwd = null;
  let startTime = null;
  let endTime = null;
  const filesEdited = new Set();

  for (const entry of raw) {
    // Skip metadata events
    if (!['user', 'assistant'].includes(entry.type)) continue;

    const ts = entry.timestamp ?? null;
    if (ts) {
      const t = new Date(ts).getTime();
      if (!startTime || t < startTime) startTime = t;
      if (!endTime   || t > endTime)   endTime   = t;
    }

    if (entry.sessionId) sessionId = entry.sessionId;
    if (entry.cwd)       cwd       = entry.cwd;

    const content = entry.message?.content;
    const isToolResult = Array.isArray(content) &&
      content.some(b => b.type === 'tool_result');

    // ── User message (human turn, not a tool result) ──────────────────────
    if (entry.type === 'user' && !isToolResult) {
      const text = typeof content === 'string'
        ? content
        : (Array.isArray(content)
            ? content.filter(b => b.type === 'text').map(b => b.text).join('\n')
            : '');
      if (!text.trim()) continue;

      step++;
      events.push({
        step,
        type:          'user',
        uuid:          entry.uuid ?? null,
        timestamp:     ts,
        durationMs:    null,
        tool:          null,
        result:        null,
        text:          text.trim(),
        thinking:      null,
        failed:        false,
        isBranchPoint: false,
        toolUseId:     null,
      });
    }

    // ── Assistant message ────────────────────────────────────────────────
    if (entry.type === 'assistant' && Array.isArray(content)) {
      for (const block of content) {

        // Thinking block
        if (block.type === 'thinking' && block.thinking?.trim()) {
          step++;
          events.push({
            step,
            type:      'thinking',
            uuid:      entry.uuid ?? null,
            timestamp: ts,
            durationMs: null,
            tool: null, result: null,
            text: null,
            thinking:  block.thinking,
            failed: false, isBranchPoint: false, toolUseId: null,
          });
        }

        // Tool call
        if (block.type === 'tool_use') {
          const result = resultMap.get(block.id) ?? null;
          const toolName = block.name ?? 'Unknown';

          // Track files
          if (['Edit', 'Write'].includes(toolName) && block.input?.file_path) {
            filesEdited.add(block.input.file_path);
          }

          // Determine if failed
          const isError = !!(
            result?.interrupted ||
            (result?.stderr && result.stderr.trim().length > 0 &&
             !result.stderr.includes('warning') &&
             !result.stderr.includes('Warning') &&
             !result.stderr.includes('npm warn'))
          );

          step++;
          events.push({
            step,
            type:      'tool_call',
            uuid:      entry.uuid ?? null,
            timestamp: ts,
            durationMs: result?.timestamp
              ? Math.max(0, new Date(result.timestamp).getTime() - new Date(ts).getTime())
              : null,
            tool: {
              name:        toolName,
              input:       block.input ?? {},
              description: block.input?.description ?? null,
            },
            result: result ? {
              stdout:      result.stdout,
              stderr:      result.stderr,
              interrupted: result.interrupted,
              isError,
            } : null,
            text:          null,
            thinking:      null,
            failed:        isError,
            isBranchPoint: false,
            toolUseId:     block.id,
          });
        }
      }
    }
  }

  // Compute durations for events without a linked result
  for (let i = 0; i < events.length - 1; i++) {
    if (events[i].durationMs === null && events[i].timestamp && events[i + 1].timestamp) {
      events[i].durationMs = Math.max(0,
        new Date(events[i + 1].timestamp).getTime() -
        new Date(events[i].timestamp).getTime()
      );
    }
  }

  const durationMs = startTime && endTime ? endTime - startTime : null;

  return {
    events,
    meta: {
      sessionId,
      cwd,
      startTime,
      endTime,
      durationMs,
      filesEdited: [...filesEdited].sort(),
      totalSteps:  step,
      errorCount:  events.filter(e => e.failed).length,
    },
  };
}

export function formatDuration(ms) {
  if (!ms) return '?';
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}
