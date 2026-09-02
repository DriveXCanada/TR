import type { Severity } from '@/lib/domain';

const SEVERITY_CLASS: Record<Severity, string> = {
  severe: 'chip-severe',
  intolerance: 'chip-intolerance',
  preference: 'chip-preference',
};

const SEVERITY_LABEL: Record<Severity, string> = {
  severe: 'SEVERE',
  intolerance: 'Intolerance',
  preference: 'Preference',
};

export function SeverityChip({ severity, children }: { severity: Severity; children?: React.ReactNode }): React.ReactNode {
  return (
    <span className={`chip ${SEVERITY_CLASS[severity]}`}>
      {severity === 'severe' && <span aria-hidden>▲</span>}
      {children ?? SEVERITY_LABEL[severity]}
    </span>
  );
}

export function Card({ title, subtitle, children, className = '' }: {
  title?: string; subtitle?: string; children: React.ReactNode; className?: string;
}): React.ReactNode {
  return (
    <section className={`card p-4 ${className}`}>
      {title !== undefined && (
        <header className="mb-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-tr-grey">{title}</h2>
          {subtitle !== undefined && <p className="mt-0.5 text-xs text-tr-grey">{subtitle}</p>}
        </header>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }): React.ReactNode {
  return (
    <div className="card p-4">
      <div className="text-xs uppercase tracking-wide text-tr-grey">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-tr-charcoal">{value}</div>
      {hint !== undefined && <div className="mt-0.5 text-xs text-tr-grey">{hint}</div>}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }): React.ReactNode {
  return <p className="py-6 text-center text-sm text-tr-grey">{children}</p>;
}

export function money(amount: number, currency: string): string {
  return `${currency} ${amount.toFixed(2)}`;
}
