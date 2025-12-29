import React, { useState } from 'react';
import { storageService } from '../services/storageService';
import { LogEntry } from '../types';
import { Github, Trash2, CheckCircle2 } from 'lucide-react';

interface SettingsProps {
  onSyncGithub: (logs: LogEntry[]) => void;
}

export const Settings: React.FC<SettingsProps> = ({ onSyncGithub }) => {
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSimulateGithub = () => {
    setIsSyncing(true);
    // Simulate fetching commits
    setTimeout(() => {
      const mockLogs: LogEntry[] = [
        {
          id: crypto.randomUUID(),
          content: "fix: update dependency resolution logic in build script",
          timestamp: Date.now() - 1000 * 60 * 60 * 2, // 2 hours ago
          source: 'github',
          tags: [{ name: 'Build', category: 'Task' }, { name: 'CI/CD', category: 'Concept' }],
          summary: 'Fix build script deps'
        },
        {
          id: crypto.randomUUID(),
          content: "feat: add user profile vector embedding generation",
          timestamp: Date.now() - 1000 * 60 * 60 * 5, // 5 hours ago
          source: 'github',
          tags: [{ name: 'Python', category: 'Language' }, { name: 'Vector DB', category: 'Concept' }],
          summary: 'Add user embeddings'
        }
      ];
      onSyncGithub(mockLogs);
      setIsSyncing(false);
      alert("Synced 2 commits from GitHub (Simulation)");
    }, 1500);
  };

  const handleClearData = () => {
    if (confirm("Are you sure? This will delete all local logs.")) {
        storageService.clearAll();
        window.location.reload();
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <h3 className="text-lg font-bold text-slate-800 mb-4">Integrations</h3>
        
        <div className="flex items-center justify-between p-4 border border-slate-100 rounded-xl bg-slate-50">
            <div className="flex items-center gap-4">
                <div className="p-2 bg-black text-white rounded-full">
                    <Github className="w-6 h-6" />
                </div>
                <div>
                    <h4 className="font-semibold text-slate-800">GitHub Activity</h4>
                    <p className="text-sm text-slate-500">Sync commits as daily logs</p>
                </div>
            </div>
            <button 
                onClick={handleSimulateGithub}
                disabled={isSyncing}
                className="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
                {isSyncing ? 'Syncing...' : 'Sync Now'}
            </button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <h3 className="text-lg font-bold text-slate-800 mb-4">Data Management</h3>
        <p className="text-sm text-slate-500 mb-6">
            Your data is stored locally in your browser's LocalStorage. Clearing it is irreversible.
        </p>
        <button 
            onClick={handleClearData}
            className="flex items-center gap-2 text-red-600 hover:text-red-700 font-medium px-4 py-2 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
        >
            <Trash2 className="w-4 h-4" />
            Clear All Data
        </button>
      </div>

       <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <h3 className="text-lg font-bold text-slate-800 mb-4">System Status</h3>
        <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 p-3 rounded-lg border border-emerald-100">
            <CheckCircle2 className="w-5 h-5" />
            <span className="font-medium">Gemini API Configured</span>
        </div>
      </div>
    </div>
  );
};
