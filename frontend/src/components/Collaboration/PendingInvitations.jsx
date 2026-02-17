import { useEffect, useState } from 'react';
import { Mail, Check, X, Users } from 'lucide-react';
import useCollaborationStore from '../../stores/useCollaborationStore';

export default function PendingInvitations({ onAccepted }) {
  const { pendingInvitations, fetchPendingInvitations, acceptInvitation, rejectInvitation } =
    useCollaborationStore();
  const [processingIds, setProcessingIds] = useState(new Set());
  const [dismissedIds, setDismissedIds] = useState(new Set());

  useEffect(() => {
    fetchPendingInvitations().catch(() => {});
  }, [fetchPendingInvitations]);

  const handleAccept = async (id) => {
    setProcessingIds((prev) => new Set(prev).add(id));
    try {
      await acceptInvitation(id);
      setDismissedIds((prev) => new Set(prev).add(id));
      onAccepted?.();
    } catch {
      // keep visible on error
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleReject = async (id) => {
    setProcessingIds((prev) => new Set(prev).add(id));
    try {
      await rejectInvitation(id);
      setDismissedIds((prev) => new Set(prev).add(id));
    } catch {
      // keep visible on error
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const visible = pendingInvitations.filter((inv) => !dismissedIds.has(inv.id));

  if (visible.length === 0) return null;

  return (
    <div className="mb-8 space-y-3 animate-fade-in">
      <h3 className="text-sm font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider flex items-center gap-2">
        <Mail className="w-4 h-4" />
        Pending Invitations
      </h3>

      {visible.map((inv) => {
        const isProcessing = processingIds.has(inv.id);

        return (
          <div
            key={inv.id}
            className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 bg-white dark:bg-stone-800 border border-amber-200 dark:border-amber-800/50 rounded-xl p-4 shadow-sm"
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                <Users className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-stone-900 dark:text-stone-100 truncate">
                  {inv.trip_name}
                </p>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  {inv.invited_by_name ? `Invited by ${inv.invited_by_name}` : 'You were invited'}
                  {' \u00b7 '}
                  <span className="capitalize">{inv.role}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => handleAccept(inv.id)}
                disabled={isProcessing}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors"
              >
                <Check className="w-3.5 h-3.5" />
                Accept
              </button>
              <button
                onClick={() => handleReject(inv.id)}
                disabled={isProcessing}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-200 hover:bg-stone-300 dark:bg-stone-700 dark:hover:bg-stone-600 disabled:opacity-50 text-stone-700 dark:text-stone-300 text-xs font-medium rounded-lg transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                Decline
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
