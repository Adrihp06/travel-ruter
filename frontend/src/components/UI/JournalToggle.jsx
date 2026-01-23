import React from 'react';
import { BookOpen } from 'lucide-react';

const JournalToggle = ({ onClick, noteCount = 0 }) => {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors"
      title="Open Journal"
    >
      <BookOpen className="w-5 h-5" />
      <span className="text-sm font-medium">Journal</span>
      {noteCount > 0 && (
        <span className="bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 text-xs px-1.5 py-0.5 rounded-full">
          {noteCount}
        </span>
      )}
    </button>
  );
};

export default JournalToggle;
