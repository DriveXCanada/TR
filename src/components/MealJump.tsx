import type { Slot } from '@/lib/domain';

/**
 * Jumps to a meal's section further down the page.
 *
 * The planner shows every meal at once, so filtering by meal would hide work
 * the cook is trying to do. On a phone, though, reaching drinks means scrolling
 * past four other meals — so these move you there instead of filtering.
 *
 * Plain anchors on purpose: they work before hydration, and on a tablet in a
 * field kitchen that is the difference between a control that responds and one
 * that appears broken.
 */
export function MealJump({ slots }: { slots: readonly Slot[] }): React.ReactNode {
  return (
    <div className="no-print flex flex-wrap items-center gap-1" role="group" aria-label="Jump to a meal">
      <span className="mr-1 text-sm font-medium text-tr-grey">Jump to</span>
      {slots.map((s) => (
        <a
          key={s}
          href={`#slot-${s}`}
          className="rounded-md border border-tr-line bg-tr-slate px-3 py-2 text-sm font-medium capitalize text-tr-silver transition hover:bg-tr-charcoal hover:text-tr-white"
        >
          {s}
        </a>
      ))}
    </div>
  );
}
