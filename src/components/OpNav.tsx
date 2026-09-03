'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * Section-scoped navigation. Ten tabs mixing two jobs became two sections with
 * five or six each, and a breadcrumb back to the chooser — you only ever see
 * the tabs for the job you are doing.
 */
const SECTIONS = {
  food: {
    label: 'Food Unit',
    tabs: [
      { href: '', label: 'Board' },
      { href: '/roster', label: 'Roster' },
      { href: '/menu', label: 'Menu' },
      { href: '/shopping', label: 'Shopping' },
      { href: '/check', label: 'Check' },
      { href: '/brief', label: 'Brief' },
    ],
  },
  logistics: {
    label: 'Logistics',
    tabs: [
      { href: '', label: 'Overview' },
      { href: '/travel', label: 'Travel' },
      { href: '/staffing', label: 'Staffing' },
    ],
  },
} as const;

export type SectionKey = keyof typeof SECTIONS;

export function OpNav({ opId, section }: { opId: string; section: SectionKey }): React.ReactNode {
  const pathname = usePathname();
  const base = `/op/${opId}/${section}`;
  const current = SECTIONS[section];
  const other: SectionKey = section === 'food' ? 'logistics' : 'food';

  return (
    <nav className="no-print border-b border-tr-line bg-tr-black">
      <div className="mx-auto max-w-6xl px-4">
        <div className="flex items-center justify-between gap-4 pt-2">
          <div className="flex items-baseline gap-2 text-xs">
            <Link href={`/op/${opId}`} className="text-tr-grey hover:text-tr-white">Operation</Link>
            <span aria-hidden className="text-tr-line">/</span>
            <span className="font-bold uppercase tracking-wide text-tr-red-bright">{current.label}</span>
          </div>
          <Link
            href={`/op/${opId}/${other}`}
            className="rounded border border-tr-line px-2 py-1 text-xs font-bold uppercase tracking-wide text-tr-grey transition hover:border-tr-grey hover:text-tr-white"
          >
            Switch to {SECTIONS[other].label}
          </Link>
        </div>

        <div className="-mb-px flex gap-1 overflow-x-auto">
          {current.tabs.map((tab) => {
            const href = `${base}${tab.href}`;
            const active = tab.href === '' ? pathname === base : pathname.startsWith(href);
            return (
              <Link
                key={tab.label}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`whitespace-nowrap border-b-2 px-3 py-3 text-sm font-bold uppercase tracking-wide transition ${
                  active
                    ? 'border-tr-red text-tr-white'
                    : 'border-transparent text-tr-grey hover:text-tr-silver'
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
