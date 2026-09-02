/**
 * Branding.
 *
 * IMPORTANT: this build does NOT ship the Team Rubicon logo. Fabricating a
 * charity's mark — even approximately — misrepresents them. `TrMark` renders an
 * honest geometric placeholder, and `ConceptBanner` states plainly that this is
 * an unofficial build. Replace the placeholder only with an official asset
 * supplied by Team Rubicon Canada, and drop the banner only once the build is
 * actually sanctioned by them.
 */
export function TrMark({ size = 32 }: { size?: number }): React.ReactNode {
  return (
    <span
      aria-hidden
      style={{ width: size, height: size }}
      className="inline-flex shrink-0 items-center justify-center rounded-sm bg-tr-red font-black text-white"
    >
      <span style={{ fontSize: size * 0.42, lineHeight: 1 }}>TR</span>
    </span>
  );
}

export function Wordmark({ subtitle }: { subtitle?: string }): React.ReactNode {
  return (
    <span className="flex items-center gap-3">
      <TrMark />
      <span className="leading-tight">
        <span className="block text-sm font-bold uppercase tracking-wide text-white">
          Team Rubicon Canada
        </span>
        <span className="block text-xs text-white/70">{subtitle ?? 'Built to Serve'}</span>
      </span>
    </span>
  );
}

export function PoweredByDriveX({ className = '' }: { className?: string }): React.ReactNode {
  return (
    <span className={`text-xs text-tr-grey ${className}`}>
      Powered by <span className="font-semibold text-tr-ink">DriveX</span>
    </span>
  );
}

/** Shown until an official Team Rubicon Canada asset and sign-off are in place. */
export function ConceptBanner(): React.ReactNode {
  return (
    <div className="bg-tr-charcoal px-4 py-1.5 text-center text-[11px] text-white/80">
      CONCEPT BUILD — not an official Team Rubicon product. Branding is a placeholder pending approval.
    </div>
  );
}
