import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import useCollaborationStore from '../../stores/useCollaborationStore';
import useAuthStore from '../../stores/useAuthStore';
import { useToast } from '../common/Toast';
import ConfirmDialog from '../common/ConfirmDialog';

export default function TripMemberList({ tripId }) {
  const { t } = useTranslation();
  const { members, isLoading, fetchMembers, removeMember } = useCollaborationStore();
  const currentUser = useAuthStore((s) => s.user);
  const { toast } = useToast();
  const [removingId, setRemovingId] = useState(null);
  const [memberToRemove, setMemberToRemove] = useState(null);

  useEffect(() => {
    if (tripId) fetchMembers(tripId);
  }, [tripId, fetchMembers]);

  const isCurrentUserOwner = members.some(
    (m) => m.user_id === currentUser?.id && m.role === 'owner'
  );

  const handleRemoveClick = (member) => {
    setMemberToRemove(member);
  };

  const handleConfirmRemove = async () => {
    if (!memberToRemove) return;
    const userId = memberToRemove.user_id;
    const name = memberToRemove.user_name || memberToRemove.user_email;
    setRemovingId(userId);
    try {
      await removeMember(tripId, userId);
      toast.success(t('collaboration.memberRemoved', { name }));
    } catch (err) {
      toast.error(err.message || t('collaboration.failedRemove'));
    } finally {
      setRemovingId(null);
      setMemberToRemove(null);
    }
  };

  if (isLoading) {
    return <div className="animate-pulse h-20 bg-gray-100 dark:bg-gray-800 rounded" />;
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
        {t('collaboration.members')}
      </h3>
      <div className="space-y-1">
        {members.map((member) => {
          const isOwnerRow = member.role === 'owner';
          const isSelf = member.user_id === currentUser?.id;
          const canRemove = isCurrentUserOwner && !isOwnerRow && !isSelf;

          return (
            <div
              key={member.id}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800"
            >
              {member.user_avatar ? (
                <img
                  src={member.user_avatar}
                  alt={member.user_name || ''}
                  className="h-6 w-6 rounded-full"
                />
              ) : (
                <div className="h-6 w-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs">
                  {(member.user_name || member.user_email || '?')[0].toUpperCase()}
                </div>
              )}
              <span className="text-sm text-gray-900 dark:text-gray-100 flex-1 truncate">
                {member.user_name || member.user_email}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                {t(`collaboration.${member.role}`)}
              </span>
              {member.status === 'pending' && (
                <span className="text-xs text-yellow-600 dark:text-yellow-400">
                  {t('collaboration.pending')}
                </span>
              )}
              {canRemove && (
                <button
                  onClick={() => handleRemoveClick(member)}
                  disabled={removingId === member.user_id}
                  className="p-1 text-gray-400 hover:text-red-500 dark:hover:text-red-400 disabled:opacity-50 transition-colors"
                  title={t('collaboration.removeMember')}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      <ConfirmDialog
        isOpen={!!memberToRemove}
        onConfirm={handleConfirmRemove}
        onCancel={() => setMemberToRemove(null)}
        title={t('collaboration.removeMember')}
        message={t('collaboration.confirmRemoveMessage', {
          name: memberToRemove?.user_name || memberToRemove?.user_email || '',
        })}
        variant="danger"
        isLoading={removingId !== null}
      />
    </div>
  );
}
