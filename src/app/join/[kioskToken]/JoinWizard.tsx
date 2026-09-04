'use client';

import { useActionState, useState } from 'react';
import { submitJoin, type JoinState } from '@/lib/actions/join';
import { ICS_ROLES, ICS_ROLE_LABELS, MEALS, type Severity } from '@/lib/domain';
import { SIZE_SCHEMES, SCHEMES, type SizeMap } from '@/lib/sizes';

/** Common restrictions, offered as taps rather than free text so they land as structured data. */
const COMMON = [
  { key: 'peanuts', label: 'Peanuts' },
  { key: 'tree-nuts', label: 'Tree nuts' },
  { key: 'fish', label: 'Fish' },
  { key: 'shellfish', label: 'Shellfish' },
  { key: 'dairy', label: 'Dairy' },
  { key: 'egg', label: 'Egg' },
  { key: 'gluten', label: 'Gluten' },
  { key: 'soy', label: 'Soy' },
  { key: 'sesame', label: 'Sesame' },
  { key: 'mustard', label: 'Mustard' },
  { key: 'pork', label: 'Pork' },
  { key: 'vegetarian', label: 'Vegetarian' },
  { key: 'vegan', label: 'Vegan' },
  { key: 'halal', label: 'Halal' },
  { key: 'diabetic', label: 'Diabetic' },
] as const;

interface Picked { key: string; severity: Severity; note: string; }

const STEPS = ['Consent', 'You', 'Kit sizes', 'Food & medical', 'Auto-injector', 'Your meals', 'Preferences', 'Confirm'] as const;

export function JoinWizard(
  { kioskToken, operationName, days }: { kioskToken: string; operationName: string; days: readonly string[] },
): React.ReactNode {
  const [state, action, pending] = useActionState<JoinState, FormData>(submitJoin, {});
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState<Picked[]>([]);
  const [custom, setCustom] = useState('');
  const [carrying, setCarrying] = useState(false);
  const [lastDay, setLastDay] = useState('');
  const [sizes, setSizes] = useState<SizeMap>({});

  function toggle(key: string): void {
    setPicked((prev) => prev.some((p) => p.key === key)
      ? prev.filter((p) => p.key !== key)
      : [...prev, { key, severity: 'preference', note: '' }]);
  }

  function update(key: string, patch: Partial<Picked>): void {
    setPicked((prev) => prev.map((p) => (p.key === key ? { ...p, ...patch } : p)));
  }

  function addCustom(): void {
    const key = custom.trim().toLowerCase();
    if (key === '' || picked.some((p) => p.key === key)) return;
    setPicked((prev) => [...prev, { key, severity: 'preference', note: '' }]);
    setCustom('');
  }

  if (state.ok === true) {
    return (
      <div className="card p-6 text-center">
        <h1 className="text-xl font-bold text-tr-white">You&apos;re on the roster</h1>
        <p className="mt-2 text-sm text-tr-silver">
          Thanks. The kitchen has your details for <strong>{operationName}</strong>.
        </p>
        <p className="mt-4 text-sm text-tr-grey">
          If anything changes — especially an allergy or your departure day — tell a lead in person.
          Do not assume the kitchen will spot it.
        </p>
      </div>
    );
  }

  const visible = step === STEPS.length - 1;

  return (
    <form action={action} className="card space-y-5 p-5">
      <input type="hidden" name="kioskToken" value={kioskToken} />
      <input type="hidden" name="restrictions" value={JSON.stringify(picked)} />
      <input type="hidden" name="sizes" value={JSON.stringify(sizes)} />

      <ol className="flex flex-wrap gap-1 text-xs" aria-label="Progress">
        {STEPS.map((label, i) => (
          <li key={label} className={`rounded px-2 py-1 ${
            i === step ? 'bg-tr-red text-white' : i < step ? 'bg-tr-red/15 text-tr-red-bright' : 'bg-tr-raised text-tr-grey'
          }`}>{label}</li>
        ))}
      </ol>

      {/* Every step stays mounted so the browser submits all fields at once. */}
      <section hidden={step !== 0} className="space-y-3">
        <h2 className="text-lg font-semibold text-tr-white">Before we start</h2>
        <p className="text-sm text-tr-silver">
          The kitchen needs your dietary and medical information to feed you safely. It is visible only to
          the leads running <strong>{operationName}</strong>, is never sold or shared, and is permanently
          deleted after the operation&apos;s retention period.
        </p>
        <p className="text-sm text-tr-silver">
          You can decline and sign in with a lead in person instead.
        </p>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="consent" value="yes" className="mt-1" required />
          <span>I agree to the kitchen recording these details so they can feed me safely.</span>
        </label>
        <p className="text-xs text-tr-grey">
          Full detail in the <a className="underline" href="/privacy" target="_blank" rel="noreferrer">privacy notice</a>.
        </p>
      </section>

      <section hidden={step !== 1} className="space-y-3">
        <h2 className="text-lg font-semibold text-tr-white">Who are you?</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm"><span className="label">First name</span>
            <input name="firstName" className="input" autoComplete="given-name" /></label>
          <label className="text-sm"><span className="label">Last name</span>
            <input name="lastName" className="input" autoComplete="family-name" /></label>
        </div>
        <label className="text-sm block"><span className="label">ICS role</span>
          <select name="icsRole" className="input" defaultValue="Core Ops">
            {ICS_ROLES.map((r) => <option key={r} value={r}>{r} — {ICS_ROLE_LABELS[r]}</option>)}
          </select></label>
        <label className="text-sm block"><span className="label">Phone (optional)</span>
          <input name="phone" className="input" inputMode="tel" autoComplete="tel" /></label>
      </section>

      <section hidden={step !== 2} className="space-y-3">
        <h2 className="text-lg font-semibold text-tr-white">Kit sizes</h2>
        <p className="text-sm text-tr-silver">
          Logistics orders PPE before you arrive. Kit that does not fit does not get worn, so a guess here
          costs somebody a day on site.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {SIZE_SCHEMES.map((scheme) => (
            <label key={scheme} className="text-sm">
              <span className="label">{SCHEMES[scheme].prompt}</span>
              <select
                name={`size_${scheme}`}
                className="input"
                value={sizes[scheme] ?? ''}
                onChange={(e) => setSizes((prev) => {
                  const next = { ...prev };
                  if (e.target.value === '') delete next[scheme];
                  else next[scheme] = e.target.value;
                  return next;
                })}
              >
                <option value="">Not sure / prefer not to say</option>
                {SCHEMES[scheme].options.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </label>
          ))}
        </div>
        <p className="text-xs text-tr-grey">
          Leave anything blank if you are unsure — logistics would rather chase one answer than issue the
          wrong size to everyone.
        </p>
      </section>

      <section hidden={step !== 3} className="space-y-3">
        <h2 className="text-lg font-semibold text-tr-white">Allergies, intolerances, diet</h2>
        <p className="text-sm text-tr-silver">
          Tap everything that applies. If something could send you to hospital, mark it <strong>Severe</strong> —
          the kitchen treats severe as a hard stop on a dish.
        </p>
        <div className="flex flex-wrap gap-2">
          {COMMON.map((item) => (
            <button
              key={item.key} type="button" onClick={() => toggle(item.key)}
              className={`rounded-full border px-3 py-1.5 text-sm ${
                picked.some((p) => p.key === item.key)
                  ? 'border-tr-red bg-tr-red text-white' : 'border-tr-line bg-tr-slate text-tr-silver'
              }`}
            >{item.label}</button>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            className="input" placeholder="Something else" value={custom}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }}
          />
          <button type="button" className="btn-secondary" onClick={addCustom}>Add</button>
        </div>

        {picked.length > 0 && (
          <ul className="space-y-2">
            {picked.map((p) => (
              <li key={p.key} className="rounded-md border border-tr-line p-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium capitalize text-tr-white">{p.key.replace('-', ' ')}</span>
                  <select
                    className="input w-auto py-1 text-sm" value={p.severity}
                    onChange={(e) => update(p.key, { severity: e.target.value as Severity })}
                    aria-label={`How serious is ${p.key}?`}
                  >
                    <option value="severe">Severe — could hospitalise me</option>
                    <option value="intolerance">Intolerance — makes me unwell</option>
                    <option value="preference">Preference — I choose not to</option>
                  </select>
                  <button type="button" className="text-xs text-tr-grey underline" onClick={() => toggle(p.key)}>
                    Remove
                  </button>
                </div>
                <input
                  className="input mt-2 text-sm" placeholder="Anything the kitchen should know (optional)"
                  value={p.note} onChange={(e) => update(p.key, { note: e.target.value })}
                  aria-label={`Note about ${p.key}`}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section hidden={step !== 4} className="space-y-3">
        <h2 className="text-lg font-semibold text-tr-white">Auto-injector</h2>
        <p className="text-sm text-tr-silver">
          If you carry an EpiPen or similar, tell us exactly where it is. In an emergency somebody who
          does not know you has to find it in seconds.
        </p>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox" name="epipenCarrying" value="yes"
            checked={carrying} onChange={(e) => setCarrying(e.target.checked)}
          />
          <span>I carry an auto-injector</span>
        </label>
        {carrying && (
          <label className="text-sm block"><span className="label">Where is it kept?</span>
            <input name="epipenLocation" className="input" placeholder="e.g. right thigh pocket; spare in the kitchen first-aid box" /></label>
        )}
      </section>

      <section hidden={step !== 5} className="space-y-3">
        <h2 className="text-lg font-semibold text-tr-white">Which meals are you on site for?</h2>
        <p className="text-sm text-tr-silver">
          The kitchen cooks to a headcount per meal, so arriving at supper or leaving after lunch
          genuinely changes what gets made.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm"><span className="label">First day here</span>
            <select name="arriveDate" className="input" defaultValue={days[0]}>
              {days.map((d) => <option key={d} value={d}>{d}</option>)}
            </select></label>
          <label className="text-sm"><span className="label">First meal you&apos;ll eat</span>
            <select name="arriveMeal" className="input" defaultValue="breakfast">
              {MEALS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select></label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm"><span className="label">Last day here</span>
            <select name="departDate" className="input" value={lastDay} onChange={(e) => setLastDay(e.target.value)}>
              <option value="">Not sure yet</option>
              {days.map((d) => <option key={d} value={d}>{d}</option>)}
            </select></label>
          <label className="text-sm"><span className="label">On your last day — are you here for supper, or leaving before?</span>
            <select name="departMeal" className="input" defaultValue="supper" disabled={lastDay === ''}>
              <option value="breakfast">Leaving after breakfast</option>
              <option value="lunch">Leaving after lunch</option>
              <option value="supper">Here for supper</option>
            </select></label>
        </div>
        {lastDay === '' && (
          <p className="rounded-md border border-intolerance-border bg-intolerance-bg p-2 text-xs text-intolerance">
            No last day yet is fine. The kitchen will keep counting you for every meal until you tell a lead —
            so please do tell them, or they will cook for a person who has gone home.
          </p>
        )}
      </section>

      <section hidden={step !== 6} className="space-y-3">
        <h2 className="text-lg font-semibold text-tr-white">Preferences (optional)</h2>
        <p className="text-sm text-tr-silver">
          Not safety information — this just helps the kitchen cook things people actually want after a hard day.
        </p>
        <label className="text-sm block"><span className="label">Things you like</span>
          <input name="likes" className="input" placeholder="chilli, strong coffee" /></label>
        <label className="text-sm block"><span className="label">Things you would rather avoid</span>
          <input name="dislikes" className="input" placeholder="oatmeal" /></label>
        <label className="text-sm block"><span className="label">Anything that lifts morale</span>
          <input name="morale" className="input" placeholder="pancakes on a cold morning" /></label>
        <label className="text-sm block"><span className="label">Anything else</span>
          <textarea name="freeNote" rows={2} className="input" /></label>
      </section>

      <section hidden={!visible} className="space-y-3">
        <h2 className="text-lg font-semibold text-tr-white">Check and send</h2>
        <p className="text-sm text-tr-silver">
          You marked <strong>{picked.filter((p) => p.severity === 'severe').length}</strong> item(s) as severe
          and <strong>{picked.length}</strong> in total.
          {carrying ? ' You told us you carry an auto-injector.' : ''}
        </p>
        <p className="text-sm text-tr-grey">
          Go back and fix anything that is wrong. Once you send this, changes go through a lead.
        </p>
      </section>

      {state.error !== undefined && (
        <p role="alert" className="rounded-md border border-severe-border bg-severe-bg px-3 py-2 text-sm text-severe">
          {state.error}
        </p>
      )}

      <div className="flex items-center justify-between gap-2">
        <button
          type="button" data-testid="wizard-back" className="btn-secondary"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
        >Back</button>

        {/*
          These two MUST have distinct keys. Without them React reuses the same
          DOM node and merely flips `type` from "button" to "submit" — and
          because React 19 flushes this state update synchronously inside the
          click, the browser then performs the submit default action on the very
          click that was meant to advance the step. The confirmation step got
          skipped and the form sent itself. Distinct keys force a new node, so
          the clicked element stays a plain button for the life of the event.
        */}
        {visible ? (
          <button key="submit" type="submit" data-testid="wizard-submit" className="btn-primary" disabled={pending}>
            {pending ? 'Sending…' : 'Send to the kitchen'}
          </button>
        ) : (
          <button
            key="next" type="button" data-testid="wizard-next" className="btn-primary"
            onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
          >Next</button>
        )}
      </div>
    </form>
  );
}
