import React, { useState, useEffect } from 'react';
import { apiService } from '../services/apiService';
import { storageService } from '../services/storageService';
import { Github, Trash2, CheckCircle2, AlertCircle, Upload, Clock, Database, Key, RefreshCw, X, Settings as SettingsIcon, Filter } from 'lucide-react';

interface SettingsProps {
  onSyncGithub: (logs: { content: string, source: string, timestamp: number }[]) => Promise<void>;
}

export const Settings: React.FC<SettingsProps> = ({ onSyncGithub }) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [backendStatus, setBackendStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [processingStats, setProcessingStats] = useState<{
    pendingAiProcessing: number;
    pendingSkillTree: number;
  } | null>(null);

  // GitHub state
  const [githubConfig, setGithubConfig] = useState<{
    configured: boolean;
    username: string | null;
    selectedRepos: string[];
    includeActivities: boolean;
    lastSync: string | null;
  } | null>(null);
  const [showGitHubSetup, setShowGitHubSetup] = useState(false);
  const [githubToken, setGithubToken] = useState('');
  const [includeActivities, setIncludeActivities] = useState(true);
  const [availableRepos, setAvailableRepos] = useState<{ name: string; full_name: string; private: boolean }[]>([]);
  const [selectedRepos, setSelectedRepos] = useState<string[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [savingConfig, setSavingConfig] = useState(false);

  useEffect(() => {
    checkBackendStatus();
  }, []);

  const checkBackendStatus = async () => {
    try {
      await apiService.healthCheck();
      setBackendStatus('online');
      const stats = await apiService.getProcessingStats();
      setProcessingStats(stats);

      // Load GitHub config
      const config = await apiService.getGitHubConfig();
      setGithubConfig(config);
    } catch {
      setBackendStatus('offline');
    }
  };

  const handleSyncGitHub = async () => {
    setIsSyncing(true);
    try {
      const result = await apiService.syncGitHub();
      alert(result.message);
      checkBackendStatus(); // Refresh config
    } catch (e: any) {
      console.error(e);
      alert(e.message || "Failed to sync GitHub");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleConnectGitHub = async () => {
    if (!githubToken.trim()) {
      setConfigError('Please enter your GitHub Personal Access Token');
      return;
    }

    setSavingConfig(true);
    setConfigError(null);

    try {
      const result = await apiService.saveGitHubConfig({
        token: githubToken,
        selectedRepos: selectedRepos.length > 0 ? selectedRepos : undefined,
        includeActivities
      });

      setGithubConfig({
        configured: true,
        username: result.username,
        selectedRepos,
        includeActivities,
        lastSync: null
      });
      setShowGitHubSetup(false);
      setGithubToken('');
      alert(result.message);
    } catch (e: any) {
      setConfigError(e.message || 'Failed to connect GitHub');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleDisconnectGitHub = async () => {
    if (!confirm('Are you sure you want to disconnect GitHub?')) return;

    try {
      await apiService.disconnectGitHub();
      setGithubConfig(null);
      setShowGitHubSetup(false);
    } catch (e) {
      console.error(e);
      alert('Failed to disconnect GitHub');
    }
  };

  const handleLoadRepos = async () => {
    if (!githubToken.trim()) {
      setConfigError('Please enter your GitHub token first');
      return;
    }

    setLoadingRepos(true);
    setConfigError(null);

    try {
      // Temporarily save token to fetch repos
      await apiService.saveGitHubConfig({ token: githubToken, includeActivities: true });
      const repos = await apiService.getGitHubRepos();
      setAvailableRepos(repos);
    } catch (e: any) {
      setConfigError(e.message || 'Failed to load repositories');
    } finally {
      setLoadingRepos(false);
    }
  };

  const handleMigrateFromLocalStorage = async () => {
    setIsMigrating(true);
    try {
      const logs = storageService.getLogs();
      const summaries = storageService.getDailySummaries();

      if (logs.length === 0 && Object.keys(summaries).length === 0) {
        alert("No data found in localStorage to migrate.");
        return;
      }

      const logsResult = await apiService.migrateLogs(logs);
      const summariesResult = await apiService.migrateSummaries(summaries);

      alert(`Migration complete!\nLogs migrated: ${logsResult.migrated}\nSummaries migrated: ${summariesResult.migrated}`);

      if (confirm("Migration successful! Do you want to clear the old localStorage data?")) {
        storageService.clearAll();
      }

      window.location.reload();
    } catch (e) {
      console.error(e);
      alert("Migration failed. Is the backend running?");
    } finally {
      setIsMigrating(false);
    }
  };

  const handleTriggerBatchProcessing = async () => {
    try {
      const result = await apiService.triggerBatchProcessing();
      alert(`Batch processing complete. Processed ${result.processed} entries.`);
      checkBackendStatus();
    } catch (e) {
      console.error(e);
      alert("Failed to trigger batch processing.");
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* System Status */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <h3 className="text-lg font-bold text-slate-800 mb-4">System Status</h3>
        <div className="space-y-3">
          <div className={`flex items-center gap-2 p-3 rounded-lg border ${backendStatus === 'online'
              ? 'text-emerald-600 bg-emerald-50 border-emerald-100'
              : backendStatus === 'offline'
                ? 'text-red-600 bg-red-50 border-red-100'
                : 'text-slate-600 bg-slate-50 border-slate-100'
            }`}>
            {backendStatus === 'online' ? (
              <CheckCircle2 className="w-5 h-5" />
            ) : backendStatus === 'offline' ? (
              <AlertCircle className="w-5 h-5" />
            ) : (
              <Clock className="w-5 h-5 animate-spin" />
            )}
            <span className="font-medium">
              Backend Server: {backendStatus === 'online' ? 'Online' : backendStatus === 'offline' ? 'Offline' : 'Checking...'}
            </span>
          </div>

          {processingStats && (
            <div className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg">
              <div className="flex items-center gap-4">
                <span>Pending AI Processing: <strong>{processingStats.pendingAiProcessing}</strong></span>
                <span>Pending Skill Tree: <strong>{processingStats.pendingSkillTree}</strong></span>
              </div>
              {processingStats.pendingAiProcessing > 0 && (
                <button
                  onClick={handleTriggerBatchProcessing}
                  className="mt-2 text-indigo-600 hover:text-indigo-800 text-sm font-medium"
                >
                  Trigger Batch Processing Now
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* GitHub Integration */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
          <Github className="w-5 h-5" />
          GitHub Integration
        </h3>

        {githubConfig?.configured ? (
          <div className="space-y-4">
            {/* Connected Status */}
            <div className="flex items-center justify-between p-4 border border-emerald-100 rounded-xl bg-emerald-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-600 rounded-full flex items-center justify-center text-white">
                  <Github className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-semibold text-emerald-800">Connected as @{githubConfig.username}</h4>
                  <p className="text-xs text-emerald-600">
                    {githubConfig.selectedRepos.length > 0
                      ? `Syncing ${githubConfig.selectedRepos.length} selected repos`
                      : 'Syncing all repositories'}
                    {githubConfig.includeActivities && ' + activities'}
                  </p>
                  {githubConfig.lastSync && (
                    <p className="text-xs text-emerald-500 mt-1">
                      Last sync: {new Date(githubConfig.lastSync).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSyncGitHub}
                  disabled={isSyncing || backendStatus !== 'online'}
                  className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                  {isSyncing ? 'Syncing...' : 'Sync Now'}
                </button>
                <button
                  onClick={handleDisconnectGitHub}
                  className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  title="Disconnect GitHub"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <p className="text-xs text-slate-500">
              💡 GitHub will auto-sync at 23:43 daily before the Daily Recap is generated.
            </p>
          </div>
        ) : showGitHubSetup ? (
          <div className="space-y-4">
            {/* Token Input */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                GitHub Personal Access Token
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Key className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                  <input
                    type="password"
                    value={githubToken}
                    onChange={(e) => setGithubToken(e.target.value)}
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                    className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
                <button
                  onClick={handleLoadRepos}
                  disabled={loadingRepos || !githubToken.trim()}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-50 text-sm whitespace-nowrap"
                >
                  {loadingRepos ? 'Loading...' : 'Load Repos'}
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Create a token at{' '}
                <a href="https://github.com/settings/tokens" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
                  github.com/settings/tokens
                </a>
                {' '}with <code className="bg-slate-100 px-1 rounded">repo</code> and <code className="bg-slate-100 px-1 rounded">read:user</code> scopes.
              </p>
            </div>

            {/* Repo Selection */}
            {availableRepos.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  <Filter className="w-4 h-4 inline mr-1" />
                  Select Repositories (optional)
                </label>
                <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg p-2 space-y-1">
                  {availableRepos.map(repo => (
                    <label key={repo.full_name} className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedRepos.includes(repo.name)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedRepos([...selectedRepos, repo.name]);
                          } else {
                            setSelectedRepos(selectedRepos.filter(r => r !== repo.name));
                          }
                        }}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-sm text-slate-700">{repo.full_name}</span>
                      {repo.private && (
                        <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">private</span>
                      )}
                    </label>
                  ))}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Leave empty to sync all repositories.
                </p>
              </div>
            )}

            {/* Include Activities Toggle */}
            <label className="flex items-center gap-3 p-3 border border-slate-100 rounded-lg bg-slate-50 cursor-pointer">
              <input
                type="checkbox"
                checked={includeActivities}
                onChange={(e) => setIncludeActivities(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <div>
                <span className="text-sm font-medium text-slate-700">Include Activities</span>
                <p className="text-xs text-slate-500">Sync issues, PRs, and reviews (in addition to commits)</p>
              </div>
            </label>

            {/* Error */}
            {configError && (
              <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-red-600 text-sm">
                {configError}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowGitHubSetup(false);
                  setGithubToken('');
                  setConfigError(null);
                }}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConnectGitHub}
                disabled={savingConfig || !githubToken.trim()}
                className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
              >
                {savingConfig ? 'Connecting...' : 'Connect GitHub'}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between p-4 border border-slate-100 rounded-xl bg-slate-50">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-black text-white rounded-full">
                <Github className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-semibold text-slate-800">GitHub Activity</h4>
                <p className="text-sm text-slate-500">Sync commits and activities as logs</p>
              </div>
            </div>
            <button
              onClick={() => setShowGitHubSetup(true)}
              disabled={backendStatus !== 'online'}
              className="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              Connect
            </button>
          </div>
        )}
      </div>

      {/* Data Migration */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <h3 className="text-lg font-bold text-slate-800 mb-4">Data Migration</h3>
        <p className="text-sm text-slate-500 mb-4">
          If you have existing data in localStorage, you can migrate it to the backend database.
        </p>
        <button
          onClick={handleMigrateFromLocalStorage}
          disabled={isMigrating || backendStatus !== 'online'}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
        >
          <Upload className="w-4 h-4" />
          {isMigrating ? 'Migrating...' : 'Migrate from localStorage'}
        </button>
      </div>

      {/* Database Info */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <h3 className="text-lg font-bold text-slate-800 mb-4">Data Storage</h3>
        <div className="flex items-center gap-2 text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100">
          <Database className="w-5 h-5" />
          <span className="font-medium">Using SQLite database (server-side)</span>
        </div>
        <p className="text-sm text-slate-500 mt-3">
          Scheduled tasks: GitHub sync at 23:43, Daily recap at 23:45, Batch AI processing every 10 minutes.
        </p>
      </div>
    </div>
  );
};
