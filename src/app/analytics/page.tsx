// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  ResponsiveContainer,
} from 'recharts';
import Navigation from '@/components/Navigation';
import Button from '@/components/ui/Button';
import { useAuth } from '@/lib/auth-context';

interface SummaryStats {
  totalPosts: number;
  publishedPosts: number;
  scheduledPosts: number;
  totalImpressions: number;
  totalEngagement: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
}

interface TopPost {
  id: string;
  caption: string;
  imageUrl?: string;
  metrics: {
    impressions: number;
    engagement: number;
    likes: number;
    comments: number;
    shares: number;
    date: string;
  };
}

interface DayEngagement {
  day: string;
  avgEngagement: number;
  totalEngagement: number;
  postCount: number;
}

interface AnalyticsData {
  date: string;
  impressions: number;
  engagement: number;
  likes: number;
  comments: number;
  shares: number;
}

export default function AnalyticsPage() {
  const [stats, setStats] = useState<SummaryStats | null>(null);
  const [topPosts, setTopPosts] = useState<TopPost[]>([]);
  const [dayEngagement, setDayEngagement] = useState<DayEngagement[]>([]);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('30');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const { token } = useAuth();

  useEffect(() => {
    fetchData();
  }, [dateRange]);

  const fetchData = async () => {
    setLoading(true);
    try {
      let startDate: string | undefined;
      let endDate: string | undefined;

      if (dateRange === 'custom' && customStartDate && customEndDate) {
        startDate = customStartDate;
        endDate = customEndDate;
      } else if (dateRange !== 'all') {
        const start = new Date();
        start.setDate(start.getDate() - parseInt(dateRange));
        startDate = start.toISOString().split('T')[0];
        endDate = new Date().toISOString().split('T')[0];
      }

      const params = new URLSearchParams();
      if (startDate) params.append('start', startDate);
      if (endDate) params.append('end', endDate);
      params.append('days', dateRange === 'all' ? '365' : dateRange);

      const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};
      const [statsRes, topPostsRes, dayEngRes, analyticsRes] = await Promise.all([
        fetch(`/api/analytics/summary?${params}`, { headers: authHeaders }),
        fetch(`/api/analytics/top-posts?${params}`, { headers: authHeaders }),
        fetch(`/api/analytics/by-day?${params}`, { headers: authHeaders }),
        fetch(`/api/analytics?${params}`, { headers: authHeaders }),
      ]);

      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data.stats);
      }

      if (topPostsRes.ok) {
        const data = await topPostsRes.json();
        setTopPosts(data.posts);
      }

      if (dayEngRes.ok) {
        const data = await dayEngRes.json();
        setDayEngagement(data.engagement);
      }

      if (analyticsRes.ok) {
        const data = await analyticsRes.json();
        // Aggregate analytics by date
        const aggregated = aggregateByDate(data.analytics);
        setAnalyticsData(aggregated);
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const aggregateByDate = (analytics: any[]): AnalyticsData[] => {
    const grouped: Record<string, AnalyticsData> = {};

    for (const item of analytics) {
      if (!grouped[item.date]) {
        grouped[item.date] = {
          date: item.date,
          impressions: 0,
          engagement: 0,
          likes: 0,
          comments: 0,
          shares: 0,
        };
      }
      grouped[item.date].impressions += item.impressions || 0;
      grouped[item.date].engagement += item.engagement || 0;
      grouped[item.date].likes += item.likes || 0;
      grouped[item.date].comments += item.comments || 0;
      grouped[item.date].shares += item.shares || 0;
    }

    return Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date));
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const exportCSV = () => {
    const headers = ['Date', 'Impressions', 'Engagement', 'Likes', 'Comments', 'Shares'];
    const rows = analyticsData.map((d) => [
      d.date,
      d.impressions,
      d.engagement,
      d.likes,
      d.comments,
      d.shares,
    ]);

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-${dateRange}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading analytics...</p>
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
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <div className="flex items-center gap-4">
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="custom">Custom range</option>
              <option value="all">All time</option>
            </select>
            {dateRange === 'custom' && (
              <>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg"
                />
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg"
                />
              </>
            )}
            <Button onClick={exportCSV} className="bg-green-600 hover:bg-green-700">
              Export CSV
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-sm text-gray-500">Total Posts</p>
              <p className="text-3xl font-bold text-gray-900">{stats.totalPosts}</p>
              <p className="text-xs text-gray-500">
                {stats.publishedPosts} published, {stats.scheduledPosts} scheduled
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-sm text-gray-500">Impressions</p>
              <p className="text-3xl font-bold text-blue-600">
                {formatNumber(stats.totalImpressions)}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-sm text-gray-500">Engagement</p>
              <p className="text-3xl font-bold text-green-600">
                {formatNumber(stats.totalEngagement)}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-sm text-gray-500">Total Interactions</p>
              <p className="text-3xl font-bold text-purple-600">
                {formatNumber(stats.totalLikes + stats.totalComments + stats.totalShares)}
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Engagement Over Time Chart */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Engagement Over Time</h2>
            {analyticsData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={analyticsData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => {
                      const date = new Date(value);
                      return `${date.getMonth() + 1}/${date.getDate()}`;
                    }}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="impressions"
                    stroke="#3B82F6"
                    name="Impressions"
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="engagement"
                    stroke="#10B981"
                    name="Engagement"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-gray-500">
                No data available for this period
              </div>
            )}
          </div>

          {/* Engagement by Day of Week */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Engagement by Day</h2>
            {dayEngagement.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={dayEngagement}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Bar
                    dataKey="avgEngagement"
                    fill="#8B5CF6"
                    name="Avg Engagement"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-gray-500">
                No data available
              </div>
            )}
          </div>
        </div>

        {/* Likes vs Comments vs Shares Chart */}
        {analyticsData.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Interactions Breakdown</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analyticsData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => {
                    const date = new Date(value);
                    return `${date.getMonth() + 1}/${date.getDate()}`;
                  }}
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="likes" fill="#EC4899" name="Likes" stackId="a" />
                <Bar dataKey="comments" fill="#F59E0B" name="Comments" stackId="a" />
                <Bar dataKey="shares" fill="#06B6D4" name="Shares" stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Top Performing Posts */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Performing Posts</h2>
          {topPosts.length > 0 ? (
            <div className="space-y-4">
              {topPosts.map((post, idx) => (
                <div key={post.id} className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-800 rounded-full flex items-center justify-center font-bold">
                    {idx + 1}
                  </div>
                  {post.imageUrl && (
                    <img
                      src={post.imageUrl}
                      alt=""
                      className="w-16 h-16 object-cover rounded"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-900 line-clamp-2">{post.caption}</p>
                    <div className="flex gap-4 mt-2 text-sm text-gray-600">
                      <span>👁 {formatNumber(post.metrics.impressions)}</span>
                      <span>❤️ {formatNumber(post.metrics.likes)}</span>
                      <span>💬 {formatNumber(post.metrics.comments)}</span>
                      <span>🔄 {formatNumber(post.metrics.shares)}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">
                      {new Date(post.metrics.date).toLocaleDateString()}
                    </p>
                    <p className="font-semibold text-green-600">
                      {formatNumber(post.metrics.engagement)} engagement
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">
              No published posts with metrics yet
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
