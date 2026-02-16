import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import authFetch from '../../utils/authFetch';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

const SERVICES = [
  { name: 'mapbox', label: 'Mapbox' },
  { name: 'openrouteservice', label: 'OpenRouteService' },
  { name: 'google_maps', label: 'Google Maps' },
  { name: 'perplexity', label: 'Perplexity' },
  { name: 'anthropic', label: 'Anthropic (Claude)' },
  { name: 'openai', label: 'OpenAI' },
  { name: 'google_ai', label: 'Google AI (Gemini)' },
];

export default function ApiKeySettings({ tripId }) {
  const { t } = useTranslation();
  const [keys, setKeys] = useState([]);
  const [newKey, setNewKey] = useState({ service: '', key: '' });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const fetchKeys = async () => {
    try {
      const resp = await authFetch(`${API_BASE}/trips/${tripId}/api-keys`);
      if (resp.ok) setKeys(await resp.json());
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (tripId) fetchKeys();
  }, [tripId]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!newKey.service || !newKey.key) return;
    setLoading(true);
    try {
      const resp = await authFetch(`${API_BASE}/trips/${tripId}/api-keys/${newKey.service}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: newKey.key }),
      });
      if (resp.ok) {
        setMessage(t('apiKeys.saved'));
        setNewKey({ service: '', key: '' });
        fetchKeys();
        setTimeout(() => setMessage(''), 3000);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (service) => {
    await authFetch(`${API_BASE}/trips/${tripId}/api-keys/${service}`, {
      method: 'DELETE',
    });
    fetchKeys();
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('apiKeys.title')}</h3>

      {keys.length > 0 && (
        <div className="space-y-2">
          {keys.map((k) => (
            <div key={k.service_name} className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div>
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{k.service_name}</span>
                <span className="ml-2 text-xs text-gray-500 font-mono">{k.masked_key}</span>
              </div>
              <button
                onClick={() => handleDelete(k.service_name)}
                className="text-xs text-red-600 hover:text-red-700"
              >
                {t('apiKeys.delete')}
              </button>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleSave} className="flex gap-2">
        <select
          value={newKey.service}
          onChange={(e) => setNewKey({ ...newKey, service: e.target.value })}
          className="px-3 py-1.5 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
        >
          <option value="">{t('apiKeys.service')}</option>
          {SERVICES.map((s) => (
            <option key={s.name} value={s.name}>{s.label}</option>
          ))}
        </select>
        <input
          type="password"
          value={newKey.key}
          onChange={(e) => setNewKey({ ...newKey, key: e.target.value })}
          placeholder="API Key"
          className="flex-1 px-3 py-1.5 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
        />
        <button
          type="submit"
          disabled={loading}
          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {t('apiKeys.addKey')}
        </button>
      </form>
      {message && <p className="text-sm text-green-600">{message}</p>}
    </div>
  );
}
