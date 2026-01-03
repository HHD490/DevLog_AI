import React, { useState, useEffect } from 'react';
import { LogEntry, BlogPost } from '../types';
import { apiService } from '../services/apiService';
import { FileText, Loader2, CalendarRange, Download, Calendar, ChevronLeft, ChevronRight, X, Eye } from 'lucide-react';

interface BlogGeneratorProps {
  logs: LogEntry[];
}

type PeriodType = 'yesterday' | 'week' | 'month' | 'quarter' | 'year' | 'custom';

// Date helper functions
const getDateRange = (period: PeriodType): { start: Date; end: Date; name: string } => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (period) {
    case 'yesterday': {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return { start: yesterday, end: yesterday, name: 'Yesterday' };
    }
    case 'week': {
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      return { start: weekAgo, end: today, name: 'Last 7 Days' };
    }
    case 'month': {
      const monthAgo = new Date(today);
      monthAgo.setDate(monthAgo.getDate() - 30);
      return { start: monthAgo, end: today, name: 'Last 30 Days' };
    }
    case 'quarter': {
      const quarterAgo = new Date(today);
      quarterAgo.setMonth(quarterAgo.getMonth() - 3);
      return { start: quarterAgo, end: today, name: 'Last Quarter' };
    }
    case 'year': {
      const yearAgo = new Date(today);
      yearAgo.setFullYear(yearAgo.getFullYear() - 1);
      return { start: yearAgo, end: today, name: 'Last Year' };
    }
    default:
      return { start: today, end: today, name: 'Custom' };
  }
};

const formatDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const formatDisplayDate = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;

// Helper to render inline markdown (bold, italic, code)
const renderInlineMarkdown = (text: string): React.ReactNode[] => {
  const result: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Match patterns: **bold**, *italic*, `code`
    const match = remaining.match(/(\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`)/);

    if (!match || match.index === undefined) {
      result.push(<span key={key++}>{remaining}</span>);
      break;
    }

    // Add text before match
    if (match.index > 0) {
      result.push(<span key={key++}>{remaining.slice(0, match.index)}</span>);
    }

    const fullMatch = match[0];
    if (fullMatch.startsWith('**')) {
      // Bold
      result.push(<strong key={key++} className="font-semibold text-slate-800">{match[2]}</strong>);
    } else if (fullMatch.startsWith('`')) {
      // Inline code
      result.push(<code key={key++} className="px-1.5 py-0.5 bg-slate-100 text-pink-600 rounded text-sm font-mono">{match[4]}</code>);
    } else if (fullMatch.startsWith('*')) {
      // Italic
      result.push(<em key={key++} className="italic">{match[3]}</em>);
    }

    remaining = remaining.slice(match.index + fullMatch.length);
  }

  return result;
};

// Simple Calendar Component
const SimpleDatePicker: React.FC<{
  startDate: Date | null;
  endDate: Date | null;
  onSelect: (date: Date) => void;
  onClose: () => void;
}> = ({ startDate, endDate, onSelect, onClose }) => {
  const [viewMonth, setViewMonth] = useState(new Date());

  const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1).getDay();

  const days = [];
  for (let i = 0; i < firstDayOfMonth; i++) {
    days.push(<div key={`empty-${i}`} className="w-9 h-9" />);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day);
    const isStart = startDate && formatDate(date) === formatDate(startDate);
    const isEnd = endDate && formatDate(date) === formatDate(endDate);
    const isInRange = startDate && endDate && date > startDate && date < endDate;
    const isToday = formatDate(date) === formatDate(new Date());

    days.push(
      <button
        key={day}
        onClick={() => onSelect(date)}
        className={`w-9 h-9 rounded-full text-sm font-medium transition-colors flex items-center justify-center
          ${isStart || isEnd ? 'bg-indigo-600 text-white' : ''}
          ${isInRange ? 'bg-indigo-100 text-indigo-700' : ''}
          ${!isStart && !isEnd && !isInRange ? 'hover:bg-slate-100 text-slate-700' : ''}
          ${isToday && !isStart && !isEnd ? 'ring-1 ring-indigo-400' : ''}
        `}
      >
        {day}
      </button>
    );
  }

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 10 }, (_, i) => currentYear - 5 + i);

  return (
    <div className="absolute top-full left-0 mt-2 bg-white rounded-xl shadow-xl border border-slate-200 p-4 z-50 min-w-[320px]">
      {/* Month/Year Navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1))}
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-slate-600" />
        </button>
        <div className="flex items-center gap-2">
          <select
            value={viewMonth.getMonth()}
            onChange={(e) => setViewMonth(new Date(viewMonth.getFullYear(), parseInt(e.target.value), 1))}
            className="px-2 py-1 border border-slate-200 rounded-lg text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {monthNames.map((m, i) => (
              <option key={m} value={i}>{m}</option>
            ))}
          </select>
          <select
            value={viewMonth.getFullYear()}
            onChange={(e) => setViewMonth(new Date(parseInt(e.target.value), viewMonth.getMonth(), 1))}
            className="px-2 py-1 border border-slate-200 rounded-lg text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {years.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <button
          onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1))}
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ChevronRight className="w-5 h-5 text-slate-600" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-2 mb-2">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
          <div key={d} className="w-9 h-6 flex items-center justify-center text-xs text-slate-400 font-medium">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-2">{days}</div>
      <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center">
        <div className="text-xs text-slate-500">
          {startDate && !endDate && '← Select end date'}
          {startDate && endDate && `${formatDisplayDate(startDate)} - ${formatDisplayDate(endDate)}`}
        </div>
        <button onClick={onClose} className="text-xs text-slate-500 hover:text-slate-700">Close</button>
      </div>
    </div>
  );
};

export const BlogGenerator: React.FC<BlogGeneratorProps> = ({ logs }) => {
  const [blogs, setBlogs] = useState<BlogPost[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>('week');
  const [loading, setLoading] = useState(true);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [customStart, setCustomStart] = useState<Date | null>(null);
  const [customEnd, setCustomEnd] = useState<Date | null>(null);
  const [previewBlog, setPreviewBlog] = useState<BlogPost | null>(null);

  useEffect(() => {
    loadBlogs();
  }, []);

  const loadBlogs = async () => {
    try {
      const blogsData = await apiService.getBlogs();
      setBlogs(blogsData);
    } catch (e) {
      console.error('Failed to load blogs:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleDateSelect = (date: Date) => {
    if (!customStart || (customStart && customEnd)) {
      // First click or reset
      setCustomStart(date);
      setCustomEnd(null);
    } else {
      // Second click
      if (date < customStart) {
        setCustomEnd(customStart);
        setCustomStart(date);
      } else {
        setCustomEnd(date);
      }
      setShowDatePicker(false);
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      let startDate: Date, endDate: Date, periodName: string;

      if (selectedPeriod === 'custom' && customStart) {
        startDate = customStart;
        endDate = customEnd || customStart;
        periodName = `${formatDisplayDate(startDate)} - ${formatDisplayDate(endDate)}`;
      } else {
        const range = getDateRange(selectedPeriod);
        startDate = range.start;
        endDate = range.end;
        periodName = range.name;
      }

      const newBlog = await apiService.generateBlog(
        formatDate(startDate),
        formatDate(endDate),
        periodName
      );

      setBlogs(prev => [newBlog, ...prev]);
    } catch (e) {
      console.error(e);
      alert("Failed to generate blog. Is the backend running?");
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadMarkdown = (blog: BlogPost) => {
    const element = document.createElement("a");
    const file = new Blob([blog.content], { type: 'text/markdown' });
    element.href = URL.createObjectURL(file);
    element.download = `${blog.title.replace(/\s+/g, '-').toLowerCase()}.md`;
    document.body.appendChild(element);
    element.click();
  };

  const periodOptions: { value: PeriodType; label: string }[] = [
    { value: 'yesterday', label: 'Yesterday' },
    { value: 'week', label: 'Last 7 Days' },
    { value: 'month', label: 'Last 30 Days' },
    { value: 'quarter', label: 'Last Quarter' },
    { value: 'year', label: 'Last Year' },
    { value: 'custom', label: 'Custom Range' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl p-8 text-white shadow-lg">
        <h2 className="text-2xl font-bold mb-2">Turn Logs into Content</h2>
        <p className="text-indigo-100 mb-6 max-w-xl">
          AI will analyze your scattered logs, structure them into sections, and write a polished "Building in Public" style blog post ready for deployment.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          {/* Period Dropdown */}
          <select
            value={selectedPeriod}
            onChange={(e) => {
              const val = e.target.value as PeriodType;
              setSelectedPeriod(val);
              if (val === 'custom') {
                setShowDatePicker(true);
                setCustomStart(null);
                setCustomEnd(null);
              }
            }}
            className="bg-white/10 border border-white/20 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-white/50 cursor-pointer"
          >
            {periodOptions.filter(o => o.value !== 'custom').map(opt => (
              <option key={opt.value} value={opt.value} className="text-slate-900">{opt.label}</option>
            ))}
            <option value="custom" className="text-slate-900">Custom Range</option>
          </select>

          {/* Custom Date Display */}
          {selectedPeriod === 'custom' && (
            <div className="relative">
              <button
                onClick={() => setShowDatePicker(!showDatePicker)}
                className="flex items-center gap-2 bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-sm"
              >
                <Calendar className="w-4 h-4" />
                {customStart && customEnd
                  ? `${formatDisplayDate(customStart)} - ${formatDisplayDate(customEnd)}`
                  : customStart
                    ? `${formatDisplayDate(customStart)} - ?`
                    : 'Select dates'
                }
              </button>
              {showDatePicker && (
                <SimpleDatePicker
                  startDate={customStart}
                  endDate={customEnd}
                  onSelect={handleDateSelect}
                  onClose={() => setShowDatePicker(false)}
                />
              )}
            </div>
          )}

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={isGenerating || (selectedPeriod === 'custom' && !customStart)}
            className="bg-white text-indigo-600 px-6 py-2 rounded-lg font-bold hover:bg-indigo-50 transition-colors disabled:opacity-70 flex items-center gap-2"
          >
            {isGenerating ? <Loader2 className="animate-spin w-5 h-5" /> : <FileText className="w-5 h-5" />}
            {isGenerating ? "Drafting..." : "Generate Post"}
          </button>
        </div>
      </div>

      {blogs.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No blog posts generated yet. Create your first one!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {blogs.map(blog => (
            <div key={blog.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 hover:shadow-md transition-shadow flex flex-col h-full">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-2 text-slate-500 text-xs">
                  <CalendarRange className="w-4 h-4" />
                  {new Date(blog.createdAt).toLocaleDateString()}
                </div>
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-3 line-clamp-2">{blog.title}</h3>
              <p className="text-slate-500 text-sm line-clamp-4 flex-1 mb-4 font-mono text-xs bg-slate-50 p-2 rounded">
                {blog.content.substring(0, 150)}...
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPreviewBlog(blog)}
                  className="flex-1 py-2 border border-slate-200 rounded-lg text-slate-600 text-sm font-medium hover:bg-slate-50 flex items-center justify-center gap-2"
                >
                  <Eye className="w-4 h-4" />
                  Preview
                </button>
                <button
                  onClick={() => downloadMarkdown(blog)}
                  className="flex-1 py-2 border border-slate-200 rounded-lg text-slate-600 text-sm font-medium hover:bg-slate-50 flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Download
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Preview Modal */}
      {previewBlog && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setPreviewBlog(null)}>
          <div
            className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h2 className="text-xl font-bold text-slate-800">{previewBlog.title}</h2>
              <button
                onClick={() => setPreviewBlog(null)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {(() => {
                // Extract content from various formats
                let content = previewBlog.content;

                // Step 1: Strip ```json wrapper if present
                if (content.trim().startsWith('```')) {
                  // Remove opening ```json or ``` and closing ```
                  content = content.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
                }

                // Step 2: Parse JSON if it looks like JSON
                if (content.trim().startsWith('{')) {
                  try {
                    const parsed = JSON.parse(content);
                    content = parsed.content || content;
                  } catch (e) {
                    // Not valid JSON, use as-is
                  }
                }

                // Step 3: Unescape literal \n to actual newlines
                content = content.replace(/\\n/g, '\n');

                // Pre-process to handle code blocks properly
                const lines = content.split('\n');
                const elements: React.ReactNode[] = [];
                let i = 0;

                while (i < lines.length) {
                  const line = lines[i];

                  // Handle code blocks
                  if (line.startsWith('```')) {
                    const codeLines: string[] = [];
                    i++; // Skip opening ```
                    while (i < lines.length && !lines[i].startsWith('```')) {
                      codeLines.push(lines[i]);
                      i++;
                    }
                    i++; // Skip closing ```
                    elements.push(
                      <pre key={`code-${i}`} className="bg-slate-800 text-slate-100 rounded-lg p-4 my-3 overflow-x-auto text-sm font-mono">
                        <code>{codeLines.join('\n')}</code>
                      </pre>
                    );
                    continue;
                  }

                  // Headings
                  if (line.startsWith('# ')) {
                    elements.push(<h1 key={i} className="text-2xl font-bold text-slate-800 mb-4 mt-6">{renderInlineMarkdown(line.slice(2))}</h1>);
                  } else if (line.startsWith('## ')) {
                    elements.push(<h2 key={i} className="text-xl font-bold text-slate-800 mt-6 mb-3">{renderInlineMarkdown(line.slice(3))}</h2>);
                  } else if (line.startsWith('### ')) {
                    elements.push(<h3 key={i} className="text-lg font-semibold text-slate-700 mt-4 mb-2">{renderInlineMarkdown(line.slice(4))}</h3>);
                    // Lists
                  } else if (line.startsWith('- ')) {
                    elements.push(<li key={i} className="ml-4 mb-1 text-slate-600">• {renderInlineMarkdown(line.slice(2))}</li>);
                  } else if (line.match(/^\d+\. /)) {
                    elements.push(<li key={i} className="ml-4 mb-1 text-slate-600">{renderInlineMarkdown(line)}</li>);
                    // Horizontal rule
                  } else if (line.trim() === '---') {
                    elements.push(<hr key={i} className="my-6 border-slate-200" />);
                    // Empty lines
                  } else if (line.trim() === '') {
                    elements.push(<div key={i} className="h-2" />);
                    // Regular paragraphs with inline formatting
                  } else {
                    elements.push(<p key={i} className="mb-2 text-slate-600 leading-relaxed">{renderInlineMarkdown(line)}</p>);
                  }

                  i++;
                }

                return elements;
              })()}
            </div>
            <div className="p-4 border-t border-slate-200 flex justify-end gap-2">
              <button
                onClick={() => { downloadMarkdown(previewBlog); setPreviewBlog(null); }}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Download .MD
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
