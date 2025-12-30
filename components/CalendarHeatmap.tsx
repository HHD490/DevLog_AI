import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
// 假设 LogEntry 类型在你的项目中
import { LogEntry } from '../types';

interface CalendarHeatmapProps {
  logs: LogEntry[];
}

export const CalendarHeatmap: React.FC<CalendarHeatmapProps> = ({ logs }) => {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null);

  // 1. 获取可用年份
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    years.add(currentYear);
    logs.forEach(log => {
      years.add(new Date(log.timestamp).getFullYear());
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [logs, currentYear]);

  // 2. 生成热力图数据
  const heatmapData = useMemo(() => {
    const data: Record<string, number> = {};

    logs.forEach(log => {
      const logDate = new Date(log.timestamp);
      if (logDate.getFullYear() === selectedYear) {
        const dateKey = logDate.toLocaleDateString();
        data[dateKey] = (data[dateKey] || 0) + 1;
      }
    });

    const weeks: { date: Date; count: number }[][] = [];
    let currentWeek: { date: Date; count: number }[] = [];

    const startDate = new Date(selectedYear, 0, 1);
    const endDate = new Date(selectedYear, 11, 31);

    const firstSunday = new Date(startDate);
    firstSunday.setDate(startDate.getDate() - startDate.getDay());

    const gridStartDate = firstSunday;
    const current = new Date(gridStartDate);

    while (current <= endDate || currentWeek.length > 0) {
      const dateKey = current.toLocaleDateString();
      const isInYear = current.getFullYear() === selectedYear;

      currentWeek.push({
        date: new Date(current),
        count: isInYear ? (data[dateKey] || 0) : -1
      });

      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
        if (current > endDate) break;
      }
      current.setDate(current.getDate() + 1);
    }
    return weeks;
  }, [logs, selectedYear]);

  // 3. 计算颜色
  const getColorClass = (count: number) => {
    if (count === -1) return 'bg-transparent';
    if (count === 0) return 'bg-slate-100';
    if (count === 1) return 'bg-indigo-200';
    if (count === 2) return 'bg-indigo-400';
    if (count >= 3) return 'bg-indigo-600';
    return 'bg-slate-100';
  };

  // 4. 计算月份标签位置
  const monthLabels = useMemo(() => {
    const labels: { label: string; index: number }[] = [];
    let lastMonth = -1;
    heatmapData.forEach((week, i) => {
      const validDay = week.find(d => d.count !== -1);
      if (validDay) {
        const month = validDay.date.getMonth();
        if (month !== lastMonth) {
          labels.push({
            label: validDay.date.toLocaleString('default', { month: 'short' }),
            index: i
          });
          lastMonth = month;
        }
      }
    });
    return labels;
  }, [heatmapData]);

  const totalContributions = useMemo(() => {
    return logs.filter(log =>
      new Date(log.timestamp).getFullYear() === selectedYear
    ).length;
  }, [logs, selectedYear]);

  return (
    <div className="w-full">
      {/* Header with Year Selector */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelectedYear(y => Math.max(y - 1, Math.min(...availableYears)))}
            disabled={selectedYear <= Math.min(...availableYears)}
            className="p-1 hover:bg-slate-100 rounded disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4 text-slate-500" />
          </button>
          <span className="text-lg font-semibold text-slate-700 min-w-[60px] text-center">
            {selectedYear}
          </span>
          <button
            onClick={() => setSelectedYear(y => Math.min(y + 1, currentYear))}
            disabled={selectedYear >= currentYear}
            className="p-1 hover:bg-slate-100 rounded disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-4 h-4 text-slate-500" />
          </button>
        </div>
        <div className="text-sm text-slate-500">
          <span className="font-semibold text-slate-700">{totalContributions}</span> contributions in {selectedYear}
        </div>
      </div>

      {/* Heatmap Grid */}
      <div className="overflow-x-auto pb-2">
        <div className="inline-block min-w-full relative">

          {/* Month Labels - 修正对齐 */}
          <div className="relative h-5 mb-1 w-full">
            {monthLabels.map((m, i) => (
              <div
                key={i}
                className="absolute top-0 text-[10px] text-slate-400 font-medium whitespace-nowrap"
                style={{
                  // 核心修正：
                  // 32px 是左侧 Day Label 的宽度 (w-8)
                  // 16px 是每列的总宽度 (w-3 12px + gap-1 4px)
                  left: `${m.index * 16 + 32}px`
                }}
              >
                {m.label}
              </div>
            ))}
          </div>

          <div className="flex gap-1">
            {/* Day labels - 固定宽度 w-8 */}
            <div className="flex flex-col gap-1 pr-2 justify-between py-1 w-8 text-right shrink-0">
              <span className="text-[10px] text-slate-300 h-3"></span>
              <span className="text-[10px] text-slate-300 h-3">Mon</span>
              <span className="text-[10px] text-slate-300 h-3"></span>
              <span className="text-[10px] text-slate-300 h-3">Wed</span>
              <span className="text-[10px] text-slate-300 h-3"></span>
              <span className="text-[10px] text-slate-300 h-3">Fri</span>
              <span className="text-[10px] text-slate-300 h-3"></span>
            </div>

            {/* Grid */}
            <div className="flex gap-1 relative">
              {heatmapData.map((week, weekIdx) => (
                <div key={weekIdx} className="flex flex-col gap-1">
                  {week.map((day, dayIdx) => {
                    const dateStr = day.count >= 0
                      ? `${String(day.date.getMonth() + 1).padStart(2, '0')}-${String(day.date.getDate()).padStart(2, '0')}`
                      : '';
                    const tooltipText = day.count >= 0
                      ? `${dateStr}: ${day.count} 条记录`
                      : '';
                    return (
                      <div
                        key={dayIdx}
                        onMouseEnter={(e) => {
                          if (day.count >= 0) {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setTooltip({ text: tooltipText, x: rect.left + rect.width / 2, y: rect.top - 8 });
                          }
                        }}
                        onMouseLeave={() => setTooltip(null)}
                        className={`w-3 h-3 rounded-[2px] transition-colors ${getColorClass(day.count)} ${day.count >= 0 ? 'hover:ring-2 hover:ring-indigo-300' : ''}`}
                      />
                    );
                  })}
                </div>
              ))}

              {/* Custom Tooltip */}
              {tooltip && (
                <div
                  className="fixed z-50 px-2 py-1 text-xs font-medium text-white bg-slate-800 rounded shadow-lg pointer-events-none whitespace-nowrap transform -translate-x-1/2 -translate-y-full"
                  style={{ left: tooltip.x, top: tooltip.y }}
                >
                  {tooltip.text}
                  <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-slate-800" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Legend */}
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