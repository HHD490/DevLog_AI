import React, { useMemo, useState } from 'react';
import { LogEntry, DailySummary } from '../types';
import { Tag as TagIcon, RefreshCw, Wand2, Check } from 'lucide-react';
import { geminiService } from '../services/geminiService';
import { storageService } from '../services/storageService';

interface TimelineProps {
  logs: LogEntry[];
  dailySummaries: Record<string, DailySummary>;
  onRefreshSummaries: (newSummaries: Record<string, DailySummary>) => void;
}

export const Timeline: React.FC<TimelineProps> = ({ logs, dailySummaries, onRefreshSummaries }) => {
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);

  const groupedLogs = useMemo(() => {
    const groups: Record<string, LogEntry[]> = {};
    logs.forEach(log => {
      const date = new Date(log.timestamp).toLocaleDateString();
      if (!groups[date]) groups[date] = [];
      groups[date].push(log);
    });
    return Object.entries(groups).sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime());
  }, [logs]);

  const handleGenerateSummary = async (date: string, dayLogs: LogEntry[]) => {
    setGeneratingFor(date);
    try {
      const summary = await geminiService.generateDailySummary(date, dayLogs);
      storageService.saveDailySummary(summary);
      onRefreshSummaries({ ...dailySummaries, [date]: summary });
    } catch (e) {
      console.error(e);
      alert("Failed to generate summary");
    } finally {
      setGeneratingFor(null);
    }
  };

  if (groupedLogs.length === 0) {
    return (
        <div className="flex flex-col items-center justify-center h-96 text-slate-400">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                <TagIcon className="w-8 h-8 text-slate-300" />
            </div>
            <p>No logs recorded yet. Start by adding a new entry!</p>
        </div>
    )
  }

  return (
    <div className="space-y-8 pb-20">
      {groupedLogs.map(([date, dayLogs]) => {
        const summary = dailySummaries[date];
        const isGenerating = generatingFor === date;

        return (
          <div key={date} className="relative pl-8 md:pl-0">
            {/* Timeline Line (Desktop) */}
            <div className="hidden md:block absolute left-[120px] top-0 bottom-0 w-px bg-slate-200"></div>
            
            <div className="md:flex gap-8">
              {/* Date Column */}
              <div className="md:w-32 flex-shrink-0 mb-4 md:mb-0 relative">
                 <div className="md:text-right sticky top-20">
                    <div className="text-xl font-bold text-slate-800">
                        {new Date(dayLogs[0].timestamp).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}
                    </div>
                    <div className="text-sm text-slate-500">
                        {new Date(dayLogs[0].timestamp).toLocaleDateString(undefined, {weekday: 'long'})}
                    </div>
                 </div>
                 {/* Dot */}
                 <div className="hidden md:block absolute right-[-37px] top-2 w-4 h-4 rounded-full border-4 border-white bg-indigo-500 shadow-sm z-10"></div>
              </div>

              {/* Content Column */}
              <div className="flex-1 space-y-4">
                
                {/* Summary Section */}
                {summary ? (
                    <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-6 relative group/summary">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2 text-indigo-700 font-semibold">
                              <Wand2 className="w-5 h-5" />
                              Daily Recap
                          </div>
                          <button 
                            onClick={() => handleGenerateSummary(date, dayLogs)}
                            disabled={isGenerating}
                            title="Regenerate summary"
                            className="text-indigo-400 hover:text-indigo-600 transition-colors p-1 rounded-lg hover:bg-white"
                          >
                            <RefreshCw className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
                          </button>
                        </div>
                        {isGenerating ? (
                          <div className="flex flex-col gap-2 py-4">
                            <div className="h-4 bg-indigo-100 rounded w-full animate-pulse"></div>
                            <div className="h-4 bg-indigo-100 rounded w-5/6 animate-pulse"></div>
                            <div className="h-4 bg-indigo-100 rounded w-4/6 animate-pulse"></div>
                          </div>
                        ) : (
                          <>
                            <p className="text-slate-700 mb-4 leading-relaxed">{summary.content}</p>
                            <div className="space-y-3">
                                 <div className="flex flex-wrap gap-2">
                                    {summary.techStackUsed.map(t => (
                                        <span key={t} className="px-2 py-1 bg-white text-indigo-600 text-[10px] uppercase tracking-wider rounded border border-indigo-100 font-bold">
                                            {t}
                                        </span>
                                    ))}
                                 </div>
                                 <div className="space-y-1">
                                    {summary.keyAchievements.slice(0, 3).map((ach, i) => (
                                      <div key={i} className="flex items-start gap-2 text-sm text-slate-600">
                                        <Check className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                                        <span>{ach}</span>
                                      </div>
                                    ))}
                                 </div>
                            </div>
                          </>
                        )}
                    </div>
                ) : (
                    <div className="flex justify-end">
                         <button 
                            onClick={() => handleGenerateSummary(date, dayLogs)}
                            disabled={isGenerating}
                            className="text-sm flex items-center gap-1.5 text-indigo-600 hover:text-indigo-800 font-medium disabled:opacity-50"
                         >
                             {isGenerating ? (
                                <span className="animate-pulse flex items-center gap-2">
                                  <RefreshCw className="w-4 h-4 animate-spin" />
                                  Generating Recap...
                                </span>
                             ) : (
                                <>
                                    <Wand2 className="w-4 h-4" />
                                    Generate Daily Recap
                                </>
                             )}
                         </button>
                    </div>
                )}

                {/* Individual Logs */}
                <div className="space-y-3">
                  {dayLogs.map((log) => (
                    <div key={log.id} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow group">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-xs font-mono text-slate-400 bg-slate-50 px-2 py-1 rounded">
                            {new Date(log.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </span>
                        {log.source === 'github' && (
                            <span className="text-[10px] font-bold uppercase tracking-widest bg-slate-800 text-white px-2 py-0.5 rounded flex items-center gap-1">
                                Git
                            </span>
                        )}
                      </div>
                      <p className="text-slate-700 leading-snug mb-3">{log.content}</p>
                      
                      <div className="flex flex-wrap gap-2">
                        {log.tags.map((tag, idx) => (
                          <span 
                            key={idx} 
                            className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-tighter
                                ${tag.category === 'Language' ? 'bg-blue-50 text-blue-600' : 
                                  tag.category === 'Framework' ? 'bg-purple-50 text-purple-600' : 
                                  'bg-slate-100 text-slate-600'}`}
                          >
                            {tag.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};