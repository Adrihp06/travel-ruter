import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Copy, Check, Terminal, Monitor } from 'lucide-react';
import authFetch from '../../utils/authFetch';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

const CopyButton = ({ text, isCopied, onCopy }) => (
  <button
    onClick={() => onCopy(text)}
    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
  >
    {isCopied ? (
      <>
        <Check className="w-3.5 h-3.5 text-green-500" />
        <span className="text-green-600 dark:text-green-400">Copied</span>
      </>
    ) : (
      <>
        <Copy className="w-3.5 h-3.5" />
        <span>Copy</span>
      </>
    )}
  </button>
);

const InstructionBlock = ({ icon: Icon, title, description, content, textColor, isCopied, onCopy }) => (
  <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700">
    <div className="flex items-center gap-2 mb-4">
      <Icon className="w-5 h-5 text-gray-700 dark:text-gray-300" />
      <h3 className="text-base font-semibold text-gray-900 dark:text-white">
        {title}
      </h3>
    </div>
    <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
      {description}
    </p>
    <div className="flex items-start gap-2">
      <pre className={`flex-1 p-3 rounded-lg bg-gray-900 ${textColor} text-xs font-mono overflow-x-auto whitespace-pre-wrap`}>
        {content}
      </pre>
      <CopyButton text={content} isCopied={isCopied} onCopy={onCopy} />
    </div>
  </div>
);

const MCP_TOOLS = [
  { name: 'manage_trip', desc: 'Create, read, update, delete trips' },
  { name: 'manage_destination', desc: 'CRUD for trip destinations' },
  { name: 'manage_poi', desc: 'CRUD for points of interest' },
  { name: 'manage_accommodation', desc: 'CRUD for hotels & stays' },
  { name: 'manage_note', desc: 'CRUD for travel notes' },
  { name: 'search_destinations', desc: 'Geocode locations' },
  { name: 'get_poi_suggestions', desc: 'Discover attractions & restaurants' },
  { name: 'calculate_route', desc: 'Directions between points' },
  { name: 'get_travel_matrix', desc: 'Multi-point travel times' },
  { name: 'calculate_budget', desc: 'Trip budget analysis' },
  { name: 'generate_smart_schedule', desc: 'Auto-schedule POIs' },
  { name: 'schedule_pois', desc: 'Bulk-apply POI schedules' },
];

const ClaudeCodeSection = () => {
  const [tokenData, setTokenData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expiryDays, setExpiryDays] = useState(30);
  const [copied, setCopied] = useState({});
  const timersRef = useRef({});

  useEffect(() => {
    const timers = timersRef.current;
    return () => Object.values(timers).forEach(clearTimeout);
  }, []);

  const desktopConfigString = useMemo(
    () => tokenData ? JSON.stringify(tokenData.claude_desktop_config, null, 2) : '',
    [tokenData]
  );

  const generateToken = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(
        `${API_BASE}/mcp-access/token?expiry_days=${expiryDays}`,
        { method: 'POST' }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Error ${res.status}`);
      }
      const data = await res.json();
      setTokenData(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text, key) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied((prev) => ({ ...prev, [key]: true }));
      clearTimeout(timersRef.current[key]);
      timersRef.current[key] = setTimeout(
        () => setCopied((prev) => ({ ...prev, [key]: false })),
        2000
      );
    } catch {
      // fallback
    }
  };

  return (
    <div className="space-y-6">
      {/* Explanation */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
          How it works
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
          Generate a personal MCP token to connect your Claude Desktop or Claude Code
          directly to Travel Ruter's planning tools. Your own Claude subscription
          handles the AI, while Travel Ruter provides the trip data and APIs. This
          means you can plan trips in Claude with full access to your destinations,
          POIs, budgets, and schedules.
        </p>
      </div>

      {/* Token Generation */}
      <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
          Generate Token
        </h3>

        <div className="flex items-end gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Token validity
            </label>
            <select
              value={expiryDays}
              onChange={(e) => setExpiryDays(Number(e.target.value))}
              className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            >
              <option value={7}>7 days</option>
              <option value={30}>30 days</option>
              <option value={60}>60 days</option>
              <option value={90}>90 days</option>
            </select>
          </div>
          <button
            onClick={generateToken}
            disabled={loading}
            className="px-5 py-2 rounded-lg bg-gradient-to-r from-[#D97706] to-[#EA580C] text-white font-medium text-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {loading ? 'Generating...' : 'Generate MCP Token'}
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm mb-4">
            {error}
          </div>
        )}

        {tokenData && (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Your MCP Token
            </label>
            <div className="flex items-center gap-2">
              <code className="flex-1 p-3 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-xs font-mono text-gray-800 dark:text-gray-200 break-all">
                {tokenData.token}
              </code>
              <CopyButton
                text={tokenData.token}
                isCopied={copied['token']}
                onCopy={(text) => copyToClipboard(text, 'token')}
              />
            </div>
            {tokenData.expires_at && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Expires: {new Date(tokenData.expires_at).toLocaleDateString()}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Connection Instructions */}
      {tokenData && (
        <>
          <InstructionBlock
            icon={Terminal}
            title="Claude Code"
            description="Run this command in your terminal:"
            content={tokenData.claude_code_command}
            textColor="text-green-400"
            isCopied={copied['claude-code']}
            onCopy={(text) => copyToClipboard(text, 'claude-code')}
          />
          <InstructionBlock
            icon={Monitor}
            title="Claude Desktop"
            description={<>Add this to your Claude Desktop config (<code className="text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">claude_desktop_config.json</code>):</>}
            content={desktopConfigString}
            textColor="text-blue-300"
            isCopied={copied['claude-desktop']}
            onCopy={(text) => copyToClipboard(text, 'claude-desktop')}
          />
        </>
      )}

      {/* Available Tools */}
      <div>
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
          Available Tools
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {MCP_TOOLS.map((tool) => (
            <div
              key={tool.name}
              className="flex items-start gap-2 p-3 rounded-lg bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700"
            >
              <code className="text-xs font-mono font-semibold text-amber-600 dark:text-amber-400 shrink-0">
                {tool.name}
              </code>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {tool.desc}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ClaudeCodeSection;
