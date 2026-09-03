import { ConceptBanner, PoweredByDriveX, Wordmark } from './Brand';

/**
 * Shown instead of a generic 500 when the server is misconfigured. The point is
 * that whoever deployed this can read it and fix it without server logs.
 */
export function SetupError({ message }: { message: string }): React.ReactNode {
  return (
    <main className="min-h-screen">
      <ConceptBanner />
      <div className="bg-tr-black px-4 py-4">
        <div className="mx-auto max-w-xl"><Wordmark subtitle="Field Operations" /></div>
      </div>
      <div className="mx-auto mt-10 max-w-xl px-4">
        <div className="card border-severe-border p-6">
          <h1 className="text-lg font-bold text-severe">This server is not set up correctly</h1>
          <p className="mt-2 text-sm text-tr-silver">{message}</p>
          <p className="mt-4 text-sm text-tr-grey">
            Volunteer data is safe — nothing has been lost. The console cannot start until the
            configuration is fixed and the service redeployed.
          </p>
          <p className="mt-3 text-xs text-tr-grey">
            Diagnostics: <a className="underline" href="/api/health">/api/health</a>
          </p>
        </div>
        <p className="mt-4 text-center"><PoweredByDriveX /></p>
      </div>
    </main>
  );
}
