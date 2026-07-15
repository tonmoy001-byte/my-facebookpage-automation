// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';
import Navigation from '@/components/Navigation';
import Button from '@/components/ui/Button';

interface Comment {
  id: string;
  facebookCommentId: string;
  content: string;
  authorName: string;
  authorId: string;
  status: string;
  reply?: string;
  repliedAt?: string;
  createdAt: string;
  page: {
    pageName: string;
  };
  rule?: {
    name: string;
  };
}

export default function CommentsPage() {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  useEffect(() => {
    fetchComments();
  }, [filter, page]);

  const fetchComments = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: ((page - 1) * limit).toString(),
      });
      if (filter) params.append('status', filter);

      const response = await fetch(`/api/comments?${params}`);
      if (response.ok) {
        const data = await response.json();
        setComments(data.comments);
        setTotal(data.total);
      }
    } catch (error) {
      console.error('Failed to fetch comments:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'replied':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'ignored':
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
          <h1 className="text-2xl font-bold text-gray-900">Comments</h1>
          <div className="text-sm text-gray-600">
            {total} total comments
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-6">
          {['', 'pending', 'replied', 'ignored'].map((status) => (
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

        {/* Comments List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading comments...</p>
          </div>
        ) : comments.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <p className="text-gray-600">No comments found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {comments.map((comment) => (
              <div
                key={comment.id}
                className="bg-white rounded-lg shadow p-6"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">
                        {comment.authorName}
                      </span>
                      <span className="text-sm text-gray-500">
                        on {comment.page.pageName}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(comment.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {comment.rule && (
                      <span className="px-2 py-0.5 text-xs bg-purple-100 text-purple-800 rounded">
                        {comment.rule.name}
                      </span>
                    )}
                    <span
                      className={`px-2 py-0.5 text-xs rounded-full ${getStatusColor(
                        comment.status
                      )}`}
                    >
                      {comment.status}
                    </span>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                  <p className="text-gray-900">{comment.content}</p>
                </div>

                {comment.reply && (
                  <div className="bg-blue-50 rounded-lg p-4 ml-8">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-medium text-blue-800">
                        Auto-reply
                      </span>
                      {comment.repliedAt && (
                        <span className="text-xs text-blue-600">
                          {new Date(comment.repliedAt).toLocaleString()}
                        </span>
                      )}
                    </div>
                    <p className="text-blue-900">{comment.reply}</p>
                  </div>
                )}
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
