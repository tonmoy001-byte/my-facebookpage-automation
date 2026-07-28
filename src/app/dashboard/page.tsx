'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';
import Navigation from '@/components/Navigation';
import DirectPublish from '@/components/DirectPublish';

interface DashboardStats {
  totalPosts: number;
  scheduled: number;
  published: number;
  failed: number;
}

interface RecentPost {
  id: string;
  content: string;
  status: string;
  createdAt: string;
  facebookPostId: string | null;
}

export default function DashboardPage() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats>({ totalPosts: 0, scheduled: 0, published: 0, failed: 0 });
  const [recentPosts, setRecentPosts] = useState<RecentPost[]>([]);
  const [hasConnectedPage, setHasConnectedPage] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    if (user && token) {
      fetchStats();
      fetchRecentPosts();
      checkFacebookPage();
    }
  }, [user, token]);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/posts?limit=100', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const posts = data.posts || [];
        setStats({
          totalPosts: data.total || posts.length,
          scheduled: posts.filter((p: any) => p.status === 'scheduled').length,
          published: posts.filter((p: any) => p.status === 'published').length,
          failed: posts.filter((p: any) => p.status === 'failed').length,
        });
      }
    } catch (e) {
      console.error('Failed to fetch stats:', e);
    }
  };

  const fetchRecentPosts = async () => {
    try {
      const res = await fetch('/api/posts?limit=5', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setRecentPosts(data.posts || []);
      }
    } catch (e) {
      console.error('Failed to fetch posts:', e);
    }
  };

  const checkFacebookPage = async () => {
    try {
      const res = await fetch('/api/facebook/pages', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setHasConnectedPage(data.pages && data.pages.length > 0);
      }
    } catch {
      setHasConnectedPage(false);
    }
  };

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Navigation />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold mb-6">Welcome back, {user.name}!</h1>

        {!hasConnectedPage && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-yellow-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="text-yellow-800 font-medium">No Facebook page connected</p>
                <p className="text-yellow-700 text-sm">
                  <Link href="/settings" className="underline hover:text-yellow-900">Go to Settings → Facebook</Link> to connect your page before publishing.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <p className="text-sm text-gray-500">Total Posts</p>
            <p className="text-3xl font-bold text-gray-900">{stats.totalPosts}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <p className="text-sm text-gray-500">Scheduled</p>
            <p className="text-3xl font-bold text-blue-600">{stats.scheduled}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <p className="text-sm text-gray-500">Published</p>
            <p className="text-3xl font-bold text-green-600">{stats.published}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <p className="text-sm text-gray-500">Failed</p>
            <p className="text-3xl font-bold text-red-600">{stats.failed}</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Direct Publish */}
          <DirectPublish />

          {/* Recent Activity */}
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <h2 className="text-lg font-semibold mb-4">Recent Posts</h2>
            {recentPosts.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                No posts yet. Use Direct Publish above to create your first post!
              </p>
            ) : (
              <div className="space-y-3">
                {recentPosts.map((post) => (
                  <div key={post.id} className="border border-gray-100 rounded-md p-3">
                    <p className="text-sm text-gray-800 line-clamp-2">{post.content}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        post.status === 'published' ? 'bg-green-100 text-green-700' :
                        post.status === 'scheduled' ? 'bg-blue-100 text-blue-700' :
                        post.status === 'failed' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {post.status}
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date(post.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
