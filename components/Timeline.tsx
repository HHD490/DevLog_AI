import React, { useMemo, useState } from 'react';
import { LogEntry, DailySummary } from '../types';
import { Tag as TagIcon, RefreshCw, Wand2, Check, X, Copy, ChevronDown } from 'lucide-react';
import { MarkdownRenderer } from './MarkdownRenderer';

interface TimelineProps {
  logs: LogEntry[];
  dailySummaries: Record<string, DailySummary>;
  onGenerateSummary: (date: string) => Promise<DailySummary>;
}

// Configuration
const MAX_PREVIEW_CHARS = 200;  // Max characters before truncation
const MAX_PREVIEW_LINES = 3;    // CSS line-clamp value

export const Timeline: React.FC<TimelineProps> = ({ logs, dailySummaries, onGenerateSummary }) => {
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);
  const [previewLog, setPreviewLog] = useState<LogEntry | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const groupedLogs = useMemo(() => {
    const groups: Record<string, LogEntry[]> = {};
    logs.forEach(log => {
      // Use YYYY-MM-DD format for consistent grouping (local timezone)
      const d = new Date(log.timestamp);
      const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (!groups[date]) groups[date] = [];
      groups[date].push(log);
    });
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [logs]);

  const handleGenerateSummary = async (date: string) => {
    setGeneratingFor(date);
    try {
      // date is already in YYYY-MM-DD format, pass directly to API
      await onGenerateSummary(date);
    } catch (e) {
      console.error(e);
      alert("Failed to generate summary");
    } finally {
      setGeneratingFor(null);
    }
  };

  const handleCopyContent = async (content: string, logId: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(logId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (e) {
      console.error('Failed to copy:', e);
    }
  };

  // Check if content needs truncation
  const needsTruncation = (content: string) => {
    return content.length > MAX_PREVIEW_CHARS || content.split('\n').length > MAX_PREVIEW_LINES;
  };

  // Get truncated content
  const getTruncatedContent = (content: string) => {
    if (content.length > MAX_PREVIEW_CHARS) {
      return content.slice(0, MAX_PREVIEW_CHARS).trim() + '...';
    }
    const lines = content.split('\n');
    if (lines.length > MAX_PREVIEW_LINES) {
      return lines.slice(0, MAX_PREVIEW_LINES).join('\n') + '...';
    }
    return content;
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
    <>
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
                      {new Date(dayLogs[0].timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </div>
                    <div className="text-sm text-slate-500">
                      {new Date(dayLogs[0].timestamp).toLocaleDateString(undefined, { weekday: 'long' })}
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
                          onClick={() => handleGenerateSummary(date)}
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
                        onClick={() => handleGenerateSummary(date)}
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
                    {dayLogs.map((log) => {
                      const isTruncated = needsTruncation(log.content);
                      const displayContent = isTruncated ? getTruncatedContent(log.content) : log.content;

                      return (
                        <div
                          key={log.id}
                          className={`bg-white p-4 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-all group ${isTruncated ? 'cursor-pointer' : ''}`}
                          onClick={() => isTruncated && setPreviewLog(log)}
                        >
                          <div className="flex justify-between items-start mb-2">
                            <span className="text-xs font-mono text-slate-400 bg-slate-50 px-2 py-1 rounded">
                              {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <div className="flex items-center gap-2">
                              {log.source === 'github' && (
                                <span className="text-[10px] font-bold uppercase tracking-widest bg-slate-800 text-white px-2 py-0.5 rounded flex items-center gap-1">
                                  Git
                                </span>
                              )}
                              {isTruncated && (
                                <span className="text-[10px] text-slate-400 flex items-center gap-1">
                                  <ChevronDown className="w-3 h-3" />
                                  {log.content.length} chars
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Log Content with word wrap and line clamp */}
                          <p
                            className="text-slate-700 leading-snug mb-3 whitespace-pre-wrap break-words"
                            style={{
                              display: '-webkit-box',
                              WebkitLineClamp: MAX_PREVIEW_LINES,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden'
                            }}
                          >
                            {displayContent}
                          </p>

                          {isTruncated && (
                            <div className="text-xs text-indigo-500 font-medium mb-2 group-hover:text-indigo-700 transition-colors">
                              Click to view full log →
                            </div>
                          )}

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
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Log Preview Modal */}
      {previewLog && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setPreviewLog(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-3">
                <span className="text-sm font-mono text-slate-500 bg-white px-2 py-1 rounded border border-slate-200">
                  {new Date(previewLog.timestamp).toLocaleString()}
                </span>
                {previewLog.source === 'github' && (
                  <span className="text-[10px] font-bold uppercase tracking-widest bg-slate-800 text-white px-2 py-0.5 rounded">
                    Git
                  </span>
                )}
                <span className="text-xs text-slate-400">
                  {previewLog.content.length} characters
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleCopyContent(previewLog.content, previewLog.id)}
                  className="p-2 hover:bg-white rounded-lg transition-colors text-slate-500 hover:text-slate-700"
                  title="Copy content"
                >
                  {copiedId === previewLog.id ? (
                    <Check className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
                <button
                  onClick={() => setPreviewLog(null)}
                  className="p-2 hover:bg-white rounded-lg transition-colors text-slate-500 hover:text-slate-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <MarkdownRenderer content={previewLog.content} />
            </div>

            {/* Tags Footer */}
            {previewLog.tags.length > 0 && (
              <div className="p-4 border-t border-slate-200 bg-slate-50">
                <div className="flex flex-wrap gap-2">
                  {previewLog.tags.map((tag, idx) => (
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
            )}
          </div>
        </div>
      )}
    </>
  );
};