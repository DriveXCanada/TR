/**
 * Masthead for a printed sheet. Only renders on paper.
 *
 * A printout leaves the app behind — its access control, its day selector, the
 * knowledge of which operation it came from. Anything handed to a crew has to
 * say what it is and when it was true, or it gets used on the wrong day.
 */
export function PrintHeader(
  { title, operationName, location, day, note }: {
    title: string; operationName: string; location?: string; day?: string; note?: string;
  },
): React.ReactNode {
  return (
    <header className="print-only print-head">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12pt', alignItems: 'baseline' }}>
        <strong style={{ fontSize: '14pt', textTransform: 'uppercase' }}>{title}</strong>
        <span style={{ fontSize: '9pt' }}>{day}</span>
      </div>
      <div style={{ fontSize: '9.5pt', marginTop: '2pt' }}>
        {operationName}{location !== undefined && ` · ${location}`} · Team Rubicon Canada · Powered by DriveX
      </div>
      {note !== undefined && <div style={{ fontSize: '8.5pt', marginTop: '3pt' }}>{note}</div>}
    </header>
  );
}
