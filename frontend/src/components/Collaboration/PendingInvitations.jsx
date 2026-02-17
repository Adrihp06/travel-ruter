import { useEffect, useState } from 'react';
import { Mail, Check, X, Users, AlertCircle } from 'lucide-react';
import useCollaborationStore from '../../stores/useCollaborationStore';

export default function PendingInvitations({ onAccepted }) {
  const { pendingInvitations, fetchPendingInvitations, acceptInvitation, rejectInvitation } =
    useCollaborationStore();
  const [processingIds, setProcessingIds] = useState(new Set());
  const [errorIds, setErrorIds] = useState(new Map());

  useEffect(() => {
    fetchPendingInvitations().catch(() => {});
  }, [fetchPendingInvitations]);

  const handleAccept = async (id) => {
    setProcessingIds((prev) => new Set(prev).add(id));
    setErrorIds((prev) => { const next = new Map(prev); next.delete(id); return next; });
    try {
      await acceptInvitation(id);
      await onAccepted?.();
    } catch (err) {
      setErrorIds((prev) => new Map(prev).set(id, err.message || 'Failed to accept'));
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
    setErrorIds((prev) => { const next = new Map(prev); next.delete(id); return next; });
    try {
      await rejectInvitation(id);
    } catch (err) {
      setErrorIds((prev) => new Map(prev).set(id, err.message || 'Failed to decline'));
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  if (pendingInvitations.length === 0) return null;

  return (
    <div className="mb-8 space-y-3 animate-fade-in">
      <h3 className="text-sm font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider flex items-center gap-2">
        <Mail className="w-4 h-4" />
        Pending Invitations
      </h3>

      {pendingInvitations.map((inv) => {
        const isProcessing = processingIds.has(inv.id);
        const error = errorIds.get(inv.id);

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
                {error && (
                  <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3 h-3" />
                    {error}
                  </p>
                )}
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
