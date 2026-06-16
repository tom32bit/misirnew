/* =====================================================================
   Misir dashboard — shell, state, routing
   ===================================================================== */

const VIEWS = [
  { id:"home",         label:"Home",          icon:"home" },
  { id:"inbox",        label:"Inbox",         icon:"inbox",       countKey:"inboxUnread" },
  { id:"notification", label:"Notification",  icon:"bell",        countKey:"notifCritical" },
  { id:"collection",   label:"Collection",    icon:"library" },
  { id:"comparison",   label:"Comparison",    icon:"columns-3" },
  { id:"decision",     label:"Decision tree", icon:"git-branch" },
];

const DATE_OPTIONS = ["Today","This week","This month","All time"];

const state = {
  view:    "home",
  spaceId: "series-a",
  scope:   "series-a",   // "all" | spaceId
  scopeOpen: false,
  date: 0,
  theme: localStorage.getItem("misir.theme") || "light",

  // per-view filters
  nudgeDismissed: false,
  inboxFilter:   "all",
  inboxQuery:    "",
  inboxSpace:    "all",
  notifFilter:   "all",
  notifSpace:    "all",
  colFilter:     "all",
  colSubspace:   "all",
  colSpace:      "all",
  colQuery:      "",

  // all-spaces sub-selectors
  compSpaceId: "series-a",
  decSpaceId:  "series-a",

  // Misir asks
  misirAnswerDraft:     "",
  misirAnswerSubmitted: null,
  misirAnswering:       false,
  misirResponse:        null,
  misirQuestionDismissed: false,
  misirAsksExpanded:    false,
  mobileMenuOpen:       false,

  // modal
  modal: null,
  newChatDraft: "",
  newChatSpaceId: "series-a",
  newSpaceDraft: { title:"", goal:"", deadline:"" },
};

/* ============================================================
   Scope helpers — always use these in views, never global window.X
   ============================================================ */

window.activeData = function() {
  return (state.scope === "all") ? null : (window.SPACE_DATA[state.spaceId] || null);
};

window.scopeCaptures = function() {
  if (state.scope === "all") return window.getAllCaptures();
  const d = window.SPACE_DATA[state.spaceId];
  return d ? (d.captures || []).map(c => ({ ...c, spaceId: state.spaceId })) : [];
};

window.scopeSubspaces = function() {
  if (state.scope === "all") return window.getAllSubspaces();
  const d = window.SPACE_DATA[state.spaceId];
  return d ? (d.subspaces || []).map(s => ({ ...s, spaceId: state.spaceId })) : [];
};

window.scopeChats = function() {
  if (state.scope === "all") return window.getAllChats();
  const d = window.SPACE_DATA[state.spaceId];
  const spaceTitle = (window.SPACES.find(s => s.id === state.spaceId)||{}).title || "";
  return d ? (d.chats || []).map(c => ({ ...c, spaceId: state.spaceId, spaceTitle })) : [];
};

window.scopeNotifications = function() {
  if (state.scope === "all") return window.getAllNotifications();
  const d = window.SPACE_DATA[state.spaceId];
  return d ? (d.notifications || []).map(n => ({ ...n, spaceId: state.spaceId })) : [];
};

window.getSubspaceById = function(id) {
  for (const [spaceId, d] of Object.entries(window.SPACE_DATA || {})) {
    const s = (d.subspaces || []).find(x => x.id === id);
    if (s) return { ...s, spaceId };
  }
  return null;
};

/* ============================================================
   Derived counts
   ============================================================ */
function counts() {
  const chats  = window.scopeChats();
  const notifs = window.scopeNotifications();
  return {
    inboxUnread:    chats.filter(c => c.unread).length,
    notifCritical:  notifs.filter(n => n.severity === "critical").length,
  };
}

/* ============================================================
   Sidebar
   ============================================================ */
function renderSidebar() {
  const c = counts();
  return `
    <aside class="side ${state.mobileMenuOpen ? 'mobile-open' : ''}">
      <div class="side-brand">
        <img src="assets/misir-logo.png" alt="">
        <span class="name">Misir</span>
        <span class="ver">v1</span>
      </div>

      <button class="side-search" onclick="alert('Command palette · ⌘K')">
        ${fmt.icn("search",13)}
        <span>Search what you know…</span>
        <span class="kbd">⌘K</span>
      </button>

      <div class="side-row">
        <button onclick="openNewSpace()">${fmt.icn("plus",12)} New space</button>
        <button class="primary" onclick="openNewChat()">${fmt.icn("message-circle",12)} Chat</button>
      </div>

      <nav class="side-nav">
        ${VIEWS.map(v => {
          const ct = v.countKey ? c[v.countKey] : 0;
          return `
            <button class="side-item ${state.view === v.id ? 'active' : ''}" onclick="setView('${v.id}')">
              <span class="si-icn">${fmt.icn(v.icon,14)}</span>
              <span>${v.label}</span>
              ${ct > 0 ? `<span class="si-count">${ct}</span>` : ""}
            </button>`;
        }).join("")}
      </nav>

      <div class="side-label">
        ${fmt.icn("chevron-down",11)} Spaces
        <button class="add" onclick="openNewSpace()" title="New space">${fmt.icn("plus",12)}</button>
      </div>

      <div class="side-spaces">
        <button class="side-item ${state.scope === 'all' ? 'active' : ''}" onclick="setScope('all')">
          <span class="si-icn">${fmt.icn("layers",14)}</span>
          <span style="flex:1;">All spaces</span>
          <span class="si-count">${window.SPACES.length}</span>
        </button>
        ${window.SPACES.map(s => {
          const color = window.getSpaceColor(s.id);
          return `
            <button class="side-item ${state.scope === s.id ? 'active' : ''}" onclick="setScope('${s.id}')">
              <span class="si-icn" style="color:${color};">${fmt.icn("target",14)}</span>
              <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${s.title}</span>
              ${s.unread > 0
                ? `<span class="si-pip" style="background:${color};"></span><span class="si-count" style="margin-left:4px;color:${color};">${s.unread}</span>`
                : `<span class="si-count">${s.readiness}%</span>`}
            </button>`;
        }).join("")}
      </div>

      <div class="side-profile">
        <div class="avatar">${window.USER.initial}</div>
        <div class="who">
          ${window.USER.name}
          <small>${window.USER.role}</small>
        </div>
        <button class="cog" onclick="toggleTheme()" title="${state.theme === 'dark' ? 'Switch to light' : 'Switch to dark'}">${fmt.icn(state.theme === 'dark' ? 'moon' : 'sun', 14)}</button>
        <button class="cog" title="Settings">${fmt.icn("settings",14)}</button>
      </div>
    </aside>
  `;
}

/* ============================================================
   Top bar
   ============================================================ */
function renderTopBar() {
  const view  = VIEWS.find(v => v.id === state.view);
  const isAll = state.scope === "all";
  const space = window.SPACES.find(s => s.id === state.scope);
  const scopeLabel = isAll ? "All spaces" : (space ? space.title : "All spaces");

  return `
    <div class="topbar">
      <div class="crumb">
        <button class="mob-menu-btn" onclick="toggleMobileMenu()">${fmt.icn("menu",16)}</button>
        <span class="now">${view ? view.label : "Home"}</span>
        <span class="sep">/</span>
        <span class="crumb-scope">${scopeLabel}</span>
      </div>

      <div class="date-scrub">
        <button onclick="setDate(Math.max(0,${state.date}-1))">${fmt.icn("chevron-left",13)}</button>
        <span class="label">${DATE_OPTIONS[state.date]}</span>
        <button onclick="setDate(Math.min(${DATE_OPTIONS.length-1},${state.date}+1))">${fmt.icn("chevron-right",13)}</button>
      </div>

      <div class="top-right"></div>
    </div>
  `;
}

/* ============================================================
   View dispatch
   ============================================================ */
function renderView() {
  switch (state.view) {
    case "home":         return window.renderHome();
    case "inbox":        return window.renderInbox();
    case "notification": return window.renderNotification();
    case "collection":   return window.renderCollection();
    case "comparison":   return window.renderComparison();
    case "decision":     return window.renderDecision();
    default:             return window.renderHome();
  }
}

/* ============================================================
   Main render
   ============================================================ */
function renderMobileNav() {
  const c = counts();
  const items = [
    { id:"home",       icon:"home" },
    { id:"inbox",      icon:"inbox",      countKey:"inboxUnread" },
    { id:"collection", icon:"library" },
    { id:"comparison", icon:"columns-3" },
    { id:"decision",   icon:"git-branch" },
  ];
  return `<nav class="mobile-nav" aria-label="Navigation">${items.map(v => {
    const ct = v.countKey ? c[v.countKey] : 0;
    return `<button class="mob-nav-item ${state.view === v.id ? 'active' : ''}" onclick="setView('${v.id}')">${fmt.icn(v.icon,20)}${ct > 0 ? `<span class="mob-badge">${ct}</span>` : ""}</button>`;
  }).join("")}</nav>`;
}

function render() {
  document.documentElement.dataset.theme = state.theme;
  document.getElementById("root").innerHTML = `
    ${state.mobileMenuOpen ? `<div class="mobile-scrim" onclick="toggleMobileMenu()"></div>` : ""}
    ${renderSidebar()}
    <div class="main">
      ${renderTopBar()}
      <div class="body">
        <div class="view">${renderView()}</div>
      </div>
    </div>
    ${renderMobileNav()}
    ${renderModal()}
  `;
  if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
  const inp = document.querySelector(".modal-card input, .modal-card textarea");
  if (inp && state.modal) inp.focus();
}

/* ============================================================
   Actions
   ============================================================ */
window.setView = function(v) { state.view = v; state.scopeOpen = false; state.mobileMenuOpen = false; render(); };
window.setDate = function(d) { state.date = d; render(); };
window.setScope = function(s) {
  state.scope = s;
  state.scopeOpen = false;
  state.mobileMenuOpen = false;
  if (s !== "all") { state.spaceId = s; state.compSpaceId = s; state.decSpaceId = s; }
  render();
};
window.setSpace = function(s) { window.setScope(s); };
window.toggleScopeMenu = function(e) {
  if (e) e.stopPropagation();
  state.scopeOpen = !state.scopeOpen;
  render();
};
document.addEventListener("click", () => { if (state.scopeOpen) { state.scopeOpen = false; render(); } });

window.toggleMobileMenu = function() {
  state.mobileMenuOpen = !state.mobileMenuOpen;
  render();
};

window.toggleTheme = function() {
  state.theme = state.theme === "dark" ? "light" : "dark";
  localStorage.setItem("misir.theme", state.theme);
  render();
};
window.dismissNudge = function() { state.nudgeDismissed = true; render(); };

window.setInboxFilter = function(f) { state.inboxFilter = f; render(); };
window.setInboxSpace  = function(s) { state.inboxSpace  = s; render(); };
window.setInboxQuery  = function(q) {
  state.inboxQuery = q;
  const root = document.querySelector(".body .view");
  if (root) { root.innerHTML = window.renderInbox(); if (window.lucide && window.lucide.createIcons) window.lucide.createIcons(); const i = root.querySelector("input.search"); if (i) { i.focus(); i.setSelectionRange(q.length,q.length); } }
};

window.setNotifFilter = function(f) { state.notifFilter = f; render(); };
window.setNotifSpace  = function(s) { state.notifSpace  = s; render(); };

window.setColFilter   = function(f) { state.colFilter = f; render(); };
window.setColSubspace = function(s) { state.colSubspace = s; render(); };
window.setColSpace    = function(s) { state.colSpace = s; state.colSubspace = "all"; render(); };
window.setColQuery    = function(q) {
  state.colQuery = q;
  const root = document.querySelector(".body .view");
  if (root) { root.innerHTML = window.renderCollection(); if (window.lucide && window.lucide.createIcons) window.lucide.createIcons(); const i = root.querySelector("input.search[type='text']"); if (i) { i.focus(); i.setSelectionRange(q.length,q.length); } }
};

window.setCompSpace = function(s) { state.compSpaceId = s; render(); };
window.setDecSpace  = function(s) { state.decSpaceId  = s; render(); };

/* ============================================================
   Misir asks — thinking partner
   ============================================================ */
window.setMisirAnswer = function(v) { state.misirAnswerDraft = v; };

window.dismissMisirQuestion = function() {
  state.misirQuestionDismissed = true;
  render();
};

window.resetMisirQuestion = function() {
  state.misirAnswerDraft     = "";
  state.misirAnswerSubmitted = null;
  state.misirAnswering       = false;
  state.misirResponse        = null;
  state.misirQuestionDismissed = false;
  state.misirAsksExpanded    = false;
  render();
};

window.toggleMisirAsks = function() {
  state.misirAsksExpanded = !state.misirAsksExpanded;
  render();
  if (state.misirAsksExpanded) {
    setTimeout(() => {
      const ta = document.querySelector('.ma-input');
      if (ta) ta.focus();
    }, 60);
  }
};

window.submitMisirAnswer = async function() {
  const answer = state.misirAnswerDraft.trim();
  if (!answer) return;

  const d = window.activeData();
  if (!d) return;

  const QUESTIONS = window.MISIR_QUESTIONS || {};
  const q = QUESTIONS[state.spaceId];
  if (!q) return;

  state.misirAnswerSubmitted = answer;
  state.misirAnswering       = true;
  state.misirAnswerDraft     = "";
  render();

  const prompt = `You are Misir, a decision-readiness tool. The user is working on: "${d.challenge.title}" — goal: "${d.challenge.goal}".

Context: ${q.context}
You asked: "${q.question}"
Their answer: "${answer}"

Respond in exactly 2–3 sentences. Be direct and specific to what they said. Validate what is precise in their answer. Name exactly what is still missing. Give one concrete next action.

Rules: Never start with "Great", "Good", or any affirmation. Never say "I". No hedging. No generic advice. Speak like a sharp colleague who has read all their research this week and is slightly impatient with vagueness. If their answer is vague, say so directly.`;

  try {
    const response = await window.claude.complete(prompt);
    state.misirResponse = response;
  } catch (e) {
    // graceful fallback — space-specific canned response
    const fallbacks = {
      "series-a": "That's the structural answer. The contractual anchor separates Zantrik from GoMechanic — fleet operators can't churn overnight. File this directly. The gap has been stuck at 22% because you kept researching instead of writing down what you already knew.",
      "roadmap":  "Good instinct on sequencing. The API migration is the unlock — everything else depends on it. What's missing is the estimate: how many weeks does the migration actually take? That's the number the board will pressure-test.",
      "fleet":    "The price point is a reasonable starting hypothesis. What's missing is one actual conversation — even a 15-minute call with a fleet manager who tells you that number is too high or too low changes everything. No more research until you have that call.",
      "hire":     "Those are the right questions. What's missing is the answer — schedule the reference calls now. The information you're speculating about is available from two phone calls. Stop hypothesising and make the calls.",
    };
    state.misirResponse = fallbacks[state.spaceId] || "That's a start. File it to the subspace and see what's still missing when you look at it next to the other captures.";
  }

  state.misirAnswering = false;
  render();
};

window.openSubspace = function(id) {
  const ss = window.getSubspaceById(id);
  if (!ss) return;
  if (state.scope === "all") { state.scope = ss.spaceId; state.spaceId = ss.spaceId; }
  state.view = "collection";
  state.colSubspace = id;
  render();
};
window.openCapture = function(id) { /* detail panel — future */ };
window.openChat    = function(id) { /* chat detail — future */ };

/* ============================================================
   Modals
   ============================================================ */
window.openNewSpace = function() {
  state.modal = "new-space";
  state.newSpaceDraft = { title:"", goal:"", deadline:"" };
  render();
};
window.openNewChat = function() {
  state.modal = "new-chat";
  state.newChatDraft = "";
  state.newChatSpaceId = state.scope === "all" ? "series-a" : state.scope;
  render();
};
window.closeModal = function() { state.modal = null; render(); };

window.updateNewSpace   = function(f, v) { state.newSpaceDraft[f] = v; };
window.updateNewChatDraft = function(v) { state.newChatDraft = v; };
window.updateNewChatSpace = function(id) { state.newChatSpaceId = id; };

window.submitNewSpace = function() {
  const d = state.newSpaceDraft;
  if (!d.title.trim()) return;
  const id = "ns-" + Date.now();
  window.SPACES.unshift({ id, title:d.title.trim(), unread:0, readiness:0, subspaceCount:0, capturesWeek:0, criticalGaps:0 });
  window.SPACE_DATA[id] = { challenge:{ id, title:d.title.trim(), goal:d.goal.trim(), deadline:d.deadline.trim() ? { label:d.deadline.trim(), inDays:"—" } : null, readiness:0, subspaceCount:0, capturesWeek:0, capturesToday:0, criticalGaps:0, created:"Today", updated:"just now" }, subspaces:[], captures:[], chats:[], notifications:[], nudge:null };
  window.SPACE_COLORS[id] = "#6E6862";
  state.scope = id; state.spaceId = id;
  state.modal = null; state.view = "home";
  render();
};

window.submitNewChat = function() {
  const draft = state.newChatDraft.trim();
  if (!draft) return;
  const id  = "ch-" + Date.now();
  const spId = state.newChatSpaceId;
  const d   = window.SPACE_DATA[spId];
  if (d) {
    d.chats = d.chats || [];
    d.chats.unshift({ id, subject:draft.length>80?draft.slice(0,80)+"…":draft, lastAt:"just now", unread:true, snippet:"Misir is reading your captures — answer arriving…", subspaceId:null });
  }
  state.modal = null;
  state.scope = spId; state.spaceId = spId;
  state.view = "inbox";
  render();
};

function renderModal() {
  if (!state.modal) return "";
  let inner = state.modal === "new-space" ? renderNewSpaceModal() : renderNewChatModal();
  return `<div class="modal-scrim" onclick="closeModal()"></div><div class="modal-wrap" onclick="closeModal()"><div class="modal-card" onclick="event.stopPropagation()" role="dialog" aria-modal="true">${inner}</div></div>`;
}

function renderNewSpaceModal() {
  const d = state.newSpaceDraft;
  return `
    <div class="modal-head">
      <div>
        <div class="eyebrow">New space</div>
        <h2 class="modal-title">Define a challenge.</h2>
        <p class="modal-sub">Give it a name and the goal you're trying to reach. Misir will generate subspaces and start watching.</p>
      </div>
      <button class="modal-x" onclick="closeModal()" aria-label="Close">${fmt.icn("x",14)}</button>
    </div>
    <div class="modal-body">
      <label class="modal-field">
        <span class="modal-label">Challenge</span>
        <input type="text" placeholder="Raise Series A, hire a Head of Eng, learn pour-over coffee…" value="${d.title}" oninput="updateNewSpace('title',this.value)" onkeydown="if(event.key==='Enter'&&event.metaKey)submitNewSpace()">
      </label>
      <label class="modal-field">
        <span class="modal-label">End goal</span>
        <textarea rows="3" placeholder="Close $5M Series A by Q3 2025, led by an international fund out of SEA." oninput="updateNewSpace('goal',this.value)">${d.goal}</textarea>
        <span class="modal-hint">Specific is better than ambitious. Misir's marker generation uses this.</span>
      </label>
      <label class="modal-field">
        <span class="modal-label">Deadline · optional</span>
        <input type="text" placeholder="Wavemaker first meeting · 6 days" value="${d.deadline}" oninput="updateNewSpace('deadline',this.value)">
      </label>
      <div class="modal-preview">
        <div class="eyebrow" style="margin-bottom:6px;">Misir will generate</div>
        <ul class="modal-preview-list">
          <li>4–8 subspaces (AI-generated topics) inside this challenge</li>
          <li>A starter set of markers per subspace to seed the extension</li>
          <li>A first readiness baseline once 5+ captures land</li>
        </ul>
      </div>
    </div>
    <div class="modal-foot">
      <span class="modal-hint">⌘ Enter to create</span>
      <div class="row" style="gap:8px;">
        <button class="btn ghost" onclick="closeModal()">Cancel</button>
        <button class="btn primary" onclick="submitNewSpace()">Create space ${fmt.icn("arrow-right",12)}</button>
      </div>
    </div>`;
}

function renderNewChatModal() {
  const prompts = [
    "What's the single biggest gap before my next deadline?",
    "Which subspace should I close first?",
    "Draft the opening 90 seconds of the pitch.",
    "What do my captures say about the competitive landscape?",
  ];
  return `
    <div class="modal-head">
      <div>
        <div class="eyebrow">New chat</div>
        <h2 class="modal-title">Ask Misir.</h2>
        <p class="modal-sub">Misir reads your captures and subspaces before answering.</p>
      </div>
      <button class="modal-x" onclick="closeModal()" aria-label="Close">${fmt.icn("x",14)}</button>
    </div>
    <div class="modal-body">
      <div class="modal-field">
        <span class="modal-label">In space</span>
        <div class="modal-space-picker">
          ${window.SPACES.map(s => `
            <button class="modal-space-opt ${state.newChatSpaceId===s.id?'active':''}" onclick="updateNewChatSpace('${s.id}');document.querySelectorAll('.modal-space-opt').forEach(el=>el.classList.remove('active'));this.classList.add('active');">
              ${fmt.icn("target",12)} ${s.title}
            </button>`).join("")}
        </div>
      </div>
      <label class="modal-field">
        <span class="modal-label">Your question</span>
        <textarea rows="4" placeholder="Ask anything about what you've captured…" oninput="updateNewChatDraft(this.value)" onkeydown="if(event.key==='Enter'&&(event.metaKey||event.ctrlKey))submitNewChat()">${state.newChatDraft}</textarea>
        <span class="modal-hint">⌘ Enter to send</span>
      </label>
      <div class="modal-preview">
        <div class="eyebrow" style="margin-bottom:6px;">Or start from</div>
        <div class="modal-prompts">
          ${prompts.map(p => `<button class="modal-prompt" onclick="updateNewChatDraft(${JSON.stringify(p)});document.querySelector('.modal-card textarea').value=${JSON.stringify(p)};document.querySelector('.modal-card textarea').focus();">${p}</button>`).join("")}
        </div>
      </div>
    </div>
    <div class="modal-foot">
      <span class="modal-hint">${window.scopeCaptures().length} captures available as context</span>
      <div class="row" style="gap:8px;">
        <button class="btn ghost" onclick="closeModal()">Cancel</button>
        <button class="btn primary" onclick="submitNewChat()">Send ${fmt.icn("arrow-right",12)}</button>
      </div>
    </div>`;
}

document.addEventListener("keydown", (e) => { if (e.key==="Escape"&&state.modal) { state.modal=null; render(); } });
window.newChat  = function() { window.openNewChat(); };
window.newSpace = function() { window.openNewSpace(); };
window.markAllRead = function() { window.scopeNotifications().forEach(n => n.unread=false); render(); };

/* ============================================================
   Boot
   ============================================================ */
document.addEventListener("DOMContentLoaded", render);
