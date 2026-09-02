import { redirect } from 'next/navigation';
import { getSession, isAuthConfigured } from '@/lib/auth/session';
import { ConceptBanner, PoweredByDriveX, Wordmark } from '@/components/Brand';
import { LoginForm } from './LoginForm';

export const dynamic = 'force-dynamic';

export default async function LoginPage(): Promise<React.ReactNode> {
  if (await getSession()) redirect('/');
  const configured = isAuthConfigured();

  return (
    <main className="min-h-screen">
      <ConceptBanner />
      <div className="bg-tr-charcoal px-4 py-4">
        <div className="mx-auto max-w-md"><Wordmark subtitle="Field Operations" /></div>
      </div>

      <div className="mx-auto mt-10 max-w-md px-4">
        <div className="card p-6">
          <h1 className="mb-1 text-xl font-semibold text-tr-charcoal">Sign in</h1>
          <p className="mb-5 text-sm text-tr-grey">
            Lead and assistant access. There is no public sign-up — accounts are issued by your Food Unit Leader.
          </p>
          {configured ? (
            <LoginForm />
          ) : (
            <p role="alert" className="rounded-md border border-severe-border bg-severe-bg px-3 py-2 text-sm text-severe">
              This server is missing <code>AUTH_SECRET</code>, so sign-in is disabled. Set it and redeploy.
            </p>
          )}
        </div>
        <p className="mt-4 text-center text-xs text-tr-grey">
          Health data is handled per our <a className="underline" href="/privacy">privacy notice</a>.
        </p>
        <p className="mt-2 text-center"><PoweredByDriveX /></p>
      </div>
    </main>
  );
}
