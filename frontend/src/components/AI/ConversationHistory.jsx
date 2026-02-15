import React from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, MessageSquare } from 'lucide-react';
import useAIStore from '../../stores/useAIStore';

const ConversationHistory = () => {
  const { t } = useTranslation();
  const {
    conversations,
    conversationId,
    loadConversation,
    startNewConversation,
    removeConversation,
    isLoading,
  } = useAIStore();

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/30">
      <div className="px-4 py-3">
        {/* New conversation button */}
        <button
          onClick={startNewConversation}
          disabled={isLoading}
          className="w-full flex items-center gap-2 px-3 py-2 mb-2 text-sm font-medium text-[#D97706] bg-[#D97706]/10 hover:bg-[#D97706]/20 rounded-lg transition-colors disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          {t('ai.newConversation')}
        </button>

        {/* Conversation list */}
        <div className="max-h-[264px] overflow-y-auto space-y-1">
          {conversations.length === 0 ? (
            <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-3">
              {t('ai.noConversations')}
            </p>
          ) : (
            conversations.map((conv) => {
              const isActive = conv.id === conversationId;
              return (
                <div
                  key={conv.id}
                  className={`group flex items-start gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                    isActive
                      ? 'bg-[#D97706]/10 ring-1 ring-[#D97706]/40'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700/50'
                  }`}
                  onClick={() => !isActive && !isLoading && loadConversation(conv.id)}
                >
                  <MessageSquare className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                    isActive ? 'text-[#D97706]' : 'text-gray-400'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm truncate ${
                      isActive
                        ? 'font-medium text-[#D97706]'
                        : 'text-gray-700 dark:text-gray-300'
                    }`}>
                      {conv.title}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                      {t('ai.messagesCount', { count: conv.messageCount })} · {formatDate(conv.updatedAt)}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeConversation(conv.id);
                    }}
                    className="p-1 opacity-0 group-hover:opacity-100 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-all"
                    title={t('ai.deleteConversation')}
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-500" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default ConversationHistory;
