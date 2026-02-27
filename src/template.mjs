// src/template.mjs — self-contained HTML/CSS/JS viewer
// REPLAY_DATA is injected as a JSON constant before this script runs.

export function buildHtml(replayData) {
  const json = JSON.stringify(replayData)
    .replace(/<\/script>/gi, '<\\/script>')
    .replace(/<!--/g, '<\\!--');
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Session Replay — ${replayData.meta.project}</title>
<style>
:root {
  --bg:        #080b10;
  --surface:   #0f1318;
  --surface2:  #161b22;
  --surface3:  #1c2128;
  --border:    #21262d;
  --border2:   #30363d;
  --text:      #e6edf3;
  --muted:     #768390;
  --faint:     #3d444d;

  --bash:      #ff7b7b;
  --edit:      #58a6ff;
  --write:     #3fb950;
  --read:      #8b949e;
  --user:      #f0883e;
  --thinking:  #484f58;
  --task:      #bc8cff;
  --error:     #f85149;
  --branch:    #f0883e;
}
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;overflow:hidden}
body{
  background:var(--bg);
  color:var(--text);
  font-family:-apple-system,'Segoe UI',sans-serif;
  font-size:14px;
  display:flex;
  flex-direction:column;
}

/* ─── HEADER ─────────────────────────────────────────────────────── */
.header{
  flex-shrink:0;
  background:linear-gradient(160deg,#0d1526 0%,#0f1318 60%,#080b10 100%);
  border-bottom:1px solid var(--border);
  padding:18px 28px 14px;
}
.header-row1{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:14px}
.session-name{
  font-size:18px;font-weight:700;color:#f0f6fc;
  display:flex;align-items:center;gap:10px;
}
.session-name .project-tag{
  background:linear-gradient(135deg,#1f6feb,#388bfd);
  color:#fff;font-size:11px;font-weight:600;
  border-radius:5px;padding:2px 8px;letter-spacing:.3px;
}
.session-sub{
  display:flex;gap:10px;align-items:center;
  color:var(--muted);font-size:12px;margin-top:4px;
}
.chip{
  background:var(--surface3);border:1px solid var(--border);
  border-radius:12px;padding:2px 9px;font-size:11px;font-weight:500;
}
.chip.branch{color:#79c0ff;border-color:#1f6feb44}
.chip.date{color:var(--muted)}

/* Stats row */
.stats-row{display:flex;gap:10px;flex-wrap:wrap}
.stat{
  background:var(--surface2);border:1px solid var(--border);
  border-radius:8px;padding:8px 14px;min-width:80px;text-align:center;
  transition:border-color .15s;
}
.stat:hover{border-color:var(--border2)}
.stat.has-error{
  border-color:rgba(248,81,73,.4);
  background:rgba(248,81,73,.06);
}
.stat-n{font-size:20px;font-weight:700;color:#f0f6fc;line-height:1}
.stat.has-error .stat-n{color:var(--error)}
.stat-l{font-size:9px;text-transform:uppercase;letter-spacing:.6px;color:var(--muted);margin-top:3px}

/* Header buttons */
.hdr-btns{display:flex;gap:6px;align-items:flex-start;flex-shrink:0;margin-left:20px}
.hbtn{
  background:var(--surface2);border:1px solid var(--border);
  color:var(--muted);border-radius:6px;padding:5px 11px;
  font-size:11px;cursor:pointer;transition:all .15s;white-space:nowrap;
}
.hbtn:hover{background:var(--surface3);color:var(--text);border-color:var(--border2)}
.hbtn.on{background:#12243a;border-color:#1f6feb;color:#79c0ff}

/* ─── FILTER BAR ──────────────────────────────────────────────────── */
.filter-bar{
  flex-shrink:0;
  background:var(--surface);
  border-bottom:1px solid var(--border);
  padding:8px 28px;
  display:flex;gap:6px;align-items:center;flex-wrap:wrap;
}
.fchip{
  display:inline-flex;align-items:center;gap:5px;
  border:1px solid var(--border);background:transparent;
  color:var(--muted);border-radius:20px;padding:3px 11px;
  font-size:11px;cursor:pointer;transition:all .15s;font-family:inherit;
}
.fchip:hover{border-color:var(--border2);color:var(--text)}
.fchip.on{background:#12243a;border-color:#1f6feb;color:#79c0ff}
.fchip .cd{width:6px;height:6px;border-radius:50%;flex-shrink:0}
.fchip .cn{
  background:rgba(255,255,255,.08);border-radius:8px;
  padding:0 5px;font-size:10px;
}
.search{
  margin-left:auto;background:var(--surface2);
  border:1px solid var(--border);color:var(--text);
  border-radius:6px;padding:4px 10px;font-size:12px;
  width:180px;outline:none;font-family:inherit;
}
.search:focus{border-color:var(--edit)}
.search::placeholder{color:var(--faint)}

/* ─── MAIN SCROLL AREA ────────────────────────────────────────────── */
.scroll-area{flex:1;overflow-y:auto;overflow-x:hidden}
.timeline{
  max-width:900px;margin:0 auto;
  padding:20px 28px 80px;
  position:relative;
}
/* Vertical guide */
.timeline::before{
  content:'';position:absolute;
  left:47px;top:20px;bottom:20px;
  width:2px;
  background:linear-gradient(to bottom,transparent,var(--border) 4%,var(--border) 96%,transparent);
}

/* ─── STEP ROW ────────────────────────────────────────────────────── */
.srow{display:flex;gap:14px;margin-bottom:6px;align-items:flex-start}
.srow.hidden{display:none}
.srow.kbd-active .scard{box-shadow:0 0 0 2px rgba(88,166,255,.35);border-color:rgba(88,166,255,.5)!important}

/* Dot */
.sdot{
  width:36px;height:36px;flex-shrink:0;
  border-radius:50%;border:2px solid var(--border);
  background:var(--surface2);z-index:1;
  display:flex;align-items:center;justify-content:center;
  font-size:13px;margin-top:2px;
  transition:border-color .15s,background .15s;
}
.srow:hover .sdot{border-color:var(--border2)}

/* Dot color variants */
.dot-bash    {background:rgba(255,123,123,.12);border-color:rgba(255,123,123,.45)}
.dot-edit    {background:rgba(88,166,255,.12);border-color:rgba(88,166,255,.45)}
.dot-write   {background:rgba(63,185,80,.12);border-color:rgba(63,185,80,.45)}
.dot-read,
.dot-glob,
.dot-grep    {background:rgba(139,148,158,.1);border-color:rgba(139,148,158,.3)}
.dot-user    {background:rgba(240,136,62,.14);border-color:rgba(240,136,62,.5)}
.dot-thinking{background:rgba(72,79,88,.2);border-color:rgba(72,79,88,.5)}
.dot-task    {background:rgba(188,140,255,.12);border-color:rgba(188,140,255,.4)}
.dot-failed  {background:rgba(248,81,73,.15);border-color:rgba(248,81,73,.7)!important}

/* ─── STEP CARD ───────────────────────────────────────────────────── */
.scard{
  flex:1;border:1px solid var(--border);border-radius:9px;
  background:var(--surface);overflow:hidden;
  transition:border-color .15s,box-shadow .15s;
}
.scard:hover{border-color:var(--border2)}
.scard.failed{
  border-color:rgba(248,81,73,.4)!important;
  background:rgba(248,81,73,.025);
}
.scard.is-user{
  border-color:rgba(240,136,62,.3);
  background:linear-gradient(135deg,rgba(240,136,62,.07),rgba(240,136,62,.02));
}

/* Card header */
.shead{
  padding:9px 12px;display:flex;align-items:center;
  gap:9px;cursor:pointer;user-select:none;
}
.scard:not(.is-user) .shead:hover{background:rgba(255,255,255,.025)}

/* Left accent bars */
.acc-bash    .shead{border-left:3px solid var(--bash)}
.acc-edit    .shead{border-left:3px solid var(--edit)}
.acc-write   .shead{border-left:3px solid var(--write)}
.acc-read    .shead,
.acc-glob    .shead,
.acc-grep    .shead{border-left:3px solid var(--faint)}
.acc-user    .shead{border-left:3px solid var(--user)}
.acc-thinking .shead{border-left:3px solid var(--thinking)}
.acc-task    .shead{border-left:3px solid var(--task)}
.scard.failed .shead{border-left:3px solid var(--error)!important}

/* Tool badge */
.tbadge{
  font-size:9px;font-weight:700;letter-spacing:.6px;
  text-transform:uppercase;border-radius:4px;
  padding:2px 6px;flex-shrink:0;min-width:46px;text-align:center;
}
.tb-bash    {background:rgba(255,123,123,.15);color:#ff8f8f}
.tb-edit    {background:rgba(88,166,255,.15);color:#79c0ff}
.tb-write   {background:rgba(63,185,80,.15);color:#56d364}
.tb-read,
.tb-glob,
.tb-grep    {background:rgba(139,148,158,.12);color:var(--read)}
.tb-user    {background:rgba(240,136,62,.15);color:#ffab70}
.tb-thinking{background:rgba(72,79,88,.2);color:var(--thinking)}
.tb-task    {background:rgba(188,140,255,.15);color:#d2a8ff}
.tb-failed  {background:rgba(248,81,73,.2);color:#ff7b72}

/* Step number */
.snum{font-size:10px;color:var(--faint);min-width:26px;text-align:right;flex-shrink:0}

/* Description */
.sdesc{
  flex:1;font-size:13px;overflow:hidden;text-overflow:ellipsis;
  white-space:nowrap;color:var(--text);
}
.sdesc code{
  font-family:'SF Mono','Fira Code',monospace;font-size:11px;
  background:var(--surface3);padding:1px 5px;border-radius:3px;
  color:#cdd9e5;
}

/* Meta area */
.smeta{display:flex;align-items:center;gap:7px;flex-shrink:0}
.dur{font-size:11px;color:var(--muted)}
.fail-tag{
  background:rgba(248,81,73,.15);border:1px solid rgba(248,81,73,.3);
  color:#ff7b72;font-size:9px;font-weight:600;text-transform:uppercase;
  letter-spacing:.4px;border-radius:4px;padding:1px 6px;
}
.chev{color:var(--faint);font-size:10px;transition:transform .2s}
.scard.open .chev{transform:rotate(90deg)}

/* ─── CARD BODY ───────────────────────────────────────────────────── */
.sbody{display:none;border-top:1px solid var(--border)}
.scard.open .sbody{display:block}

/* Terminal block */
.term{
  background:#020408;
  font-family:'SF Mono','Fira Code','Cascadia Code',monospace;
  font-size:12px;padding:14px 16px;
}
.term-prompt{
  display:flex;align-items:flex-start;gap:7px;margin-bottom:10px;
}
.term-ps1{color:#57ab5a;font-weight:600;flex-shrink:0}
.term-cmd{color:#cdd9e5;white-space:pre-wrap;word-break:break-all}
.term-section{
  font-size:9px;text-transform:uppercase;letter-spacing:.5px;
  color:var(--faint);margin:10px 0 5px;font-family:inherit;
}
.term-out{
  color:#8b949e;white-space:pre-wrap;word-break:break-all;
  max-height:300px;overflow-y:auto;line-height:1.45;
}
.term-err{
  color:#ff7b72;white-space:pre-wrap;word-break:break-all;
  max-height:200px;overflow-y:auto;line-height:1.45;
  background:rgba(248,81,73,.04);border-radius:4px;padding:6px 8px;
}
.term-interrupted{
  color:#f0883e;font-size:11px;margin-top:8px;
  display:flex;align-items:center;gap:5px;
}

/* File / diff block */
.fblock{padding:12px 14px}
.fpath{
  font-family:'SF Mono','Fira Code',monospace;font-size:11px;
  color:var(--edit);margin-bottom:10px;word-break:break-all;
  display:flex;align-items:center;gap:6px;
}
.fpath .lang-badge{
  background:var(--surface3);border:1px solid var(--border);
  color:var(--muted);font-size:9px;border-radius:3px;padding:1px 5px;
  text-transform:uppercase;letter-spacing:.4px;
}
.block-label{
  font-size:9px;text-transform:uppercase;letter-spacing:.5px;
  color:var(--faint);margin:10px 0 5px;
}
.block-label:first-child{margin-top:0}
pre.cblock{
  background:#020408;border:1px solid var(--border);
  border-radius:6px;padding:10px 12px;
  font-size:11px;white-space:pre-wrap;word-break:break-all;
  font-family:'SF Mono','Fira Code',monospace;line-height:1.5;
  max-height:260px;overflow-y:auto;color:#8b949e;
}
pre.cblock.removed{
  color:#ff7b72;background:rgba(248,81,73,.04);
  border-color:rgba(248,81,73,.2);
}
pre.cblock.added{
  color:#56d364;background:rgba(63,185,80,.04);
  border-color:rgba(63,185,80,.2);
}

/* Thinking body */
.thinkbody{
  padding:14px 16px;font-style:italic;
  color:var(--thinking);font-size:13px;line-height:1.7;
  max-height:220px;overflow-y:auto;
  background:rgba(72,79,88,.05);
}

/* User message body */
.user-full-text{
  padding:12px 16px 14px;
  color:#ffab70;font-size:14px;line-height:1.7;
  white-space:pre-wrap;word-break:break-word;
}

/* Fork button */
.fork-btn{
  display:inline-flex;align-items:center;gap:6px;
  margin:10px 14px 13px;
  background:rgba(255,255,255,.04);border:1px solid var(--border);
  color:var(--muted);border-radius:6px;padding:5px 12px;
  font-size:12px;cursor:pointer;transition:all .15s;
  font-family:inherit;
}
.fork-btn:hover{
  background:rgba(88,166,255,.1);
  border-color:rgba(88,166,255,.5);color:var(--edit);
}

/* ─── BRANCH SEPARATOR ────────────────────────────────────────────── */
.bsep{
  display:flex;align-items:center;gap:10px;
  margin:6px 0 6px 50px;
  color:var(--branch);font-size:11px;
}
.bsep::before,.bsep::after{
  content:'';flex:1;height:1px;
  background:rgba(240,136,62,.25);
}
.bsep-label{
  background:rgba(240,136,62,.1);border:1px solid rgba(240,136,62,.3);
  border-radius:4px;padding:2px 9px;white-space:nowrap;font-weight:500;
}

/* ─── SCROLLBARS ──────────────────────────────────────────────────── */
::-webkit-scrollbar{width:5px;height:5px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:var(--border2);border-radius:3px}
::-webkit-scrollbar-thumb:hover{background:#4a5568}

/* ─── KB HINT ─────────────────────────────────────────────────────── */
.kbhint{
  flex-shrink:0;
  background:rgba(8,11,16,.95);
  border-top:1px solid var(--border);
  padding:5px 28px;font-size:11px;color:var(--muted);
  display:flex;gap:16px;align-items:center;
}
kbd{
  background:var(--surface3);border:1px solid var(--border);
  border-radius:3px;padding:1px 5px;font-size:10px;font-family:inherit;
  color:var(--text);
}
.kbhint-spacer{flex:1}
.session-id{font-size:10px;color:var(--faint);font-family:'SF Mono',monospace}
</style>
</head>
<body>

<!-- HEADER -->
<div class="header">
  <div class="header-row1">
    <div>
      <div class="session-name">
        <span id="h-title"></span>
        <span class="project-tag" id="h-project"></span>
      </div>
      <div class="session-sub">
        <span class="chip branch" id="h-branch"></span>
        <span class="chip date" id="h-date"></span>
        <span id="h-dur" style="color:var(--muted);font-size:12px"></span>
      </div>
    </div>
    <div class="hdr-btns">
      <button class="hbtn" id="btn-expand">Expand all</button>
      <button class="hbtn" id="btn-collapse">Collapse all</button>
      <button class="hbtn" id="btn-errors">⚠ Errors only</button>
    </div>
  </div>
  <div class="stats-row" id="stats-row"></div>
</div>

<!-- FILTER BAR -->
<div class="filter-bar" id="filter-bar"></div>

<!-- TIMELINE -->
<div class="scroll-area">
  <div class="timeline" id="timeline"></div>
</div>

<!-- KB HINT -->
<div class="kbhint">
  <span><kbd>j</kbd><kbd>k</kbd> navigate</span>
  <span><kbd>Enter</kbd> expand</span>
  <span><kbd>f</kbd> fork</span>
  <span><kbd>/</kbd> search</span>
  <span><kbd>Esc</kbd> collapse all</span>
  <span class="kbhint-spacer"></span>
  <span class="session-id" id="kb-sid"></span>
</div>

<script>
const DATA = ${json};
const {events, meta, summary} = DATA;

// ── Helpers ─────────────────────────────────────────────────────────────────
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
function fmt(ms){
  if(!ms&&ms!==0)return'';
  const h=Math.floor(ms/3600000),m=Math.floor((ms%3600000)/60000),s=Math.floor((ms%60000)/1000);
  if(h>0)return h+'h '+m+'m';
  if(m>0)return m+'m '+s+'s';
  return s>0?s+'s':'<1s';
}
function ext(fp){return(fp||'').split('.').pop().toLowerCase()||'txt'}
function basename(fp){return(fp||'').split('/').pop()}

const ICONS={
  Bash:'$',Edit:'✎',Write:'✚',Read:'◎',Glob:'⌖',Grep:'⌖',
  WebFetch:'◈',Task:'⚙',user:'◉',thinking:'…',
  TodoWrite:'☑',TaskCreate:'☑',TaskUpdate:'☑',TaskGet:'☑',TaskList:'☑',
};
function icon(k){return ICONS[k]||'⬡'}

function tkey(ev){
  if(ev.type==='user')return'user';
  if(ev.type==='thinking')return'thinking';
  return ev.tool?.name||'unknown';
}

const KNOWN=['bash','edit','write','read','glob','grep','user','thinking','task'];
function safeKey(k){return KNOWN.includes(k.toLowerCase())?k.toLowerCase():'read'}

function desc(ev){
  if(ev.type==='user')return ev.text?.replace(/\\n/g,' ')||'';
  if(ev.type==='thinking')return'Claude is thinking…';
  const t=ev.tool;if(!t)return'';
  const n=t.name,i=t.input;
  if(n==='Bash')return i.description||i.command||'';
  if(n==='Edit'||n==='Write')return i.file_path||'';
  if(n==='Read')return i.file_path||'';
  if(n==='Glob')return i.pattern||'';
  if(n==='Grep')return'pattern: '+(i.pattern||'');
  if(n==='WebFetch')return i.url||'';
  if(n==='Task')return i.description||t.description||'subagent';
  return JSON.stringify(i).substring(0,100);
}

// ── Header ───────────────────────────────────────────────────────────────────
document.getElementById('h-title').textContent='Session Replay';
document.getElementById('h-project').textContent=meta.project||'unknown';
document.getElementById('h-branch').textContent='⎇ '+(meta.branch||'unknown');
document.getElementById('h-date').textContent=meta.date||'';
document.getElementById('h-dur').textContent=fmt(summary.durationMs||meta.durationMs);
document.getElementById('kb-sid').textContent=(meta.sessionId||'').substring(0,8)+'…';

// Stats
const statsRow=document.getElementById('stats-row');
[
  {n:summary.totalSteps,     l:'Steps'},
  {n:summary.errorCount,     l:'Errors',    err:summary.errorCount>0},
  {n:summary.branchPoints,   l:'Branch pts'},
  {n:(summary.filesEdited||[]).length, l:'Files changed'},
  {n:fmt(summary.durationMs||0),l:'Duration',  raw:true},
].forEach(s=>{
  const d=document.createElement('div');
  d.className='stat'+(s.err?' has-error':'');
  d.innerHTML='<div class="stat-n">'+s.n+'</div><div class="stat-l">'+s.l+'</div>';
  statsRow.appendChild(d);
});

// ── Filter bar ───────────────────────────────────────────────────────────────
const tc=summary.toolCounts||{};
const filterBar=document.getElementById('filter-bar');
let activeFilter='all';

const filterDefs=[
  {key:'all',     label:'All',      count:events.length,                        color:'#8b949e'},
  {key:'user',    label:'User',     count:events.filter(e=>e.type==='user').length,      color:'#f0883e'},
  {key:'Bash',    label:'Bash',     count:tc.Bash||0,                           color:'#ff7b7b'},
  {key:'Edit',    label:'Edit',     count:tc.Edit||0,                           color:'#58a6ff'},
  {key:'Write',   label:'Write',    count:tc.Write||0,                          color:'#3fb950'},
  {key:'Read',    label:'Read',     count:(tc.Read||0)+(tc.Glob||0)+(tc.Grep||0), color:'#8b949e'},
  {key:'thinking',label:'Thinking', count:events.filter(e=>e.type==='thinking').length,  color:'#484f58'},
  {key:'errors',  label:'⚠ Errors', count:summary.errorCount,                  color:'#f85149'},
].filter(f=>f.count>0);

filterDefs.forEach(f=>{
  const btn=document.createElement('button');
  btn.className='fchip'+(f.key==='all'?' on':'');
  btn.dataset.fk=f.key;
  btn.innerHTML='<span class="cd" style="background:'+f.color+'"></span>'+
    esc(f.label)+' <span class="cn">'+f.count+'</span>';
  btn.addEventListener('click',()=>setFilter(f.key));
  filterBar.appendChild(btn);
});

const search=document.createElement('input');
search.className='search';
search.placeholder='Search steps…';
search.addEventListener('input',applyFilter);
filterBar.appendChild(search);

function setFilter(k){
  activeFilter=k;
  filterBar.querySelectorAll('.fchip').forEach(c=>c.classList.toggle('on',c.dataset.fk===k));
  document.getElementById('btn-errors').classList.toggle('on',k==='errors');
  applyFilter();
}
function applyFilter(){
  const q=search.value.toLowerCase();
  document.querySelectorAll('.srow[data-idx]').forEach(row=>{
    const i=parseInt(row.dataset.idx),ev=events[i];
    if(!ev){row.classList.add('hidden');return}
    let show=true;
    if(activeFilter!=='all'){
      if(activeFilter==='errors')show=ev.failed;
      else if(activeFilter==='user')show=ev.type==='user';
      else if(activeFilter==='thinking')show=ev.type==='thinking';
      else if(activeFilter==='Read')show=['Read','Glob','Grep'].includes(ev.tool?.name);
      else show=ev.tool?.name===activeFilter;
    }
    if(show&&q)show=(desc(ev)+' '+(ev.text||'')).toLowerCase().includes(q);
    row.classList.toggle('hidden',!show);
  });
}

// ── Timeline ─────────────────────────────────────────────────────────────────
const tl=document.getElementById('timeline');

events.forEach((ev,i)=>{
  // Branch separator before branch points
  if(ev.isBranchPoint){
    const sep=document.createElement('div');
    sep.className='bsep';
    sep.innerHTML='<span class="bsep-label">⑂ User intervened</span>';
    tl.appendChild(sep);
  }

  const tk=tkey(ev);
  const sk=safeKey(tk);
  const isUser=ev.type==='user';
  const isThink=ev.type==='thinking';

  // Row wrapper
  const row=document.createElement('div');
  row.className='srow';
  row.dataset.idx=i;

  // Dot
  const dot=document.createElement('div');
  dot.className='sdot '+(ev.failed?'dot-failed':'dot-'+sk);
  dot.textContent=icon(tk);

  // Card
  const card=document.createElement('div');
  const accentCls=isUser?'':isThink?'':'acc-'+sk;
  card.className='scard '+accentCls+(ev.failed?' failed':'')+(isUser?' is-user':'');

  const d=desc(ev);
  const shortDesc=isUser
    ? '<code style="font-family:inherit;background:none;color:#ffab70;font-size:13px">'+esc(d.substring(0,160))+(d.length>160?'…':'')+'</code>'
    : '<code>'+esc(d.substring(0,120))+(d.length>120?'…':'')+'</code>';

  const badgeCls='tb-'+(ev.failed?'failed':sk);
  const badgeTxt=ev.failed?'error':tk;

  card.innerHTML=\`
    <div class="shead">
      <span class="snum">\${ev.step}</span>
      <span class="tbadge \${badgeCls}">\${esc(badgeTxt)}</span>
      <span class="sdesc">\${shortDesc}</span>
      <span class="smeta">
        \${ev.failed?'<span class="fail-tag">failed</span>':''}
        \${ev.durationMs?'<span class="dur">'+fmt(ev.durationMs)+'</span>':''}
        <span class="chev">▶</span>
      </span>
    </div>
    <div class="sbody" id="body-\${i}"></div>
  \`;

  card.querySelector('.shead').addEventListener('click',()=>{
    const wasOpen=card.classList.contains('open');
    card.classList.toggle('open');
    if(!wasOpen)renderBody(ev,document.getElementById('body-'+i));
    activeIdx=i;
  });

  row.appendChild(dot);
  row.appendChild(card);
  tl.appendChild(row);
});

// ── Body renderer ────────────────────────────────────────────────────────────
function renderBody(ev,el){
  if(el._r)return;
  el._r=true;
  let h='';

  if(ev.type==='thinking'){
    h+='<div class="thinkbody">'+esc(ev.thinking?.substring(0,4000)||'')+'</div>';
  } else if(ev.type==='user'){
    h+='<div class="user-full-text">'+esc(ev.text||'')+'</div>';
  } else if(ev.type==='tool_call'&&ev.tool){
    const n=ev.tool.name,inp=ev.tool.input;

    if(n==='Bash'){
      const cmd=inp.command||'';
      const out=(ev.result?.stdout||'').trim();
      const err=(ev.result?.stderr||'').trim();
      h+='<div class="term">';
      h+='<div class="term-prompt"><span class="term-ps1">$</span><span class="term-cmd">'+esc(cmd)+'</span></div>';
      if(out)h+='<div class="term-section">Output</div><pre class="term-out">'+esc(out.substring(0,5000))+'</pre>';
      if(err)h+='<div class="term-section">Stderr</div><pre class="term-err">'+esc(err.substring(0,2000))+'</pre>';
      if(ev.result?.interrupted)h+='<div class="term-interrupted">⚠ Interrupted</div>';
      h+='</div>';
    } else if(n==='Edit'){
      const fp=inp.file_path||'';
      h+='<div class="fblock">';
      h+='<div class="fpath">'+esc(fp)+'<span class="lang-badge">'+esc(ext(fp))+'</span></div>';
      if(inp.old_string!=null){
        h+='<div class="block-label">Removed</div><pre class="cblock removed">'+esc(inp.old_string.substring(0,2000))+'</pre>';
        h+='<div class="block-label">Added</div><pre class="cblock added">'+esc(inp.new_string.substring(0,2000))+'</pre>';
      }
      h+='</div>';
    } else if(n==='Write'){
      const fp=inp.file_path||'';
      h+='<div class="fblock">';
      h+='<div class="fpath">'+esc(fp)+'<span class="lang-badge">'+esc(ext(fp))+'</span></div>';
      if(inp.content)h+='<div class="block-label">Content</div><pre class="cblock added">'+esc(inp.content.substring(0,3000))+'</pre>';
      h+='</div>';
    } else if(n==='Read'){
      const fp=inp.file_path||'';
      h+='<div class="fblock">';
      h+='<div class="fpath">'+esc(fp)+'<span class="lang-badge">'+esc(ext(fp))+'</span></div>';
      const out=(ev.result?.stdout||'').trim();
      if(out)h+='<div class="block-label">Contents</div><pre class="cblock">'+esc(out.substring(0,3000))+'</pre>';
      h+='</div>';
    } else if(n==='Glob'||n==='Grep'){
      h+='<div class="fblock">';
      h+='<div class="block-label">Query</div><pre class="cblock">'+esc(JSON.stringify(inp,null,2))+'</pre>';
      const out=(ev.result?.stdout||'').trim();
      if(out)h+='<div class="block-label">Results</div><pre class="cblock">'+esc(out.substring(0,2000))+'</pre>';
      h+='</div>';
    } else {
      h+='<div class="fblock">';
      h+='<div class="block-label">Input</div><pre class="cblock">'+esc(JSON.stringify(inp,null,2).substring(0,1500))+'</pre>';
      const out=(ev.result?.stdout||'').trim();
      if(out)h+='<div class="block-label">Output</div><pre class="cblock">'+esc(out.substring(0,1500))+'</pre>';
      h+='</div>';
    }
  }

  h+='<button class="fork-btn" onclick="forkFrom('+ev.step+')">⑂ Fork from step '+ev.step+'</button>';
  el.innerHTML=h;
}

// ── Fork ─────────────────────────────────────────────────────────────────────
function forkFrom(stepNum){
  const prior=events.filter(e=>e.step<=stepNum);
  const files=[...new Set(prior.filter(e=>e.tool&&['Edit','Write'].includes(e.tool.name)).map(e=>e.tool.input.file_path))];
  const cmds=prior.filter(e=>e.tool?.name==='Bash').slice(-5).map(e=>'  $ '+(e.tool.input.command||''));
  const lastUser=prior.filter(e=>e.type==='user').pop()?.text||'';
  const atStep=prior[prior.length-1];
  const atDesc=atStep?.tool?atStep.tool.name+': '+(atStep.tool.input.file_path||atStep.tool.input.command||''):atStep?.text||'';
  const md=\`# Session Fork — \${meta.project} from step \${stepNum}

## What happened before this point (steps 1–\${stepNum})

**Files changed:**
\${files.map(f=>'- '+f).join('\\n')||'- (none)'}

**Last commands run:**
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
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([md],{type:'text/markdown'}));
  a.download='fork-step-'+stepNum+'.md';
  a.style.display='none';
  document.body.appendChild(a);
  a.click();
  setTimeout(()=>{document.body.removeChild(a);URL.revokeObjectURL(a.href)},100);
}

// ── Controls ──────────────────────────────────────────────────────────────────
document.getElementById('btn-expand').addEventListener('click',()=>{
  document.querySelectorAll('.srow:not(.hidden) .scard:not(.is-user)').forEach(c=>{
    if(!c.classList.contains('open')){
      c.classList.add('open');
      const i=parseInt(c.closest('.srow')?.dataset.idx??-1);
      if(i>=0)renderBody(events[i],document.getElementById('body-'+i));
    }
  });
});
document.getElementById('btn-collapse').addEventListener('click',()=>{
  document.querySelectorAll('.scard.open').forEach(c=>c.classList.remove('open'));
});
document.getElementById('btn-errors').addEventListener('click',function(){
  setFilter(activeFilter==='errors'?'all':'errors');
});

// ── Keyboard nav ──────────────────────────────────────────────────────────────
let activeIdx=0;
function visRows(){return[...document.querySelectorAll('.srow[data-idx]:not(.hidden)')]}

document.addEventListener('keydown',e=>{
  if(e.target===search){
    if(e.key==='Escape'){search.value='';search.blur();applyFilter()}
    return;
  }
  if(e.key==='/')    {e.preventDefault();search.focus();return}

  const all=visRows();
  const pos=all.findIndex(r=>parseInt(r.dataset.idx)===activeIdx);

  if(e.key==='j'||e.key==='ArrowDown'){
    e.preventDefault();
    const nxt=all[Math.min(pos+1,all.length-1)];
    if(nxt)jump(all,nxt);
  }
  if(e.key==='k'||e.key==='ArrowUp'){
    e.preventDefault();
    const prv=all[Math.max(pos-1,0)];
    if(prv)jump(all,prv);
  }
  if(e.key==='Enter'){
    all[pos]?.querySelector('.shead')?.click();
  }
  if(e.key==='Escape'){
    document.querySelectorAll('.scard.open').forEach(c=>c.classList.remove('open'));
  }
  if(e.key==='f'){
    const ev=events[activeIdx];if(ev)forkFrom(ev.step);
  }
});

function jump(all,target){
  all.forEach(r=>r.classList.remove('kbd-active'));
  target.classList.add('kbd-active');
  activeIdx=parseInt(target.dataset.idx);
  target.scrollIntoView({block:'nearest',behavior:'smooth'});
}
</script>
</body>
</html>`;
}
