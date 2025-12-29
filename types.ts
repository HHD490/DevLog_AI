export interface Tag {
  name: string;
  category: 'Language' | 'Framework' | 'Concept' | 'Task' | 'Other';
}

export interface LogEntry {
  id: string;
  content: string;
  timestamp: number;
  tags: Tag[];
  source: 'manual' | 'github' | 'voice';
  summary?: string; // Short one-line summary
}

export interface DailySummary {
  date: string; // YYYY-MM-DD
  content: string;
  keyAchievements: string[];
  techStackUsed: string[];
}

export interface BlogPost {
  id: string;
  title: string;
  content: string; // Markdown
  dateRange: { start: number; end: number };
  createdAt: number;
}

export type ViewState = 'dashboard' | 'timeline' | 'brain' | 'blog' | 'settings';
