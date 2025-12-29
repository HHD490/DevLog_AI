import React, { useState } from 'react';
import { LogEntry, BlogPost } from '../types';
import { geminiService } from '../services/geminiService';
import { storageService } from '../services/storageService';
import { FileText, Loader2, CalendarRange, Download } from 'lucide-react';

interface BlogGeneratorProps {
  logs: LogEntry[];
}

export const BlogGenerator: React.FC<BlogGeneratorProps> = ({ logs }) => {
  const [blogs, setBlogs] = useState<BlogPost[]>(storageService.getBlogs());
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month'>('week');

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      // Filter logs based on period
      const now = Date.now();
      const days = selectedPeriod === 'week' ? 7 : 30;
      const startTime = now - (days * 24 * 60 * 60 * 1000);
      
      const filteredLogs = logs.filter(l => l.timestamp >= startTime);

      if (filteredLogs.length === 0) {
        alert("No logs found for this period to generate a blog.");
        return;
      }

      const periodName = selectedPeriod === 'week' ? "This Week" : "This Month";
      const { title, content } = await geminiService.generateBlog(filteredLogs, periodName);

      const newBlog: BlogPost = {
        id: crypto.randomUUID(),
        title,
        content,
        dateRange: { start: startTime, end: now },
        createdAt: now
      };

      const updated = storageService.saveBlog(newBlog);
      setBlogs(updated);
    } catch (e) {
      console.error(e);
      alert("Failed to generate blog.");
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadMarkdown = (blog: BlogPost) => {
    const element = document.createElement("a");
    const file = new Blob([blog.content], {type: 'text/markdown'});
    element.href = URL.createObjectURL(file);
    element.download = `${blog.title.replace(/\s+/g, '-').toLowerCase()}.md`;
    document.body.appendChild(element);
    element.click();
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl p-8 text-white shadow-lg">
        <h2 className="text-2xl font-bold mb-2">Turn Logs into Content</h2>
        <p className="text-indigo-100 mb-6 max-w-xl">
          AI will analyze your scattered logs, structure them into sections, and write a polished "Building in Public" style blog post ready for deployment.
        </p>
        
        <div className="flex items-center gap-4">
          <select 
            value={selectedPeriod} 
            onChange={(e) => setSelectedPeriod(e.target.value as any)}
            className="bg-white/10 border border-white/20 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-white/50"
          >
            <option value="week" className="text-slate-900">Last 7 Days</option>
            <option value="month" className="text-slate-900">Last 30 Days</option>
          </select>

          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="bg-white text-indigo-600 px-6 py-2 rounded-lg font-bold hover:bg-indigo-50 transition-colors disabled:opacity-70 flex items-center gap-2"
          >
            {isGenerating ? <Loader2 className="animate-spin w-5 h-5"/> : <FileText className="w-5 h-5" />}
            {isGenerating ? "Drafting..." : "Generate Post"}
          </button>
        </div>
      </div>

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
            <button 
                onClick={() => downloadMarkdown(blog)}
                className="w-full py-2 border border-slate-200 rounded-lg text-slate-600 text-sm font-medium hover:bg-slate-50 flex items-center justify-center gap-2"
            >
                <Download className="w-4 h-4" />
                Download .MD
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
