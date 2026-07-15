// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';
import Button from '@/components/ui/Button';

interface ConnectedPage {
  id: string;
  pageId: string;
  pageName: string;
  connectedAt: string;
}

export default function FacebookConnect() {
  const [pages, setPages] = useState<ConnectedPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    pageId: '',
    pageName: '',
    accessToken: '',
  });

  useEffect(() => {
    fetchPages();
  }, []);

  const fetchPages = async () => {
    try {
      const response = await fetch('/api/facebook/pages');
      if (response.ok) {
        const data = await response.json();
        setPages(data.pages);
      }
    } catch (err) {
      console.error('Failed to fetch pages:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setConnecting(true);
    setError(null);

    try {
      const response = await fetch('/api/facebook/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to connect page');
      }

      await fetchPages();
      setFormData({ pageId: '', pageName: '', accessToken: '' });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async (pageId: string) => {
    if (!confirm('Are you sure you want to disconnect this page?')) return;

    try {
      const response = await fetch(`/api/facebook/${pageId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await fetchPages();
      }
    } catch (err) {
      console.error('Failed to disconnect page:', err);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-2 text-gray-600">Loading pages...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Facebook Pages</h3>

      {/* Connected Pages */}
      {pages.length > 0 && (
        <div className="space-y-3">
          {pages.map((page) => (
            <div
              key={page.id}
              className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg"
            >
              <div>
                <p className="font-medium text-gray-900">{page.pageName}</p>
                <p className="text-sm text-gray-600">
                  Connected {new Date(page.connectedAt).toLocaleDateString()}
                </p>
              </div>
              <Button
                onClick={() => handleDisconnect(page.id)}
                className="bg-red-100 hover:bg-red-200 text-red-700"
              >
                Disconnect
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Connect New Page */}
      <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
        <h4 className="font-medium text-gray-900 mb-4">Connect New Page</h4>

        <form onSubmit={handleConnect} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Page Name
            </label>
            <input
              type="text"
              value={formData.pageName}
              onChange={(e) => setFormData({ ...formData, pageName: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="My Facebook Page"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Page ID
            </label>
            <input
              type="text"
              value={formData.pageId}
              onChange={(e) => setFormData({ ...formData, pageId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="1234567890"
              required
            />
            <p className="mt-1 text-xs text-gray-500">
              Find this in your Facebook Page settings or via the Graph API
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Access Token
            </label>
            <input
              type="password"
              value={formData.accessToken}
              onChange={(e) => setFormData({ ...formData, accessToken: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="EAAxxxx..."
              required
            />
            <p className="mt-1 text-xs text-gray-500">
              Generate a Page Access Token from{' '}
              <a
                href="https://developers.facebook.com/tools/explorer/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                Graph API Explorer
              </a>
            </p>
          </div>

          <Button
            type="submit"
            disabled={connecting}
            className="bg-blue-600 hover:bg-blue-700 w-full"
          >
            {connecting ? 'Connecting...' : 'Connect Page'}
          </Button>
        </form>
      </div>
    </div>
  );
}
