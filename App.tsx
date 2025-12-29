import React, { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { Timeline } from './components/Timeline';
import { InputModal } from './components/InputModal';
import { AskBrain } from './components/AskBrain';
import { BlogGenerator } from './components/BlogGenerator';
import { Settings } from './components/Settings';
import { LogEntry, ViewState, DailySummary } from './types';
import { storageService } from './services/storageService';

const App: React.FC = () => {
  const [activeView, setActiveView] = useState<ViewState>('dashboard');
  const [isInputOpen, setIsInputOpen] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [dailySummaries, setDailySummaries] = useState<Record<string, DailySummary>>({});

  useEffect(() => {
    // Load data on mount
    const loadedLogs = storageService.getLogs();
    const loadedSummaries = storageService.getDailySummaries();
    setLogs(loadedLogs);
    setDailySummaries(loadedSummaries);
  }, []);

  const handleSaveEntry = (entry: LogEntry) => {
    const updatedLogs = storageService.saveLog(entry);
    setLogs(updatedLogs);
  };

  const handleSyncGithub = (newLogs: LogEntry[]) => {
    const updatedLogs = storageService.saveLogsBatch(newLogs);
    setLogs(updatedLogs);
  }

  const handleRefreshSummaries = (summaries: Record<string, DailySummary>) => {
    setDailySummaries(summaries);
  }

  const renderView = () => {
    switch (activeView) {
      case 'dashboard':
        return <Dashboard logs={logs} />;
      case 'timeline':
        return <Timeline logs={logs} dailySummaries={dailySummaries} onRefreshSummaries={handleRefreshSummaries} />;
      case 'brain':
        return <AskBrain logs={logs} />;
      case 'blog':
        return <BlogGenerator logs={logs} />;
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
