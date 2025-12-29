import React, { useMemo } from 'react';
import { LogEntry } from '../types';

interface CalendarHeatmapProps {
  logs: LogEntry[];
}

export const CalendarHeatmap: React.FC<CalendarHeatmapProps> = ({ logs }) => {
  const heatmapData = useMemo(() => {
    const today = new Date();
    const daysToShow = 140; // Approx 20 weeks
    const data: Record<string, number> = {};
    
    // Aggregate logs by date
    logs.forEach(log => {
      const dateKey = new Date(log.timestamp).toLocaleDateString();
      data[dateKey] = (data[dateKey] || 0) + 1;
    });

    const weeks: { date: Date; count: number }[][] = [];
    let currentWeek: { date: Date; count: number }[] = [];

    // Start from the Sunday of the week containing (today - daysToShow)
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - daysToShow);
    const dayOfWeek = startDate.getDay();
    startDate.setDate(startDate.getDate() - dayOfWeek);

    for (let i = 0; i <= daysToShow + dayOfWeek; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      const dateKey = date.toLocaleDateString();
      
      currentWeek.push({
        date,
        count: data[dateKey] || 0
      });

      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    }
    if (currentWeek.length > 0) weeks.push(currentWeek);

    return weeks;
  }, [logs]);

  const getColorClass = (count: number) => {
    if (count === 0) return 'bg-slate-100';
    if (count === 1) return 'bg-indigo-200';
    if (count === 2) return 'bg-indigo-400';
    if (count >= 3) return 'bg-indigo-600';
    return 'bg-slate-100';
  };

  const monthLabels = useMemo(() => {
    const labels: { label: string; index: number }[] = [];
    let lastMonth = -1;
    heatmapData.forEach((week, i) => {
      const month = week[0].date.getMonth();
      if (month !== lastMonth) {
        labels.push({
          label: week[0].date.toLocaleString('default', { month: 'short' }),
          index: i
        });
        lastMonth = month;
      }
    });
    return labels;
  }, [heatmapData]);

  return (
    <div className="w-full overflow-x-auto pb-2">
      <div className="inline-block min-w-full">
        <div className="flex gap-1 mb-1">
          {monthLabels.map((m, i) => (
            <div 
              key={i} 
              className="text-[10px] text-slate-400 font-medium"
              style={{ marginLeft: i === 0 ? '0' : `${(m.index - monthLabels[i-1].index) * 14 - 20}px` }}
            >
              {m.label}
            </div>
          ))}
        </div>
        <div className="flex gap-1">
          {/* Day labels */}
          <div className="flex flex-col gap-1 pr-2 justify-between py-1">
            <span className="text-[10px] text-slate-300">Mon</span>
            <span className="text-[10px] text-slate-300">Wed</span>
            <span className="text-[10px] text-slate-300">Fri</span>
          </div>
          {/* Grid */}
          <div className="flex gap-1">
            {heatmapData.map((week, weekIdx) => (
              <div key={weekIdx} className="flex flex-col gap-1">
                {week.map((day, dayIdx) => (
                  <div
                    key={dayIdx}
                    title={`${day.date.toLocaleDateString()}: ${day.count} entries`}
                    className={`w-3 h-3 rounded-[2px] transition-colors ${getColorClass(day.count)} hover:ring-2 hover:ring-indigo-300 cursor-help`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
        <div className="mt-4 flex items-center justify-end gap-2 text-[10px] text-slate-400">
          <span>Less</span>
          <div className="w-2.5 h-2.5 rounded-[1px] bg-slate-100" />
          <div className="w-2.5 h-2.5 rounded-[1px] bg-indigo-200" />
          <div className="w-2.5 h-2.5 rounded-[1px] bg-indigo-400" />
          <div className="w-2.5 h-2.5 rounded-[1px] bg-indigo-600" />
          <span>More</span>
        </div>
      </div>
    </div>
  );
};