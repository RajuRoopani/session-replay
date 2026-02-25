// src/analyze.mjs — tag events with failures and branch points

/**
 * Enrich events with failure detection and branch point tagging.
 * Mutates events in-place (adds/overrides: failed, isBranchPoint).
 */
export function analyze(events) {
  // Branch point: a user message that follows tool calls
  // (user intervened mid-session, not just the opening prompt)
  let seenToolCall = false;
  for (const ev of events) {
    if (ev.type === 'tool_call') {
      seenToolCall = true;
    }
    if (ev.type === 'user' && seenToolCall) {
      ev.isBranchPoint = true;
    }
  }

  // Failure propagation: if a tool_call fails, tag it
  // (parse.mjs already sets failed on tool_calls with stderr)
  // Also catch bash commands with non-zero exit code patterns
  for (const ev of events) {
    if (ev.type !== 'tool_call' || !ev.result) continue;

    const { stdout = '', stderr = '' } = ev.result;
    const combined = (stdout + '\n' + stderr).toLowerCase();

    // Additional failure signals
    if (
      /exit code [1-9]/.test(combined) ||
      /error:/i.test(stderr) ||
      /failed/i.test(stderr) ||
      ev.result.interrupted
    ) {
      ev.failed = true;
    }
  }

  return events;
}

/** Compute summary stats for the sidebar */
export function summarize(events, meta) {
  const toolCounts = {};
  for (const ev of events) {
    if (ev.type === 'tool_call') {
      toolCounts[ev.tool.name] = (toolCounts[ev.tool.name] ?? 0) + 1;
    }
  }

  return {
    totalSteps:   meta.totalSteps,
    errorCount:   events.filter(e => e.failed).length,
    branchPoints: events.filter(e => e.isBranchPoint).length,
    filesEdited:  meta.filesEdited,
    toolCounts,
    durationMs:   meta.durationMs,
  };
}
