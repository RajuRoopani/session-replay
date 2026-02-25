// src/template.mjs — self-contained HTML/CSS/JS viewer
// REPLAY_DATA is injected as a JSON constant before this script runs.

export function buildHtml(replayData) {
  const json = JSON.stringify(replayData);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Session Replay — ${replayData.meta.project}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#0d1117;color:#e6edf3;font-family:-apple-system,'Segoe UI',sans-serif;font-size:14px;display:flex;flex-direction:column;height:100vh;overflow:hidden}
a{color:#58a6ff}
code,pre{font-family:'SF Mono','Fira Code',monospace;font-size:12px}

/* Header */
.header{background:#161b22;border-bottom:1px solid #30363d;padding:12px 20px;display:flex;align-items:center;gap:16px;flex-shrink:0}
.header-title{font-weight:600;font-size:15px;color:#f0f6fc}
.header-meta{color:#8b949e;font-size:12px;display:flex;gap:12px;align-items:center}
.badge{background:#21262d;border:1px solid #30363d;border-radius:4px;padding:2px 8px;font-size:11px}
.badge.error{background:#2d1117;border-color:#f85149;color:#f85149}

/* Layout */
.body{display:flex;flex:1;overflow:hidden}

/* Sidebar */
.sidebar{width:220px;background:#161b22;border-right:1px solid #30363d;overflow-y:auto;flex-shrink:0;padding:16px}
.sidebar h3{color:#8b949e;font-size:11px;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px}
.stat-row{display:flex;justify-content:space-between;padding:3px 0;font-size:13px}
.stat-val{font-weight:600;color:#f0f6fc}
.file-list{margin-top:4px}
.file-item{font-size:11px;color:#8b949e;padding:2px 0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.file-item.edited::before{content:"✎ ";color:#58a6ff}
.section-gap{margin-top:16px}
.tool-legend{margin-top:4px}
.legend-row{display:flex;align-items:center;gap:6px;padding:2px 0;font-size:12px}
.legend-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}

/* Timeline */
.timeline{flex:1;overflow-y:auto;padding:12px 16px}

/* Step cards */
.step{border:1px solid #30363d;border-radius:6px;margin-bottom:6px;overflow:hidden}
.step.failed{border-color:#f8514966;background:#1c111766}
.step.branch-point{border-color:#f0883e66}
.step-header{padding:10px 12px;cursor:pointer;display:flex;align-items:center;gap:8px;user-select:none}
.step-header:hover{background:#161b22}
.step-num{color:#8b949e;font-size:11px;min-width:28px;text-align:right;flex-shrink:0}
.tool-icon{font-size:14px;flex-shrink:0;width:20px;text-align:center}
.step-summary{flex:1;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font-size:13px}
.step-summary code{background:#21262d;padding:1px 4px;border-radius:3px;font-size:11px}
.step-right{display:flex;align-items:center;gap:8px;flex-shrink:0}
.duration{color:#8b949e;font-size:11px}
.error-badge{color:#f85149;font-size:12px}
.chevron{color:#8b949e;font-size:10px;transition:transform .15s}
.step.expanded .chevron{transform:rotate(90deg)}
.branch-marker{font-size:10px;color:#f0883e;border:1px solid #f0883e66;border-radius:3px;padding:1px 5px}

/* Tool color bars */
.step[data-tool="Bash"]    .step-header{border-left:3px solid #f78166}
.step[data-tool="Edit"]    .step-header{border-left:3px solid #58a6ff}
.step[data-tool="Write"]   .step-header{border-left:3px solid #3fb950}
.step[data-tool="Read"]    .step-header{border-left:3px solid #8b949e}
.step[data-tool="WebFetch"] .step-header{border-left:3px solid #d2a8ff}
.step[data-tool="Task"]    .step-header{border-left:3px solid #d2a8ff}
.step[data-tool="Glob"]    .step-header{border-left:3px solid #8b949e}
.step[data-tool="Grep"]    .step-header{border-left:3px solid #8b949e}
.step[data-tool="user"]    .step-header{border-left:3px solid #f0883e}
.step[data-tool="thinking"] .step-header{border-left:3px solid #3d444d}
.step.failed               .step-header{border-left:3px solid #f85149}

/* Step body */
.step-body{display:none;padding:12px;border-top:1px solid #21262d;background:#010409}
.step.expanded .step-body{display:block}
.step-body pre{white-space:pre-wrap;word-break:break-all;font-size:12px;color:#8b949e;max-height:300px;overflow-y:auto}
.step-body pre.stdout{color:#e6edf3}
.step-body pre.stderr{color:#f85149}
.step-body pre.thinking-text{color:#8b949e;font-style:italic}
.label{font-size:10px;text-transform:uppercase;color:#8b949e;margin-bottom:4px;margin-top:10px}
.label:first-child{margin-top:0}
.fork-btn{margin-top:10px;background:#21262d;border:1px solid #30363d;color:#e6edf3;padding:5px 12px;border-radius:5px;cursor:pointer;font-size:12px}
.fork-btn:hover{background:#30363d;border-color:#58a6ff;color:#58a6ff}

/* Branch separator */
.branch-sep{text-align:center;color:#f0883e;font-size:11px;padding:8px 0;opacity:.8}

/* Keyboard hint */
.kb-hint{padding:6px 16px;background:#0d1117;border-top:1px solid #21262d;font-size:11px;color:#484f58;flex-shrink:0}
</style>
</head>
<body>
<div class="header">
  <span class="header-title" id="hdr-title"></span>
  <div class="header-meta">
    <span id="hdr-branch" class="badge"></span>
    <span id="hdr-date"></span>
    <span id="hdr-duration"></span>
    <span id="hdr-errors" class="badge error" style="display:none"></span>
  </div>
</div>
<div class="body">
  <div class="sidebar">
    <h3>Session</h3>
    <div class="stat-row"><span>Steps</span><span class="stat-val" id="s-steps">—</span></div>
    <div class="stat-row"><span>Errors</span><span class="stat-val" id="s-errors">—</span></div>
    <div class="stat-row"><span>Branch pts</span><span class="stat-val" id="s-branches">—</span></div>
    <div class="stat-row"><span>Duration</span><span class="stat-val" id="s-duration">—</span></div>

    <div class="section-gap">
      <h3>Files changed</h3>
      <div class="file-list" id="file-list"></div>
    </div>

    <div class="section-gap">
      <h3>Legend</h3>
      <div class="tool-legend">
        <div class="legend-row"><div class="legend-dot" style="background:#f78166"></div>Bash</div>
        <div class="legend-row"><div class="legend-dot" style="background:#58a6ff"></div>Edit</div>
        <div class="legend-row"><div class="legend-dot" style="background:#3fb950"></div>Write</div>
        <div class="legend-row"><div class="legend-dot" style="background:#d2a8ff"></div>Fetch/Task</div>
        <div class="legend-row"><div class="legend-dot" style="background:#8b949e"></div>Read/Glob/Grep</div>
        <div class="legend-row"><div class="legend-dot" style="background:#f0883e"></div>User message</div>
        <div class="legend-row"><div class="legend-dot" style="background:#f85149"></div>Failed step</div>
      </div>
    </div>
  </div>

  <div class="timeline" id="timeline" tabindex="0"></div>
</div>
<div class="kb-hint">j/k — navigate &nbsp;·&nbsp; Enter — expand &nbsp;·&nbsp; f — fork from here &nbsp;·&nbsp; Esc — collapse</div>

<script>
const DATA = ${json};

// ── Helpers ──────────────────────────────────────────────────────────────────

function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function fmt(ms){ if(!ms) return ''; const m=Math.floor(ms/60000),s=Math.floor((ms%60000)/1000); return m?m+'m '+s+'s':s+'s'; }
function toolIcon(name){
  const icons={Bash:'$',Edit:'✎',Write:'✚',Read:'👁',Glob:'🔍',Grep:'🔍',WebFetch:'🌐',Task:'⚙',TodoWrite:'✅'};
  return icons[name]||'⚙';
}
function stepSummary(ev){
  if(ev.type==='user')     return esc(ev.text?.substring(0,120)||'');
  if(ev.type==='thinking') return '<em style="color:#484f58">thinking...</em>';
  const t=ev.tool;
  if(!t) return '';
  const n=t.name;
  if(n==='Bash')    return '<code>'+(t.input.description||t.input.command||'').substring(0,100)+'</code>';
  if(n==='Edit'||n==='Write') return '<code>'+(t.input.file_path||'').split('/').pop()+'</code>';
  if(n==='Read')    return '<code>'+(t.input.file_path||'').split('/').pop()+'</code>';
  if(n==='Glob')    return '<code>'+(t.input.pattern||'')+'</code>';
  if(n==='Grep')    return '<code>'+(t.input.pattern||'')+'</code>';
  if(n==='WebFetch') return '<code>'+(t.input.url||'').substring(0,80)+'</code>';
  if(n==='Task')    return (t.description||t.input.description||'subagent').substring(0,80);
  return esc(JSON.stringify(t.input).substring(0,80));
}

// ── Render sidebar ────────────────────────────────────────────────────────────
const {events,meta,summary}=DATA;
document.getElementById('hdr-title').textContent='session-replay — '+meta.project;
document.getElementById('hdr-branch').textContent=meta.branch||'unknown';
document.getElementById('hdr-date').textContent=meta.date||'';
document.getElementById('hdr-duration').textContent=fmt(meta.durationMs);
document.getElementById('s-steps').textContent=summary.totalSteps;
document.getElementById('s-errors').textContent=summary.errorCount;
document.getElementById('s-branches').textContent=summary.branchPoints;
document.getElementById('s-duration').textContent=fmt(summary.durationMs);

if(summary.errorCount>0){
  const eb=document.getElementById('hdr-errors');
  eb.textContent=summary.errorCount+' error'+(summary.errorCount>1?'s':'');
  eb.style.display='';
}

const fl=document.getElementById('file-list');
(summary.filesEdited||[]).forEach(f=>{
  const d=document.createElement('div');
  d.className='file-item edited';
  d.textContent=f.split('/').pop();
  d.title=f;
  fl.appendChild(d);
});

// ── Render timeline ───────────────────────────────────────────────────────────
const tl=document.getElementById('timeline');
let prevWasToolCall=false;

events.forEach((ev,i)=>{
  // Branch separator
  if(ev.isBranchPoint){
    const sep=document.createElement('div');
    sep.className='branch-sep';
    sep.textContent='─── ⑂  User intervened ───';
    tl.appendChild(sep);
  }

  const toolKey = ev.type==='user'?'user':ev.type==='thinking'?'thinking':(ev.tool?.name||'');
  const div=document.createElement('div');
  div.className='step'+(ev.failed?' failed':'')+(ev.isBranchPoint?' branch-point':'');
  div.dataset.tool=toolKey;
  div.dataset.index=i;

  div.innerHTML=\`
    <div class="step-header">
      <span class="step-num">\${ev.step}</span>
      <span class="tool-icon">\${toolIcon(toolKey)}</span>
      <span class="step-summary">\${stepSummary(ev)}</span>
      <span class="step-right">
        \${ev.isBranchPoint?'<span class="branch-marker">branch</span>':''}
        \${ev.failed?'<span class="error-badge">❌</span>':''}
        \${ev.durationMs?'<span class="duration">'+fmt(ev.durationMs)+'</span>':''}
        \${ev.type!=='user'?'<span class="chevron">▶</span>':''}
      </span>
    </div>
    <div class="step-body" id="body-\${i}"></div>
  \`;

  // Lazy-render body on expand
  div.querySelector('.step-header').addEventListener('click',()=>{
    if(ev.type==='user') return;
    const wasExpanded=div.classList.contains('expanded');
    div.classList.toggle('expanded');
    if(!wasExpanded) renderBody(ev, document.getElementById('body-'+i));
    activeIdx=i;
  });

  tl.appendChild(div);
});

function renderBody(ev, el){
  if(el._rendered) return;
  el._rendered=true;
  let html='';

  if(ev.type==='thinking'){
    html+='<div class="label">Thinking</div><pre class="thinking-text">'+esc(ev.thinking?.substring(0,2000)||'')+'</pre>';
  }

  if(ev.type==='tool_call' && ev.tool){
    html+='<div class="label">Input</div><pre>'+esc(JSON.stringify(ev.tool.input,null,2))+'</pre>';
    if(ev.result){
      if(ev.result.stdout?.trim())
        html+='<div class="label">Output</div><pre class="stdout">'+esc(ev.result.stdout.substring(0,3000))+'</pre>';
      if(ev.result.stderr?.trim())
        html+='<div class="label">Stderr</div><pre class="stderr">'+esc(ev.result.stderr.substring(0,1000))+'</pre>';
      if(ev.result.interrupted)
        html+='<div class="label" style="color:#f85149">Interrupted</div>';
    }
  }

  html+='<button class="fork-btn" onclick="forkFrom('+ev.step+')">⑂ Fork from step '+ev.step+'</button>';
  el.innerHTML=html;
}

// ── Fork feature ─────────────────────────────────────────────────────────────
function forkFrom(stepNum){
  const prior=events.filter(e=>e.step<=stepNum);
  const files=[...new Set(prior.filter(e=>e.tool&&['Edit','Write'].includes(e.tool.name)).map(e=>e.tool.input.file_path))];
  const cmds=prior.filter(e=>e.tool?.name==='Bash').slice(-5).map(e=>'  $ '+e.tool.input.command);
  const lastUser=prior.filter(e=>e.type==='user').pop()?.text||'';
  const atStep=prior[prior.length-1];
  const atDesc=atStep?.tool ? atStep.tool.name+': '+(atStep.tool.input.file_path||atStep.tool.input.command||'') : atStep?.text||'';

  const md=\`# Session Fork — \${meta.project} from step \${stepNum}

## What happened before this point (steps 1–\${stepNum})

**Files changed:**
\${files.map(f=>'- '+f).join('\\n')||'- (none)'}

**Last \${Math.min(5,cmds.length)} commands run:**
\${cmds.join('\\n')||'  (none)'}

**Last user message:**
> \${lastUser}

## At step \${stepNum}
The agent was executing: \${atDesc}

## Continue from here
Pick up this session from step \${stepNum}. The files listed above have been modified.
Branch: \${meta.branch||'unknown'}
Session: \${meta.sessionId||'unknown'}
\`;

  const blob=new Blob([md],{type:'text/markdown'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='fork-step-'+stepNum+'.md';
  a.click();
}

// ── Keyboard navigation ───────────────────────────────────────────────────────
let activeIdx=0;
const steps=()=>[...tl.querySelectorAll('.step')];

document.getElementById('timeline').addEventListener('keydown', e=>{
  const all=steps();
  if(e.key==='j'||e.key==='ArrowDown'){ e.preventDefault(); activeIdx=Math.min(activeIdx+1,all.length-1); scroll(all); }
  if(e.key==='k'||e.key==='ArrowUp'){   e.preventDefault(); activeIdx=Math.max(activeIdx-1,0); scroll(all); }
  if(e.key==='Enter'){
    const el=all[activeIdx];
    if(el) el.querySelector('.step-header')?.click();
  }
  if(e.key==='Escape'){
    all.forEach(el=>{ el.classList.remove('expanded'); });
  }
  if(e.key==='f'){
    const ev=events[activeIdx];
    if(ev) forkFrom(ev.step);
  }
});

function scroll(all){
  all[activeIdx]?.scrollIntoView({block:'nearest',behavior:'smooth'});
}
</script>
</body>
</html>`;
}
