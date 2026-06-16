/* =====================================================================
   Misir dashboard — views (scope-aware)
   All render functions pull data via window.activeData() / window.scopeX()
   defined in app.js. Views detect state.scope to route All vs. Single.
   ===================================================================== */

/* ============================================================
   Shared helpers
   ============================================================ */
window.fmt = {
  spark(values, w=56, h=16) {
    if (!values||!values.length) return "";
    const max = Math.max(1,...values);
    const step = w/(values.length-1||1);
    const pts = values.map((v,i)=>`${(i*step).toFixed(1)},${(h-(v/max)*(h-2)-1).toFixed(1)}`).join(" ");
    return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="none"><polyline points="${pts}" stroke="var(--accent)" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"></polyline></svg>`;
  },
  icn(name, size=14) { return `<i data-lucide="${name}" style="width:${size}px;height:${size}px;"></i>`; },
  subspaceTag(id) {
    const s = window.getSubspaceById ? window.getSubspaceById(id) : null;
    if (!s) return "";
    const color = window.getSpaceColor ? window.getSpaceColor(s.spaceId) : "var(--accent)";
    return `<span class="subspace-tag" style="--sc:${color};">${s.title}</span>`;
  },
  spaceTag(spaceId) {
    const sp = (window.SPACES||[]).find(x => x.id === spaceId);
    if (!sp) return "";
    const color = window.getSpaceColor(spaceId);
    return `<span class="space-tag" style="--sc:${color};">${sp.title}</span>`;
  },
};

/* ──────────────────────────────────────────────────────────── */
window.renderNudge = function(nudge) {
  const n = nudge || (window.activeData()||{}).nudge || window.NUDGE || null;
  if (!n) return "";
  return `
    <div class="nudge" role="region" aria-label="Misir noticed">
      <div>
        <div class="micro"><span class="pulsing"></span> Misir noticed</div>
        <div class="scatter">${n.scatter}</div>
        <div class="direction">${n.direction}</div>
        <div class="consequence">${n.consequence}</div>
      </div>
      <div class="row" style="gap:8px;">
        <button class="btn primary" onclick="setView('decision')">${fmt.icn("git-branch",12)} Decision tree</button>
        <button class="btn ghost" onclick="dismissNudge()" title="Dismiss">${fmt.icn("x",14)}</button>
      </div>
    </div>`;
};

/* ============================================================
   HOME — router
   ============================================================ */
window.renderHome = function() {
  return (state.scope === "all") ? renderHomeAll() : renderHomeSingle();
};

/* ─── ALL SPACES HOME ─────────────────────────────────────── */
function renderHomeAll() {
  const allCaptures = window.getAllCaptures();
  const totalWeek     = window.SPACES.reduce((a,s) => a + (s.capturesWeek||0), 0);
  const totalCritical = window.SPACES.reduce((a,s) => a + (s.criticalGaps||0), 0);

  const INSIGHTS = [
    { type:"readiness",   label:"Almost there",  icon:"check-circle",  text:"You are 2 reference calls away from making the VP Engineering offer. Everything else in the hire space is done. Readiness shows 71% but the real gap is a single afternoon.", cta:"Open Hire", ctaFn:"setScope('hire');setView('home');", spaces:["hire"] },
    { type:"collision",   label:"Deadline",       icon:"alert-circle",  text:"VP Engineering offer in 14 days. H2 roadmap board review in 18 days. The person you hire changes what can realistically ship in H2. You haven't connected these two decisions.", cta:"See both", ctaFn:"setScope('all');setView('decision');", spaces:["hire","roadmap"] },
    { type:"pattern",     label:"Pattern",        icon:"repeat",        text:"You've opened GoMechanic 3 times and Fleet SaaS pricing twice this week — neither has moved. These aren't research gaps. You're circling the hardest questions.", cta:"Break the loop", ctaFn:"setScope('series-a');setView('decision');", spaces:["series-a","fleet"] },
    { type:"cross-space", label:"Cross-space",    icon:"link-2",        text:"Accelerating Asia appears in your Series A investor research <em>and</em> has an active fleet thesis. One conversation advances two spaces at once.", cta:"Connect spaces", ctaFn:"setScope('series-a');setView('comparison');", spaces:["series-a","fleet"] },
    { type:"blindspot",   label:"Blind spot",     icon:"eye-off",       text:`${totalWeek} captures this week. Readiness moved in 2 of 4 spaces. The reading is happening — the synthesis isn't. None of your Fleet SaaS captures have generated a decision yet.`, cta:"Open Collection", ctaFn:"setScope('all');setView('collection');", spaces:["fleet","roadmap"] },
  ];

  const TYPE_META = {
    "cross-space":{ color:"#2A4A7A", bg:"rgba(42,74,122,0.07)" },
    "pattern":    { color:"#FF6C3C", bg:"rgba(255,108,60,0.07)" },
    "collision":  { color:"#B8730D", bg:"rgba(184,115,13,0.07)" },
    "readiness":  { color:"#2A6A4A", bg:"rgba(42,106,74,0.07)" },
    "blindspot":  { color:"#A8423D", bg:"rgba(168,66,61,0.07)" },
  };

  const hour = new Date().getHours();
  const grt  = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  // Compute the single most compelling statement from data
  const MOMENTS = [
    // Behavioral pattern — most surprising
    { text: "You've opened GoMechanic three times\nthis week. You haven't written\na single answer down.", accent:"#FF6C3C", spaceId:"series-a", ctaFn:"setScope('series-a');setView('decision');", cta:"Break the loop" },
    // Cross-space collision
    { text: "The person you hire as VP Engineering\ndirectly changes what ships\nin H2. You haven't connected these.", accent:"#B8730D", spaceId:"hire", ctaFn:"setScope('all');setView('decision');", cta:"See the collision" },
    // Almost done
    { text: "Two reference calls. That's all\nthat stands between you and\nthe VP Engineering offer.", accent:"#2A6A4A", spaceId:"hire", ctaFn:"setScope('hire');setView('home');", cta:"Open Hire" },
    // Cross-space opportunity
    { text: "One conversation with Accelerating Asia\nadvances both your Series A\nand Fleet SaaS spaces at once.", accent:"#2A4A7A", spaceId:"series-a", ctaFn:"setScope('series-a');setView('comparison');", cta:"Connect spaces" },
  ];
  // Pick based on most critical space
  const moment = MOMENTS[0]; // cycle could be random or time-based in production

  return `

    <!-- ═══ HERO ═══ -->
    <div class="all-hero">
      <div class="ah-left">
        <div class="ah-greeting">${grt}, ${window.USER.name}.</div>
        <div class="ah-moment">${moment.text.split("\n").map((line, i) => `
          <span class="ah-line ${i===2?"ah-line-accent":""}" style="${i===2?"color:"+moment.accent+";":""}">${line}</span>
        `).join("")}</div>
        <div class="ah-moment-foot">
          <button class="ah-cta" style="color:${moment.accent};border-color:color-mix(in srgb,${moment.accent} 30%,transparent);" onclick="${moment.ctaFn}">${moment.cta} ${fmt.icn("arrow-right",12)}</button>
          <span class="ah-meta">${totalWeek} captures · ${totalCritical} critical gap${totalCritical===1?"":"s"}</span>
        </div>
      </div>
      <div class="ah-right">
        ${window.SPACES.map(s => {
          const color = window.getSpaceColor(s.id);
          const ch    = (window.SPACE_DATA[s.id]||{}).challenge || {};
          return `
            <button class="ah-space" onclick="setScope('${s.id}')" style="--sc:${color};">
              <div class="ah-sp-ring" style="background:conic-gradient(${color} 0 ${s.readiness*3.6}deg,var(--border-strong) ${s.readiness*3.6}deg 360deg);">
                <div class="ah-sp-inner">${s.readiness}%</div>
              </div>
              <div class="ah-sp-info">
                <div class="ah-sp-name">${s.title}</div>
                <div class="ah-sp-meta" style="color:${color};">
                  ${s.criticalGaps>0 ? `<span>${s.criticalGaps} critical</span>` : `<span style="color:var(--success);">On track</span>`}
                  ${ch.deadline ? `<span>· ${ch.deadline.inDays}d</span>` : ""}
                </div>
              </div>
            </button>
          `;
        }).join("")}
      </div>
    </div>

    <!-- ═══ INSIGHTS ═══ -->
    <div class="sec-head">
      <div class="title">What Misir noticed <small>5 things worth knowing this week</small></div>
    </div>

    <div class="insight-list">
      ${INSIGHTS.map((ins, i) => {
        const meta = TYPE_META[ins.type] || TYPE_META["pattern"];
        const chips = ins.spaces.map(id => {
          const sp = window.SPACES.find(s => s.id === id);
          const c  = window.getSpaceColor(id);
          return sp ? `<span class="ins-space-chip" style="color:${c};border-color:color-mix(in srgb,${c} 30%,transparent);background:color-mix(in srgb,${c} 7%,transparent);">${sp.title}</span>` : "";
        }).join("");
        return `
          <div class="insight-row" style="--ins-color:${meta.color};--ins-bg:${meta.bg};">
            <div class="ins-num">${String(i+1).padStart(2,"0")}</div>
            <div class="ins-label">
              <span class="ins-type" style="color:${meta.color};">${fmt.icn(ins.icon,12)} ${ins.label}</span>
              <div class="ins-chips">${chips}</div>
            </div>
            <div class="ins-text">${ins.text}</div>
            <button class="ins-cta" style="color:${meta.color};border-color:color-mix(in srgb,${meta.color} 25%,transparent);" onclick="${ins.ctaFn}">${ins.cta} ${fmt.icn("arrow-right",11)}</button>
          </div>`;
      }).join("")}
    </div>

    <div class="space-pulse-strip">
      ${window.SPACES.map(s => {
        const color = window.getSpaceColor(s.id);
        const ch    = (window.SPACE_DATA[s.id]||{}).challenge || {};
        return `
          <button class="sps-item" onclick="setScope('${s.id}')" style="--sc:${color};">
            <div class="sps-top">
              <span class="sps-dot" style="background:${color};"></span>
              <span class="sps-name">${s.title}</span>
              ${s.criticalGaps > 0 ? `<span class="sps-crit">${s.criticalGaps}</span>` : ""}
            </div>
            <div class="sps-bar"><div class="sps-fill" style="width:${s.readiness}%;background:${color};"></div></div>
            <div class="sps-meta">
              <span style="font-weight:600;color:${color};">${s.readiness}%</span>
              ${ch.deadline ? `<span>· ${ch.deadline.inDays}d</span>` : ""}
              <span style="margin-left:auto;">${s.capturesWeek} cap</span>
            </div>
          </button>`;
      }).join("")}
    </div>

  `;
}

function renderSpaceSection(s) {
  const d     = window.SPACE_DATA[s.id] || {};
  const ch    = d.challenge || {};
  const color = window.getSpaceColor(s.id);
  const ss    = d.subspaces || [];

  return `
    <div class="space-section">
      <div class="space-section-head">
        <div class="ssh-left">
          <span class="ssh-dot" style="background:${color};"></span>
          <span class="ssh-title">${s.title}</span>
          ${ch.deadline ? `<span class="ssh-dead" style="color:${color};">${fmt.icn("clock",11)} ${ch.deadline.inDays}d · ${ch.deadline.label}</span>` : ""}
        </div>
        <div class="ssh-right">
          <div class="ssh-ring-wrap">
            <div class="ssh-ring" style="background:conic-gradient(${color} 0 ${s.readiness*3.6}deg,var(--border-strong) ${s.readiness*3.6}deg 360deg);">
              <div class="ssh-ring-inner">${s.readiness}%</div>
            </div>
          </div>
          <button class="sc-open" style="color:${color};border-color:color-mix(in srgb,${color} 35%,transparent);" onclick="setScope('${s.id}')">Open ${fmt.icn("arrow-right",11)}</button>
        </div>
      </div>

      <div class="ssh-goal">${ch.goal || ""}</div>

      <div class="ssh-subspaces">
        ${ss.map(sub => {
          const subColor = window.SUBSPACE_COLORS[sub.id] || color;
          const isCrit   = sub.flag === "critical";
          return `
            <div class="ssh-ss-row ${isCrit ? "ssh-ss-crit" : ""}" onclick="openSubspace('${sub.id}')">
              <div class="ssh-ss-lane" style="background:${subColor};"></div>
              <div class="ssh-ss-head">
                <span class="ssh-ss-title">${sub.title}</span>
                ${isCrit ? `<span class="ssr-flag">${fmt.icn("alert-circle",10)} Critical</span>` : ""}
                ${sub.flag === "low" ? `<span class="ssr-flag ssr-flag-low">${fmt.icn("alert-triangle",10)} Needs pull</span>` : ""}
              </div>
              <div class="ssh-ss-bar-wrap">
                <div class="ssr-bar"><div class="ssr-fill" style="width:${sub.completeness}%;background:${subColor};"></div></div>
                <span class="ssr-pct" style="color:${subColor};">${sub.completeness}%</span>
              </div>
              <div class="ssh-ss-meta">
                <span>${sub.captures} captures</span>
                ${sub.weekDelta > 0 ? `<span style="color:${subColor};font-weight:600;">+${sub.weekDelta} this week</span>` : ""}
                <span style="margin-left:auto;color:var(--fg-subtle);">${sub.lastHit}</span>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    </div>
  `;
}

function renderNudgeCompact(space, nudge) {
  const color = window.getSpaceColor(space.id);
  return `
    <div class="nudge" style="--accent-local:${color}; border-color:color-mix(in srgb,${color} 30%, transparent);" role="region">
      <div>
        <div class="micro" style="color:${color};">
          <span class="pulsing" style="background:${color};"></span>
          Misir noticed · ${space.title}
        </div>
        <div class="scatter">${nudge.scatter}</div>
        <div class="direction">${nudge.direction}</div>
        <div class="consequence" style="color:${color};">${nudge.consequence}</div>
      </div>
      <div class="row" style="gap:8px;">
        <button class="btn primary" style="background:${color};border-color:${color};" onclick="setScope('${space.id}');setView('decision');">Open →</button>
        <button class="btn ghost" onclick="dismissNudge()">${fmt.icn("x",14)}</button>
      </div>
    </div>`;
}

function renderSpaceCard(s) {
  const d    = window.SPACE_DATA[s.id] || {};
  const ch   = d.challenge || {};
  const color = window.getSpaceColor(s.id);
  const recent = (d.captures||[]).find(c => c.date === "Today") || (d.captures||[])[0];
  return `
    <div class="space-card" style="--sc:${color};">
      <div class="sc-accent"></div>
      <div class="sc-head">
        <div class="sc-title">${s.title}</div>
        ${ch.deadline ? `<div class="sc-dead" style="color:${color};">${fmt.icn("clock",10)} ${ch.deadline.inDays}d · ${ch.deadline.label}</div>` : ""}
      </div>
      <div class="sc-goal">${(ch.goal||"").slice(0,80)}…</div>
      <div class="sc-body">
        <div class="sc-ring-wrap">
          <div class="sc-ring" style="background:conic-gradient(${color} 0 ${s.readiness*3.6}deg, var(--border-strong) ${s.readiness*3.6}deg);">
            <div class="sc-ring-inner"><span>${s.readiness}%</span></div>
          </div>
          <div class="sc-ring-lbl">readiness</div>
        </div>
        <div class="sc-meta">
          <div class="sc-stat"><span>${s.subspaceCount}</span> subspaces</div>
          <div class="sc-stat"><span>${s.capturesWeek}</span> captures/wk</div>
          ${s.criticalGaps > 0
            ? `<div class="sc-stat critical"><span>${s.criticalGaps}</span> critical ${s.criticalGaps===1?"gap":"gaps"}</div>`
            : `<div class="sc-stat ok">${fmt.icn("check-circle",11)} No critical gaps</div>`}
        </div>
      </div>
      ${recent ? `<div class="sc-recent">${fmt.icn("zap",11)} ${recent.title.slice(0,60)}…</div>` : ""}
      <div class="sc-foot">
        <button class="sc-open" onclick="setScope('${s.id}')" style="color:${color};border-color:color-mix(in srgb,${color} 35%,transparent);">Open space ${fmt.icn("arrow-right",11)}</button>
      </div>
    </div>`;
}

function renderCaptureRowAll(c) {
  const spaceColor = window.getSpaceColor(c.spaceId);
  const sp = (window.SPACES||[]).find(x => x.id === c.spaceId);
  const ic = window.surfaceIcon(c.surface);
  return `
    <div class="capture-all" onclick="openCapture('${c.id}')">
      <span class="ca-dot" style="background:${spaceColor};"></span>
      <div class="ca-space" style="color:${spaceColor};">${sp?sp.title.split(" ").slice(0,2).join(" "):"—"}</div>
      <div class="ca-time">${c.time}</div>
      <div class="ca-icon">${fmt.icn(ic,13)}</div>
      <div class="ca-body">
        <span class="ca-title">${c.title}</span>
        ${c.revisit ? `<span class="revisit">×${c.revisit}</span>` : ""}
      </div>
      <div class="ca-marker">${c.marker}</div>
    </div>`;
}

/* ─── SINGLE SPACE HOME ────────────────────────────────────── */

window.MISIR_QUESTIONS = {
  "series-a": {
    subspaceId: "gomechanic-forensic",
    context:    "GoMechanic forensic is at 22%. You've opened it three times this week without answering the question.",
    question:   "Before you research more — how does Zantrik avoid the same failure? One sentence.",
    placeholder:"Zantrik avoids it because…",
  },
  "roadmap": {
    subspaceId: "rm-release",
    context:    "Your release strategy subspace is empty. Board review is in 18 days.",
    question:   "If you had to sequence your 3 H2 bets right now — what ships first, and why?",
    placeholder:"Fleet API ships first because…",
  },
  "fleet": {
    subspaceId: "fl-pricing",
    context:    "Fleet SaaS pricing is at 18%. You haven't validated a number with a single fleet operator.",
    question:   "What would a fleet manager pay per vehicle per month without hesitation? What's your gut number?",
    placeholder:"$X per vehicle because…",
  },
  "hire": {
    subspaceId: "hi-pipeline",
    context:    "You've reviewed Arif and Tanvir's profiles. Offer deadline is in 14 days.",
    question:   "What's the one thing you'd most want to understand about each of them before making an offer?",
    placeholder:"For Arif I want to know… For Tanvir…",
  },
};

function renderMisirAsks(d) {
  if (state.misirQuestionDismissed) return "";
  const q = window.MISIR_QUESTIONS[state.spaceId];
  if (!q) return "";

  const color = window.getSpaceColor(state.spaceId);
  const ss    = window.getSubspaceById(q.subspaceId);

  if (state.misirAnswering) {
    return `
      <div class="misir-asks" style="--ma-color:${color};">
        <div class="ma-head">
          <div class="ma-attr">${fmt.icn("zap",11)} Misir asked · ${ss ? ss.title : ""}</div>
        </div>
        <div class="ma-q" style="padding-bottom:0;">"${q.question}"</div>
        <div class="ma-answer-preview">"${state.misirAnswerSubmitted}"</div>
        <div class="ma-thinking">
          <div class="typing-dots"><span></span><span></span><span></span></div>
          <span>Misir is thinking…</span>
        </div>
      </div>`;
  }

  if (state.misirResponse) {
    return `
      <div class="misir-asks ma-responded" style="--ma-color:${color};">
        <div class="ma-head">
          <div class="ma-attr">${fmt.icn("zap",11)} Misir · ${ss ? ss.title : ""}</div>
        </div>
        <div class="ma-exchange">
          <div class="ma-you">
            <span class="ma-you-label">You said</span>
            <p>"${state.misirAnswerSubmitted}"</p>
          </div>
          <div class="ma-misir">
            <span class="ma-misir-label" style="color:${color};">Misir</span>
            <p>${state.misirResponse}</p>
          </div>
        </div>
        <div class="ma-actions">
          <button class="btn primary" style="background:${color};border-color:${color};" onclick="openSubspace('${q.subspaceId}')">File to ${ss ? ss.title : "subspace"} ${fmt.icn("arrow-right",12)}</button>
          <button class="btn ghost" onclick="resetMisirQuestion()">Ask another</button>
          <button class="btn ghost" onclick="dismissMisirQuestion()">Done</button>
        </div>
      </div>`;
  }

  // Compact collapsed state (default)
  if (!state.misirAsksExpanded) {
    return `
      <div class="misir-asks ma-compact" style="--ma-color:${color};">
        <div class="mac-row" onclick="toggleMisirAsks()">
          <div class="ma-attr">${fmt.icn("zap",11)} Misir has a question · ${ss ? ss.title : ""}</div>
          <div class="mac-q">${q.question}</div>
          <button class="btn primary mac-expand" style="background:${color};border-color:${color};" onclick="event.stopPropagation();toggleMisirAsks()">Answer ${fmt.icn("arrow-right",12)}</button>
          <button class="ma-dismiss" onclick="event.stopPropagation();dismissMisirQuestion()" title="Ask later">${fmt.icn("x",13)}</button>
        </div>
      </div>`;
  }

  // Expanded full state
  return `
    <div class="misir-asks" style="--ma-color:${color};">
      <div class="ma-head">
        <div class="ma-attr">${fmt.icn("zap",11)} Misir has a question · ${ss ? ss.title : ""}</div>
        <button class="ma-dismiss" onclick="dismissMisirQuestion()" title="Ask later">${fmt.icn("x",13)}</button>
      </div>
      <div class="ma-context">${q.context}</div>
      <div class="ma-q">${q.question}</div>
      <div class="ma-input-wrap">
        <textarea class="ma-input" rows="2" placeholder="${q.placeholder}" oninput="setMisirAnswer(this.value)" onkeydown="if(event.key==='Enter'&&(event.metaKey||event.ctrlKey))submitMisirAnswer()">${state.misirAnswerDraft}</textarea>
      </div>
      <div class="ma-foot">
        <span class="ma-hint">⌘ Enter to send</span>
        <div class="row" style="gap:8px;">
          <button class="btn ghost" onclick="toggleMisirAsks()">Collapse</button>
          <button class="btn ghost" onclick="dismissMisirQuestion()">Ask later</button>
          <button class="btn primary" style="background:${color};border-color:${color};" onclick="submitMisirAnswer()">Answer ${fmt.icn("arrow-right",12)}</button>
        </div>
      </div>
    </div>`;
}

const SPACE_BRIEFS = {
  "series-a": "Six days to Wavemaker. 46 captures across 7 subspaces — you've been thorough. But you've opened GoMechanic three times this week without answering it. That's the one gap that matters. Wavemaker will ask it in the first ten minutes.",
  "roadmap":  "Board review in 18 days. You have the customer signals — fleet API and offline mode top the list. You don't have the release sequence. That's what the board will ask first. Not what you're building. In what order.",
  "fleet":    "Pilot kickoff in 45 days. Three subspaces below 20% — pricing, tech integration, sales motion. None of these close with more reading. Book three fleet manager calls this week.",
  "hire":     "Two reference calls. That's the only thing between you and an offer to Arif Hasan. 71% readiness and the missing 29% is one afternoon of phone calls. The offer deadline is in 14 days.",
};

const SS_STATUS = {
  "investor-intel":      "Your strongest coverage. Wavemaker and Jungle Ventures both researched.",
  "cac-unit-econ":       "The 18-month threshold appears 6 times. Not yet connected to your own financials.",
  "competition":         "Pitstop and Park+ covered. No comparable raises mapped to Zantrik yet.",
  "gomechanic-forensic": "Opened 3 times without resolving. One focused session closes this.",
  "market-tam":          "Bangladesh aftermarket sized. SEA fleet operator count still missing.",
  "narrative":           "Three angles surfaced. None tested against an investor audience yet.",
  "customer-evidence":   "Internal data pull needed. Cannot be filled by web research.",
  "rm-customer":         "Fleet API and offline mode top the list. Reliability over features.",
  "rm-tech-debt":        "API migration is the highest-leverage item. Unlocks 3 blocked features.",
  "rm-competitors":      "Park+ and Carro both shipped offline-first in Q1. Window is closing.",
  "rm-resources":        "Engineering capacity data lives in Linear. Pull it before the roadmap locks.",
  "rm-release":          "No sequencing plan yet. Board will ask what ships first.",
  "fl-market":           "Uncontested segment. Most operators are spreadsheet or WhatsApp-based.",
  "fl-segments":         "SME vs. enterprise tension not yet resolved.",
  "fl-pricing":          "No pricing model validated. You can't sign pilots without a number.",
  "fl-tech":             "Integration scope undefined. Pilot customers will ask on day one.",
  "fl-sales":            "No outreach plan. 45 days to kickoff with no leads yet.",
  "fl-regulatory":       "BRTA requirements not yet assessed.",
  "hi-pipeline":         "Two first-round-ready candidates. Pipeline ahead of schedule.",
  "hi-comp":             "Offer range is competitive. Don't wait for the Series A to close.",
  "hi-process":          "Process designed. Leadership case study not yet scheduled.",
};

function renderHomeSingle() {
  const d = window.activeData();
  if (!d) return `<div style="padding:40px;text-align:center;color:var(--fg-subtle);">No data for this space yet.</div>`;
  const ch      = d.challenge;
  const captures = (d.captures||[]).filter(c => c.date === "Today");
  const dec      = d.decision || {};
  const brief    = SPACE_BRIEFS[state.spaceId] || `${ch.capturesWeek} captures this week across ${ch.subspaceCount} subspaces.`;
  const color    = window.getSpaceColor(state.spaceId);

  return `
    <div class="misir-brief">
      <div class="brief-attr">${fmt.icn("zap",11)} Misir's read · ${ch.title} · ${ch.updated}</div>
      <p class="brief-text">${brief}</p>
      ${ch.deadline ? `
        <div class="brief-deadline" style="color:${color};">
          ${fmt.icn("clock",12)} ${ch.deadline.label} · <strong>${ch.deadline.inDays} days</strong>
          <span class="brief-readiness" style="margin-left:16px;">${ch.readiness}% readiness</span>
        </div>` : ""}
    </div>

    ${renderMisirAsks(d)}

    <div class="sec-head">
      <div class="title">Subspaces <small>${ch.subspaceCount} AI-generated topics</small></div>
      <div class="right">
        <button class="link" onclick="setView('collection')">Captures →</button>
        <button class="link" onclick="setView('comparison')">Comparison →</button>
      </div>
    </div>

    <div class="ss-status-list">
      ${(d.subspaces||[]).map(s => renderSubspaceStatusRow(s)).join("")}
    </div>

    <div class="two-up" style="margin-top:0;">
      <div class="card" style="padding:0;">
        <div class="ph">
          <span class="eyebrow">Today · ${captures.length} captures</span>
          <span class="spacer"></span>
          <button class="link" onclick="setView('collection')">All →</button>
        </div>
        ${window.renderTodayTimeline(captures, d.subspaces||[])}
      </div>

      <div class="card" style="padding:0;">
        <div class="ph">
          <span class="eyebrow">Decision readiness</span>
          <span class="spacer"></span>
          <button class="link" onclick="setView('decision')">Full tree →</button>
        </div>
        <div class="mini-readiness">
          <div class="ring" style="--p:${ch.readiness}"><div class="pct">${ch.readiness}%</div></div>
          <div class="info">
            <div class="lead">${ch.criticalGaps} critical gap${ch.criticalGaps===1?"":"s"} before you can walk in confidently.</div>
            <div class="sub">${(dec.gaps||[]).slice(0,2).map(g=>g.label).join(". ")}.</div>
          </div>
        </div>
        <hr class="divider">
        <div class="chat-cta" style="margin:14px 14px 16px;border-radius:6px;">
          <div class="ic">${fmt.icn("message-circle",16)}</div>
          <div class="text">${dec.ask||"Ask Misir anything about this challenge."}<small>Misir uses your captures + subspace context.</small></div>
          <button class="btn primary" onclick="openNewChat()">Chat ${fmt.icn("arrow-right",12)}</button>
        </div>
      </div>
    </div>
  `;
}

function renderSubspaceStatusRow(s) {
  const color  = window.SUBSPACE_COLORS[s.id] || "var(--accent)";
  const status = SS_STATUS[s.id] || `${s.captures} captures · ${s.completeness}% complete.`;
  const isCrit = s.flag === "critical";
  const isLow  = s.flag === "low";

  return `
    <div class="ss-status-row ${isCrit?"ss-crit":""} ${isLow?"ss-low":""}" onclick="openSubspace('${s.id}')">
      <div class="ssr-lane" style="background:${color};"></div>
      <div class="ssr-head">
        <span class="ssr-title">${s.title}</span>
        ${isCrit ? `<span class="ssr-flag">${fmt.icn("alert-circle",11)} Critical</span>` : ""}
        ${isLow  ? `<span class="ssr-flag ssr-flag-low">${fmt.icn("alert-triangle",11)} Needs pull</span>` : ""}
      </div>
      <div class="ssr-bar-wrap">
        <div class="ssr-bar"><div class="ssr-fill" style="width:${s.completeness}%;background:${color};"></div></div>
        <span class="ssr-pct" style="color:${color};">${s.completeness}%</span>
      </div>
      <p class="ssr-status">${status}</p>
      <div class="ssr-foot">
        <span class="ssr-meta">${s.captures} captures</span>
        ${s.weekDelta > 0 ? `<span class="ssr-delta" style="color:${color};">+${s.weekDelta} this week</span>` : ""}
        <span class="ssr-meta" style="margin-left:auto;">${s.lastHit}</span>
      </div>
    </div>
  `;
}

/* Subspace tile */
window.renderSubspaceTile = function(s) {
  const flagClass = s.flag ? `flag-${s.flag}` : "";
  return `
    <button class="ss-tile ${flagClass}" onclick="openSubspace('${s.id}')" title="${s.flagNote||''}">
      <div class="top">
        <span class="ttl">${s.title}</span>
        <span class="cap-count">${s.captures} ${s.weekDelta>0?`<span style="color:var(--accent);">+${s.weekDelta}</span>`:""}</span>
      </div>
      <div class="desc">${s.desc}</div>
      <div class="markers">${s.markers.slice(0,3).map(m=>`<span class="chip marker">${m}</span>`).join("")}${s.markers.length>3?`<span class="chip" style="background:transparent;border-color:transparent;color:var(--fg-subtle);">+${s.markers.length-3} more</span>`:""}</div>
      <div class="footline">
        <span>${s.completeness}% complete</span>
        <span class="spacer"></span>
        ${fmt.spark(s.spark,48,14)}
        <span>${s.lastHit}</span>
      </div>
    </button>`;
};

/* Capture row (Collection view) */
window.renderCaptureRow = function(c) {
  const icn = window.surfaceIcon(c.surface);
  return `
    <div class="capture" onclick="openCapture('${c.id}')">
      <div class="time">${c.time}</div>
      <div class="surface">${fmt.icn(icn,12)} ${c.surface}</div>
      <div class="ttl">
        <span class="chip type">${c.type}</span>
        <span class="t">${c.title}</span>
        ${c.revisit?`<span class="revisit">×${c.revisit} revisited</span>`:""}
      </div>
      <div class="right">
        <span class="chip marker">${c.marker}</span>
        ${fmt.subspaceTag(c.subspaceId)}
        ${c.spaceId && state.scope==="all" ? fmt.spaceTag(c.spaceId) : ""}
      </div>
    </div>`;
};

/* ============================================================
   Today timeline (Home single)
   ============================================================ */
window.SUBSPACE_COLORS = {
  "investor-intel":"#FF6C3C","cac-unit-econ":"#2A6A4A","competition":"#2A4A7A",
  "gomechanic-forensic":"#B8730D","market-tam":"#6E6862","narrative":"#7A3FA0","customer-evidence":"#A8423D",
  "rm-customer":"#2A6A4A","rm-tech-debt":"#4A6A3A","rm-competitors":"#2A4A7A","rm-resources":"#6E6862","rm-release":"#FF6C3C",
  "fl-market":"#2A4A7A","fl-segments":"#4A5A7A","fl-pricing":"#B8730D","fl-tech":"#2A6A4A","fl-sales":"#A8423D","fl-regulatory":"#6E6862",
  "hi-pipeline":"#7A3FA0","hi-comp":"#5A3F80","hi-process":"#9A4FA0",
};

function subspaceColor(id) { return window.SUBSPACE_COLORS[id] || "var(--accent)"; }

function parseHM(t) {
  const m = /^(\d{1,2}):(\d{2})/.exec(t||"");
  return m ? parseInt(m[1],10)+parseInt(m[2],10)/60 : null;
}

window.renderTodayTimeline = function(captures, subspaces) {
  if (!captures.length) return `<div style="padding:30px;text-align:center;color:var(--fg-subtle);font-size:13px;">No captures yet today.</div>`;

  const times = captures.map(c=>parseHM(c.time)).filter(v=>v!==null);
  const minH  = Math.max(0, Math.floor(Math.min(...times)));
  const maxH  = Math.min(23, Math.ceil(Math.max(...times)));
  const span  = Math.max(1, maxH-minH);
  const hours = []; for (let h=minH;h<=maxH;h++) hours.push(h);

  const arcTicks = hours.map(h=>`<span class="hour-tick" style="left:${((h-minH)/span*100)}%;">${String(h).padStart(2,"0")}</span>`).join("");
  const arcDots  = captures.map(c=>{
    const t=parseHM(c.time); if(t===null) return "";
    return `<span class="capture-tick ${c.revisit?"revisit":""}" style="left:${((t-minH)/span*100)}%;--c:${subspaceColor(c.subspaceId)};" title="${c.time} · ${c.title}" onclick="openCapture('${c.id}')"></span>`;
  }).join("");

  const rows = captures.slice().sort((a,b)=>(parseHM(a.time)||0)-(parseHM(b.time)||0)).map(c => {
    const color = subspaceColor(c.subspaceId);
    const ss    = (subspaces||[]).find(x=>x.id===c.subspaceId) || window.getSubspaceById(c.subspaceId);
    const ic    = window.surfaceIcon(c.surface);
    return `
      <div class="t-row ${c.revisit?"is-revisit":""}" onclick="openCapture('${c.id}')">
        <div class="t-time">${c.time}</div>
        <div class="t-lane" style="--c:${color};"></div>
        <div class="t-icon">${fmt.icn(ic,14)}</div>
        <div class="t-main">
          <div class="t-line">
            <div class="t-title">${c.title}</div>
            ${c.revisit?`<span class="t-revisit">${fmt.icn("rotate-ccw",9)} revisited ×${c.revisit}</span>`:""}
          </div>
          <div class="t-meta">
            <span class="t-type">${c.type.toLowerCase()}</span>
            <span class="t-sep">·</span>
            <span class="t-surf">${c.surface}</span>
            ${ss?`<span class="t-sep">·</span><button class="t-ss" onclick="event.stopPropagation();openSubspace('${c.subspaceId}')"><span class="t-ss-dot" style="background:${color};"></span>${ss.title}</button>`:""}
          </div>
        </div>
        <div class="t-marker">${c.marker}</div>
      </div>`;
  }).join("");

  return `
    <div class="day-arc">
      <div class="eyebrow" style="font-size:9.5px;">Day arc · ${String(minH).padStart(2,"0")}:00 → ${String(maxH).padStart(2,"0")}:00</div>
      <div class="day-arc-track">${arcTicks}${arcDots}</div>
    </div>
    <div class="t-list">${rows}</div>`;
};

/* ============================================================
   INBOX
   ============================================================ */
window.renderInbox = function() {
  const isAll  = state.scope === "all";
  let list     = window.scopeChats();
  const f      = state.inboxFilter || "all";
  const sq     = state.inboxSpace  || "all";
  const q      = (state.inboxQuery || "").toLowerCase();

  if (f === "unread")    list = list.filter(c => c.unread);
  if (isAll && sq !== "all") list = list.filter(c => c.spaceId === sq);
  if (q) list = list.filter(c => c.subject.toLowerCase().includes(q) || c.snippet.toLowerCase().includes(q));

  const total  = window.scopeChats().length;
  const unread = window.scopeChats().filter(c=>c.unread).length;

  return `
    <div class="sec-head">
      <div class="title">Inbox <small>All conversations with Misir</small></div>
      <div class="right"><button class="btn primary" onclick="openNewChat()">${fmt.icn("plus",12)} New chat</button></div>
    </div>

    <div class="card" style="padding:0;">
      <div class="filterbar">
        <div class="seg">
          <button class="${f==="all"?"active":""}" onclick="setInboxFilter('all')">All <span style="font-family:var(--font-mono);font-size:10px;color:var(--fg-subtle);margin-left:4px;">${total}</span></button>
          <button class="${f==="unread"?"active":""}" onclick="setInboxFilter('unread')">Unread <span style="font-family:var(--font-mono);font-size:10px;color:var(--accent);margin-left:4px;">${unread}</span></button>
        </div>
        ${isAll ? `
          <select class="search" style="min-width:auto;cursor:pointer;" onchange="setInboxSpace(this.value)">
            <option value="all" ${sq==="all"?"selected":""}>All spaces</option>
            ${window.SPACES.map(s=>`<option value="${s.id}" ${sq===s.id?"selected":""}>${s.title}</option>`).join("")}
          </select>` : ""}
        <input class="search" type="text" placeholder="Search subject or snippet…" value="${state.inboxQuery||""}" oninput="setInboxQuery(this.value)">
        <span class="count">${list.length} of ${total}</span>
      </div>
      ${list.map(c => `
        <div class="inbox-row ${c.unread?"unread":""}" onclick="openChat('${c.id}')">
          <span class="dot ${c.unread?"":"dot-faint"}"></span>
          <div class="lead">
            <div class="subj">${c.subject}</div>
            <div class="snip">${c.snippet}</div>
          </div>
          <div class="meta">
            <span class="at">${c.lastAt}</span>
            ${c.subspaceId ? fmt.subspaceTag(c.subspaceId) : ""}
            ${isAll && c.spaceId ? fmt.spaceTag(c.spaceId) : ""}
          </div>
        </div>`).join("")}
      ${list.length===0?`<div style="padding:30px;text-align:center;color:var(--fg-subtle);font-size:13px;">No chats match.</div>`:""}
    </div>`;
};

/* ============================================================
   NOTIFICATION
   ============================================================ */
window.renderNotification = function() {
  const isAll = state.scope === "all";
  let ns      = window.scopeNotifications();
  const f     = state.notifFilter || "all";
  const sq    = state.notifSpace  || "all";

  if (f !== "all") ns = ns.filter(n => n.severity === f);
  if (isAll && sq !== "all") ns = ns.filter(n => n.spaceId === sq);

  const all      = window.scopeNotifications();
  const critical = all.filter(n=>n.severity==="critical").length;
  const warning  = all.filter(n=>n.severity==="warning").length;
  const info     = all.filter(n=>n.severity==="info").length;

  return `
    <div class="sec-head">
      <div class="title">Notifications <small>Alerts, nudges, and gaps Misir is watching</small></div>
      <div class="right"><button class="btn ghost" onclick="markAllRead()">Mark all read</button></div>
    </div>

    ${state.nudgeDismissed?"":window.renderNudge()}

    <div class="card" style="padding:0;">
      <div class="filterbar">
        <div class="seg">
          <button class="${f==="all"?"active":""}"      onclick="setNotifFilter('all')">All <span style="font-family:var(--font-mono);font-size:10px;color:var(--fg-subtle);margin-left:4px;">${all.length}</span></button>
          <button class="${f==="critical"?"active":""}" onclick="setNotifFilter('critical')">Critical <span style="font-family:var(--font-mono);font-size:10px;color:var(--accent);margin-left:4px;">${critical}</span></button>
          <button class="${f==="warning"?"active":""}"  onclick="setNotifFilter('warning')">Warning <span style="font-family:var(--font-mono);font-size:10px;color:var(--warning);margin-left:4px;">${warning}</span></button>
          <button class="${f==="info"?"active":""}"     onclick="setNotifFilter('info')">Info <span style="font-family:var(--font-mono);font-size:10px;color:var(--fg-subtle);margin-left:4px;">${info}</span></button>
        </div>
        ${isAll ? `
          <select class="search" style="min-width:auto;cursor:pointer;" onchange="setNotifSpace(this.value)">
            <option value="all" ${sq==="all"?"selected":""}>All spaces</option>
            ${window.SPACES.map(s=>`<option value="${s.id}" ${sq===s.id?"selected":""}>${s.title}</option>`).join("")}
          </select>` : ""}
        <span class="count">${ns.length} of ${all.length}</span>
      </div>
      ${ns.map(n => `
        <div class="notif-row">
          <span class="sev sev-${n.severity}"><span class="dot"></span>${n.severity}</span>
          <div class="body-c">
            <div class="ttl-c">${n.title}</div>
            <div class="txt">${n.body}</div>
            <div style="display:flex;align-items:center;gap:6px;margin-top:6px;">
              ${n.subspaceId ? fmt.subspaceTag(n.subspaceId) : ""}
              ${isAll && n.spaceId ? fmt.spaceTag(n.spaceId) : ""}
            </div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px;">
            <span class="at">${n.at}</span>
            <button class="btn" onclick="${n.subspaceId?`openSubspace('${n.subspaceId}')`:`setView('decision')`}">${n.actionLabel} ${fmt.icn("arrow-right",12)}</button>
          </div>
        </div>`).join("")}
    </div>`;
};

/* ============================================================
   COLLECTION
   ============================================================ */
window.renderCollection = function() {
  const isAll = state.scope === "all";
  const f     = state.colFilter   || "all";
  const sq    = state.colSubspace || "all";
  const sp    = state.colSpace    || "all";
  const q     = (state.colQuery   || "").toLowerCase();

  const tmap  = { article:"Article", aichat:"AI chat", pdf:"PDF", video:"Video", post:"Post" };
  let list    = window.scopeCaptures();

  if (f !== "all")             list = list.filter(c => c.type === tmap[f]);
  if (sq !== "all")            list = list.filter(c => c.subspaceId === sq);
  if (isAll && sp !== "all")   list = list.filter(c => c.spaceId === sp);
  if (q) list = list.filter(c =>
    c.title.toLowerCase().includes(q) || c.marker.toLowerCase().includes(q) || c.surface.toLowerCase().includes(q)
  );

  const all   = window.scopeCaptures();
  const counts = { all:all.length, article:all.filter(c=>c.type==="Article").length, aichat:all.filter(c=>c.type==="AI chat").length, pdf:all.filter(c=>c.type==="PDF").length, video:all.filter(c=>c.type==="Video").length, post:all.filter(c=>c.type==="Post").length };

  const groups = {};
  list.forEach(c => { (groups[c.date]=groups[c.date]||[]).push(c); });

  const allSS = window.scopeSubspaces();

  return `
    <div class="sec-head">
      <div class="title">Collection <small>Everything the extension captured</small></div>
      <div class="right"><span class="eyebrow">${all.length} total</span></div>
    </div>

    <div class="card" style="padding:0;">
      <div class="filterbar">
        <div class="seg">
          <button class="${f==="all"?"active":""}"     onclick="setColFilter('all')">All <span style="font-family:var(--font-mono);font-size:10px;color:var(--fg-subtle);margin-left:4px;">${counts.all}</span></button>
          <button class="${f==="article"?"active":""}" onclick="setColFilter('article')">Articles <span style="font-family:var(--font-mono);font-size:10px;color:var(--fg-subtle);margin-left:4px;">${counts.article}</span></button>
          <button class="${f==="aichat"?"active":""}"  onclick="setColFilter('aichat')">AI chats <span style="font-family:var(--font-mono);font-size:10px;color:var(--fg-subtle);margin-left:4px;">${counts.aichat}</span></button>
          <button class="${f==="pdf"?"active":""}"     onclick="setColFilter('pdf')">PDFs <span style="font-family:var(--font-mono);font-size:10px;color:var(--fg-subtle);margin-left:4px;">${counts.pdf}</span></button>
          <button class="${f==="video"?"active":""}"   onclick="setColFilter('video')">Videos <span style="font-family:var(--font-mono);font-size:10px;color:var(--fg-subtle);margin-left:4px;">${counts.video}</span></button>
          <button class="${f==="post"?"active":""}"    onclick="setColFilter('post')">Posts <span style="font-family:var(--font-mono);font-size:10px;color:var(--fg-subtle);margin-left:4px;">${counts.post}</span></button>
        </div>
        ${isAll ? `<select class="search" style="min-width:auto;cursor:pointer;" onchange="setColSpace(this.value)">
          <option value="all" ${sp==="all"?"selected":""}>All spaces</option>
          ${window.SPACES.map(s=>`<option value="${s.id}" ${sp===s.id?"selected":""}>${s.title}</option>`).join("")}
        </select>` : ""}
        <select class="search" style="min-width:auto;cursor:pointer;" onchange="setColSubspace(this.value)">
          <option value="all" ${sq==="all"?"selected":""}>All subspaces</option>
          ${allSS.map(s=>`<option value="${s.id}" ${sq===s.id?"selected":""}>${s.title}</option>`).join("")}
        </select>
        <input class="search" type="text" placeholder="Search title, marker, source…" value="${state.colQuery||""}" oninput="setColQuery(this.value)">
        <span class="count">${list.length} of ${all.length}</span>
      </div>
      ${Object.keys(groups).map(date=>`
        <div class="eyebrow" style="padding:10px 18px 8px;background:var(--bg-subtle);border-bottom:1px solid var(--border);">${date} <span style="color:var(--fg-faint);margin-left:6px;">${groups[date].length}</span></div>
        ${groups[date].map(renderCaptureRow).join("")}`).join("")}
      ${list.length===0?`<div style="padding:30px;text-align:center;color:var(--fg-subtle);font-size:13px;">No captures match.</div>`:""}
    </div>`;
};

/* ============================================================
   COMPARISON
   ============================================================ */
window.renderComparison = function() {
  const isAll = state.scope === "all";
  const spId  = isAll ? state.compSpaceId : state.spaceId;
  const d     = window.SPACE_DATA[spId] || {};
  const cmp   = d.comparison || {};
  const total = (cmp.sources||[]).reduce((a,b)=>a+b.count,0);

  return `
    <div class="sec-head">
      <div class="title">Comparison <small>How your sources agree, conflict, and go silent</small></div>
      <div class="right"><span class="eyebrow">${total} captures · ${(cmp.sources||[]).length} sources</span></div>
    </div>

    ${isAll ? `
      <div class="space-tab-row">
        ${window.SPACES.map(s => {
          const color = window.getSpaceColor(s.id);
          return `<button class="space-tab ${spId===s.id?"active":""}" style="--sc:${color};" onclick="setCompSpace('${s.id}')">${s.title}</button>`;
        }).join("")}
      </div>` : ""}

    ${cmp.tension ? `
    <div class="tension">
      <div class="eyebrow" style="color:var(--accent);margin-bottom:14px;">${cmp.tension.title}</div>
      ${(cmp.tension.rows||[]).map((r,i)=>`
        <div class="ten-row">
          <div class="num">${String(i+1).padStart(2,"0")}</div>
          <div class="from">${r.from}</div>
          <div class="stance">${r.stance}</div>
        </div>`).join("")}
      <div class="edge"><strong style="font-weight:600;">Your edge.</strong>&nbsp;${cmp.tension.edge}</div>
    </div>` : ""}

    <div class="sources-grid">
      ${(cmp.sources||[]).map(s=>`
        <div class="card src-card src-${s.key}">
          <div class="src-head">
            <div class="row"><span class="name">${s.label}</span><span class="count">${s.count} artifacts</span></div>
            <div class="summary">${s.summary}</div>
          </div>
          <div class="src-body">
            <div class="eyebrow" style="margin-bottom:6px;">Key findings</div>
            ${(s.findings||[]).map(f=>`<div class="row-f"><div><div class="conf">${f.conf}%</div><div class="conf-bar"><i style="width:${f.conf}%"></i></div></div><div class="ftext">${f.text}</div></div>`).join("")}
          </div>
          <div class="src-signal"><div class="eyebrow">Unique signal</div><div class="txt">${s.signal}</div></div>
        </div>`).join("")}
    </div>

    ${cmp.synthesis ? `
    <div class="card" style="padding:0;">
      <div class="ph"><span class="eyebrow">Synthesis — what all sources tell you together</span><span class="spacer"></span><span class="eyebrow">Readiness ${(d.challenge||{}).readiness||0}%</span></div>
      <div class="synth-grid">
        <div class="col"><div class="top"><div class="ic" style="background:rgba(46,125,85,0.1);color:var(--success);">${fmt.icn("check",13)}</div><div class="eyebrow">Where they agree</div></div><p>${cmp.synthesis.consensus}</p></div>
        <div class="col"><div class="top"><div class="ic" style="background:rgba(184,115,13,0.1);color:var(--warning);">${fmt.icn("alert-triangle",13)}</div><div class="eyebrow">Where they conflict</div></div><p>${cmp.synthesis.conflict}</p></div>
        <div class="col"><div class="top"><div class="ic" style="background:rgba(255,108,60,0.1);color:var(--accent);">${fmt.icn("eye-off",13)}</div><div class="eyebrow">What none covered</div></div><p>${cmp.synthesis.blindspot}</p><button class="btn primary" style="margin-top:12px;" onclick="setView('decision')">Fill gaps ${fmt.icn("arrow-right",12)}</button></div>
      </div>
    </div>` : ""}
  `;
};

/* ============================================================
   DECISION TREE
   ============================================================ */
window.renderDecision = function() {
  const isAll = state.scope === "all";
  return isAll ? renderDecisionAll() : renderDecisionSingle();
};

function renderDecisionAll() {
  return `
    <div class="sec-head">
      <div class="title">Decision tree <small>Readiness across all spaces</small></div>
    </div>

    <div class="space-cards-grid">
      ${window.SPACES.map(s => {
        const d   = window.SPACE_DATA[s.id]||{};
        const ch  = d.challenge||{};
        const dec = d.decision||{};
        const color = window.getSpaceColor(s.id);
        const gapCount = (dec.gaps||[]).length;
        const critGaps = (dec.gaps||[]).filter(g=>g.sev==="Critical").length;
        return `
          <div class="space-card decision-card" style="--sc:${color};" onclick="setDecSpace('${s.id}')">
            <div class="sc-accent"></div>
            <div class="sc-head">
              <div class="sc-title">${s.title}</div>
              ${ch.deadline?`<div class="sc-dead" style="color:${color};">${fmt.icn("clock",10)} ${ch.deadline.inDays}d · ${ch.deadline.label}</div>`:""}
            </div>
            <div class="sc-body">
              <div class="sc-ring-wrap">
                <div class="sc-ring" style="background:conic-gradient(${color} 0 ${s.readiness*3.6}deg,var(--border-strong) ${s.readiness*3.6}deg);">
                  <div class="sc-ring-inner"><span>${s.readiness}%</span></div>
                </div>
                <div class="sc-ring-lbl">readiness</div>
              </div>
              <div class="sc-meta">
                <div class="sc-stat">${fmt.icn("git-branch",11)} ${gapCount} gap${gapCount===1?"":"s"}</div>
                ${critGaps>0?`<div class="sc-stat critical">${critGaps} critical</div>`:`<div class="sc-stat ok">${fmt.icn("check-circle",11)} No critical</div>`}
                <div class="sc-stat">${dec.question?(dec.question.slice(0,40)+"…"):"No decision framed"}</div>
              </div>
            </div>
            <div class="sc-foot">
              <button class="sc-open" style="color:${color};border-color:color-mix(in srgb,${color} 35%,transparent);" onclick="event.stopPropagation();setDecSpace('${s.id}');setScope('${s.id}');setView('decision');">Full tree ${fmt.icn("arrow-right",11)}</button>
            </div>
          </div>`;
      }).join("")}
    </div>

    <div class="sec-head" style="margin-top:8px;">
      <div class="title">Detailed view <small>${(window.SPACES.find(s=>s.id===state.decSpaceId)||{}).title||""}</small></div>
      <div class="right">
        ${window.SPACES.map(s=>{
          const color=window.getSpaceColor(s.id);
          return `<button class="space-tab-sm ${state.decSpaceId===s.id?"active":""}" style="--sc:${color};" onclick="setDecSpace('${s.id}')">${s.title.split(" ").slice(0,2).join(" ")}</button>`;
        }).join("")}
      </div>
    </div>
    ${renderDecisionBody(state.decSpaceId)}
  `;
}

function renderDecisionSingle() {
  return renderDecisionBody(state.spaceId);
}

function renderDecisionBody(spId) {
  const d   = window.SPACE_DATA[spId] || {};
  const ch  = d.challenge || {};
  const dec = d.decision  || {};
  if (!dec.question) return `<div style="padding:40px;text-align:center;color:var(--fg-subtle);">No decision framed for this space yet.</div>`;

  return `
    <div class="decision-hero">
      <div class="eyebrow" style="color:var(--accent);margin-bottom:6px;">Active strategic decision</div>
      <div class="q">${dec.question}</div>
      <div class="opts">
        <div class="opt primary">
          <div class="opt-label">${dec.optionA.label}</div>
          <div class="opt-bar"><i style="width:${dec.optionA.readiness}%"></i></div>
          <div class="opt-meta"><span class="dot"></span> ${dec.optionA.readiness}% readiness · ${dec.optionA.note}</div>
        </div>
        <div class="vs">VS</div>
        <div class="opt">
          <div class="opt-label" style="color:var(--fg-muted);">${dec.optionB.label}</div>
          <div class="opt-bar"><i style="width:${dec.optionB.readiness}%;background:var(--fg-faint);"></i></div>
          <div class="opt-meta">${dec.optionB.note}</div>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:14px;padding:14px 16px;background:var(--bg);border:1px solid var(--border);border-radius:6px;">
        <div class="ring" style="--p:${ch.readiness||0};width:48px;height:48px;"><div class="pct" style="font-size:13px;">${ch.readiness||0}%</div></div>
        <div style="flex:1;font-size:13px;color:var(--fg-muted);line-height:1.55;">
          <strong style="color:var(--fg);font-weight:600;">Research readiness ${ch.readiness||0}%.</strong>
          ${ch.deadline?`You have a ${ch.deadline.label} in ${ch.deadline.inDays} days.`:""} 
          Your captures cover ${ch.readiness||0}% of what you need to walk in confidently.
        </div>
      </div>
    </div>

    <div class="pcgrid">
      <div class="card pc">
        <div class="pc-head"><div class="ic">${fmt.icn("check",13)}</div><span style="font-weight:600;font-size:14px;">Tailwinds for this path</span></div>
        <ul>${(dec.for||[]).map(t=>`<li>${t}</li>`).join("")}</ul>
      </div>
      <div class="card pc against">
        <div class="pc-head"><div class="ic">${fmt.icn("x",13)}</div><span style="font-weight:600;font-size:14px;">Headwinds against it</span></div>
        <ul>${(dec.against||[]).map(t=>`<li>${t}</li>`).join("")}</ul>
      </div>
    </div>

    <div class="card" style="padding:0;">
      <div class="ph"><span class="eyebrow">Fill these gaps before deciding</span><span class="spacer"></span><span class="eyebrow">${(dec.gaps||[]).length} remaining</span></div>
      ${(dec.gaps||[]).map(g=>`
        <div class="gap-row">
          <div class="sev sev-${g.sev.toLowerCase()}"><span class="dot"></span>${g.sev}</div>
          <div>
            <div style="font-size:13.5px;font-weight:500;color:var(--fg);line-height:1.45;">${g.label}</div>
            <div style="font-size:12.5px;color:var(--fg-muted);line-height:1.5;margin-top:4px;">${g.action}</div>
            <div style="margin-top:8px;">${fmt.subspaceTag(g.subspaceId)}</div>
          </div>
          <div><button class="btn" onclick="openSubspace('${g.subspaceId}')">Investigate ${fmt.icn("arrow-right",12)}</button></div>
        </div>`).join("")}
    </div>

    <div class="chat-cta">
      <div class="ic">${fmt.icn("message-circle",16)}</div>
      <div class="text">${dec.ask||"Ask Misir anything about this decision."}<small>Misir uses your captures + subspace context to answer.</small></div>
      <button class="btn primary" onclick="openNewChat()">Start chat ${fmt.icn("arrow-right",12)}</button>
    </div>`;
}
