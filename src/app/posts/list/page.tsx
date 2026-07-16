// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navigation from '@/components/Navigation';
import Button from '@/components/ui/Button';
import { useAuth } from '@/lib/auth-context';

interface Post {
  id: string;
  content: string;
  mediaUrls: string[];
  status: string;
  brandVoice?: string;
  createdAt: string;
  publishJob?: {
    scheduledAt: string;
    status: string;
  };
}

export default function PostsListPage() {
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 10;
  const { token } = useAuth();

  useEffect(() => {
    fetchPosts();
  }, [filter, page]);

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: ((page - 1) * limit).toString(),
      });
      if (filter) params.append('status', filter);

      const response = await fetch(`/api/posts?${params}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (response.ok) {
        const data = await response.json();
        setPosts(data.posts);
        setTotal(data.total);
      }
    } catch (error) {
      console.error('Failed to fetch posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this post?')) return;

    try {
      const response = await fetch(`/api/posts/${id}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (response.ok) {
        fetchPosts();
      }
    } catch (error) {
      console.error('Failed to delete post:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'published':
        return 'bg-green-100 text-green-800';
      case 'scheduled':
        return 'bg-blue-100 text-blue-800';
      case 'draft':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Posts</h1>
          <Button
            onClick={() => router.push('/posts/create')}
            className="bg-blue-600 hover:bg-blue-700"
          >
            Create New Post
          </Button>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-6">
          {['', 'draft', 'scheduled', 'published'].map((status) => (
            <button
              key={status}
              onClick={() => {
                setFilter(status);
                setPage(1);
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                filter === status
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              {status || 'All'}
            </button>
          ))}
        </div>

        {/* Posts List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading posts...</p>
          </div>
        ) : posts.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <p className="text-gray-600">No posts found</p>
            <Button
              onClick={() => router.push('/posts/create')}
              className="mt-4 bg-blue-600 hover:bg-blue-700"
            >
              Create Your First Post
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => (
              <div
                key={post.id}
                className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start gap-4">
                  {post.mediaUrls?.[0] && (
                    <img
                      src={post.mediaUrls[0]}
                      alt=""
                      className="w-20 h-20 object-cover rounded-lg flex-shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                          post.status
                        )}`}
                      >
                        {post.status}
                      </span>
                      {post.brandVoice && (
                        <span className="text-xs text-gray-500">
                          {post.brandVoice}
                        </span>
                      )}
                    </div>
                    <p className="text-gray-900 line-clamp-2 mb-2">{post.content}</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button
                      onClick={() => router.push(`/posts/${post.id}`)}
                      className="bg-gray-200 hover:bg-gray-300 text-gray-800 text-sm"
                    >
                      Edit
                    </Button>
                    <Button
                      onClick={() => handleDelete(post.id)}
                      className="bg-red-100 hover:bg-red-200 text-red-700 text-sm"
                    >
                      Delete
                    </Button>
                  </div>
                </div>
                <div className="mt-4 text-xs text-gray-500">
                  {post.publishJob?.scheduledAt
                    ? `Scheduled for ${new Date(
                        post.publishJob.scheduledAt
                      ).toLocaleString()}`
                    : `Created ${new Date(post.createdAt).toLocaleDateString()}`}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {total > limit && (
          <div className="flex justify-center gap-2 mt-8">
            <Button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="bg-gray-200 hover:bg-gray-300 text-gray-800"
            >
              Previous
            </Button>
            <span className="px-4 py-2 text-gray-700">
              Page {page} of {Math.ceil(total / limit)}
            </span>
            <Button
              onClick={() => setPage(page + 1)}
              disabled={page >= Math.ceil(total / limit)}
              className="bg-gray-200 hover:bg-gray-300 text-gray-800"
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
