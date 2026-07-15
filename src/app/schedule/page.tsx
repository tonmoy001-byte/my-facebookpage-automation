// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navigation from '@/components/Navigation';
import Calendar from '@/components/Calendar';
import Button from '@/components/ui/Button';
import { useAuth } from '@/lib/auth-context';

interface ScheduledPost {
  id: string;
  postId: string;
  scheduledAt: string;
  status: string;
  retryCount: number;
  post: {
    id: string;
    content: string;
    mediaUrls: string[];
    status: string;
    brandVoice?: string;
  };
}

const statusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800' },
  processing: { label: 'Processing', color: 'bg-blue-100 text-blue-800' },
  completed: { label: 'Published', color: 'bg-green-100 text-green-800' },
  failed: { label: 'Failed', color: 'bg-red-100 text-red-800' },
};

export default function SchedulePage() {
  const router = useRouter();
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPost, setSelectedPost] = useState<ScheduledPost | null>(null);
  const { token } = useAuth();

  useEffect(() => {
    fetchScheduledPosts();
  }, []);

  const fetchScheduledPosts = async () => {
    try {
      const response = await fetch('/api/schedule', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (response.ok) {
        const data = await response.json();
        setScheduledPosts(data.schedules);
      }
    } catch (error) {
      console.error('Failed to fetch scheduled posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (scheduleId: string) => {
    if (!confirm('Are you sure you want to unschedule this post?')) return;

    try {
      const response = await fetch(`/api/schedule/${scheduleId}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (response.ok) {
        await fetchScheduledPosts();
        setSelectedPost(null);
      }
    } catch (error) {
      console.error('Failed to delete schedule:', error);
    }
  };

  const handlePostClick = (post: ScheduledPost) => {
    setSelectedPost(post);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading schedule...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Schedule</h1>
          <Button
            onClick={() => router.push('/posts/create')}
            className="bg-blue-600 hover:bg-blue-700"
          >
            Create New Post
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Calendar */}
          <div className="lg:col-span-2">
            <Calendar
              scheduledPosts={scheduledPosts}
              onDateSelect={() => {}}
              onPostClick={handlePostClick}
            />
          </div>

          {/* Sidebar - Upcoming Posts */}
          <div className="space-y-6">
            {/* Selected Post Details */}
            {selectedPost && (
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900">Selected Post</h3>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig[selectedPost.status]?.color || 'bg-gray-100 text-gray-800'}`}>
                    {statusConfig[selectedPost.status]?.label || selectedPost.status}
                  </span>
                </div>
                 {selectedPost.post.mediaUrls?.[0] && (
                    <img
                      src={selectedPost.post.mediaUrls[0]}
                      alt=""
                      className="w-full h-40 object-cover rounded-lg mb-4"
                    />
                  )}
                  <p className="text-gray-900 mb-2">{selectedPost.post.content}</p>
                <p className="text-sm text-gray-500 mb-1">
                  Scheduled for: {new Date(selectedPost.scheduledAt).toLocaleString()}
                </p>
                {selectedPost.status === 'failed' && selectedPost.retryCount > 0 && (
                  <p className="text-sm text-red-600 mb-2">
                    Failed after {selectedPost.retryCount} {selectedPost.retryCount === 1 ? 'retry' : 'retries'}
                  </p>
                )}
                {selectedPost.status === 'pending' && (
                  <div className="flex gap-2 mt-4">
                    <Button
                      onClick={() => handleDelete(selectedPost.id)}
                      className="bg-red-100 hover:bg-red-200 text-red-700 text-sm"
                    >
                      Unschedule
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Upcoming Posts List */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Scheduled Posts</h3>
              {scheduledPosts.length === 0 ? (
                <p className="text-gray-500 text-sm">No scheduled posts</p>
              ) : (
                <div className="space-y-3">
                  {scheduledPosts.slice(0, 10).map((schedule) => (
                    <div
                      key={schedule.id}
                      onClick={() => setSelectedPost(schedule)}
                      className={`p-3 rounded-lg cursor-pointer transition-colors ${
                        selectedPost?.id === schedule.id
                          ? 'bg-blue-50 border border-blue-200'
                          : 'bg-gray-50 hover:bg-gray-100'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm text-gray-900 line-clamp-2 flex-1">
                          {schedule.post.content}
                        </p>
                        <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig[schedule.status]?.color || 'bg-gray-100 text-gray-800'}`}>
                          {statusConfig[schedule.status]?.label || schedule.status}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(schedule.scheduledAt).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Stats */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Stats</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Total Scheduled</span>
                  <span className="font-medium">{scheduledPosts.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Pending</span>
                  <span className="font-medium text-yellow-600">
                    {scheduledPosts.filter((s) => s.status === 'pending').length}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Failed</span>
                  <span className="font-medium text-red-600">
                    {scheduledPosts.filter((s) => s.status === 'failed').length}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">This Week</span>
                  <span className="font-medium">
                    {
                      scheduledPosts.filter((s) => {
                        const date = new Date(s.scheduledAt);
                        const now = new Date();
                        const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
                        return date >= now && date <= weekFromNow;
                      }).length
                    }
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">This Month</span>
                  <span className="font-medium">
                    {
                      scheduledPosts.filter((s) => {
                        const date = new Date(s.scheduledAt);
                        const now = new Date();
                        return (
                          date.getMonth() === now.getMonth() &&
                          date.getFullYear() === now.getFullYear()
                        );
                      }).length
                    }
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
