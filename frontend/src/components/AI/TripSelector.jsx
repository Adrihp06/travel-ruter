/**
 * TripSelector - Claude-style trip selection component
 * Shows list of existing trips or option to start fresh
 */

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MapPin, Plus, Calendar, Clock, MessageSquare, Trash2, ArrowLeft } from 'lucide-react';
import RightChevron from '@/components/icons/right-chevron';
import AirplaneIcon from '@/components/icons/airplane-icon';
import SparklesIcon from '@/components/icons/sparkles-icon';
import GlobeIcon from '@/components/icons/globe-icon';
import useTripStore from '../../stores/useTripStore';
import useAIStore from '../../stores/useAIStore';
import { listConversations } from '../../utils/conversationStorage';

const TripSelector = () => {
  const { t } = useTranslation();
  const { tripsWithDestinations, fetchTripsSummary, isLoading } = useTripStore();
  const { selectTripForChat, startNewTripChat, agentConfig, loadConversationFromHistory, removeConversation } = useAIStore();
  const [showChatHistory, setShowChatHistory] = useState(false);
  const [allConversations, setAllConversations] = useState([]);

  // Fetch trips on mount
  useEffect(() => {
    if (tripsWithDestinations.length === 0) {
      fetchTripsSummary();
    }
  }, [tripsWithDestinations.length, fetchTripsSummary]);

  const handleSelectTrip = (trip) => {
    selectTripForChat(trip.id, {
      id: trip.id,
      name: trip.name || trip.title,
      startDate: trip.start_date,
      endDate: trip.end_date,
      destinations: trip.destinations?.map(d => ({
        id: d.id,
        name: d.city_name || d.name,
        country: d.country,
      })) || [],
      budget: trip.total_budget,
      currency: trip.currency,
    });
  };

  const formatDateRange = (startDate, endDate) => {
    if (!startDate) return t('ai.noDatesSet');
    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : null;

    const options = { month: 'short', day: 'numeric' };
    const startStr = start.toLocaleDateString(undefined, options);

    if (!end) return startStr;

    if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
      return `${startStr} - ${end.getDate()}`;
    }

    return `${startStr} - ${end.toLocaleDateString(undefined, options)}`;
  };

  // Get days until trip starts
  const getDaysUntil = (startDate) => {
    if (!startDate) return null;
    const start = new Date(startDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    start.setHours(0, 0, 0, 0);
    const diff = Math.ceil((start - today) / (1000 * 60 * 60 * 24));
    if (diff < 0) return t('ai.past');
    if (diff === 0) return t('ai.today');
    if (diff === 1) return t('ai.tomorrow');
    if (diff <= 7) return t('ai.daysAway', { count: diff });
    return null;
  };

  const handleShowHistory = () => {
    const convs = listConversations();
    setAllConversations(convs);
    setShowChatHistory(true);
  };

  const handleSelectConversation = (conv) => {
    loadConversationFromHistory(conv.id);
  };

  const handleDeleteConversation = (e, conv) => {
    e.stopPropagation();
    removeConversation(conv.id);
    setAllConversations((prev) => prev.filter((c) => c.id !== conv.id));
  };

  const formatTimeAgo = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return t('ai.justNow');
    if (diffMins < 60) return t('ai.minutesAgo', { count: diffMins });
    if (diffHours < 24) return t('ai.hoursAgo', { count: diffHours });
    if (diffDays < 7) return t('ai.daysAgo', { count: diffDays });
    return date.toLocaleDateString();
  };

  // Chat History View
  if (showChatHistory) {
    return (
      <div className="h-full flex flex-col">
        {/* History Header */}
        <div className="px-4 pt-4 pb-3">
          <button
            onClick={() => setShowChatHistory(false)}
            className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors mb-3"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('common.back')}
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#D97706]/10 flex items-center justify-center">
              <Clock className="w-5 h-5 text-[#D97706]" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                {t('ai.chatHistory')}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t('ai.allConversations')}
              </p>
            </div>
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {allConversations.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4">
                <MessageSquare className="w-8 h-8 text-gray-300 dark:text-gray-600" />
              </div>
              <p className="font-medium text-gray-600 dark:text-gray-300">{t('ai.noConversations')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {allConversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => handleSelectConversation(conv)}
                  className="w-full group flex items-start gap-3 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:border-[#D97706]/50 dark:hover:border-[#D97706]/50 hover:shadow-md transition-all text-left"
                >
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600 flex items-center justify-center flex-shrink-0">
                    <MessageSquare className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {conv.title}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {t('ai.messagesCount', { count: conv.messageCount })}
                      </span>
                      <span className="text-gray-300 dark:text-gray-600">·</span>
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        {formatTimeAgo(conv.updatedAt)}
                      </span>
                    </div>
                    {conv.tripId && conv.tripContext?.name && (
                      <div className="flex items-center gap-1 mt-1">
                        <MapPin className="w-3 h-3 text-[#D97706]" />
                        <span className="text-[11px] text-[#D97706]">{conv.tripContext.name}</span>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={(e) => handleDeleteConversation(e, conv)}
                    className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-all flex-shrink-0"
                    title={t('ai.deleteConversation')}
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-500" />
                  </button>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="text-center px-6 pt-6 pb-4">
        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#D97706] to-[#EA580C] flex items-center justify-center mx-auto mb-3 shadow-lg shadow-orange-500/20">
          <SparklesIcon className="w-7 h-7 text-white" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {agentConfig.name || t('ai.travelAssistant')}
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {t('ai.chooseTrip')}
        </p>
      </div>

      {/* New Trip Option */}
      <div className="px-4 pb-3">
        <button
          onClick={startNewTripChat}
          className="w-full flex items-center p-4 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 border-2 border-dashed border-[#D97706]/40 dark:border-[#D97706]/30 rounded-xl hover:border-[#D97706] dark:hover:border-[#D97706] hover:shadow-lg hover:shadow-orange-500/10 transition-all group"
        >
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#D97706] to-[#EA580C] flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform shadow-md">
            <Plus className="w-6 h-6 text-white" />
          </div>
          <div className="ml-4 text-left flex-1">
            <p className="font-semibold text-gray-900 dark:text-white">{t('ai.planNewTrip')}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('ai.startFresh')}</p>
          </div>
          <RightChevron className="w-5 h-5 text-gray-400 group-hover:text-[#D97706] group-hover:translate-x-0.5 transition-all" />
        </button>
      </div>

      {/* Chat History Button */}
      <div className="px-4 pb-3">
        <button
          onClick={handleShowHistory}
          className="w-full flex items-center p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:border-[#D97706]/50 dark:hover:border-[#D97706]/50 hover:shadow-md transition-all group"
        >
          <div className="w-10 h-10 rounded-lg bg-[#D97706]/10 flex items-center justify-center flex-shrink-0 group-hover:bg-[#D97706]/20 transition-colors">
            <Clock className="w-5 h-5 text-[#D97706]" />
          </div>
          <div className="ml-3 text-left flex-1">
            <p className="font-medium text-gray-900 dark:text-white text-sm">{t('ai.chatHistory')}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{t('ai.viewPastConversations')}</p>
          </div>
          <RightChevron className="w-5 h-5 text-gray-300 dark:text-gray-600 group-hover:text-[#D97706] group-hover:translate-x-0.5 transition-all flex-shrink-0" />
        </button>
      </div>

      {/* Divider */}
      <div className="px-4 py-2">
        <div className="flex items-center">
          <div className="flex-1 border-t border-gray-200 dark:border-gray-700" />
          <span className="px-3 text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider font-medium">
            {t('ai.orContinuePlanning')}
          </span>
          <div className="flex-1 border-t border-gray-200 dark:border-gray-700" />
        </div>
      </div>

      {/* Trip List */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-8 h-8 border-2 border-[#D97706] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : tripsWithDestinations.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4">
              <GlobeIcon className="w-8 h-8 text-gray-300 dark:text-gray-600" />
            </div>
            <p className="font-medium text-gray-600 dark:text-gray-300">{t('ai.noTripsYet')}</p>
            <p className="text-sm mt-1">{t('ai.startByPlanning')}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {tripsWithDestinations.slice(0, 10).map((trip) => {
              const daysUntil = getDaysUntil(trip.start_date);

              return (
                <button
                  key={trip.id}
                  onClick={() => handleSelectTrip(trip)}
                  className="w-full flex items-center p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:border-[#D97706]/50 dark:hover:border-[#D97706]/50 hover:shadow-md transition-all group"
                >
                  {/* Trip Image/Icon */}
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {trip.cover_image ? (
                      <img
                        src={trip.cover_image}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <MapPin className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                    )}
                  </div>

                  {/* Trip Info */}
                  <div className="ml-3 text-left flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900 dark:text-white truncate">
                        {trip.name || trip.title || t('ai.untitledTrip')}
                      </p>
                      {daysUntil && (
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                          daysUntil === 'Past'
                            ? 'bg-gray-100 dark:bg-gray-700 text-gray-500'
                            : daysUntil === 'Today' || daysUntil === 'Tomorrow'
                            ? 'bg-[#D97706]/10 text-[#D97706]'
                            : 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                        }`}>
                          {daysUntil}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      <Calendar className="w-3 h-3 mr-1" />
                      <span>{formatDateRange(trip.start_date, trip.end_date)}</span>
                      {trip.destinations?.length > 0 && (
                        <>
                          <span className="mx-1.5">·</span>
                          <MapPin className="w-3 h-3 mr-0.5" />
                          <span>{trip.destinations.length} {trip.destinations.length === 1 ? t('ai.stop') : t('ai.stops')}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <RightChevron className="w-5 h-5 text-gray-300 dark:text-gray-600 group-hover:text-[#D97706] group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default TripSelector;
