"use client"

import Image from "next/image"
import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import "./landing.css"

/**
 * Signed-out home page. Ported from the standalone landing-page/ build; the
 * hamburger and scroll-reveals that were DOM scripts are React here.
 *
 * Styles live in ./landing.css, scoped under .landing — see the note there.
 */
export function Landing() {
  const [menuOpen, setMenuOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  // Reveal sections once as they scroll in. Reduced-motion (or no IO support)
  // shows everything immediately rather than leaving it invisible.
  useEffect(() => {
    const targets = rootRef.current?.querySelectorAll<HTMLElement>(".reveal")
    if (!targets?.length) return

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (reduce || !("IntersectionObserver" in window)) {
      targets.forEach((el) => el.classList.add("in"))
      return
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("in")
            io.unobserve(entry.target)
          }
        }
      },
      { threshold: 0.15 },
    )
    targets.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])

  // Close the mobile menu on outside click or Escape.
  useEffect(() => {
    if (!menuOpen) return
    const onClick = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest("nav.top")) setMenuOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false)
    }
    document.addEventListener("click", onClick)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("click", onClick)
      document.removeEventListener("keydown", onKey)
    }
  }, [menuOpen])

  return (
    <div className="landing" ref={rootRef}>
      <nav className="top">
        <div className="wrap nav-inner">
          <Link href="/" className="wordmark">
            <Image src="/landing/misir-logo.png" alt="" width={22} height={22} />
            Misir
          </Link>
          <div className="nav-links">
            <a href="#how" className="quiet">How it works</a>
            <a href="#privacy" className="quiet">Privacy</a>
            <Link href="/sign-in" className="quiet">Sign in</Link>
            <Link href="/sign-up" className="btn btn-primary sm">Join the beta</Link>
            <button
              className="nav-burger"
              type="button"
              aria-label="Menu"
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
              onClick={() => setMenuOpen((open) => !open)}
            >
              <span></span><span></span>
            </button>
          </div>
        </div>
        <div className="mobile-menu" id="mobile-menu" hidden={!menuOpen}>
          <div className="wrap" onClick={() => setMenuOpen(false)}>
            <a href="#how">How it works</a>
            <a href="#privacy">Privacy</a>
            <Link href="/sign-in">Sign in</Link>
          </div>
        </div>
      </nav>

      <header className="hero">
        <div className="wrap hero-grid">
          <div className="hero-copy">
            <div className="eyebrow accent rise d1">For founders &amp; operators making high-stakes calls</div>
            <h1 className="rise d2">Turn scattered reading into decisions you can <em>defend.</em></h1>
            <p className="hero-sub rise d3">
              You&apos;re deciding something that matters: a raise, a pricing change, a key hire.
              Your best thinking is buried in AI chats and tabs you&apos;ll never open again.
            </p>
            <p className="hero-lead rise d3"><strong className="hl">Misir:</strong></p>
            <ul className="hero-points rise d3">
              <li><span className="chk">✓</span>Captures as you read and chat with AI</li>
              <li><span className="chk">✓</span>Shows where your sources disagree</li>
              <li><span className="chk">✓</span>Tells you when you have enough to decide</li>
            </ul>
            <div className="hero-ctas rise d4">
              <Link href="/sign-up" className="btn btn-primary">Claim your free beta access</Link>
              <a href="#how" className="btn btn-ghost">See how it works</a>
            </div>
            <p className="hero-note rise d4">Chrome extension · Free while in beta · No card needed</p>
          </div>

          <div className="art-wrap rise d3">
            <figure className="art">
              <Image
                src="/landing/hero-image.png"
                width={1400}
                height={764}
                priority
                alt="Illustration of AI assistants, websites and notes unpacked from a cardboard box."
              />
            </figure>
            <figcaption className="art-caption">
              Everything you read &amp; ask, unpacked into the decisions you&apos;re making.
            </figcaption>
          </div>
        </div>
      </header>

      <section>
        <div className="wrap section-pad">
          <div className="problem reveal">
            <div className="eyebrow">The problem</div>
            <h2 className="h2">Twenty tabs. Four AI chats. <br />A decision that keeps slipping.</h2>
            <p>
              Everything you learn lives somewhere else: a ChatGPT thread here, a memo there,
              a founder&apos;s blog post you&apos;ll never find again. When it&apos;s time to decide, you can&apos;t
              see what you actually know, where your sources disagree, or what&apos;s still missing.
              <br /><em>Misir keeps that ledger for you.</em>
            </p>
          </div>
        </div>
      </section>

      <section id="how" className="how">
        <div className="wrap section-pad">
          <div className="how-head reveal">
            <div className="eyebrow accent">How it works</div>
            <h2 className="h2">From open tabs <br />to a made decision.</h2>
            <p>Three quiet moves. You keep reading the way you already read.</p>
          </div>

          <div className="how-steps">
            <div className="hstep reveal" style={{ "--step": "var(--s1)" } as React.CSSProperties}>
              <div className="hstep-copy">
                <div className="hstep-num">01</div>
                <h3>Capture without thinking about it.</h3>
                <p>
                  The extension reads the page <b>on your device</b>, matches it to the right
                  space, and offers one-click save, mid-article or mid-AI-chat.
                  No folders, no tagging, no copy-paste.
                </p>
              </div>
              <div className="hstep-art">
                <div className="mini">
                  <div className="browser-head">
                    <span className="traffic"><i></i><i></i><i></i></span>
                    <span className="urlbar">claude.ai/chat/raise-questions</span>
                  </div>
                  <div className="mini-head"><span className="pulse"></span>Live match</div>
                  <div className="mini-row"><span className="who">Matched</span><span className="what">&quot;SAFE vs. priced round tradeoffs&quot; → <b style={{ color: "#37352F" }}>Raise Series A · Terms</b></span></div>
                  <div className="mini-row"><span className="save-pill">✓ Save capture</span><span className="what">The chat keeps going; Misir watches for the continuation.</span></div>
                </div>
              </div>
            </div>

            <div className="hstep flip reveal" style={{ "--step": "var(--s2)" } as React.CSSProperties}>
              <div className="hstep-copy">
                <div className="hstep-num">02</div>
                <h3>Watch scattered reading become a picture.</h3>
                <p>
                  Misir compares sources against each other: where they <b>agree</b>, where they
                  <b>conflict</b>, and what <b>none of them covered</b>. It surfaces tensions and
                  cross-space connections you&apos;d never spot in a bookmarks folder.
                </p>
              </div>
              <div className="hstep-art">
                <div className="mini">
                  <div className="mini-head">Where your sources differ</div>
                  <div className="mini-row"><span className="who" style={{ color: "#10A37F" }}>ChatGPT</span><span className="what">Optimize for speed: take the SAFE, close in three weeks.</span></div>
                  <div className="mini-row"><span className="who" style={{ color: "#2A6A9A" }}>Web</span><span className="what">Priced rounds protect you when the next raise is uncertain.</span></div>
                  <div className="mini-row"><span className="who" style={{ color: "var(--accent)" }}>Your edge</span><span className="what">You&apos;ve seen both failure modes. Your sources haven&apos;t.</span></div>
                </div>
              </div>
            </div>

            <div className="hstep reveal" style={{ "--step": "var(--s3)" } as React.CSSProperties}>
              <div className="hstep-copy">
                <div className="hstep-num">03</div>
                <h3>Decide on evidence, not vibes.</h3>
                <p>
                  A readiness score tells you how much of the picture you have. Knowledge gaps
                  tell you exactly what to close before the deadline. When the ring fills,
                  <b>you&apos;re not guessing anymore.</b>
                </p>
              </div>
              <div className="hstep-art">
                <div className="mini">
                  <div className="mini-head">Fill these gaps before deciding</div>
                  <div className="gaps-grid">
                    <div>
                      <div className="mini-row"><span className="who" style={{ color: "var(--danger)" }}>● Critical</span><span className="what">No data on bridge terms in a down market.</span></div>
                      <div className="mini-row"><span className="who" style={{ color: "var(--warning)" }}>● High</span><span className="what">Only one reference call on the lead investor.</span></div>
                      <div className="mini-row"><span className="who">Coverage</span><span className="bar"><i style={{ width: "72%" }}></i></span><span className="what" style={{ flex: "none", fontFamily: "var(--font-mono)", fontSize: "10px" }}>72%</span></div>
                    </div>
                    <div className="ring-cell">
                      <div className="ring"><b>72%</b><small>ready</small></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="privacy" className="privacy">
        <div className="wrap section-pad">
          <div className="privacy-grid">
            <div className="reveal">
              <div className="eyebrow accent">Private by architecture</div>
              <h2 className="h2">Your reading is understood <br />on your machine, not our servers.</h2>
              <p className="lede">
                The semantic matching that decides &quot;this page belongs to that decision&quot; runs
                entirely in your browser, on-device. Pages you don&apos;t save are never sent
                anywhere. Capture is opt-in per purpose, Global Privacy Control is honored
                automatically, and everything you&apos;ve stored can be erased in one click.
              </p>
            </div>
            <div className="pflow reveal">
              <div className="pflow-row"><span className="k">Matching</span><span className="pin"></span><span className="v"><b>On-device embeddings.</b> The model runs in your browser.</span></div>
              <div className="pflow-row"><span className="k">Capture</span><span className="pin"></span><span className="v"><b>Consent-gated.</b> Off until you turn it on, per purpose.</span></div>
              <div className="pflow-row"><span className="k">Signals</span><span className="pin"></span><span className="v"><b>GPC honored.</b> Opt-out signals are enforced, not ignored.</span></div>
              <div className="pflow-row"><span className="k">Your data</span><span className="pin"></span><span className="v"><b>Yours.</b> Export or erase everything, any time.</span></div>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="wrap section-pad">
          <div className="problem reveal" style={{ marginBottom: 0 }}>
            <div className="eyebrow accent">Always on watch</div>
            <h2 className="h2">What Misir notices for you</h2>
          </div>
          <div className="features">
            <div className="feature w2 reveal">
              <div className="fviz">
                <div className="viz-vs">
                  <div className="side">
                    <div className="lbl" style={{ color: "#10A37F" }}>ChatGPT</div>
                    <div className="trk"><i style={{ width: "72%", background: "#10A37F" }}></i></div>
                  </div>
                  <span className="vs">VS</span>
                  <div className="side r">
                    <div className="lbl" style={{ color: "#2A6A9A" }}>Your reading</div>
                    <div className="trk"><i style={{ width: "54%", background: "#2A6A9A" }}></i></div>
                  </div>
                </div>
              </div>
              <h4>Where sources differ</h4>
              <p>Every space tracks its central disagreement, and which side your evidence actually supports.</p>
            </div>

            <div className="feature reveal">
              <div className="fviz viz-link">
                <svg width="150" height="70" viewBox="0 0 150 70" aria-hidden="true">
                  <path d="M22 52 C 50 8, 100 8, 128 48" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeDasharray="4 4" />
                  <circle cx="22" cy="52" r="8" fill="#7FB069" stroke="#F7F6F3" strokeWidth="3" />
                  <circle cx="75" cy="56" r="6" fill="#EFEEEA" />
                  <circle cx="128" cy="48" r="8" fill="#7E8FDB" stroke="#F7F6F3" strokeWidth="3" />
                </svg>
              </div>
              <h4>Connections across spaces</h4>
              <p>A capture in one decision often answers a question in another. Misir links them.</p>
            </div>

            <div className="feature reveal">
              <div className="fviz">
                <div className="viz-nudge">
                  <span className="chip">DUE FRIDAY</span>
                  <div className="l1"></div>
                  <div className="l2"></div>
                </div>
              </div>
              <h4>Nudges with consequences</h4>
              <p>Not &quot;3 unread items,&quot; but &quot;your evidence is one-sided and your deadline is Friday.&quot;</p>
            </div>

            <div className="feature reveal">
              <div className="fviz">
                <div className="viz-rhythm">
                  <i style={{ height: "38%" }}></i><i style={{ height: "62%" }}></i><i style={{ height: "45%" }}></i><i style={{ height: "80%" }}></i><i className="cold" style={{ height: "10%" }}></i><i className="cold" style={{ height: "10%" }}></i><i className="cold" style={{ height: "10%" }}></i><i style={{ height: "30%" }}></i><i style={{ height: "58%" }}></i><i style={{ height: "92%" }}></i><i style={{ height: "70%" }}></i>
                </div>
              </div>
              <h4>Capture rhythm</h4>
              <p>See when you&apos;re doing the work, and when a decision has quietly gone cold.</p>
            </div>

            <div className="feature reveal">
              <div className="fviz">
                <div className="viz-gaps">
                  <div className="g"><span className="d" style={{ background: "var(--danger)" }}></span><span className="t" style={{ width: "74%" }}></span></div>
                  <div className="g"><span className="d" style={{ background: "var(--warning)" }}></span><span className="t" style={{ width: "56%" }}></span></div>
                  <div className="g"><span className="d" style={{ background: "var(--success)" }}></span><span className="t" style={{ width: "40%", opacity: 0.45 }}></span><span className="ok">✓</span></div>
                </div>
              </div>
              <h4>Knowledge gaps</h4>
              <p>Severity-ranked holes in your evidence, each with a concrete way to close it.</p>
            </div>

            <div className="feature w2 reveal">
              <div className="fviz">
                <div className="viz-chat">
                  <span className="u">What&apos;s my biggest open risk?</span>
                  <span className="m">Bridge terms in a down market. None of your sources cover it.<span className="cite">1</span><span className="cite">2</span></span>
                </div>
              </div>
              <h4>Ask Misir</h4>
              <p>Chat with everything you&apos;ve captured. Answers cite your own sources, not the open internet.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="final">
        <div className="wrap section-pad reveal">
          <div className="eyebrow accent">Misir</div>
          <h2 className="h2">Your next <em>decision</em> deserves the full picture.</h2>
          <div className="hero-ctas" style={{ justifyContent: "center" }}>
            <Link href="/sign-up" className="btn btn-primary">Claim your free beta access</Link>
          </div>
          <figure className="final-media">
            <video
              src="/landing/end_hero.webm"
              autoPlay
              loop
              muted
              playsInline
              aria-label="Misir capturing reading and AI chats into a decision."
            />
          </figure>
          <p className="final-note">Beta spots are free · No card · Your data stays yours</p>
        </div>
      </section>

      <footer>
        <div className="wrap foot">
          <span className="wordmark">
            <Image src="/landing/misir-logo.png" alt="" width={22} height={22} />
            Misir
          </span>
          <div className="right">
            <Link href="/privacy">Privacy Policy</Link>
            <Link href="/privacy/do-not-sell">Do Not Sell/Share</Link>
            <span>© 2026 Misir</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
