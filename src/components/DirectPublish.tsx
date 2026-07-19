'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';

interface PublishResult {
  success?: boolean;
  facebookPostId?: string;
  message?: string;
  error?: string;
}

export default function DirectPublish() {
  const { token } = useAuth();
  const [message, setMessage] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PublishResult | null>(null);

  const handlePublish = async () => {
    if (!message.trim()) return;

    setLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/facebook/publish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: message.trim(),
          imageUrl: imageUrl.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setResult({ success: true, facebookPostId: data.facebookPostId, message: data.message });
        setMessage('');
        setImageUrl('');
      } else {
        setResult({ error: data.error || 'Failed to publish' });
      }
    } catch (err: any) {
      setResult({ error: err.message || 'Network error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <h2 className="text-lg font-semibold mb-4">Direct Publish to Facebook</h2>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Post Message *
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="What's on your mind? Type your Facebook post here..."
            rows={4}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Image URL <span className="text-gray-400">(optional)</span>
          </label>
          <input
            type="url"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://example.com/photo.jpg"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <button
          onClick={handlePublish}
          disabled={loading || !message.trim()}
          className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          {loading ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Publishing...
            </span>
          ) : (
            'Publish Now'
          )}
        </button>

        {result && (
          <div className={`p-3 rounded-md text-sm ${result.success ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
            {result.success ? (
              <div>
                <p className="font-medium">{result.message}</p>
                {result.facebookPostId && (
                  <p className="text-xs mt-1 text-green-600">Facebook Post ID: {result.facebookPostId}</p>
                )}
              </div>
            ) : (
              <p className="font-medium">{result.error}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
