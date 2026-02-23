/**
 * Conversation persistence — API-primary with localStorage fallback.
 *
 * All public functions are async and call the backend first.
 * On API failure the localStorage cache is used as fallback.
 */

import authFetch from './authFetch';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
const STORAGE_KEY = 'travel-ruter-conversations';
const MAX_CONVERSATIONS = 50;
const MAX_BACKEND_HISTORY = 20;

// ---------------------------------------------------------------------------
// localStorage helpers (internal cache)
// ---------------------------------------------------------------------------

function readStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        conversations: parsed.conversations || {},
        activeConversationIds: parsed.activeConversationIds || {},
      };
    }
  } catch {
    // Corrupted data — start fresh
  }
  return { conversations: {}, activeConversationIds: {} };
}

function writeStore(store) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    pruneOldest(store, 10);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch {
      // Give up silently
    }
  }
}

function pruneOldest(store, count) {
  const sorted = Object.values(store.conversations).sort(
    (a, b) => new Date(a.updatedAt) - new Date(b.updatedAt),
  );
  const toRemove = sorted.slice(0, count);
  for (const conv of toRemove) {
    delete store.conversations[conv.id];
    for (const [key, val] of Object.entries(store.activeConversationIds)) {
      if (val === conv.id) delete store.activeConversationIds[key];
    }
  }
}

function tripKey(tripId) {
  return tripId != null ? `trip_${tripId}` : '_new';
}

/** Write a conversation object into the localStorage cache. */
function saveLocal(conv) {
  if (!conv?.id) return;
  const store = readStore();
  store.conversations[conv.id] = conv;
  const total = Object.keys(store.conversations).length;
  if (total > MAX_CONVERSATIONS) {
    pruneOldest(store, total - MAX_CONVERSATIONS);
  }
  writeStore(store);
}

function loadLocal(id) {
  const store = readStore();
  return store.conversations[id] || null;
}

function listLocal(tripId) {
  const store = readStore();
  let list = Object.values(store.conversations);
  if (tripId !== undefined) {
    list = list.filter((c) =>
      tripId === null ? c.tripId == null : c.tripId === tripId,
    );
  }
  list.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  return list;
}

function deleteLocal(id) {
  const store = readStore();
  delete store.conversations[id];
  for (const [key, val] of Object.entries(store.activeConversationIds)) {
    if (val === id) delete store.activeConversationIds[key];
  }
  writeStore(store);
}

// ---------------------------------------------------------------------------
// Helpers shared by local and API paths
// ---------------------------------------------------------------------------

function cleanMessages(messages) {
  return (messages || [])
    .filter((m) => !m.isStreaming || m.content)
    .map(({ isStreaming, ...rest }) => rest);
}

function trimBackendHistory(backendHistory) {
  if (backendHistory?.length > MAX_BACKEND_HISTORY) {
    return backendHistory.slice(-MAX_BACKEND_HISTORY);
  }
  return backendHistory;
}

/** Map a backend API response to the shape used by the frontend / localStorage. */
function apiToLocal(apiConv) {
  return {
    id: apiConv.id,
    tripId: apiConv.trip_id ?? apiConv.tripId ?? null,
    title: apiConv.title,
    messages: apiConv.messages || [],
    backendHistory: apiConv.backend_history ?? apiConv.backendHistory ?? null,
    modelId: apiConv.model_id ?? apiConv.modelId ?? null,
    tripContext: apiConv.trip_context ?? apiConv.tripContext ?? null,
    destinationContext: apiConv.destination_context ?? apiConv.destinationContext ?? null,
    createdAt: apiConv.created_at ?? apiConv.createdAt,
    updatedAt: apiConv.updated_at ?? apiConv.updatedAt,
    messageCount: apiConv.message_count ?? apiConv.messageCount ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Public API (async, API-primary with localStorage fallback)
// ---------------------------------------------------------------------------

export function generateTitle(messages) {
  const first = messages.find((m) => m.role === 'user');
  if (!first?.content) return 'New Conversation';
  return first.content.length > 60
    ? first.content.slice(0, 57) + '...'
    : first.content;
}

/**
 * Save (create or update) a conversation.
 * Returns the saved conversation object with its DB id.
 */
export async function saveConversation({
  id = null,
  tripId = null,
  messages,
  backendHistory = null,
  modelId = null,
  tripContext = null,
  destinationContext = null,
}) {
  if (!messages?.length) return null;

  const cleaned = cleanMessages(messages);
  const trimmedHistory = trimBackendHistory(backendHistory);
  const title = generateTitle(cleaned);

  // Prepare API payload (snake_case)
  const payload = {
    trip_id: tripId,
    title,
    model_id: modelId,
    messages: cleaned,
    backend_history: trimmedHistory,
    trip_context: tripContext,
    destination_context: destinationContext,
  };

  try {
    const isUpdate = id != null && typeof id === 'number';
    const url = isUpdate
      ? `${API_URL}/conversations/${id}`
      : `${API_URL}/conversations`;
    const method = isUpdate ? 'PUT' : 'POST';

    const res = await authFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const apiConv = await res.json();
      const local = apiToLocal(apiConv);
      saveLocal(local);
      return local;
    }
    // API error — fall through to localStorage fallback
  } catch {
    // Network error — fall through to localStorage fallback
  }

  // Fallback: save to localStorage only (use existing id or a temp UUID)
  const fallbackId = id || `local_${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  const existing = loadLocal(fallbackId);
  const conv = {
    id: fallbackId,
    tripId,
    title,
    messages: cleaned,
    backendHistory: trimmedHistory,
    modelId,
    tripContext,
    destinationContext,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    messageCount: cleaned.length,
  };
  saveLocal(conv);
  return conv;
}

/**
 * Load a full conversation by ID.
 */
export async function loadConversation(id) {
  if (id == null) return null;

  // Only call API for numeric (DB) IDs
  if (typeof id === 'number') {
    try {
      const res = await authFetch(`${API_URL}/conversations/${id}`);
      if (res.ok) {
        const apiConv = await res.json();
        const local = apiToLocal(apiConv);
        saveLocal(local);
        return local;
      }
    } catch {
      // Fall through to localStorage
    }
  }

  return loadLocal(id);
}

/**
 * List conversations (summaries) for the given trip.
 */
export async function listConversations(tripId) {
  try {
    const params = new URLSearchParams();
    if (tripId != null) params.set('trip_id', tripId);

    const res = await authFetch(`${API_URL}/conversations?${params}`);
    if (res.ok) {
      const data = await res.json();
      return (data.conversations || []).map(apiToLocal);
    }
  } catch {
    // Fall through to localStorage
  }

  return listLocal(tripId);
}

/**
 * Delete a conversation.
 */
export async function deleteConversation(id) {
  // Always clean localStorage
  deleteLocal(id);

  if (typeof id === 'number') {
    try {
      await authFetch(`${API_URL}/conversations/${id}`, { method: 'DELETE' });
    } catch {
      // Non-critical — localStorage already cleaned
    }
  }
}

// ---------------------------------------------------------------------------
// Active conversation tracking (localStorage only — UI preference)
// ---------------------------------------------------------------------------

export function getActiveConversationId(tripId) {
  const store = readStore();
  return store.activeConversationIds[tripKey(tripId)] || null;
}

export function setActiveConversationId(tripId, conversationId) {
  const store = readStore();
  if (conversationId) {
    store.activeConversationIds[tripKey(tripId)] = conversationId;
  } else {
    delete store.activeConversationIds[tripKey(tripId)];
  }
  writeStore(store);
}
