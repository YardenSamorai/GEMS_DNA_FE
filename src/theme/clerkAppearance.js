/* ============================================================================
 * Shared Clerk appearance.
 *
 * Makes every Clerk surface — the sign-in *modal*, the routed /sign-in &
 * /sign-up pages, and the UserButton — speak the same v1.0.5 design language
 * as the sales inventory: ink primary, glass-white surfaces, hairline borders,
 * generous radii, the Outfit typeface, and comfortable mobile-first touch
 * targets.
 *
 * Colours reference the --app-* CSS variables (see src/index.css) via
 * rgb(var(--…)), so the whole thing re-tints automatically in dark mode.
 *
 * Mobile notes:
 *   - inputs/OTP use 16px text so iOS Safari never zooms on focus
 *   - the card goes edge-to-edge with a small margin on small screens
 *   - primary CTA is a full-width ink pill with an active press scale
 * ========================================================================== */

const v = (name) => `rgb(var(${name}))`;

export const clerkAppearance = {
  variables: {
    colorPrimary: v("--app-ink"),
    colorText: v("--app-ink"),
    colorTextSecondary: v("--app-muted"),
    colorBackground: v("--app-surface"),
    colorInputBackground: v("--app-canvas-2"),
    colorInputText: v("--app-ink"),
    colorSuccess: v("--brand-emerald"),
    colorDanger: "rgb(220 38 38)",
    colorNeutral: v("--app-ink"),
    borderRadius: "0.85rem",
    fontFamily: "Outfit, ui-sans-serif, system-ui, sans-serif",
    fontSize: "15px",
  },
  layout: {
    socialButtonsPlacement: "top",
    showOptionalFields: true,
    logoPlacement: "none",
  },
  elements: {
    rootBox: "w-full",

    // Modal + card chrome — rounded, hairline, our glass-white surface.
    modalContent: "mx-3 sm:mx-0",
    modalCloseButton: "text-app-muted hover:text-app-ink",
    cardBox:
      "w-full rounded-[26px] overflow-hidden shadow-[0_28px_70px_-24px_rgba(0,0,0,0.45)]",
    card: "bg-app-surface border border-app-line px-6 py-7 sm:px-7",

    headerTitle: "text-app-ink text-[21px] font-semibold tracking-tight",
    headerSubtitle: "text-app-muted text-[13.5px] leading-relaxed",

    // Social (Google) buttons.
    socialButtonsBlockButton:
      "border border-app-line bg-app-surface rounded-xl py-2.5 hover:bg-app-canvas2 transition active:scale-[0.99]",
    socialButtonsBlockButtonText: "text-[14px] font-medium text-app-ink",

    dividerLine: "bg-app-line",
    dividerText: "text-app-soft text-[11.5px] uppercase tracking-[0.12em]",

    // Inputs — 16px text avoids the iOS focus-zoom; hairline + soft fill.
    formFieldLabel: "text-app-graphite text-[13px] font-medium",
    formFieldInput:
      "bg-app-canvas2 border border-app-line rounded-xl text-[16px] text-app-ink placeholder:text-app-soft py-2.5 focus:border-app-line2 focus:ring-0",
    formFieldInputShowPasswordButton: "text-app-muted hover:text-app-ink",
    formFieldAction: "text-app-ink font-medium hover:underline",

    // Primary CTA — the v1.0.5 ink pill, full width.
    formButtonPrimary:
      "bg-app-ink hover:bg-app-graphite text-app-canvas text-[14px] font-semibold tracking-tight rounded-full py-2.5 active:scale-[0.99] transition normal-case",

    // OTP / verification.
    otpCodeFieldInput: "text-[16px] text-app-ink border-app-line rounded-xl",
    formResendCodeLink: "text-app-ink font-medium",

    // Footer ("Don't have an account? Sign up").
    footerActionText: "text-app-muted text-[13px]",
    footerActionLink: "text-app-ink font-medium hover:underline",
    identityPreviewEditButton: "text-app-ink",

    spinner: "text-app-ink",
  },
};

export default clerkAppearance;
