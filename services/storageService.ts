import { LogEntry, DailySummary, BlogPost } from '../types';

const LOGS_KEY = 'devlog_entries';
const SUMMARIES_KEY = 'devlog_summaries';
const BLOGS_KEY = 'devlog_blogs';

export const storageService = {
  getLogs: (): LogEntry[] => {
    try {
      const stored = localStorage.getItem(LOGS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.error("Failed to parse logs", e);
      return [];
    }
  },

  saveLog: (entry: LogEntry) => {
    const logs = storageService.getLogs();
    const updated = [entry, ...logs];
    localStorage.setItem(LOGS_KEY, JSON.stringify(updated));
    return updated;
  },

  saveLogsBatch: (entries: LogEntry[]) => {
    const logs = storageService.getLogs();
    const updated = [...entries, ...logs];
    localStorage.setItem(LOGS_KEY, JSON.stringify(updated));
    return updated;
  },

  getDailySummaries: (): Record<string, DailySummary> => {
    try {
      const stored = localStorage.getItem(SUMMARIES_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch (e) {
      return {};
    }
  },

  saveDailySummary: (summary: DailySummary) => {
    const summaries = storageService.getDailySummaries();
    summaries[summary.date] = summary;
    localStorage.setItem(SUMMARIES_KEY, JSON.stringify(summaries));
  },

  getBlogs: (): BlogPost[] => {
     try {
      const stored = localStorage.getItem(BLOGS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      return [];
    }
  },

  saveBlog: (blog: BlogPost) => {
    const blogs = storageService.getBlogs();
    const updated = [blog, ...blogs];
    localStorage.setItem(BLOGS_KEY, JSON.stringify(updated));
    return updated;
  },
  
  clearAll: () => {
    localStorage.removeItem(LOGS_KEY);
    localStorage.removeItem(SUMMARIES_KEY);
    localStorage.removeItem(BLOGS_KEY);
  }
};
