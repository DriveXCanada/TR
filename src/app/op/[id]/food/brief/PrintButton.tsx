'use client';

export function PrintButton(): React.ReactNode {
  return (
    <button type="button" className="btn-primary" onClick={() => window.print()}>
      Print this brief
    </button>
  );
}
