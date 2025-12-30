import React, { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { Timeline } from './components/Timeline';
import { InputModal } from './components/InputModal';
import { AskBrain } from './components/AskBrain';
import { BlogGenerator } from './components/BlogGenerator';
import { SkillTree } from './components/SkillTree';
import { Settings } from './components/Settings';
import { LogEntry, ViewState, DailySummary } from './types';
import { apiService } from './services/apiService';

const App: React.FC = () => {
  const [activeView, setActiveView] = useState<ViewState>('dashboard');
  const [isInputOpen, setIsInputOpen] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [dailySummaries, setDailySummaries] = useState<Record<string, DailySummary>>({});
  const [loading, setLoading] = useState(true);
  const [backendAvailable, setBackendAvailable] = useState(true);

  useEffect(() => {
    // Load data from API on mount
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      // Check if backend is available
      await apiService.healthCheck();
      setBackendAvailable(true);

      const [loadedLogs, loadedSummaries] = await Promise.all([
        apiService.getLogs(),
        apiService.getDailySummaries()
      ]);
      setLogs(loadedLogs);
      setDailySummaries(loadedSummaries);
    } catch (error) {
      console.error('Failed to load data from API:', error);
      setBackendAvailable(false);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEntry = async (content: string) => {
    try {
      const newEntry = await apiService.saveLog(content);
      setLogs(prev => [newEntry, ...prev]);
    } catch (error) {
      console.error('Failed to save entry:', error);
      alert('Failed to save entry. Check if the backend is running.');
    }
  };

  const handleSyncGithub = async (newLogs: { content: string, source?: string, timestamp?: number }[]) => {
    try {
      const savedLogs = await apiService.saveLogsBatch(newLogs);
      setLogs(prev => [...savedLogs, ...prev]);
    } catch (error) {
      console.error('Failed to sync GitHub logs:', error);
      throw error;
    }
  };

  const handleRefreshSummaries = async () => {
    try {
      const summaries = await apiService.getDailySummaries();
      setDailySummaries(summaries);
    } catch (error) {
      console.error('Failed to refresh summaries:', error);
    }
  };

  const handleGenerateSummary = async (date: string) => {
    try {
      const summary = await apiService.generateDailySummary(date);
      setDailySummaries(prev => ({ ...prev, [date]: summary }));
      return summary;
    } catch (error) {
      console.error('Failed to generate summary:', error);
      throw error;
    }
  };

  const renderView = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      );
    }

    if (!backendAvailable) {
      return (
        <div className="flex flex-col items-center justify-center h-96 text-center px-4">
          <div className="bg-red-50 border border-red-200 rounded-xl p-8 max-w-md">
            <h3 className="text-lg font-semibold text-red-700 mb-2">Backend Not Available</h3>
            <p className="text-red-600 text-sm mb-4">
              The backend server is not running. Please start it with:
            </p>
            <code className="bg-red-100 px-3 py-2 rounded text-sm font-mono block mb-4">
              npm run dev:server
            </code>
            <button
              onClick={loadData}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Retry Connection
            </button>
          </div>
        </div>
      );
    }

    switch (activeView) {
      case 'dashboard':
        return <Dashboard logs={logs} />;
      case 'timeline':
        return (
          <Timeline
            logs={logs}
            dailySummaries={dailySummaries}
            onGenerateSummary={handleGenerateSummary}
          />
        );
      case 'brain':
        return <AskBrain />;
      case 'blog':
        return <BlogGenerator logs={logs} />;
      case 'skills':
        return <SkillTree />;
      case 'settings':
        return <Settings onSyncGithub={handleSyncGithub} />;
      default:
        return <Dashboard logs={logs} />;
    }
  };

  return (
    <>
      <Layout
        activeView={activeView}
        onChangeView={setActiveView}
        onOpenInput={() => setIsInputOpen(true)}
      >
        {renderView()}
      </Layout>

      <InputModal
        isOpen={isInputOpen}
        onClose={() => setIsInputOpen(false)}
        onSave={handleSaveEntry}
      />
    </>
  );
};

export default App;
