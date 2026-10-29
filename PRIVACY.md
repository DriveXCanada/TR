# Privacy

This application holds **health information about identifiable people**: dietary
restrictions, allergy severity, and where a volunteer keeps their auto-injector.
That is the most sensitive data in the system and the reason the system exists —
a kitchen cannot feed someone safely without it.

The volunteer-facing notice is at `/privacy` (public, no login) and is rendered
from `src/app/privacy/page.tsx`. **If the application changes what it collects,
that page changes in the same commit.** A notice that has drifted from the
system is worse than none, because people act on it.

## What is collected

From the volunteer, at sign-in (`/join/[kioskToken]`):

| Field | Why |
| --- | --- |
| Name, ICS role, optional phone | Identify who is in the line |
| Restrictions: key, severity, note | Safety — the core purpose |
| Auto-injector carried, and its location | Emergency response |
| Arrival and departure day + meal | Headcount per service |
| PPE sizes | Ordering kit that fits |
| Likes, dislikes, morale, free note | Optional; cooking food people want |
| Consent timestamp | Record that the notice was accepted |

Not collected: date of birth, address, health number, emergency contact,
photograph, medical diagnosis.

## Who can read it

Access is enforced in `src/lib/data/access.ts`, not in the pages. Only members
of an operation (and the master account) can read its volunteers. A non-member
receives **404, not 403**, so the system does not confirm that an operation
exists.

`meal_checks` deliberately stores the dish text and the verdict, **never the
restriction data it was checked against**.

## What leaves the server

Nothing. There is no analytics, no advertising, no tracking, and no AI
integration in this build. The only outbound data is what an operator
deliberately exports (roster CSV, shopping CSV) or prints.

**Printing is the real leak surface.** A printed brief or roster leaves the
application's access control behind. Printed sheets carry a handling warning and
should be destroyed at demobilisation.

## Retention

Volunteer records are deleted `retentionDays` after the operation's end date
(default 30). The due date is **computed at run time** from the end date and the
current retention setting — never read from a stored column — so shortening the
retention period takes effect immediately.

```bash
npm run db:purge:dry   # report what would be deleted
npm run db:purge       # delete it
```

Deleting a volunteer cascades to their restrictions. A lead can also purge an
operation's volunteer data immediately from **Settings → Danger zone**, which
requires typing the operation name.

**Run the purge on a schedule.** On Railway, add a cron service running
`npm run db:purge` daily. Without it, the deletion promise made on the sign-in
form is not kept.

## Before a real deployment

- [ ] Have whoever is accountable for privacy at Team Rubicon Canada review
      `/privacy`. It describes what the software does; it is not legal advice.
- [ ] Schedule `npm run db:purge`.
- [ ] Confirm the hosting region meets your data-residency expectations.
- [ ] Delete any sample data (`SEED_DEMO` must be unset) before real volunteers
      sign in, so fictional and real records never sit side by side.
