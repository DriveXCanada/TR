import { groupConflicts, type Conflict } from '@/lib/conflict';
import { SeverityChip } from '@/components/ui';

/**
 * Why a dish is flagged, in a form a cook will believe.
 *
 * A bare "fish" chip on a beef chilli reads as a bug, and a warning people
 * think is broken is a warning they stop reading. The ingredient and the
 * derivation are what make it credible: the chilli really does carry fish
 * protein, because Worcestershire sauce is made with anchovy.
 *
 * Every affected person is named. None of this truncates — a hidden name is a
 * person nobody checked.
 */
export function ConflictLines({ conflicts }: { conflicts: readonly Conflict[] }): React.ReactNode {
  const reasons = groupConflicts(conflicts);
  if (reasons.length === 0) return null;

  return (
    <ul className="mt-1 space-y-1">
      {reasons.map((r) => (
        <li key={`${r.severity}-${r.tag}-${r.ingredient}`} className="text-sm leading-snug">
          <SeverityChip severity={r.severity} />
          <span className="ml-2 font-semibold capitalize text-tr-white">{r.tag.replace(/-/g, ' ')}</span>
          <span className="text-tr-silver"> in </span>
          <span className="font-mono text-tr-white">{r.ingredient}</span>
          {r.via !== undefined && <span className="text-tr-grey"> — {r.via}</span>}
          <span className="text-tr-silver"> · {r.people.join(', ')}</span>
        </li>
      ))}
    </ul>
  );
}

/** The same explanation as plain text, for a printed sheet. */
export function conflictSentences(conflicts: readonly Conflict[]): string[] {
  return groupConflicts(conflicts).map((r) => {
    const because = r.via === undefined ? r.ingredient : `${r.ingredient} (${r.via})`;
    return `${r.tag.replace(/-/g, ' ')} in ${because} — ${r.people.join(', ')}`;
  });
}
