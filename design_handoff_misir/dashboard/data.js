/* =====================================================================
   Misir — multi-space data
   Architecture: SPACE_DATA[spaceId] holds everything for each space.
   Helpers at the bottom return the right slice based on active scope.
   ===================================================================== */

window.USER = { name: "Mohiuddin", initial: "M", role: "Zantrik · CEO" };

window.SPACE_COLORS = {
  "series-a": "#FF6C3C",
  "roadmap":  "#2A6A4A",
  "fleet":    "#2A4A7A",
  "hire":     "#7A3FA0",
};

window.SPACES = [
  { id: "series-a", title: "Raise Series A",      unread: 3, readiness: 64, subspaceCount: 7, capturesWeek: 46, criticalGaps: 2 },
  { id: "roadmap",  title: "Product roadmap H2",  unread: 1, readiness: 38, subspaceCount: 5, capturesWeek: 19, criticalGaps: 1 },
  { id: "fleet",    title: "Fleet SaaS expansion", unread: 2, readiness: 22, subspaceCount: 6, capturesWeek: 12, criticalGaps: 3 },
  { id: "hire",     title: "Hire VP Engineering",  unread: 0, readiness: 71, subspaceCount: 3, capturesWeek: 18, criticalGaps: 0 },
];

window.SPACE_DATA = {};

/* ─────────────────────────── SERIES A ────────────────────────────── */
SPACE_DATA["series-a"] = {
  challenge: {
    id: "series-a", title: "Raise Series A",
    goal: "Close $5M Series A by Q3 2025, led by an international fund out of Southeast Asia.",
    deadline: { label: "Wavemaker first meeting", inDays: 6 },
    readiness: 64, created: "Mar 14, 2026", updated: "2h ago",
    capturesToday: 7, capturesWeek: 46, subspaceCount: 7, criticalGaps: 2,
  },
  subspaces: [
    { id: "investor-intel",      title: "Investor intelligence",   desc: "Funds actively investing in SEA B2B SaaS post-2024 — their thesis, portfolio, and what they probe in first meetings.", markers: ["Wavemaker","Jungle Ventures","Accelerating Asia","SEA Series A","fund thesis"], captures: 14, weekDelta: 6, completeness: 78, lastHit: "32m ago", spark: [2,3,1,4,5,3,6], aiGen: true },
    { id: "cac-unit-econ",       title: "CAC & unit economics",    desc: "Automotive-SaaS benchmarks — payback period, LTV/CAC, contribution margin. Connects to Q1 dashboard.", markers: ["CAC payback","LTV","gross margin","contribution margin","18-month payback"], captures: 9, weekDelta: 2, completeness: 65, lastHit: "1h ago", spark: [1,2,2,3,4,2,2], aiGen: true },
    { id: "competition",         title: "Competitive landscape",   desc: "Direct and adjacent automotive players in South & Southeast Asia, structural differences, comparable raises.", markers: ["Pitstop","Park+","automotive marketplace","fleet SaaS"], captures: 11, weekDelta: 4, completeness: 52, lastHit: "Yesterday", spark: [0,2,1,2,3,3,4], aiGen: true },
    { id: "gomechanic-forensic", title: "GoMechanic forensic",     desc: "Forensic breakdown of the GoMechanic collapse — what specifically failed and how Zantrik differs structurally.", markers: ["GoMechanic collapse","Amit Bhasin","fraud allegations"], captures: 4, weekDelta: 0, completeness: 22, lastHit: "3d ago", spark: [1,0,0,2,0,1,0], aiGen: true, flag: "critical", flagNote: "Opened 3 times this week without resolving." },
    { id: "market-tam",          title: "Market sizing & TAM",     desc: "Bangladesh and SEA automotive aftermarket, fleet operator counts, digitization rate.", markers: ["Bangladesh automotive","fleet operators","digitization rate"], captures: 7, weekDelta: 1, completeness: 60, lastHit: "2d ago", spark: [1,1,0,2,1,1,1], aiGen: true },
    { id: "narrative",           title: "Narrative & deck framing",desc: "Story angles, moat framing, slide composition that have landed in recent SEA B2B raises.", markers: ["ecosystem lock-in","franchise moat","structural moat"], captures: 6, weekDelta: 3, completeness: 48, lastHit: "5h ago", spark: [0,1,1,1,2,1,0], aiGen: true },
    { id: "customer-evidence",   title: "Customer evidence",       desc: "Retention, NPS, fleet pilot results — must come from Zantrik's own systems, not external research.", markers: ["NPS","retention curve","case study","fleet pilot"], captures: 1, weekDelta: 0, completeness: 12, lastHit: "1w ago", spark: [0,0,0,0,0,0,1], aiGen: true, flag: "low", flagNote: "Internal data pull needed — cannot be researched externally." },
  ],
  captures: [
    { id:"sa-1",  time:"09:14", date:"Today",     surface:"bloomberg.com",     type:"Article", title:"Wavemaker doubles down on Southeast Asia B2B SaaS",          marker:"Wavemaker",           subspaceId:"investor-intel" },
    { id:"sa-2",  time:"09:51", date:"Today",     surface:"claude.ai",         type:"AI chat", title:"Conversation: CAC payback benchmarks for automotive SaaS",   marker:"CAC payback",         subspaceId:"cac-unit-econ" },
    { id:"sa-3",  time:"11:22", date:"Today",     surface:"techinasia.com",    type:"Article", title:"Inside Accelerating Asia's automotive thesis",               marker:"Accelerating Asia",   subspaceId:"investor-intel" },
    { id:"sa-4",  time:"13:05", date:"Today",     surface:"linkedin.com",      type:"Post",    title:"Paul Santos on what SEA Series A founders miss in 2026",    marker:"SEA Series A",        subspaceId:"investor-intel" },
    { id:"sa-5",  time:"14:30", date:"Today",     surface:"chatgpt.com",       type:"AI chat", title:"GoMechanic collapse — what really failed",                   marker:"GoMechanic collapse", subspaceId:"gomechanic-forensic", revisit:3 },
    { id:"sa-6",  time:"15:48", date:"Today",     surface:"bessemer.com",      type:"PDF",     title:"State of the cloud — vertical SaaS unit economics",          marker:"contribution margin", subspaceId:"cac-unit-econ" },
    { id:"sa-7",  time:"16:20", date:"Today",     surface:"youtube.com",       type:"Video",   title:"Park+ founder on building India's fleet operating system",   marker:"Park+",               subspaceId:"competition" },
    { id:"sa-8",  time:"17:11", date:"Yesterday", surface:"x.com",             type:"Post",    title:"Thread: Why ecosystem lock-in beats process innovation",     marker:"ecosystem lock-in",   subspaceId:"narrative" },
    { id:"sa-9",  time:"14:02", date:"Yesterday", surface:"gemini.google.com", type:"AI chat", title:"Pitstop UAE raise — comparable to Zantrik?",                 marker:"Pitstop",             subspaceId:"competition" },
    { id:"sa-10", time:"10:48", date:"Yesterday", surface:"wsj.com",           type:"Article", title:"Jungle Ventures fund IV — sector preferences",               marker:"Jungle Ventures",     subspaceId:"investor-intel" },
    { id:"sa-11", time:"18:34", date:"2d ago",    surface:"claude.ai",         type:"AI chat", title:"Framing franchise as a structural moat",                    marker:"franchise moat",      subspaceId:"narrative" },
    { id:"sa-12", time:"11:09", date:"2d ago",    surface:"ldb.gov.bd",        type:"PDF",     title:"Bangladesh automotive sector report 2025",                   marker:"Bangladesh automotive",subspaceId:"market-tam" },
  ],
  chats: [
    { id:"sa-c1", subject:"GoMechanic — what actually failed",          lastAt:"32m ago",   unread:true,  snippet:"Three distinct failure modes. Two don't apply to Zantrik. One does — and you haven't addressed it publicly.", subspaceId:"gomechanic-forensic" },
    { id:"sa-c2", subject:"Are my CAC numbers Series A-ready?",         lastAt:"2h ago",    unread:true,  snippet:"Your contribution margin is 41% — above median for vertical SaaS, but Wavemaker will probe how stable it is.", subspaceId:"cac-unit-econ" },
    { id:"sa-c3", subject:"Wavemaker first-meeting brief",              lastAt:"Today",     unread:false, snippet:"6 days. Here's what they actually ask in first meetings with SEA B2B founders.", subspaceId:"investor-intel" },
    { id:"sa-c4", subject:"Franchise moat vs ecosystem lock-in",        lastAt:"Yesterday", unread:false, snippet:"Neither story has landed in a successful SEA raise. The differentiated angle is…", subspaceId:"narrative" },
    { id:"sa-c5", subject:"Draft: opening 90s of Wavemaker pitch",     lastAt:"5d ago",    unread:false, snippet:"Working from the 6 narrative captures + your franchise framing. Three versions below…", subspaceId:"narrative" },
  ],
  notifications: [
    { id:"sa-n1", severity:"critical", title:"GoMechanic opened ×3 without resolving",      body:"Subspace at 22%. Wavemaker will ask in the first 10 minutes.",                 at:"1h ago",       subspaceId:"gomechanic-forensic", actionLabel:"Open subspace" },
    { id:"sa-n2", severity:"critical", title:"Customer evidence at 12%",                    body:"Cannot be filled by web reading. Pull retention & NPS from internal systems.", at:"3h ago",       subspaceId:"customer-evidence",   actionLabel:"Open subspace" },
    { id:"sa-n3", severity:"info",     title:"Marker hit · Wavemaker",                      body:"bloomberg.com — \"Wavemaker doubles down on Southeast Asia B2B SaaS\".",       at:"Today · 09:14",subspaceId:"investor-intel",       actionLabel:"View capture" },
    { id:"sa-n4", severity:"warning",  title:"Subspace stalled · GoMechanic forensic",      body:"No new captures in 3 days. 4 markers haven't fired.",                         at:"Yesterday",    subspaceId:"gomechanic-forensic", actionLabel:"Refine markers" },
    { id:"sa-n5", severity:"info",     title:"Cross-subspace pattern found",                body:"18-month CAC threshold appears in 6 captures across 2 subspaces.",             at:"Yesterday",    subspaceId:"cac-unit-econ",       actionLabel:"View connection" },
  ],
  comparison: {
    tension: { title:"Conflicting take · narrative angle",
      rows: [
        { from:"Claude",       stance:"Lead with ecosystem lock-in." },
        { from:"Gemini",       stance:"Franchise model is the untested differentiator." },
        { from:"Web research", stance:"Neither story has landed in a successful SEA raise yet." },
      ],
      edge:"You have already built the franchise layer. It's a narrative no one has told well yet.",
    },
    sources: [
      { key:"claude", label:"Claude", count:14,
        summary:"CAC payback under 18 months is non-negotiable for SEA Series A post-2024. Lead with franchise as structural moat, not technology.",
        findings:[{ text:"Median ARR $2–4M, 3× YoY growth expected at Series A", conf:92 },{ text:"Path-to-profitability within 24 months — new investor requirement", conf:88 },{ text:"CAC payback threshold has tightened from 24 to 18 months", conf:81 },{ text:"Ecosystem lock-in narrative outperforms process innovation", conf:74 }],
        signal:"Investors now require a profitability roadmap. The shift is post-Q4 2024 and most founders pitching haven't adjusted." },
      { key:"gemini", label:"Gemini", count:9,
        summary:"Bangladesh automotive is $2.1B with 12% digitization. No competitor has raised in 12 months.",
        findings:[{ text:"GoMechanic failure: unit-economics collapse, not market failure", conf:95 },{ text:"Pitstop UAE raised $3M — direct comparable, smaller market", conf:87 },{ text:"B2B fleet contracts significantly de-risk the revenue story", conf:83 },{ text:"Franchise-as-moat globally underused in automotive pitch decks", conf:71 }],
        signal:"No automotive startup in South Asia has told the franchise-as-moat story to international investors. A genuine white space." },
      { key:"web", label:"Web", count:23,
        summary:"Local investor ticket sizes cap at $500K–$1M. An international lead is essential.",
        findings:[{ text:"Accelerating Asia: 3 automotive investments in 18 months", conf:91 },{ text:"SEA Series A timeline: 6–9 months in current climate", conf:84 },{ text:"Startup Bangladesh: 6 of 8 seed portfolios received follow-on", conf:79 },{ text:"No Zantrik competitor coverage in last 12 months", conf:66 }],
        signal:"Zantrik has zero coverage in international tech media — a risk and an opportunity." },
    ],
    synthesis: {
      consensus:"The fundraising climate has structurally changed. Growth-at-all-costs is dead. Zantrik's franchise model and B2B contracts are the right foundation — but they need to be quantified.",
      conflict: "Claude says lead with ecosystem lock-in. Gemini says franchise model. Web shows neither story has landed in a successful SEA raise yet.",
      blindspot:"Customer evidence (12%) and the GoMechanic forensic (22%) are the two highest-probability curveballs in any Series A conversation.",
    },
  },
  decision: {
    question:"Should I raise Series A now, or extend runway?",
    optionA:{ label:"Raise Series A now",     readiness:64, note:"2 critical gaps remain" },
    optionB:{ label:"Extend runway 6 months", readiness:0,  note:"Not yet researched" },
    for:["Accelerating Asia actively investing in automotive — thesis confirmed.","B2B fleet contracts significantly de-risk the revenue narrative.","No competitor has raised in 12 months — clear market window.","6–9 month timeline means starting now = closing Q3 2025."],
    against:["CAC payback not confirmed below the 18-month threshold.","GoMechanic question unresearched — high-probability curveball.","Unit economics not benchmarked against internal Zantrik data.","International lead required — local tickets cap at $500K–$1M."],
    gaps:[
      { sev:"Critical", subspaceId:"gomechanic-forensic", label:"Forensic breakdown of GoMechanic collapse vs. Zantrik",         action:"Will come up in the first 10 minutes of any investor call." },
      { sev:"Critical", subspaceId:"investor-intel",      label:"What Wavemaker and Jungle Ventures ask SEA B2B founders post-2024", action:"Pull recent portfolio notes and LP letters." },
      { sev:"High",     subspaceId:"customer-evidence",   label:"Zantrik NPS and retention vs. automotive SaaS benchmarks",        action:"Internal data pull — cannot be researched externally." },
      { sev:"Medium",   subspaceId:"narrative",           label:"International press coverage strategy before the raise",           action:"Zero Zantrik coverage in international tech media." },
    ],
    ask:"Want to walk me through how you'd answer the GoMechanic question right now?",
  },
  nudge:{ scatter:"You opened GoMechanic 3 times this week. No new research followed any of those opens.", direction:"Stop circling it. The subspace is at 22% — one focused session closes it.", consequence:"Wavemaker will ask this in the first 10 minutes." },
};

/* ─────────────────────────── ROADMAP ────────────────────────────── */
SPACE_DATA["roadmap"] = {
  challenge: {
    id:"roadmap", title:"Product roadmap H2",
    goal:"Ship a focused H2 roadmap for Zantrik's SaaS platform — 3 bets, engineering aligned, no scope creep.",
    deadline:{ label:"Board review", inDays:18 },
    readiness:38, created:"Apr 01, 2026", updated:"Yesterday",
    capturesToday:2, capturesWeek:19, subspaceCount:5, criticalGaps:1,
  },
  subspaces: [
    { id:"rm-customer",    title:"Customer signals",    desc:"Feature requests, NPS verbatims, support tickets — what customers actually need vs. what they say.", markers:["feature request","NPS verbatim","support ticket","churn reason"], captures:6, weekDelta:2, completeness:55, lastHit:"Today · 08:30", spark:[1,1,2,3,2,2,3], aiGen:true },
    { id:"rm-tech-debt",   title:"Technical debt",      desc:"What engineering says is slowing them down — the invisible tax on every sprint.", markers:["tech debt","refactor","legacy code","API migration"], captures:4, weekDelta:1, completeness:40, lastHit:"Yesterday", spark:[0,1,1,2,1,2,1], aiGen:true },
    { id:"rm-competitors", title:"Competitor features", desc:"What GoMechanic, Park+, Pitstop, and Carro shipped in the last 6 months.", markers:["competitor launch","Carro feature","Park+ update","product comparison"], captures:5, weekDelta:2, completeness:62, lastHit:"Yesterday", spark:[1,2,1,2,3,2,3], aiGen:true },
    { id:"rm-resources",   title:"Resource planning",   desc:"Engineering capacity, hiring timeline, and what can realistically ship in H2.", markers:["sprint velocity","engineering capacity","Q3 headcount"], captures:2, weekDelta:0, completeness:20, lastHit:"3d ago", spark:[0,0,1,0,0,1,0], aiGen:true, flag:"low", flagNote:"Needs internal data from the eng team." },
    { id:"rm-release",     title:"Release strategy",    desc:"How to sequence and communicate the H2 bets — internal alignment and customer announcements.", markers:["release cadence","feature flag","beta rollout","launch plan"], captures:2, weekDelta:0, completeness:18, lastHit:"4d ago", spark:[0,0,0,1,0,1,0], aiGen:true, flag:"critical", flagNote:"No sequencing plan yet — board review in 18 days." },
  ],
  captures: [
    { id:"rm-1", time:"08:30", date:"Today",     surface:"notion.so",         type:"Article", title:"Customer NPS deep-dive — Q1 verbatims compiled",          marker:"NPS verbatim",     subspaceId:"rm-customer" },
    { id:"rm-2", time:"10:15", date:"Today",     surface:"claude.ai",         type:"AI chat", title:"Prioritisation frameworks for product roadmaps",          marker:"feature request",  subspaceId:"rm-customer" },
    { id:"rm-3", time:"14:00", date:"Yesterday", surface:"linear.app",        type:"Article", title:"Park+ announced offline-first fleet management module",   marker:"Park+ update",     subspaceId:"rm-competitors" },
    { id:"rm-4", time:"09:45", date:"Yesterday", surface:"gemini.google.com", type:"AI chat", title:"Tech debt taxonomy for early-stage SaaS teams",          marker:"tech debt",        subspaceId:"rm-tech-debt" },
    { id:"rm-5", time:"11:30", date:"2d ago",    surface:"techcrunch.com",    type:"Article", title:"Carro launches API-first service bay integration",        marker:"Carro feature",    subspaceId:"rm-competitors" },
    { id:"rm-6", time:"15:20", date:"2d ago",    surface:"claude.ai",         type:"AI chat", title:"Engineering capacity planning — velocity estimation",    marker:"sprint velocity",  subspaceId:"rm-resources" },
  ],
  chats: [
    { id:"rm-c1", subject:"What should our 3 H2 bets be?",                  lastAt:"Today",     unread:true,  snippet:"Based on 19 captures: fleet API, offline mode, and NPS-driven retention tooling. Here's why…", subspaceId:"rm-customer" },
    { id:"rm-c2", subject:"How much tech debt is realistic to clear in H2?", lastAt:"Yesterday", unread:false, snippet:"4 captures on this. The API migration is the highest-leverage item — everything else depends on it.", subspaceId:"rm-tech-debt" },
    { id:"rm-c3", subject:"Competitor feature gap analysis",                 lastAt:"2d ago",    unread:false, snippet:"Park+ and Carro both shipped offline-first in Q1. Zantrik doesn't have this yet.", subspaceId:"rm-competitors" },
  ],
  notifications: [
    { id:"rm-n1", severity:"critical", title:"No release plan — board review in 18 days",        body:"Release strategy at 18%. Board will ask what ships first.",                    at:"Today",      subspaceId:"rm-release",    actionLabel:"Open subspace" },
    { id:"rm-n2", severity:"warning",  title:"Resource planning stalled at 20%",                 body:"Engineering capacity data lives in Linear. Pull it before the roadmap locks.", at:"Yesterday",  subspaceId:"rm-resources",  actionLabel:"Pull data" },
    { id:"rm-n3", severity:"info",     title:"Marker hit · NPS verbatim",                        body:"notion.so — Q1 NPS verbatims compiled. Filed to Customer signals.",           at:"Today · 08:30", subspaceId:"rm-customer", actionLabel:"View capture" },
  ],
  comparison: {
    tension:{ title:"Conflicting take · prioritisation",
      rows:[
        { from:"Customer data", stance:"Fleet API and offline mode are the top two requests by volume." },
        { from:"Engineering",   stance:"Tech debt must be cleared first — velocity is declining." },
        { from:"Competitors",   stance:"Offline-first is becoming table stakes; delay risks losing fleet accounts." },
      ],
      edge:"The fleet API and offline mode are the same bet — one architecture decision unlocks both.",
    },
    sources:[
      { key:"claude", label:"Customer signals", count:6, summary:"Fleet API and offline mode top the request list. Churn data points at missing reliability, not missing features.",
        findings:[{ text:"Fleet API requested by 8 of top 15 accounts", conf:88 },{ text:"Offline mode cited in 34% of churn conversations", conf:82 },{ text:"NPS verbatims skew toward reliability over new features", conf:76 },{ text:"Support tickets cluster around sync and connectivity", conf:71 }],
        signal:"Your highest-value customers are asking for infrastructure, not features." },
      { key:"gemini", label:"Technical", count:4, summary:"API migration is the highest-leverage tech debt item. Current velocity is 40% of what it could be post-refactor.",
        findings:[{ text:"API migration unlocks 3 planned features currently blocked", conf:91 },{ text:"Current tech debt reducing sprint velocity by ~40%", conf:85 },{ text:"Legacy auth layer is the single biggest risk item", conf:78 },{ text:"Estimated 6 weeks to clear critical path debt", conf:65 }],
        signal:"Clearing the API migration first means the second half of H2 moves 2× faster." },
      { key:"web", label:"Competitors", count:5, summary:"Park+ and Carro both shipped offline-first in Q1. Offline-first is becoming a fleet requirement.",
        findings:[{ text:"Park+ offline-first shipped to 200+ fleet operators in March", conf:93 },{ text:"Carro API integration reduced onboarding time by 60%", conf:87 },{ text:"Pitstop lost 3 accounts to offline-capable competitors", conf:72 },{ text:"Fleet operators cite offline mode in 70% of RFPs", conf:68 }],
        signal:"The window to ship offline-first before it becomes expected is closing. 2 quarters at most." },
    ],
    synthesis:{
      consensus:"Fleet API, offline mode, and tech debt clearance are not three things — they're one architectural bet. Do the API migration and the other two follow.",
      conflict:"Customer data says ship now. Engineering says clear debt first. The resolution is the API migration: it's both.",
      blindspot:"No data on what existing fleet accounts will churn over if H2 misses. The risk isn't competition — it's existing account retention.",
    },
  },
  decision:{
    question:"Which 3 bets should anchor the H2 roadmap?",
    optionA:{ label:"Fleet API + Offline mode + Retention tooling", readiness:38, note:"Leading customer signal" },
    optionB:{ label:"Tech debt + API migration + Fleet API", readiness:0, note:"Engineering-first — not yet modelled" },
    for:["Fleet API requested by 8 of top 15 accounts.","Offline mode cited in 34% of churn conversations.","Carro and Park+ both shipped offline-first in Q1.","Retention tooling directly ties to NPS improvement plan."],
    against:["Engineering velocity at 60% without clearing API migration.","Resource planning at 20% — capacity unknown.","No release sequencing plan — board review in 18 days.","No data on which features prevent churn in top accounts."],
    gaps:[
      { sev:"Critical", subspaceId:"rm-release",   label:"Release sequencing plan — what ships first", action:"Board will ask for this directly." },
      { sev:"High",     subspaceId:"rm-resources",  label:"Engineering capacity for H2 — realistic velocity", action:"Pull from Linear before the roadmap locks." },
      { sev:"Medium",   subspaceId:"rm-tech-debt",  label:"API migration estimate — weeks and risk surface", action:"Engineering team needs to scope this." },
    ],
    ask:"Want me to draft the 3-bet framework for the board based on what you've captured so far?",
  },
  nudge:{ scatter:"No release plan. Board review in 18 days. You've captured customer signals but not sequenced them into a timeline.", direction:"The fleet API and offline mode are the same architectural bet. Sequence them as one item and the roadmap locks.", consequence:"Board will ask 'what ships first?' You don't have an answer yet." },
};

/* ─────────────────────────── FLEET ─────────────────────────────── */
SPACE_DATA["fleet"] = {
  challenge:{
    id:"fleet", title:"Fleet SaaS expansion",
    goal:"Launch a fleet-operator SaaS tier — 3 signed pilots, pricing validated, integration shipped.",
    deadline:{ label:"Pilot kickoff", inDays:45 },
    readiness:22, created:"Apr 18, 2026", updated:"2d ago",
    capturesToday:1, capturesWeek:12, subspaceCount:6, criticalGaps:3,
  },
  subspaces:[
    { id:"fl-market",     title:"Market validation",   desc:"Who fleet operators currently use, what they pay, and why they'd switch.",                         markers:["fleet operator","telematics","vehicle management","fleet spend"],      captures:4, weekDelta:1, completeness:45, lastHit:"Today · 10:00", spark:[1,0,1,2,1,2,2], aiGen:true },
    { id:"fl-segments",   title:"Fleet segments",      desc:"Small fleets (5–20) vs. enterprise (100+) — different problems, different price points.",          markers:["SME fleet","enterprise fleet","owner-operator","100+ vehicles"],      captures:3, weekDelta:0, completeness:30, lastHit:"2d ago",    spark:[0,1,0,1,1,0,1], aiGen:true },
    { id:"fl-pricing",    title:"Pricing model",       desc:"Per-seat, per-vehicle, or usage-based? Comparable SaaS fleet tools and their pricing.",           markers:["fleet SaaS pricing","per-vehicle","fleet management cost"],           captures:2, weekDelta:0, completeness:18, lastHit:"3d ago",    spark:[0,0,1,0,0,1,0], aiGen:true, flag:"critical", flagNote:"No pricing model validated. Pilot kickoff in 45 days." },
    { id:"fl-tech",       title:"Tech infrastructure", desc:"What integrations fleet operators expect on day one — GPS, OBD, insurance APIs.",                 markers:["GPS integration","OBD","telematics API","fleet dashboard"],          captures:2, weekDelta:1, completeness:22, lastHit:"2d ago",    spark:[0,0,0,1,0,1,1], aiGen:true, flag:"critical" },
    { id:"fl-sales",      title:"Sales motion",        desc:"How fleet SaaS companies land and expand — outbound vs. product-led, deal cycle length.",         markers:["fleet sales cycle","outbound SDR","product-led growth"],             captures:1, weekDelta:0, completeness:12, lastHit:"1w ago",    spark:[0,0,0,0,0,1,0], aiGen:true, flag:"critical" },
    { id:"fl-regulatory", title:"Regulatory landscape",desc:"Bangladesh BRTA requirements and SEA cross-border fleet operation rules.",                        markers:["BRTA","vehicle registration","cross-border fleet"],                  captures:1, weekDelta:0, completeness:10, lastHit:"1w ago",    spark:[0,0,0,0,1,0,0], aiGen:true },
  ],
  captures:[
    { id:"fl-1", time:"10:00", date:"Today",     surface:"claude.ai",         type:"AI chat", title:"Fleet management software landscape in South Asia",          marker:"fleet operator",     subspaceId:"fl-market" },
    { id:"fl-2", time:"09:30", date:"2d ago",    surface:"gemini.google.com", type:"AI chat", title:"Telematics API integration patterns for fleet SaaS",        marker:"telematics API",     subspaceId:"fl-tech" },
    { id:"fl-3", time:"11:00", date:"2d ago",    surface:"techcrunch.com",    type:"Article", title:"Fleetio raises $125M — per-vehicle pricing model deep dive", marker:"fleet SaaS pricing", subspaceId:"fl-pricing" },
    { id:"fl-4", time:"14:30", date:"3d ago",    surface:"claude.ai",         type:"AI chat", title:"SME fleet operator interview synthesis",                    marker:"SME fleet",          subspaceId:"fl-segments" },
    { id:"fl-5", time:"16:00", date:"3d ago",    surface:"benzinga.com",      type:"Article", title:"Vehicle telematics market — SEA forecast 2026",             marker:"telematics",         subspaceId:"fl-market" },
  ],
  chats:[
    { id:"fl-c1", subject:"What's the right pricing model for fleet operators?", lastAt:"3d ago", unread:true,  snippet:"Per-vehicle is standard for SME. Enterprise fleets negotiate usage-based. You need both tiers.", subspaceId:"fl-pricing" },
    { id:"fl-c2", subject:"How do we land the first 3 pilot customers?",         lastAt:"1w ago", unread:true,  snippet:"Outbound to fleet managers at logistics companies is the fastest path to pilot.", subspaceId:"fl-sales" },
  ],
  notifications:[
    { id:"fl-n1", severity:"critical", title:"No pricing model — pilot kickoff in 45 days",   body:"Pricing subspace at 18%. You can't sign pilots without a number.",                at:"Today",      subspaceId:"fl-pricing",  actionLabel:"Open subspace" },
    { id:"fl-n2", severity:"critical", title:"Tech integration scope undefined",               body:"Pilot customers will ask about GPS and OBD on day one. What's in scope?",        at:"Yesterday",  subspaceId:"fl-tech",     actionLabel:"Open subspace" },
    { id:"fl-n3", severity:"critical", title:"No sales motion — no outreach plan",            body:"Sales motion at 12%. No plan for pilot recruitment yet.",                         at:"2d ago",     subspaceId:"fl-sales",    actionLabel:"Open subspace" },
    { id:"fl-n4", severity:"info",     title:"Marker hit · fleet operator",                   body:"claude.ai — fleet management software landscape in South Asia.",                  at:"Today · 10:00", subspaceId:"fl-market", actionLabel:"View capture" },
  ],
  comparison:{
    tension:{ title:"Conflicting take · launch scope",
      rows:[
        { from:"Market data",  stance:"SME fleets (5–20 vehicles) are easiest to land. Low friction, fast decision." },
        { from:"Competitor",   stance:"Enterprise fleet (100+) accounts justify the integration cost. SME churns." },
        { from:"Pricing data", stance:"Per-vehicle pricing works for SME but breaks at enterprise without usage caps." },
      ],
      edge:"Launch with SME to prove the integration. Enterprise enters with a second pricing tier in Q4.",
    },
    sources:[
      { key:"claude", label:"Market research", count:4, summary:"SME fleet operators are underserved and price-sensitive. No dominant player in Bangladesh.",
        findings:[{ text:"70% of Bangladesh fleet operators are SME (under 20 vehicles)", conf:87 },{ text:"Current tools are spreadsheet or WhatsApp-based", conf:91 },{ text:"Average fleet software spend: $0 — no one is paying yet", conf:84 },{ text:"Fleet managers make buying decisions, not CEOs", conf:73 }],
        signal:"The market is uncontested because standard tools don't fit the Bangladesh context. Zantrik already understands that context." },
      { key:"gemini", label:"Competitors", count:3, summary:"Fleetio and Samsara dominate globally but have no SEA presence. Local competitors are fragmented.",
        findings:[{ text:"Fleetio: $125M raised, per-vehicle pricing $10–15/month", conf:89 },{ text:"No competitor with Bangladesh-specific compliance features", conf:93 },{ text:"Pitstop operates in UAE — adjacent but different regulatory environment", conf:81 },{ text:"Samsara hardware-first model doesn't translate to SEA", conf:77 }],
        signal:"The global leaders can't enter this market without a local partner. Zantrik is the local layer they'd need." },
      { key:"web", label:"Pricing & sales", count:2, summary:"Per-vehicle SaaS pricing is the standard. Enterprise deals require usage caps. SME sales cycle is 3–6 months.",
        findings:[{ text:"Per-vehicle pricing: $8–20/month industry standard", conf:86 },{ text:"SME fleet sales cycle: 4–8 weeks with right entry point", conf:80 },{ text:"Product demo → pilot → paid conversion rate: ~40%", conf:74 },{ text:"Fleet manager is the economic buyer for SME, not CFO", conf:88 }],
        signal:"The conversion path is short if you land with fleet managers. The mistake is going to the C-suite first." },
    ],
    synthesis:{
      consensus:"SME fleet in Bangladesh is the right starting point. The market is uncontested, Zantrik's existing relationships are the entry point, and the sales cycle is short.",
      conflict:"Scope is the tension — SME-first means limiting the integration to what SME needs, which might not satisfy enterprise later. Build for SME but design the API for enterprise.",
      blindspot:"No customer interviews in the captures yet. No data on what Bangladesh fleet operators actually need vs. what they say they need.",
    },
  },
  decision:{
    question:"Should we launch fleet SaaS with SME or enterprise first?",
    optionA:{ label:"SME-first (5–20 vehicles)", readiness:22, note:"3 critical gaps remain" },
    optionB:{ label:"Enterprise-first (100+)",   readiness:0,  note:"Not yet researched" },
    for:["SME decisions made by fleet managers — no lengthy procurement.","Bangladesh market is mostly SME — largest addressable segment.","Short sales cycle (4–8 weeks) fits pilot timeline.","Existing Zantrik relationships are with SME fleet operators."],
    against:["Pricing model not validated — no number confirmed.","Tech integration scope (GPS, OBD) not scoped.","No sales motion or outreach plan for pilot recruitment.","No BRTA / regulatory assessment completed."],
    gaps:[
      { sev:"Critical", subspaceId:"fl-pricing",  label:"Pricing model validated with at least 2 target fleet operators",  action:"Can't sign pilots without a number." },
      { sev:"Critical", subspaceId:"fl-tech",     label:"Integration scope for pilot — what's in and out on day one",       action:"Pilot customers will ask on first call." },
      { sev:"Critical", subspaceId:"fl-sales",    label:"Outreach plan — who makes the first pilot recruitment call",       action:"45 days to pilot kickoff with no leads yet." },
      { sev:"High",     subspaceId:"fl-segments", label:"SME vs enterprise validation — at least 3 customer conversations", action:"No customer interviews in the captures yet." },
    ],
    ask:"Want me to draft a 3-question validation script for SME fleet operator conversations?",
  },
  nudge:{ scatter:"3 critical subspaces below 20%. Pilot kickoff in 45 days. You're reading about the market but not talking to it.", direction:"Book 3 fleet manager calls this week. Every subspace below 20% needs a human conversation, not a web search.", consequence:"You can't sign pilots without a pricing number and an integration scope." },
};

/* ─────────────────────────── HIRE ─────────────────────────────── */
SPACE_DATA["hire"] = {
  challenge:{
    id:"hire", title:"Hire VP Engineering",
    goal:"Hire a VP Engineering who can run a 12-person eng org and ship Zantrik 2.0 by Q1 2027.",
    deadline:{ label:"Offer target", inDays:14 },
    readiness:71, created:"Mar 28, 2026", updated:"3h ago",
    capturesToday:2, capturesWeek:18, subspaceCount:3, criticalGaps:0,
  },
  subspaces:[
    { id:"hi-pipeline", title:"Candidate pipeline",       desc:"Active candidates, sourcing channels, referrals — who's in conversation.", markers:["VP Engineering","CTO candidate","engineering leader","tech exec"], captures:9, weekDelta:3, completeness:82, lastHit:"3h ago",   spark:[1,2,2,3,3,4,4], aiGen:true },
    { id:"hi-comp",     title:"Compensation benchmarks",  desc:"VP Engineering comp in Bangladesh, remote-first, and SEA early-stage context.", markers:["VP Engineering salary","CTO compensation","equity grant","eng exec comp"], captures:5, weekDelta:1, completeness:70, lastHit:"Yesterday", spark:[1,1,1,2,2,1,2], aiGen:true },
    { id:"hi-process",  title:"Interview design",         desc:"Assessment structure, technical depth vs. leadership balance, what to look for in a Zantrik context.", markers:["VP Engineering interview","leadership assessment","technical interview"], captures:4, weekDelta:1, completeness:60, lastHit:"2d ago",   spark:[0,1,1,2,1,1,1], aiGen:true },
  ],
  captures:[
    { id:"hi-1", time:"09:00", date:"Today",     surface:"linkedin.com",      type:"Post",    title:"Profile reviewed — Arif Hasan, ex-Pathao VP Engineering",     marker:"VP Engineering",          subspaceId:"hi-pipeline" },
    { id:"hi-2", time:"11:30", date:"Today",     surface:"claude.ai",         type:"AI chat", title:"VP Engineering interview scorecard design",                   marker:"VP Engineering interview", subspaceId:"hi-process" },
    { id:"hi-3", time:"14:00", date:"Yesterday", surface:"levels.fyi",        type:"Article", title:"Engineering leadership comp in SEA — 2026 survey",           marker:"VP Engineering salary",   subspaceId:"hi-comp" },
    { id:"hi-4", time:"10:00", date:"Yesterday", surface:"linkedin.com",      type:"Post",    title:"Profile reviewed — Tanvir Ahmed, ex-bKash Head of Eng",       marker:"engineering leader",      subspaceId:"hi-pipeline" },
    { id:"hi-5", time:"16:00", date:"2d ago",    surface:"gemini.google.com", type:"AI chat", title:"Referral outreach to Pathao network — who to approach",       marker:"CTO candidate",           subspaceId:"hi-pipeline" },
    { id:"hi-6", time:"11:00", date:"2d ago",    surface:"firstround.com",    type:"Article", title:"How to hire your first VP Engineering at a seed-stage co.",   marker:"eng leader",              subspaceId:"hi-process" },
    { id:"hi-7", time:"09:30", date:"3d ago",    surface:"levels.fyi",        type:"PDF",     title:"Bangladesh tech exec comp survey — base + equity",           marker:"equity grant",            subspaceId:"hi-comp" },
    { id:"hi-8", time:"14:30", date:"3d ago",    surface:"claude.ai",         type:"AI chat", title:"What does good look like in a VP Eng for a 12-person team?", marker:"leadership assessment",   subspaceId:"hi-process" },
  ],
  chats:[
    { id:"hi-c1", subject:"Are Arif and Tanvir the right profile?",         lastAt:"3h ago",   unread:false, snippet:"Arif has scale experience. Tanvir has product sensibility. You likely need both — meaning neither alone is right.", subspaceId:"hi-pipeline" },
    { id:"hi-c2", subject:"What equity range is realistic for this hire?",  lastAt:"Yesterday",unread:false, snippet:"0.75–1.5% for VP Eng at Series A stage is the market. At 64% readiness on the raise, you can offer the low end now.", subspaceId:"hi-comp" },
    { id:"hi-c3", subject:"Design the VP Engineering interview process",    lastAt:"2d ago",   unread:false, snippet:"3 rounds: (1) leadership case, (2) technical depth, (3) culture and vision. Score on 4 dimensions.", subspaceId:"hi-process" },
    { id:"hi-c4", subject:"Referral network outreach — who to ask first",   lastAt:"5d ago",   unread:false, snippet:"Pathao, bKash, and ShopUp have the deepest eng leadership benches in Dhaka.", subspaceId:"hi-pipeline" },
  ],
  notifications:[
    { id:"hi-n1", severity:"info",    title:"Pipeline at 82% — strongest subspace",              body:"9 captures this week. Arif Hasan and Tanvir Ahmed are the two leads.", at:"3h ago",       subspaceId:"hi-pipeline", actionLabel:"Open subspace" },
    { id:"hi-n2", severity:"warning", title:"Offer deadline in 14 days — comp not finalised",   body:"Comp benchmarks at 70%. Equity range is unclear until Series A closes.", at:"Yesterday",   subspaceId:"hi-comp",     actionLabel:"Open subspace" },
    { id:"hi-n3", severity:"info",    title:"Marker hit · VP Engineering",                       body:"linkedin.com — Arif Hasan, ex-Pathao VP Engineering.",                 at:"Today · 09:00",subspaceId:"hi-pipeline", actionLabel:"View capture" },
    { id:"hi-n4", severity:"info",    title:"Interview scorecard captured",                      body:"claude.ai — VP Engineering interview scorecard design.",                at:"Today · 11:30",subspaceId:"hi-process",  actionLabel:"View capture" },
  ],
  comparison:{
    tension:{ title:"Conflicting signal · candidate profiles",
      rows:[
        { from:"LinkedIn research", stance:"Arif Hasan has scale experience from Pathao's 2M-user engineering org." },
        { from:"Network intel",     stance:"Tanvir Ahmed is a stronger product-engineering translator for a product-led company." },
        { from:"Job design data",   stance:"Zantrik 2.0 needs both: someone who can scale infra and talk to PMs." },
      ],
      edge:"The two candidates solve different halves of the problem. The question is whether Zantrik can afford the 'complete' profile, or should hire for the next 18 months only.",
    },
    sources:[
      { key:"claude", label:"Pipeline research", count:9, summary:"Two strong leads. Arif brings scale and infra depth. Tanvir brings product fluency and team culture.",
        findings:[{ text:"Arif: 5 years at Pathao, grew team from 8 to 60 engineers", conf:95 },{ text:"Tanvir: shipped 3 products at bKash as Head of Engineering", conf:91 },{ text:"Both open to 0.75–1.25% equity at current market rates", conf:82 },{ text:"2 other referrals from Pathao network to be screened", conf:76 }],
        signal:"Two first-round-ready candidates. The pipeline is ahead of schedule." },
      { key:"gemini", label:"Compensation data", count:5, summary:"VP Eng in SEA early-stage: $80–140K base + 0.75–1.5% equity. Zantrik is in-range at Series A readiness.",
        findings:[{ text:"Market base: $80–140K depending on experience", conf:88 },{ text:"Equity: 0.75–1.5% is standard for VP Eng at Series A", conf:84 },{ text:"Remote premium adds 15–20% to base expectations", conf:78 },{ text:"Cliff: 1 year, vest: 4 years — standard in SEA", conf:92 }],
        signal:"Your offer range is competitive. Don't wait for the Series A to close — the market is moving." },
      { key:"web", label:"Interview design", count:4, summary:"VP Eng hiring at product-led companies requires a leadership case study, not just a technical screen.",
        findings:[{ text:"Best VP Eng hires have strong 1:1 coaching instinct — test for it", conf:89 },{ text:"Leadership case study outperforms coding interview for VP roles", conf:86 },{ text:"Culture interview should be with a senior IC, not just founders", conf:81 },{ text:"Reference calls: ask about stress response, not achievements", conf:77 }],
        signal:"The interviews designed so far are founder-centric. Add the senior IC round — it's the most predictive interview in the process." },
    ],
    synthesis:{
      consensus:"Pipeline is ahead of schedule and comp is in-range. The offer can go out in 14 days if the interview process is completed on time.",
      conflict:"Arif vs Tanvir is a real dilemma. Arif is the scale hire; Tanvir is the culture hire. Zantrik is at a stage where both matter.",
      blindspot:"No reference calls completed yet. Former managers and direct reports aren't in the captures at all — the highest-signal sources.",
    },
  },
  decision:{
    question:"Should we make an offer to Arif, run Tanvir in parallel, or wait?",
    optionA:{ label:"Make offer to Arif Hasan",           readiness:71, note:"Scale & infra depth" },
    optionB:{ label:"Run Arif and Tanvir in parallel",    readiness:0,  note:"Slows timeline by 2 weeks" },
    for:["Pipeline at 82% — strongest research coverage of any space.","Comp is in-range at current Series A readiness.","Offer deadline in 14 days — timeline is tight.","Arif's Pathao scale experience maps to Zantrik 2.0 infra needs."],
    against:["No reference calls completed — highest-signal data point missing.","Comp finalisation depends on equity, which depends on Series A close.","Interview process not completed for either candidate.","Tanvir may be a stronger culture fit — not yet assessed."],
    gaps:[
      { sev:"High",   subspaceId:"hi-pipeline", label:"Reference calls for Arif and Tanvir — former managers and direct reports", action:"Highest predictive signal not yet collected." },
      { sev:"High",   subspaceId:"hi-process",  label:"Leadership case study interview — designed but not yet scheduled",          action:"Process designed but not executed." },
      { sev:"Medium", subspaceId:"hi-comp",     label:"Equity package finalised — depends on Series A progress",                   action:"Coordinate with Series A timeline." },
    ],
    ask:"Want me to write the reference check questions for Arif and Tanvir based on the interview design captures?",
  },
  nudge:{ scatter:"71% readiness but no reference calls. You know who the candidates are. You haven't talked to anyone who worked with them.", direction:"Book 2 reference calls this week — one former manager each. That's the missing 29%.", consequence:"Offer deadline is in 14 days. References take a week to schedule." },
};

/* ──────────────────────── HELPERS ──────────────────────────── */
window.getSpaceColor = function(id) {
  return window.SPACE_COLORS[id] || "var(--fg-muted)";
};

window.getSpaceData = function(id) {
  return window.SPACE_DATA[id] || null;
};

window.getAllSubspaces = function() {
  return Object.entries(window.SPACE_DATA).flatMap(([spaceId, d]) =>
    (d.subspaces || []).map(s => ({ ...s, spaceId }))
  );
};

window.getAllCaptures = function() {
  return Object.entries(window.SPACE_DATA).flatMap(([spaceId, d]) =>
    (d.captures || []).map(c => ({ ...c, spaceId }))
  );
};

window.getAllChats = function() {
  const spaceTitle = id => (window.SPACES.find(s => s.id === id) || {}).title || id;
  return Object.entries(window.SPACE_DATA).flatMap(([spaceId, d]) =>
    (d.chats || []).map(c => ({ ...c, spaceId, spaceTitle: spaceTitle(spaceId) }))
  );
};

window.getAllNotifications = function() {
  return Object.entries(window.SPACE_DATA).flatMap(([spaceId, d]) =>
    (d.notifications || []).map(n => ({ ...n, spaceId }))
  );
};

window.surfaceIcon = function(surface) {
  if (!surface) return "globe";
  if (surface.includes("claude") || surface.includes("chatgpt") || surface.includes("gemini")) return "messages-square";
  if (surface.includes("youtube")) return "play";
  if (surface.includes("x.com") || surface.includes("linkedin")) return "at-sign";
  if (surface.includes(".pdf") || surface.endsWith(".gov.bd") || surface.includes("bessemer") || surface.includes("firstround") || surface.includes("levels.fyi")) return "file-text";
  return "globe";
};
