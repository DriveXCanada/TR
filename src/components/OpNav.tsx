'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '', label: 'Board' },
  { href: '/roster', label: 'Roster' },
  { href: '/resources', label: 'Resources' },
  { href: '/travel', label: 'Travel' },
  { href: '/menu', label: 'Menu' },
  { href: '/shopping', label: 'Shopping' },
  { href: '/recipes', label: 'Recipes' },
  { href: '/check', label: 'Check' },
  { href: '/brief', label: 'Brief' },
  { href: '/settings', label: 'Settings' },
] as const;

export function OpNav({ opId }: { opId: string }): React.ReactNode {
  const pathname = usePathname();
  const base = `/op/${opId}`;

  return (
    <nav className="no-print border-b border-black/10 bg-white">
      <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-2">
        {TABS.map((tab) => {
          const href = `${base}${tab.href}`;
          const active = tab.href === '' ? pathname === base : pathname.startsWith(href);
          return (
            <Link
              key={tab.label}
              href={href}
              className={`whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition ${
                active ? 'border-tr-red text-tr-red' : 'border-transparent text-tr-grey hover:text-tr-ink'
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
