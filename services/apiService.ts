import { LogEntry, DailySummary, BlogPost, Skill } from '../types';

const API_BASE = '/api';

/**
 * API Service for communicating with the backend.
 * Replaces the localStorage-based storageService.
 */
export const apiService = {
    // ==================== LOGS ====================

    getLogs: async (): Promise<LogEntry[]> => {
        const res = await fetch(`${API_BASE}/logs`);
        if (!res.ok) throw new Error('Failed to fetch logs');
        return res.json();
    },

    saveLog: async (content: string, source: string = 'manual'): Promise<LogEntry> => {
        const res = await fetch(`${API_BASE}/logs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content, source })
        });
        if (!res.ok) throw new Error('Failed to save log');
        return res.json();
    },

    saveLogsBatch: async (entries: { content: string, source?: string, timestamp?: number }[]): Promise<LogEntry[]> => {
        const res = await fetch(`${API_BASE}/logs/batch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ entries })
        });
        if (!res.ok) throw new Error('Failed to save logs batch');
        return res.json();
    },

    deleteLog: async (id: string): Promise<void> => {
        const res = await fetch(`${API_BASE}/logs/${id}`, {
            method: 'DELETE'
        });
        if (!res.ok) throw new Error('Failed to delete log');
    },

    // ==================== DAILY SUMMARIES ====================

    getDailySummaries: async (): Promise<Record<string, DailySummary>> => {
        const res = await fetch(`${API_BASE}/summaries`);
        if (!res.ok) throw new Error('Failed to fetch summaries');
        return res.json();
    },

    generateDailySummary: async (date: string): Promise<DailySummary> => {
        const res = await fetch(`${API_BASE}/summaries/${date}/generate`, {
            method: 'POST'
        });
        if (!res.ok) throw new Error('Failed to generate summary');
        return res.json();
    },

    // ==================== SKILL TREE ====================

    getSkillTree: async (): Promise<Skill[]> => {
        const res = await fetch(`${API_BASE}/skillTree`);
        if (!res.ok) throw new Error('Failed to fetch skill tree');
        return res.json();
    },

    getSkillTreeStats: async (): Promise<{
        totalSkills: number;
        byCategory: Record<string, number>;
        averageMaturity: number;
        unprocessedLogs: number;
        unprocessedSummaries: number;
    }> => {
        const res = await fetch(`${API_BASE}/skillTree/stats`);
        if (!res.ok) throw new Error('Failed to fetch skill tree stats');
        return res.json();
    },

    generateSkillTree: async (): Promise<{
        message: string;
        updated: boolean;
        newSkills: number;
        updatedSkills: number;
    }> => {
        const res = await fetch(`${API_BASE}/skillTree/generate`, {
            method: 'POST',
        });
        if (!res.ok) throw new Error('Failed to generate skill tree');
        return res.json();
    },

    // ==================== BLOGS ====================

    getBlogs: async (): Promise<BlogPost[]> => {
        const res = await fetch(`${API_BASE}/blogs`);
        if (!res.ok) throw new Error('Failed to fetch blogs');
        return res.json();
    },

    generateBlog: async (startDate: string, endDate: string, periodName?: string): Promise<BlogPost> => {
        const res = await fetch(`${API_BASE}/blogs/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ startDate, endDate, periodName })
        });
        if (!res.ok) throw new Error('Failed to generate blog');
        return res.json();
    },

    // ==================== BRAIN ====================

    askBrain: async (query: string): Promise<string> => {
        const res = await fetch(`${API_BASE}/brain/ask`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query })
        });
        if (!res.ok) throw new Error('Failed to ask brain');
        const data = await res.json();
        return data.answer;
    },

    // ==================== PROCESSING ====================

    getProcessingStats: async (): Promise<{
        totalLogs: number;
        pendingAiProcessing: number;
        pendingSkillTree: number;
    }> => {
        const res = await fetch(`${API_BASE}/processing/stats`);
        if (!res.ok) throw new Error('Failed to fetch processing stats');
        return res.json();
    },

    triggerBatchProcessing: async (): Promise<{ processed: number }> => {
        const res = await fetch(`${API_BASE}/processing/batch`, {
            method: 'POST'
        });
        if (!res.ok) throw new Error('Failed to trigger batch processing');
        return res.json();
    },

    triggerDailyRecap: async (date?: string): Promise<{ success: boolean; message: string }> => {
        const res = await fetch(`${API_BASE}/processing/daily-recap`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ date })
        });
        if (!res.ok) throw new Error('Failed to trigger daily recap');
        return res.json();
    },

    // ==================== MIGRATION ====================

    migrateLogs: async (logs: LogEntry[]): Promise<{ success: boolean; migrated: number }> => {
        const res = await fetch(`${API_BASE}/logs/migrate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ logs })
        });
        if (!res.ok) throw new Error('Failed to migrate logs');
        return res.json();
    },

    migrateSummaries: async (summaries: Record<string, DailySummary>): Promise<{ success: boolean; migrated: number }> => {
        const res = await fetch(`${API_BASE}/summaries/migrate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ summaries })
        });
        if (!res.ok) throw new Error('Failed to migrate summaries');
        return res.json();
    },

    // ==================== HEALTH ====================

    healthCheck: async (): Promise<{ status: string; timestamp: string }> => {
        const res = await fetch(`${API_BASE}/health`);
        if (!res.ok) throw new Error('Backend not available');
        return res.json();
    },

    // ==================== GITHUB ====================

    getGitHubConfig: async (): Promise<{
        configured: boolean;
        username: string | null;
        selectedRepos: string[];
        includeActivities: boolean;
        lastSync: string | null;
    }> => {
        const res = await fetch(`${API_BASE}/github/config`);
        if (!res.ok) throw new Error('Failed to fetch GitHub config');
        return res.json();
    },

    saveGitHubConfig: async (config: {
        token: string;
        selectedRepos?: string[];
        includeActivities?: boolean;
    }): Promise<{ success: boolean; username: string; message: string }> => {
        const res = await fetch(`${API_BASE}/github/config`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
        });
        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.error || 'Failed to save GitHub config');
        }
        return res.json();
    },

    getGitHubRepos: async (): Promise<{ name: string; full_name: string; private: boolean }[]> => {
        const res = await fetch(`${API_BASE}/github/repos`);
        if (!res.ok) throw new Error('Failed to fetch GitHub repos');
        return res.json();
    },

    syncGitHub: async (): Promise<{
        success: boolean;
        synced: number;
        skipped: number;
        message: string;
    }> => {
        const res = await fetch(`${API_BASE}/github/sync`, {
            method: 'POST'
        });
        if (!res.ok) throw new Error('Failed to sync GitHub');
        return res.json();
    },

    disconnectGitHub: async (): Promise<{ success: boolean; message: string }> => {
        const res = await fetch(`${API_BASE}/github/config`, {
            method: 'DELETE'
        });
        if (!res.ok) throw new Error('Failed to disconnect GitHub');
        return res.json();
    }
};
