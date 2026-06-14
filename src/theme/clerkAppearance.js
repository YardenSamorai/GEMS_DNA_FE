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
    spacingUnit: "1.05rem",
  },
  layout: {
    socialButtonsPlacement: "top",
    showOptionalFields: true,
    logoPlacement: "none",
  },
  elements: {
    rootBox: "w-full",

    // Backdrop — a softly blurred ink scrim instead of plain black.
    modalBackdrop: "bg-app-ink/40 backdrop-blur-md",
    modalContent: "mx-3 sm:mx-0",

    // One continuous card: rounded, hairline ring, soft lifted shadow. The
    // footer (below) blends into the same surface so there's no grey seam.
    cardBox:
      "w-full rounded-[24px] overflow-hidden ring-1 ring-app-line shadow-[0_30px_80px_-28px_rgba(0,0,0,0.45)]",
    card: "bg-app-surface px-7 py-8 sm:px-8",
    modalCloseButton: "text-app-soft hover:text-app-ink hover:bg-app-canvas2 rounded-lg",

    // Header — tight, centred, app-ink title over a muted subtitle.
    header: "gap-1.5 mb-1",
    headerTitle: "text-app-ink text-[22px] font-semibold tracking-tight",
    headerSubtitle: "text-app-muted text-[13.5px] leading-relaxed",

    main: "gap-5",

    // Social (Google) — hairline pill, generous touch height.
    socialButtons: "gap-2",
    socialButtonsBlockButton:
      "border border-app-line bg-app-surface rounded-xl py-3 hover:bg-app-canvas2 transition active:scale-[0.99]",
    socialButtonsBlockButtonText: "text-[14px] font-medium text-app-ink",

    // "or" divider.
    dividerRow: "my-1",
    dividerLine: "bg-app-line",
    dividerText: "text-app-soft text-[11px] font-medium uppercase tracking-[0.14em]",

    // Form.
    form: "gap-4",
    formField: "gap-1.5",
    formFieldLabel: "text-app-graphite text-[13px] font-medium",
    // 16px input text avoids the iOS focus-zoom; hairline + soft fill + bigger
    // tap target.
    formFieldInput:
      "bg-app-canvas2 border border-app-line rounded-xl text-[16px] text-app-ink placeholder:text-app-soft px-3.5 py-3 focus:border-app-line2 focus:ring-0 transition",
    formFieldInputShowPasswordButton: "text-app-soft hover:text-app-ink",
    formFieldAction: "text-app-ink text-[12.5px] font-medium hover:underline",

    // Primary CTA — the v1.0.5 ink pill, full width, with a subtle lift.
    formButtonPrimary:
      "bg-app-ink hover:bg-app-graphite text-app-canvas text-[14.5px] font-semibold tracking-tight rounded-full py-3 shadow-[0_10px_24px_-12px_rgba(0,0,0,0.6)] active:scale-[0.99] transition normal-case",

    // Secondary actions ("Use passkey instead", back, etc.).
    alternativeMethodsBlockButton:
      "border border-app-line bg-app-surface text-app-graphite rounded-xl py-2.5 hover:bg-app-canvas2 transition text-[13.5px] font-medium",
    backLink: "text-app-ink",
    formResendCodeLink: "text-app-ink font-medium",

    // OTP / verification.
    otpCodeFieldInput: "text-[16px] text-app-ink border-app-line rounded-xl",

    // Footer — blended into the card surface (no grey strip), thin top hairline.
    footer: "bg-app-surface border-t border-app-line",
    footerAction: "py-1",
    footerActionText: "text-app-muted text-[13px]",
    footerActionLink: "text-app-ink font-semibold hover:underline",
    identityPreviewEditButton: "text-app-ink",

    spinner: "text-app-ink",
  },
};

export default clerkAppearance;
