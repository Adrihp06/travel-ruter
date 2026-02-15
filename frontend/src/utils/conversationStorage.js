/**
 * Conversation persistence via localStorage.
 *
 * Stores frontend messages and serialized PydanticAI backend history
 * so conversations survive page reloads and context switches.
 */

const STORAGE_KEY = 'travel-ruter-conversations';
const MAX_CONVERSATIONS = 50;
const MAX_BACKEND_HISTORY = 20;

// ---------------------------------------------------------------------------
// Internal helpers
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
    // localStorage full — prune and retry
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
    // Clean up activeConversationIds references
    for (const [key, val] of Object.entries(store.activeConversationIds)) {
      if (val === conv.id) delete store.activeConversationIds[key];
    }
  }
}

function tripKey(tripId) {
  return tripId != null ? `trip_${tripId}` : '_new';
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function generateTitle(messages) {
  const first = messages.find((m) => m.role === 'user');
  if (!first?.content) return 'New Conversation';
  return first.content.length > 60
    ? first.content.slice(0, 57) + '...'
    : first.content;
}

export function saveConversation({
  id,
  tripId = null,
  messages,
  backendHistory = null,
  modelId = null,
  tripContext = null,
  destinationContext = null,
}) {
  if (!id || !messages?.length) return;

  const store = readStore();

  // Strip transient fields from messages before persisting
  const cleaned = messages
    .filter((m) => !m.isStreaming || m.content)
    .map(({ isStreaming, ...rest }) => rest);

  // Truncate backend history to keep storage small
  const trimmedHistory = backendHistory?.length > MAX_BACKEND_HISTORY
    ? backendHistory.slice(-MAX_BACKEND_HISTORY)
    : backendHistory;

  const existing = store.conversations[id];
  const now = new Date().toISOString();

  store.conversations[id] = {
    id,
    tripId,
    title: generateTitle(cleaned),
    messages: cleaned,
    backendHistory: trimmedHistory,
    modelId,
    tripContext,
    destinationContext,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    messageCount: cleaned.length,
  };

  // Enforce capacity limit
  const total = Object.keys(store.conversations).length;
  if (total > MAX_CONVERSATIONS) {
    pruneOldest(store, total - MAX_CONVERSATIONS);
  }

  writeStore(store);
}

export function loadConversation(id) {
  const store = readStore();
  return store.conversations[id] || null;
}

export function listConversations(tripId) {
  const store = readStore();
  let list = Object.values(store.conversations);

  if (tripId !== undefined) {
    list = list.filter((c) =>
      tripId === null ? c.tripId == null : c.tripId === tripId,
    );
  }

  // Sort newest first
  list.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  return list;
}

export function deleteConversation(id) {
  const store = readStore();
  delete store.conversations[id];

  // Clean up active references
  for (const [key, val] of Object.entries(store.activeConversationIds)) {
    if (val === id) delete store.activeConversationIds[key];
  }

  writeStore(store);
}

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
