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
export function TrMark({ size = 34 }: { size?: number }): React.ReactNode {
  return (
    <span
      aria-hidden
      style={{ width: size, height: size }}
      className="inline-flex shrink-0 items-center justify-center bg-tr-red font-black text-white"
    >
      <span style={{ fontSize: size * 0.4, lineHeight: 1, letterSpacing: '-0.03em' }}>TR</span>
    </span>
  );
}

export function Wordmark({ subtitle }: { subtitle?: string }): React.ReactNode {
  return (
    <span className="flex items-center gap-3">
      <TrMark />
      <span className="leading-tight">
        <span className="block text-sm font-black uppercase tracking-wide text-tr-white">
          Team Rubicon Canada
        </span>
        <span className="block text-[11px] uppercase tracking-[0.14em] text-tr-grey">
          {subtitle ?? 'Built to Serve'}
        </span>
      </span>
    </span>
  );
}

export function PoweredByDriveX({ className = '' }: { className?: string }): React.ReactNode {
  return (
    <span className={`text-xs text-tr-grey ${className}`}>
      Powered by <span className="font-bold text-tr-silver">DriveX</span>
    </span>
  );
}

/** Shown until an official Team Rubicon Canada asset and sign-off are in place. */
export function ConceptBanner(): React.ReactNode {
  return (
    <div className="border-b border-tr-red-deep bg-tr-red-deep px-4 py-1 text-center text-[10px] font-bold uppercase tracking-[0.1em] text-white/90">
      Concept build — not an official Team Rubicon product
    </div>
  );
}
