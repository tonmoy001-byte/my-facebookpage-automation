// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';

interface ScheduledPost {
  id: string;
  postId: string;
  scheduledAt: string;
  post: {
    content: string;
    mediaUrls: string[];
    status: string;
  };
}

interface CalendarProps {
  scheduledPosts: ScheduledPost[];
  onDateSelect: (date: Date) => void;
  onPostClick: (post: ScheduledPost) => void;
}

export default function Calendar({ scheduledPosts, onDateSelect, onPostClick }: CalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<'month' | 'week'>('month');

  const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
  const startDate = new Date(monthStart);
  startDate.setDate(startDate.getDate() - startDate.getDay());

  const days = [];
  const current = new Date(startDate);

  while (current <= monthEnd || days.length < 42) {
    days.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  const getPostsForDate = (date: Date) => {
    return scheduledPosts.filter((post) => {
      const scheduled = new Date(post.scheduledAt);
      return (
        scheduled.getDate() === date.getDate() &&
        scheduled.getMonth() === date.getMonth() &&
        scheduled.getFullYear() === date.getFullYear()
      );
    });
  };

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const today = new Date();

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-4">
          <button
            onClick={prevMonth}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            ←
          </button>
          <h2 className="text-lg font-semibold">
            {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
          </h2>
          <button
            onClick={nextMonth}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            →
          </button>
        </div>
        <button
          onClick={() => setCurrentDate(new Date())}
          className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
        >
          Today
        </button>
      </div>

      {/* Day Headers */}
      <div className="grid grid-cols-7 border-b">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div key={day} className="p-2 text-center text-sm font-medium text-gray-500">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7">
        {days.map((date, idx) => {
          const posts = getPostsForDate(date);
          const isToday = date.toDateString() === today.toDateString();
          const isCurrentMonth = date.getMonth() === currentDate.getMonth();

          return (
            <div
              key={idx}
              className={`min-h-[100px] border-b border-r p-2 ${
                isCurrentMonth ? 'bg-white' : 'bg-gray-50'
              } ${isToday ? 'bg-blue-50' : ''}`}
            >
              <div
                className={`text-sm mb-1 ${
                  isToday
                    ? 'bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center'
                    : isCurrentMonth
                    ? 'text-gray-900'
                    : 'text-gray-400'
                }`}
              >
                {date.getDate()}
              </div>
              <div className="space-y-1">
                {posts.slice(0, 3).map((post) => (
                  <button
                    key={post.id}
                    onClick={() => onPostClick(post)}
                    className="w-full text-left text-xs p-1 bg-blue-100 text-blue-800 rounded truncate hover:bg-blue-200"
                  >
                    {new Date(post.scheduledAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    {' '}
                     {post.post.content.substring(0, 20)}...
                  </button>
                ))}
                {posts.length > 3 && (
                  <div className="text-xs text-gray-500 text-center">
                    +{posts.length - 3} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
