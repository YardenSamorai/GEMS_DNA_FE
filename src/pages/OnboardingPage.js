import React from "react";
import { Link } from "react-router-dom";
import { SignedIn, SignedOut, SignInButton } from "@clerk/clerk-react";
import { motion } from "framer-motion";

/**
 * v1.0.5 — Public landing page.
 *
 * Replaces the prior emerald-festival marketing template with a calm,
 * editorial Liquid-Glass landing in the same language as the store
 * portal. The brand emerald survives only as the "active session"
 * status dot — every other surface is glass over the tonal canvas.
 *
 * The page is read by procurement/owner contacts at houses like
 * Cartier, Tiffany and Hermes; restraint > decoration.
 */
const OnboardingPage = () => {
  const features = [
    {
      title: "Inventory",
      description: "Single source of truth for diamonds, emeralds and coloured stones — with media, certs and provenance.",
    },
    {
      title: "Catalogues",
      description: "Generate house-branded PDF catalogues with retail-ready layouts in seconds.",
    },
    {
      title: "Trade portal",
      description: "Invite stores to browse your collection privately and request stones to memo.",
    },
    {
      title: "Memo & signatures",
      description: "Two-way digital signatures captured at issue and close, archived with audit trail.",
    },
    {
      title: "Sync",
      description: "Automatic sync with the upstream inventory system so prices and availability never drift.",
    },
    {
      title: "Label printing",
      description: "QR-labelled cards and stone bags with one tap to a Niimbot or Brother label printer.",
    },
  ];

  const steps = [
    { number: "01", title: "Sign in",   description: "Create the workspace for your house." },
    { number: "02", title: "Sync",      description: "Import inventory from your upstream system." },
    { number: "03", title: "Curate",    description: "Tier, tag and present your collection." },
    { number: "04", title: "Distribute",description: "Share with select trade partners." },
  ];

  return (
    <div className="min-h-screen app-canvas relative overflow-hidden">
      {/* Hero */}
      <section className="relative px-4 pt-16 sm:pt-24 pb-20 sm:pb-28">
        <div className="max-w-5xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Status badge — glass pill, emerald dot only */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass-surface text-[11px] font-medium tracking-[0.14em] uppercase text-app-graphite">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-emerald animate-pulse" />
              Diamond Network by Gemstar
            </div>

            <h1 className="mt-8 text-[40px] sm:text-[56px] md:text-[68px] font-semibold leading-[1.05] tracking-tight text-app-ink">
              The operating system
              <br className="hidden sm:block" />
              <span className="text-app-graphite"> for fine gemstones.</span>
            </h1>

            <p className="mt-6 text-[15px] sm:text-[17px] leading-relaxed max-w-2xl mx-auto text-app-muted">
              GEMS DNA gives houses a single, private workspace for inventory,
              catalogues, trade memos and signatures. Built for the people
              who already work with the world&apos;s most exacting brands.
            </p>

            <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center items-center">
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
              <Link to="/inventory" className="btn-secondary">
                View live collection
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Glass preview panel — restrained, no fake browser chrome */}
      <section className="px-4 pb-20">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-5xl mx-auto"
        >
          <div className="glass-surface-strong rounded-[28px] p-6 sm:p-10">
            <div className="grid grid-cols-3 gap-4 sm:gap-6">
              {[
                { label: "Stones tracked",     value: "1,247",  caption: "across 4 categories" },
                { label: "Catalogue value",    value: "$2.4M",  caption: "live, audited" },
                { label: "Active trade stores",value: "38",     caption: "private portals" },
              ].map((stat) => (
                <div key={stat.label} className="glass-surface rounded-2xl p-4 sm:p-6">
                  <p className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-app-muted">
                    {stat.label}
                  </p>
                  <p className="mt-2 text-[24px] sm:text-[34px] font-semibold tracking-tight text-app-ink leading-none">
                    {stat.value}
                  </p>
                  <p className="mt-2 text-[11.5px] text-app-soft">{stat.caption}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </section>

      {/* Features grid */}
      <section className="px-4 py-16 sm:py-20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10 sm:mb-14">
            <h2 className="text-[28px] sm:text-[38px] font-semibold tracking-tight text-app-ink">
              Everything a house needs.
            </h2>
            <p className="mt-3 text-[14px] sm:text-[15px] text-app-muted max-w-xl mx-auto">
              One workspace. Six tools designed and refined with active partners in the trade.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05, duration: 0.5 }}
                className="glass-surface rounded-2xl p-6"
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-app-line2" />
                  <span className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-app-muted">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </div>
                <h3 className="text-[16px] font-semibold tracking-tight text-app-ink">
                  {feature.title}
                </h3>
                <p className="mt-2 text-[13px] leading-relaxed text-app-muted">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="px-4 py-16 sm:py-20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10 sm:mb-14">
            <h2 className="text-[28px] sm:text-[38px] font-semibold tracking-tight text-app-ink">
              From sign-in to first trade in an afternoon.
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {steps.map((step, i) => (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.5 }}
                className="glass-surface rounded-2xl p-6"
              >
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-app-muted">
                  {step.number}
                </p>
                <h3 className="mt-3 text-[16px] font-semibold tracking-tight text-app-ink">
                  {step.title}
                </h3>
                <p className="mt-2 text-[13px] leading-relaxed text-app-muted">
                  {step.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 py-16 sm:py-24">
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-3xl mx-auto"
        >
          <div className="glass-surface-strong rounded-[28px] px-6 sm:px-12 py-12 sm:py-16 text-center">
            <h2 className="text-[26px] sm:text-[36px] font-semibold tracking-tight text-app-ink">
              Ready for a closed beta seat?
            </h2>
            <p className="mt-4 text-[14px] sm:text-[15px] text-app-muted max-w-xl mx-auto leading-relaxed">
              We invite houses one by one. Sign in to begin the conversation — there is no waitlist and no public sign-up form.
            </p>
            <div className="mt-8">
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

      {/* Footer */}
      <footer className="px-4 py-8 border-t border-app-line">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center gap-3">
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
