import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || '/api';
const api = axios.create({
  baseURL: API_BASE,
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json',
  },
});

interface SyncStats {
  created: number;
  updated: number;
  errors: number;
}

interface SyncStatus {
  configured: boolean;
  hasNotionToken: boolean;
  hasNotionDatabase: boolean;
  databaseId: string | null;
}

export const NotionSync: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [lastSyncStats, setLastSyncStats] = useState<SyncStats | null>(null);
  const [message, setMessage] = useState<string>('');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    loadSyncStatus();
  }, []);

  const loadSyncStatus = async () => {
    try {
      const response = await api.get('/notion-sync/status');
      setSyncStatus(response.data);
    } catch (err) {
      console.error('Error loading sync status:', err);
      setError('Failed to load sync status');
    }
  };

  const handleSync = async () => {
    setIsLoading(true);
    setMessage('');
    setError('');
    
    try {
      const response = await api.post('/notion-sync/sync');
      setLastSyncStats(response.data.stats);
      setMessage(response.data.message);
      
      // Reload status after sync
      await loadSyncStatus();
    } catch (err: any) {
      console.error('Error during sync:', err);
      setError(err.response?.data?.error || 'Sync failed');
    } finally {
      setIsLoading(false);
    }
  };

  if (!syncStatus) {
    return <div className="flex justify-center p-4">Loading sync status...</div>;
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-2xl font-bold mb-4">Notion Sync</h2>
      
      {/* Configuration Status */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">Configuration Status</h3>
        <div className="space-y-2">
          <div className="flex items-center">
            <span className={`inline-block w-3 h-3 rounded-full mr-2 ${
              syncStatus.hasNotionToken ? 'bg-green-500' : 'bg-red-500'
            }`}></span>
            <span>Notion Token: {syncStatus.hasNotionToken ? 'Configured' : 'Missing'}</span>
          </div>
          <div className="flex items-center">
            <span className={`inline-block w-3 h-3 rounded-full mr-2 ${
              syncStatus.hasNotionDatabase ? 'bg-green-500' : 'bg-red-500'
            }`}></span>
            <span>Notion Database: {syncStatus.hasNotionDatabase ? 'Configured' : 'Missing'}</span>
          </div>
          {syncStatus.databaseId && (
            <div className="text-sm text-gray-600">
              Database ID: {syncStatus.databaseId}
            </div>
          )}
        </div>
      </div>

      {/* Sync Controls */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">Sync Controls</h3>
        <button
          onClick={handleSync}
          disabled={!syncStatus.configured || isLoading}
          className={`px-4 py-2 rounded font-medium ${
            syncStatus.configured && !isLoading
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          {isLoading ? 'Syncing...' : 'Sync Notion Pages'}
        </button>
        
        {!syncStatus.configured && (
          <p className="text-sm text-red-600 mt-2">
            Please configure Notion token and database ID in environment variables to enable sync.
          </p>
        )}
      </div>

      {/* Messages */}
      {message && (
        <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded">
          {message}
        </div>
      )}
      
      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      {/* Last Sync Stats */}
      {lastSyncStats && (
        <div className="mb-4">
          <h3 className="text-lg font-semibold mb-2">Last Sync Results</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 bg-green-50 rounded">
              <div className="text-2xl font-bold text-green-600">{lastSyncStats.created}</div>
              <div className="text-sm text-gray-600">Created</div>
            </div>
            <div className="text-center p-3 bg-blue-50 rounded">
              <div className="text-2xl font-bold text-blue-600">{lastSyncStats.updated}</div>
              <div className="text-sm text-gray-600">Updated</div>
            </div>
            <div className="text-center p-3 bg-red-50 rounded">
              <div className="text-2xl font-bold text-red-600">{lastSyncStats.errors}</div>
              <div className="text-sm text-gray-600">Errors</div>
            </div>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="mt-6 p-4 bg-gray-50 rounded">
        <h3 className="text-lg font-semibold mb-2">How it Works</h3>
        <ul className="text-sm text-gray-700 space-y-1">
          <li>• Syncs Notion pages from your configured database</li>
          <li>• Creates new work activities for pages not yet imported</li>
          <li>• Updates existing work activities if Notion page was modified</li>
          <li>• Extracts client name, date, work type, tasks, notes, and materials</li>
          <li>• Automatically creates client records if they don't exist</li>
          <li>• Uses Notion page ID to prevent duplicates</li>
        </ul>
      </div>
    </div>
  );
}; 