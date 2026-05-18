import React from "react";
import { Link } from "react-router-dom";
import { SignedIn, SignedOut, SignInButton } from "@clerk/clerk-react";
import { motion } from "framer-motion";

/**
 * v1.0.5 — Public landing page.
 *
 * Every feature is illustrated with a live in-page mockup built from the
 * exact same design tokens the product ships with (glass-surface,
 * app-ink, app-muted, brand-emerald). The mockups ARE the product — same
 * type ramp, same hairlines, same glass recipe — just rendered server-
 * less here without the backend. That looks more authentic, sharper at
 * retina, and ages better than raster screenshots.
 */

/* -------------------------------------------------------------------------- */
/*  Tiny atoms reused inside the mockups                                       */
/* -------------------------------------------------------------------------- */

const StatusDot = ({ tone = "neutral", className = "" }) => {
  const map = {
    neutral: "bg-app-soft",
    positive: "bg-brand-emerald",
    warning: "bg-amber-400",
    info: "bg-sky-400",
  };
  return <span className={`inline-block w-1.5 h-1.5 rounded-full ${map[tone]} ${className}`} />;
};

const Pill = ({ children, tone = "neutral" }) => {
  const map = {
    neutral: "bg-app-ink/8 text-app-graphite",
    positive: "bg-brand-emerald/15 text-brand-emerald",
    info: "bg-sky-500/15 text-sky-600",
    warning: "bg-amber-500/15 text-amber-700",
    lost: "bg-rose-500/15 text-rose-600",
    ink: "bg-app-ink text-app-canvas",
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide ${map[tone]}`}>
      {children}
    </span>
  );
};

/* Stone image — served from /public/stones. Six premium macro shots,
   each on the same cool grey backdrop (#F2F2F5) so they sit on the
   glass tiles without a visible seam. The default emerald is used in
   the hero passport. */
const STONE_IMAGES = {
  emerald:        "/stones/stone-emerald.png",
  diamondRound:   "/stones/stone-diamond-round.png",
  sapphirePear:   "/stones/stone-sapphire-pear.png",
  rubyCushion:    "/stones/stone-ruby-cushion.png",
  diamondPair:    "/stones/stone-diamond-pair.png",
  emeraldOval:    "/stones/stone-emerald-oval.png",
};

const StoneImage = ({ kind = "emerald", className = "" }) => (
  <img
    src={STONE_IMAGES[kind] || STONE_IMAGES.emerald}
    alt=""
    loading="lazy"
    className={`object-contain ${className}`}
  />
);

const Spec = ({ label, value }) => (
  <div>
    <div className="text-[9px] font-medium uppercase tracking-[0.14em] text-app-soft">{label}</div>
    <div className="mt-0.5 text-[12px] font-semibold text-app-ink">{value}</div>
  </div>
);

/* -------------------------------------------------------------------------- */
/*  Mockup #1 — DNA Passport (public stone page)                               */
/* -------------------------------------------------------------------------- */

const PassportMockup = () => (
  <div className="glass-surface-strong rounded-[20px] p-4 sm:p-5 w-full max-w-[420px]">
    <div className="flex items-center justify-between mb-3">
      <Pill tone="ink">GIA · 1234567890</Pill>
      <div className="text-[10px] uppercase tracking-[0.14em] text-app-muted">DNA passport</div>
    </div>

    <div className="aspect-[4/3] rounded-2xl bg-white flex items-center justify-center overflow-hidden relative">
      <StoneImage kind="emerald" className="w-[78%] h-[78%]" />
      <div className="absolute bottom-2 left-2 text-[9.5px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-black/55 text-white backdrop-blur">Photo</div>
    </div>

    <div className="mt-4 flex items-baseline justify-between">
      <div>
        <div className="text-[18px] font-semibold tracking-tight text-app-ink leading-none">2.18 ct Emerald</div>
        <div className="text-[11px] text-app-muted mt-1">Colombia · Insignificant oil</div>
      </div>
      <div className="text-[15px] font-semibold tracking-tight text-app-ink">$48,200</div>
    </div>

    <div className="mt-4 grid grid-cols-4 gap-3">
      <Spec label="Shape" value="Emerald" />
      <Spec label="Color" value="Vivid G" />
      <Spec label="Clarity" value="VS" />
      <Spec label="Lab" value="GIA" />
    </div>

    <div className="mt-4 flex items-center gap-2">
      <div className="flex-1 h-8 rounded-full bg-app-ink text-app-canvas text-[11px] font-semibold flex items-center justify-center">View DNA</div>
      <div className="h-8 px-3 rounded-full glass-surface text-[11px] font-medium text-app-graphite flex items-center">Share</div>
    </div>
  </div>
);

/* -------------------------------------------------------------------------- */
/*  Mockup #2 — Memo with two-way signatures                                   */
/* -------------------------------------------------------------------------- */

const SignatureRow = ({ name, role, date }) => (
  <div className="glass-surface rounded-xl p-3 flex items-start justify-between gap-3">
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-[0.14em] text-app-soft">{role}</div>
      <div className="mt-0.5 text-[12.5px] font-semibold text-app-ink truncate">{name}</div>
      <div className="mt-2 text-[11px] italic text-app-graphite" style={{ fontFamily: '"Brush Script MT","Segoe Script",cursive' }}>{name}</div>
    </div>
    <div className="text-right shrink-0">
      <Pill tone="positive">Signed</Pill>
      <div className="mt-1 text-[10px] text-app-soft">{date}</div>
    </div>
  </div>
);

const MemoMockup = () => (
  <div className="glass-surface-strong rounded-[20px] p-4 sm:p-5 w-full max-w-[460px]">
    <div className="flex items-center justify-between mb-3">
      <div>
        <div className="text-[10px] uppercase tracking-[0.14em] text-app-muted">Memo</div>
        <div className="text-[14px] font-semibold text-app-ink mt-0.5">2026-0142 · Maison Solène · NY</div>
      </div>
      <Pill tone="positive">Issued</Pill>
    </div>

    <div className="grid grid-cols-2 gap-2.5">
      <SignatureRow name="Eli Cohen" role="Supplier" date="May 18, 12:04" />
      <SignatureRow name="A. Laurent" role="Store" date="May 18, 14:31" />
    </div>

    <div className="mt-3 glass-surface rounded-xl p-3 flex items-center justify-between">
      <div className="flex items-center gap-2 text-[11px] text-app-graphite">
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <rect x="4" y="3" width="16" height="18" rx="2" />
          <path d="M8 8h8M8 12h8M8 16h5" />
        </svg>
        Signed PDF · 4 items · SHA-256 audit trail
      </div>
      <div className="text-[10.5px] text-app-soft">v3</div>
    </div>
  </div>
);

/* -------------------------------------------------------------------------- */
/*  Mockup #3 — Production board (jewelry kanban)                              */
/* -------------------------------------------------------------------------- */

const KanbanCard = ({ title, sku, owner, status }) => (
  <div className="glass-surface rounded-xl p-2.5">
    <div className="flex items-start justify-between gap-2">
      <div className="text-[11.5px] font-semibold text-app-ink truncate">{title}</div>
      <div className="w-5 h-5 rounded-full bg-app-ink text-app-canvas text-[9px] font-semibold flex items-center justify-center shrink-0">{owner}</div>
    </div>
    <div className="text-[10px] text-app-muted mt-0.5">{sku}</div>
    {status ? <div className="mt-2"><Pill tone={status.tone}>{status.label}</Pill></div> : null}
  </div>
);

const ProductionMockup = () => (
  <div className="glass-surface-strong rounded-[20px] p-3 sm:p-4 w-full max-w-[560px]">
    <div className="flex items-center justify-between mb-3 px-1">
      <div className="text-[14px] font-semibold tracking-tight text-app-ink">Production board</div>
      <div className="flex items-center gap-1.5 text-[10px] text-app-muted">
        <StatusDot tone="positive" /> Live
      </div>
    </div>
    <div className="grid grid-cols-3 gap-2">
      {[
        { stage: "Design",        items: [
          { title: "Pear pendant", sku: "JW-0314", owner: "Y" },
          { title: "Bezel ring",   sku: "JW-0321", owner: "R" },
        ]},
        { stage: "In production", items: [
          { title: "Tennis bracelet", sku: "JW-0298", owner: "M", status: { label: "Setting", tone: "info" } },
          { title: "Halo ring",       sku: "JW-0301", owner: "Y", status: { label: "Casting", tone: "warning" } },
          { title: "Stud earrings",   sku: "JW-0307", owner: "R" },
        ]},
        { stage: "QC",            items: [
          { title: "Solitaire",  sku: "JW-0289", owner: "A", status: { label: "Ready", tone: "positive" } },
        ]},
      ].map((col) => (
        <div key={col.stage} className="rounded-xl bg-app-canvas/40 p-2">
          <div className="px-1 pb-2 flex items-center justify-between">
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-app-graphite">{col.stage}</div>
            <div className="text-[10px] text-app-soft">{col.items.length}</div>
          </div>
          <div className="space-y-1.5">
            {col.items.map((it) => <KanbanCard key={it.sku} {...it} />)}
          </div>
        </div>
      ))}
    </div>
  </div>
);

/* -------------------------------------------------------------------------- */
/*  Mockup #4 — CRM pipeline                                                   */
/* -------------------------------------------------------------------------- */

const CrmMockup = () => {
  const stages = [
    { label: "Lead",        count: 8,  total: "$214k", tone: "neutral", deals: [{ t: "Maison Solène",      v: "$48k" }, { t: "Roselund Atelier",   v: "$26k" }] },
    { label: "Qualified",   count: 5,  total: "$182k", tone: "info",    deals: [{ t: "Atelier Marbach",    v: "$72k" }, { t: "Beaufort Frères",    v: "$45k" }] },
    { label: "Proposal",    count: 4,  total: "$310k", tone: "warning", deals: [{ t: "House of Vaulx",     v: "$120k" }, { t: "Verrière Tokyo",    v: "$98k" }] },
    { label: "Won",         count: 2,  total: "$540k", tone: "positive",deals: [{ t: "Lindemann London",   v: "$320k" }] },
  ];
  return (
    <div className="glass-surface-strong rounded-[20px] p-3 sm:p-4 w-full max-w-[640px]">
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="text-[14px] font-semibold tracking-tight text-app-ink">Deals pipeline</div>
        <div className="text-[10px] text-app-muted">Q2 · Owner: All team</div>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {stages.map((s) => (
          <div key={s.label} className="rounded-xl bg-app-canvas/40 p-2">
            <div className="px-1 pb-2">
              <Pill tone={s.tone}>{s.label}</Pill>
              <div className="mt-1 text-[10px] text-app-soft">{s.count} · {s.total}</div>
            </div>
            <div className="space-y-1.5">
              {s.deals.map((d) => (
                <div key={d.t} className="glass-surface rounded-lg p-2">
                  <div className="text-[11px] font-semibold text-app-ink truncate">{d.t}</div>
                  <div className="text-[10px] font-semibold text-app-graphite mt-0.5">{d.v}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*  Mockup #5 — Trade portal (store catalog grid)                              */
/* -------------------------------------------------------------------------- */

const CatalogTile = ({ name, ct, color, price, stone }) => (
  <div className="glass-surface rounded-xl overflow-hidden">
    <div className="aspect-square bg-white flex items-center justify-center overflow-hidden">
      <StoneImage kind={stone} className="w-[82%] h-[82%]" />
    </div>
    <div className="p-2.5">
      <div className="text-[11px] font-semibold text-app-ink truncate">{name}</div>
      <div className="text-[10px] text-app-muted">{ct} · {color}</div>
      <div className="mt-1 text-[11.5px] font-semibold text-app-ink">{price}</div>
    </div>
  </div>
);

const PortalMockup = () => (
  <div className="glass-surface-strong rounded-[20px] p-3 sm:p-4 w-full max-w-[560px]">
    <div className="flex items-center justify-between mb-3 px-1">
      <div>
        <div className="text-[10px] uppercase tracking-[0.14em] text-app-muted">Maison Solène · Private portal</div>
        <div className="text-[14px] font-semibold tracking-tight text-app-ink mt-0.5">Catalogue</div>
      </div>
      <Pill tone="positive">Live · Encrypted</Pill>
    </div>
    <div className="grid grid-cols-3 gap-2">
      <CatalogTile stone="diamondRound" name="Round D-IF"      ct="3.02 ct" color="D · IF"  price="$184,000" />
      <CatalogTile stone="emerald"      name="Emerald cut"     ct="2.18 ct" color="Vivid G" price="$48,200"  />
      <CatalogTile stone="sapphirePear" name="Pear sapphire"   ct="4.40 ct" color="Royal B" price="$96,000"  />
      <CatalogTile stone="diamondPair"  name="Pair earrings"   ct="1.01+1.02" color="E · VS1" price="$28,400" />
      <CatalogTile stone="rubyCushion"  name="Cushion ruby"    ct="2.62 ct" color="Pigeon"   price="$210,000" />
      <CatalogTile stone="emeraldOval"  name="Oval emerald"    ct="3.51 ct" color="Vivid"    price="$72,500"  />
    </div>
  </div>
);

/* -------------------------------------------------------------------------- */
/*  Mockup #6 — Documents hub                                                  */
/* -------------------------------------------------------------------------- */

const DocumentsMockup = () => {
  const rows = [
    { id: "2026-0142", store: "Maison Solène",      issued: "May 18", items: 4, status: "Closed",  tone: "neutral" },
    { id: "2026-0141", store: "Atelier Marbach",    issued: "May 17", items: 7, status: "Issued",  tone: "info" },
    { id: "2026-0140", store: "House of Vaulx",     issued: "May 14", items: 2, status: "Awaiting",tone: "warning" },
    { id: "2026-0139", store: "Lindemann London",   issued: "May 12", items: 9, status: "Signed",  tone: "positive" },
  ];
  return (
    <div className="glass-surface-strong rounded-[20px] p-4 sm:p-5 w-full max-w-[520px]">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.14em] text-app-muted">Archive</div>
          <div className="text-[14px] font-semibold tracking-tight text-app-ink mt-0.5">Signed documents</div>
        </div>
        <div className="text-[10px] text-app-soft">142 total</div>
      </div>
      <div className="divide-y divide-app-line">
        {rows.map((r) => (
          <div key={r.id} className="py-2.5 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[12px] font-semibold text-app-ink truncate">{r.id}</div>
              <div className="text-[10.5px] text-app-muted truncate">{r.store} · {r.items} items · {r.issued}</div>
            </div>
            <Pill tone={r.tone}>{r.status}</Pill>
          </div>
        ))}
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*  Hero composition — DNA passport floating with smaller cards behind          */
/* -------------------------------------------------------------------------- */

const HeroComposition = () => (
  <div className="relative w-full h-[460px] sm:h-[520px]">
    {/* Subtle ambient glows behind the glass */}
    <div className="absolute inset-0 -z-10">
      <div className="absolute top-10 left-1/4 w-72 h-72 rounded-full bg-brand-emerald/10 blur-[80px]" />
      <div className="absolute bottom-10 right-1/4 w-80 h-80 rounded-full bg-app-ink/8 blur-[100px]" />
    </div>

    {/* Memo (back-left) */}
    <motion.div
      initial={{ opacity: 0, x: -40, rotate: -6 }}
      animate={{ opacity: 1, x: 0, rotate: -6 }}
      transition={{ delay: 0.3, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      className="hidden sm:block absolute left-2 top-10 w-[340px]"
      style={{ transform: "rotate(-6deg)" }}
    >
      <MemoMockup />
    </motion.div>

    {/* Catalog (back-right) */}
    <motion.div
      initial={{ opacity: 0, x: 40, rotate: 6 }}
      animate={{ opacity: 1, x: 0, rotate: 6 }}
      transition={{ delay: 0.4, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      className="hidden md:block absolute right-2 top-6 w-[420px]"
      style={{ transform: "rotate(6deg)" }}
    >
      <PortalMockup />
    </motion.div>

    {/* Passport (front-center) */}
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className="absolute left-1/2 -translate-x-1/2 top-12 sm:top-16 w-[320px] sm:w-[380px]"
    >
      <PassportMockup />
    </motion.div>
  </div>
);

/* -------------------------------------------------------------------------- */
/*  Feature row — alternating mockup + copy                                    */
/* -------------------------------------------------------------------------- */

const FeatureRow = ({ eyebrow, title, copy, bullets, mockup, reverse }) => (
  <motion.div
    initial={{ opacity: 0, y: 24 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: "-100px" }}
    transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
    className={`grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center ${reverse ? "lg:[&>*:first-child]:order-2" : ""}`}
  >
    <div className="min-w-0">
      <div className="text-[10.5px] font-medium uppercase tracking-[0.18em] text-app-muted">{eyebrow}</div>
      <h3 className="mt-3 text-[28px] sm:text-[34px] font-semibold tracking-tight text-app-ink leading-[1.1]">{title}</h3>
      <p className="mt-4 text-[14.5px] sm:text-[15.5px] leading-relaxed text-app-muted max-w-xl">{copy}</p>
      <ul className="mt-5 space-y-2">
        {bullets.map((b) => (
          <li key={b} className="flex items-start gap-2.5 text-[13.5px] text-app-graphite">
            <span className="mt-[7px] w-1.5 h-1.5 rounded-full bg-app-ink shrink-0" />
            <span>{b}</span>
          </li>
        ))}
      </ul>
    </div>
    <div className="flex justify-center lg:justify-end">
      {mockup}
    </div>
  </motion.div>
);

/* -------------------------------------------------------------------------- */
/*  Bento — supporting capabilities                                            */
/* -------------------------------------------------------------------------- */

const BentoItem = ({ icon, title, copy, className = "" }) => (
  <div className={`glass-surface rounded-2xl p-5 ${className}`}>
    <div className="w-9 h-9 rounded-xl bg-app-ink/8 text-app-ink flex items-center justify-center">{icon}</div>
    <h4 className="mt-4 text-[15px] font-semibold tracking-tight text-app-ink">{title}</h4>
    <p className="mt-1.5 text-[12.5px] leading-relaxed text-app-muted">{copy}</p>
  </div>
);

/* -------------------------------------------------------------------------- */
/*  Page                                                                       */
/* -------------------------------------------------------------------------- */

const OnboardingPage = () => {
  return (
    <div className="min-h-screen app-canvas relative overflow-hidden">
      {/* ============================== HERO ============================== */}
      <section className="relative px-4 pt-12 sm:pt-16 pb-6">
        <div className="max-w-6xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass-surface text-[11px] font-medium tracking-[0.14em] uppercase text-app-graphite">
              <StatusDot tone="positive" className="animate-pulse" />
              v1.0.5 · Liquid Glass · live
            </div>

            <h1 className="mt-7 text-[40px] sm:text-[56px] md:text-[72px] font-semibold leading-[1.04] tracking-tight text-app-ink">
              The operating system
              <br className="hidden sm:block" />
              <span className="text-app-graphite"> for fine gemstones.</span>
            </h1>

            <p className="mt-6 text-[15px] sm:text-[17px] leading-relaxed max-w-2xl mx-auto text-app-muted">
              GEMS DNA is a single, private workspace for inventory, catalogues,
              trade memos and signed documents — built for the people who already
              work with the world&apos;s most exacting brands.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center items-center">
              <SignedIn>
                <Link to="/dashboard" className="btn-primary">
                  Open dashboard
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Link>
              </SignedIn>
              <SignedOut>
                <SignInButton mode="modal">
                  <button className="btn-primary">
                    Request access
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </button>
                </SignInButton>
              </SignedOut>
              <a href="#features" className="btn-secondary">
                See what&apos;s inside
              </a>
            </div>
          </motion.div>
        </div>

        {/* Floating live mockup composition */}
        <div className="max-w-6xl mx-auto mt-10 sm:mt-14">
          <HeroComposition />
        </div>
      </section>

      {/* ============================== STAT STRIP ============================== */}
      <section className="px-4 pb-16 sm:pb-24">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="max-w-5xl mx-auto"
        >
          <div className="glass-surface-strong rounded-[24px] p-5 sm:p-8 grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
            {[
              { label: "Stones tracked",      value: "1,247", caption: "across 4 categories" },
              { label: "Catalogue value",     value: "$2.4M", caption: "live, audited" },
              { label: "Trade partners",      value: "38",    caption: "private portals" },
              { label: "Memos this quarter",  value: "204",   caption: "all signed two-way" },
            ].map((s) => (
              <div key={s.label} className="glass-surface rounded-2xl p-4 sm:p-5">
                <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-app-muted">{s.label}</p>
                <p className="mt-2 text-[24px] sm:text-[32px] font-semibold tracking-tight text-app-ink leading-none">{s.value}</p>
                <p className="mt-2 text-[11px] text-app-soft">{s.caption}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ============================== FEATURES ============================== */}
      <section id="features" className="px-4 pb-16 sm:pb-24">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12 sm:mb-20">
            <div className="text-[10.5px] font-medium uppercase tracking-[0.18em] text-app-muted">Features</div>
            <h2 className="mt-3 text-[28px] sm:text-[40px] font-semibold tracking-tight text-app-ink">
              One workspace. End-to-end.
            </h2>
            <p className="mt-4 text-[14px] sm:text-[15px] text-app-muted max-w-xl mx-auto">
              Six tools designed and refined with active partners in the high
              jewelry trade — from rough sourcing to signed memo to retail.
            </p>
          </div>

          <div className="space-y-20 sm:space-y-28">
            <FeatureRow
              eyebrow="DNA Passport · Public"
              title="Every stone gets a passport."
              copy="A private, brand-aligned page for each stone — photo, video, certificate, provenance, measurements, pricing tier and a one-tap WhatsApp / email share. The link is the asset; the asset is always live."
              bullets={[
                "GIA / IGI / GRS / SSEF certificate embedding with PDF view",
                "Photo and 360° video gallery — Niimbot label printing built in",
                "Pricing tiers per partner — never the same price to two houses",
                "Audit trail of who viewed, when, and from where",
              ]}
              mockup={<PassportMockup />}
            />

            <FeatureRow
              eyebrow="Memos · Two-way signatures"
              title="Memos that actually close."
              copy="Issue a memo, drop in stones from inventory, send a private signing link. Both the supplier and the receiving store sign on canvas or by typed name. The PDF is generated, archived, and emailed to both parties — every signature SHA-256-hashed with IP and user-agent."
              bullets={[
                "Hard-gated at issue (supplier) and close (supplier) — no missed signatures",
                "Advanced Electronic Signature compliant audit trail",
                "Automatic email distribution after every signature",
                "Public, no-auth signing page so the partner store needs no account",
              ]}
              mockup={<MemoMockup />}
              reverse
            />

            <FeatureRow
              eyebrow="Trade Portal · Private"
              title="A private portal for every partner."
              copy="Invite a store and they see only what you want them to see — their tier, their requests, their memos, their account. Encrypted end-to-end. Same Liquid Glass language as the dashboard, but locked to that one store."
              bullets={[
                "Per-partner pricing tiers and visibility rules",
                "Stores can request memo on a stone in one tap",
                "Real-time inbox of issued memos with one-tap signing",
                "Branded as your house — never as a third-party SaaS",
              ]}
              mockup={<PortalMockup />}
            />

            <FeatureRow
              eyebrow="Production · Jewelry workflow"
              title="From CAD to QC, on one board."
              copy="A drag-and-drop kanban for the jewelry side of the house — Design, Casting, Setting, Polishing, QC, Ready. Every card carries the stones that fuel it, the metals, the costs, the customer, the files, and the history."
              bullets={[
                "Stones consumed from inventory automatically — no double-booking",
                "Cost & margin computed live from metals + labour + stones",
                "Customer share preview with single-click approval",
                "WhatsApp 'Ready' notifications to the buyer",
              ]}
              mockup={<ProductionMockup />}
              reverse
            />

            <FeatureRow
              eyebrow="CRM · Pipeline & contacts"
              title="The trade desk, organised."
              copy="Contacts, companies, deals, tasks — kanban or list. Built around how high-jewelry sales actually work: long cycles, multiple decision-makers, and revisited proposals. Every memo and signed document threads back to the contact and the company."
              bullets={[
                "Drag-and-drop deal pipeline with team ownership",
                "Tasks tied to contacts, deals, or specific stones",
                "Broadcast emails to a filtered audience with templates",
                "Scan a business card to create a contact in two seconds",
              ]}
              mockup={<CrmMockup />}
            />

            <FeatureRow
              eyebrow="Documents Hub · Audit"
              title="Every signed document, in one place."
              copy="A central archive for every signed memo. Filter by partner, date, status, or stone. Reissue. Reprint. Share again. The hub is mirrored privately inside each partner's portal — they always have the documents that pertain to them."
              bullets={[
                "Filter and search across thousands of memos",
                "One-tap PDF re-export with the original signatures embedded",
                "Mirrored automatically into each partner's private portal",
                "Tamper-evident: any change forces a fresh signature round",
              ]}
              mockup={<DocumentsMockup />}
              reverse
            />
          </div>
        </div>
      </section>

      {/* ============================== BENTO ============================== */}
      <section className="px-4 pb-16 sm:pb-24">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10 sm:mb-14">
            <div className="text-[10.5px] font-medium uppercase tracking-[0.18em] text-app-muted">And the rest</div>
            <h2 className="mt-3 text-[28px] sm:text-[36px] font-semibold tracking-tight text-app-ink">
              Quiet capabilities that compound.
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <BentoItem
              title="Multi-team roles"
              copy="Owners, reps, and store users — each with the surface they need, nothing more."
              icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="9" cy="8" r="3" /><circle cx="17" cy="10" r="2.4" /><path d="M3 19c.6-3 3.3-5 6-5s5.4 2 6 5" /><path d="M15 19c.4-2 2-3.4 4-3.4s3.6 1.4 4 3.4" /></svg>}
            />
            <BentoItem
              title="WhatsApp & email"
              copy="Share a stone, a memo, or a catalogue in one tap — pre-formatted, on brand."
              icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M3 19l1.5-4A8 8 0 1 1 7 21z" /></svg>}
            />
            <BentoItem
              title="Label printing"
              copy="QR cards and stone bags to Niimbot / Brother label printers, paired over Bluetooth."
              icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="3" y="7" width="18" height="10" rx="2" /><path d="M7 7V4h10v3M7 17v3h10v-3" /></svg>}
            />
            <BentoItem
              title="Upstream sync"
              copy="Automatic sync with your existing inventory — prices and availability never drift."
              icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M4 12a8 8 0 0 1 13.6-5.7L21 9M20 12a8 8 0 0 1-13.6 5.7L3 15" /></svg>}
            />
            <BentoItem
              title="Customer share"
              copy="Send a single private link to your buyer — they approve, request video, or decline, no account."
              icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="6" r="2.5" /><circle cx="18" cy="18" r="2.5" /><path d="M8.2 11l7.6-4M8.2 13l7.6 4" /></svg>}
            />
            <BentoItem
              title="Reports & analytics"
              copy="Live margins per partner, conversion by tier, ageing inventory — without exporting to a spreadsheet."
              icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M4 19V5M4 19h16M8 15v-3M12 15V8M16 15v-5" /></svg>}
            />
            <BentoItem
              title="Dark mode"
              copy="Apple Liquid Glass in both themes — switch from the top bar, every surface re-tints."
              icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" /></svg>}
            />
            <BentoItem
              title="Built-in DNA passport"
              copy="A public, mobile-optimised page per stone — no extra integration, no separate marketing site."
              icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M12 3 22 9 12 21 2 9z" /><path d="M2 9h20" /></svg>}
            />
          </div>
        </div>
      </section>

      {/* ============================== HOW IT WORKS ============================== */}
      <section className="px-4 pb-16 sm:pb-24">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10 sm:mb-14">
            <div className="text-[10.5px] font-medium uppercase tracking-[0.18em] text-app-muted">Onboarding</div>
            <h2 className="mt-3 text-[28px] sm:text-[36px] font-semibold tracking-tight text-app-ink">
              From sign-in to first signed memo in an afternoon.
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {[
              { n: "01", t: "Sign in",     d: "Your house gets a private workspace under your own subdomain." },
              { n: "02", t: "Sync",        d: "Import inventory from your upstream system — we'll mirror it nightly." },
              { n: "03", t: "Curate",      d: "Tier, tag and present your collection in the new Liquid Glass UI." },
              { n: "04", t: "Distribute",  d: "Invite trade partners. Memo. Sign. Archive. Done." },
            ].map((step, i) => (
              <motion.div
                key={step.n}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.07, duration: 0.5 }}
                className="glass-surface rounded-2xl p-5"
              >
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-app-muted">{step.n}</p>
                <h3 className="mt-3 text-[16px] font-semibold tracking-tight text-app-ink">{step.t}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-app-muted">{step.d}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================== CTA ============================== */}
      <section className="px-4 pb-16 sm:pb-24">
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-3xl mx-auto"
        >
          <div className="glass-surface-strong rounded-[28px] px-6 sm:px-12 py-12 sm:py-16 text-center">
            <h2 className="text-[26px] sm:text-[36px] font-semibold tracking-tight text-app-ink">
              A closed beta. By invitation.
            </h2>
            <p className="mt-4 text-[14px] sm:text-[15px] text-app-muted max-w-xl mx-auto leading-relaxed">
              We add one house at a time and walk the team through the first ten
              memos in person. Sign in to begin the conversation — there is no
              public waitlist.
            </p>
            <div className="mt-8 flex justify-center">
              <SignedIn>
                <Link to="/dashboard" className="btn-primary">
                  Open dashboard
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Link>
              </SignedIn>
              <SignedOut>
                <SignInButton mode="modal">
                  <button className="btn-primary">
                    Request access
                  </button>
                </SignInButton>
              </SignedOut>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ============================== FOOTER ============================== */}
      <footer className="px-4 py-8 border-t border-app-line">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="relative inline-flex w-5 h-5 rounded-md bg-app-ink items-center justify-center">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L2 9L12 22L22 9L12 2Z" fill="white" />
              </svg>
            </span>
            <span className="text-[12px] text-app-muted">GEMS DNA · Diamond Network</span>
          </div>
          <p className="text-[12px] text-app-soft">© 2026 Gemstar. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default OnboardingPage;
