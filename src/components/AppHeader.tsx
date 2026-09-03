import Link from 'next/link';
import { signOut } from '@/lib/actions/auth';
import { ConceptBanner, Wordmark } from './Brand';

export function AppHeader(
  { opName, userName, isMaster = false }: { opName?: string; userName: string; isMaster?: boolean },
): React.ReactNode {
  return (
    <>
      <ConceptBanner />
      <header className="no-print border-b border-tr-line bg-tr-black">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/" className="shrink-0"><Wordmark subtitle={opName ?? 'Field Operations'} /></Link>
          <div className="flex items-center gap-4 text-xs">
            <span className="hidden text-tr-grey sm:inline">
              {userName}{isMaster && <span className="ml-1 text-tr-red-bright">·&nbsp;master</span>}
            </span>
            {isMaster && (
              <Link href="/managers" className="font-bold uppercase tracking-wide text-tr-grey hover:text-tr-white">
                Accounts
              </Link>
            )}
            <form action={signOut}>
              <button type="submit" className="font-bold uppercase tracking-wide text-tr-grey hover:text-tr-white">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
    </>
  );
}
