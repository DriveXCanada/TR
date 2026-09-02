import Link from 'next/link';
import { signOut } from '@/lib/actions/auth';
import { ConceptBanner, Wordmark } from './Brand';

export function AppHeader({ opName, userName }: { opName?: string; userName: string }): React.ReactNode {
  return (
    <>
      <ConceptBanner />
      <header className="no-print bg-tr-charcoal px-4 py-3">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <Link href="/" className="shrink-0"><Wordmark subtitle={opName ?? 'Field Operations'} /></Link>
          <form action={signOut}>
            <button type="submit" className="text-xs text-white/70 underline hover:text-white">
              Sign out ({userName})
            </button>
          </form>
        </div>
      </header>
    </>
  );
}
