import { addOperationMember, removeOperationMember } from '@/lib/actions/admin';

export interface TeamMember {
  readonly userId: string;
  readonly username: string;
  readonly name: string;
  readonly role: 'lead' | 'assistant';
  readonly isSelf: boolean;
}

export interface Assignable {
  readonly id: string;
  readonly username: string;
  readonly name: string;
}

export function TeamPanel(
  { operationId, members, assignable, canManage }: {
    operationId: string;
    members: readonly TeamMember[];
    assignable: readonly Assignable[];
    canManage: boolean;
  },
): React.ReactNode {
  return (
    <div className="space-y-4">
      <ul className="divide-y divide-tr-line">
        {members.map((m) => (
          <li key={m.userId} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <span className="text-sm">
              <span className="font-medium text-tr-white">{m.name}</span>
              <span className="ml-2 font-mono text-xs text-tr-grey">{m.username}</span>
              <span className="ml-2 chip chip-preference">{m.role}</span>
            </span>
            {canManage && !m.isSelf && (
              <form action={removeOperationMember}>
                <input type="hidden" name="operationId" value={operationId} />
                <input type="hidden" name="userId" value={m.userId} />
                <button type="submit" className="btn-secondary px-2 py-1 text-xs">Remove</button>
              </form>
            )}
          </li>
        ))}
        {members.length === 0 && (
          <li className="py-2 text-sm text-tr-grey">Nobody assigned yet.</li>
        )}
      </ul>

      {canManage && (
        assignable.length === 0 ? (
          <p className="text-sm text-tr-grey">
            Every account is already on this operation. Create more from <strong>Accounts</strong>.
          </p>
        ) : (
          <form action={addOperationMember} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="operationId" value={operationId} />
            <label className="text-sm"><span className="label">Add someone</span>
              <select name="userId" className="input w-auto" required defaultValue="">
                <option value="" disabled>Choose an account…</option>
                {assignable.map((u) => (
                  <option key={u.id} value={u.id}>{u.name} ({u.username})</option>
                ))}
              </select></label>
            <label className="text-sm"><span className="label">Role</span>
              <select name="role" className="input w-auto" defaultValue="assistant">
                <option value="lead">lead</option>
                <option value="assistant">assistant</option>
              </select></label>
            <button type="submit" className="btn-primary">Assign</button>
          </form>
        )
      )}

      <p className="text-xs text-tr-grey">
        Only people listed here can see this operation&apos;s roster, restrictions and auto-injector
        locations. Leads can assign others; the master account can always reach every operation.
      </p>
    </div>
  );
}
