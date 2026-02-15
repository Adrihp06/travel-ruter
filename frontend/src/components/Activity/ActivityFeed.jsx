import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useAuthStore from '../../stores/useAuthStore';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export default function ActivityFeed({ tripId }) {
  const { t } = useTranslation();
  const getToken = useAuthStore((s) => s.getToken);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tripId) return;
    const fetchActivity = async () => {
      try {
        const token = getToken();
        const resp = await fetch(`${API_BASE}/trips/${tripId}/activity?limit=20`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (resp.ok) {
          const data = await resp.json();
          setActivities(data.activities);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    fetchActivity();
  }, [tripId, getToken]);

  if (loading) return <div className="animate-pulse h-32 bg-gray-100 dark:bg-gray-800 rounded" />;

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
        {t('activity.title')}
      </h3>
      {activities.length === 0 ? (
        <p className="text-sm text-gray-500">{t('activity.noActivity')}</p>
      ) : (
        <div className="space-y-2">
          {activities.map((a) => (
            <div key={a.id} className="flex items-start gap-2 text-sm">
              <div className="h-1.5 w-1.5 rounded-full bg-blue-400 mt-1.5 flex-shrink-0" />
              <div>
                <span className="text-gray-900 dark:text-gray-100">
                  {a.user_name || 'Someone'}{' '}
                  <span className="text-gray-500">{t(`activity.${a.action}`, a.action)}</span>{' '}
                  {a.entity_name || a.entity_type}
                </span>
                <p className="text-xs text-gray-400">
                  {new Date(a.created_at).toLocaleString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
