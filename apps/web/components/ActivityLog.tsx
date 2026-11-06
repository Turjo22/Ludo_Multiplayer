'use client';

import React, { useEffect, useRef } from 'react';
import type { GameActivityEntry, PlayerColor } from '@ludo/shared-types';

interface ActivityLogProps {
  entries: GameActivityEntry[];
}

const BADGE_COLORS: Record<PlayerColor, string> = {
  RED: 'text-red-400 bg-red-950/60 border-red-800/40',
  GREEN: 'text-emerald-400 bg-emerald-950/60 border-emerald-800/40',
  YELLOW: 'text-amber-400 bg-amber-950/60 border-amber-800/40',
  BLUE: 'text-blue-400 bg-blue-950/60 border-blue-800/40',
};

export const ActivityLog: React.FC<ActivityLogProps> = ({ entries }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [entries]);

  return (
    <div className="flex flex-col h-44 sm:h-52 w-full bg-slate-900/80 backdrop-blur-md rounded-2xl border border-slate-800 p-3 shadow-inner">
      <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between border-b border-slate-800 pb-1.5">
        <span>Match Activity</span>
        <span className="text-[10px] text-slate-500 font-normal">Real-time</span>
      </div>

      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto space-y-1.5 pr-1 text-xs select-text"
      >
        {entries.length === 0 ? (
          <div className="text-slate-500 italic py-4 text-center">No activity recorded yet</div>
        ) : (
          entries.map((item) => {
            const timeStr = new Date(item.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            });

            const badgeStyle = item.color
              ? BADGE_COLORS[item.color]
              : 'text-slate-400 bg-slate-800 border-slate-700';

            return (
              <div
                key={item.id}
                className="flex items-start gap-2 py-1 border-b border-slate-800/40 last:border-none"
              >
                <span className="text-[10px] text-slate-500 font-mono shrink-0 mt-0.5">
                  {timeStr}
                </span>
                <span
                  className={`px-1.5 py-0.2 rounded text-[10px] font-semibold uppercase border shrink-0 ${badgeStyle}`}
                >
                  {item.type}
                </span>
                <span className="text-slate-200 leading-tight">{item.text}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
