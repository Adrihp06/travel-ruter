import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import useCollaborationStore from '../../stores/useCollaborationStore';
import { useToast } from '../common/Toast';

export default function InviteMemberModal({ tripId, isOpen, onClose }) {
  const { t } = useTranslation();
  const inviteMember = useCollaborationStore((s) => s.inviteMember);
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('viewer');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await inviteMember(tripId, email, role);
      toast.success(t('collaboration.inviteSent'));
      setEmail('');
      setRole('viewer');
      onClose();
    } catch (err) {
      toast.error(err.message || t('collaboration.failedInvite'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 w-full max-w-md">
        <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
          {t('collaboration.inviteMember')}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('collaboration.emailPlaceholder')}
              required
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('collaboration.role')}
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              <option value="viewer">{t('collaboration.viewer')}</option>
              <option value="editor">{t('collaboration.editor')}</option>
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? '...' : t('collaboration.invite')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
