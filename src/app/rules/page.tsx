// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';
import Navigation from '@/components/Navigation';
import Button from '@/components/ui/Button';
import { useAuth } from '@/lib/auth-context';

interface ReplyRule {
  id: string;
  name: string;
  type: 'keyword' | 'sentiment' | 'time';
  isActive: boolean;
  priority: number;
  keywords: string[];
  sentiment?: string;
  daysOfWeek: string[];
  startTime?: string;
  endTime?: string;
  replyTemplate: string;
  action: 'template' | 'ai_reply' | 'escalate';
}

export default function RulesPage() {
  const [rules, setRules] = useState<ReplyRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingRule, setEditingRule] = useState<ReplyRule | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    type: 'keyword' as 'keyword' | 'sentiment' | 'time',
    keywords: '',
    sentiment: 'positive',
    daysOfWeek: ['mon', 'tue', 'wed', 'thu', 'fri'],
    startTime: '09:00',
    endTime: '17:00',
    replyTemplate: '',
    action: 'template' as 'template' | 'ai_reply' | 'escalate',
  });
  const { token } = useAuth();

  useEffect(() => {
    fetchRules();
  }, []);

  const fetchRules = async () => {
    try {
      const response = await fetch('/api/rules', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (response.ok) {
        const data = await response.json();
        setRules(data.rules);
      }
    } catch (error) {
      console.error('Failed to fetch rules:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload = {
      ...formData,
      keywords: formData.keywords
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean),
    };

    try {
      const url = editingRule ? `/api/rules/${editingRule.id}` : '/api/rules';
      const method = editingRule ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        await fetchRules();
        resetForm();
      }
    } catch (error) {
      console.error('Failed to save rule:', error);
    }
  };

  const handleEdit = (rule: ReplyRule) => {
    setEditingRule(rule);
    setFormData({
      name: rule.name,
      type: rule.type,
      keywords: rule.keywords.join(', '),
      sentiment: rule.sentiment || 'positive',
      daysOfWeek: rule.daysOfWeek || [],
      startTime: rule.startTime || '09:00',
      endTime: rule.endTime || '17:00',
      replyTemplate: rule.replyTemplate,
      action: rule.action,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this rule?')) return;

    try {
      const response = await fetch(`/api/rules/${id}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (response.ok) {
        await fetchRules();
      }
    } catch (error) {
      console.error('Failed to delete rule:', error);
    }
  };

  const handleToggle = async (rule: ReplyRule) => {
    try {
      const response = await fetch(`/api/rules/${rule.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ isActive: !rule.isActive }),
      });

      if (response.ok) {
        await fetchRules();
      }
    } catch (error) {
      console.error('Failed to toggle rule:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'keyword',
      keywords: '',
      sentiment: 'positive',
      daysOfWeek: ['mon', 'tue', 'wed', 'thu', 'fri'],
      startTime: '09:00',
      endTime: '17:00',
      replyTemplate: '',
      action: 'template',
    });
    setEditingRule(null);
    setShowForm(false);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'keyword':
        return '🔍';
      case 'sentiment':
        return '😊';
      case 'time':
        return '⏰';
      default:
        return '📋';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'keyword':
        return 'Keyword';
      case 'sentiment':
        return 'Sentiment';
      case 'time':
        return 'Time-based';
      default:
        return type;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading rules...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Auto-Reply Rules</h1>
          <Button
            onClick={() => setShowForm(true)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            Create Rule
          </Button>
        </div>

        {/* Rules Form Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <h2 className="text-lg font-semibold mb-4">
                  {editingRule ? 'Edit Rule' : 'Create New Rule'}
                </h2>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Rule Name
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., Greeting Response"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Rule Type
                    </label>
                    <select
                      value={formData.type}
                      onChange={(e) =>
                        setFormData({ ...formData, type: e.target.value as any })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="keyword">Keyword Match</option>
                      <option value="sentiment">Sentiment</option>
                      <option value="time">Time-based</option>
                    </select>
                  </div>

                  {formData.type === 'keyword' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Keywords (comma-separated)
                      </label>
                      <input
                        type="text"
                        value={formData.keywords}
                        onChange={(e) =>
                          setFormData({ ...formData, keywords: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g., price, cost, how much"
                      />
                    </div>
                  )}

                  {formData.type === 'sentiment' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Match Sentiment
                      </label>
                      <select
                        value={formData.sentiment}
                        onChange={(e) =>
                          setFormData({ ...formData, sentiment: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="positive">Positive</option>
                        <option value="negative">Negative</option>
                        <option value="neutral">Neutral</option>
                        <option value="any">Any</option>
                      </select>
                    </div>
                  )}

                  {formData.type === 'time' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Days of Week
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].map((day) => (
                            <label key={day} className="flex items-center">
                              <input
                                type="checkbox"
                                checked={formData.daysOfWeek.includes(day)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setFormData({
                                      ...formData,
                                      daysOfWeek: [...formData.daysOfWeek, day],
                                    });
                                  } else {
                                    setFormData({
                                      ...formData,
                                      daysOfWeek: formData.daysOfWeek.filter((d) => d !== day),
                                    });
                                  }
                                }}
                                className="mr-1"
                              />
                              <span className="text-sm capitalize">{day}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Start Time
                          </label>
                          <input
                            type="time"
                            value={formData.startTime}
                            onChange={(e) =>
                              setFormData({ ...formData, startTime: e.target.value })
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            End Time
                          </label>
                          <input
                            type="time"
                            value={formData.endTime}
                            onChange={(e) =>
                              setFormData({ ...formData, endTime: e.target.value })
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                    </>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Reply Template
                    </label>
                    <textarea
                      value={formData.replyTemplate}
                      onChange={(e) =>
                        setFormData({ ...formData, replyTemplate: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 h-24"
                      placeholder="Thanks for your comment! {name}"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Action
                    </label>
                    <select
                      value={formData.action}
                      onChange={(e) =>
                        setFormData({ ...formData, action: e.target.value as any })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="template">Use Template</option>
                      <option value="ai_reply">AI Generated Reply</option>
                      <option value="escalate">Escalate (No Reply)</option>
                    </select>
                  </div>

                  <div className="flex gap-4 pt-4">
                    <Button
                      type="submit"
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      {editingRule ? 'Update Rule' : 'Create Rule'}
                    </Button>
                    <Button
                      type="button"
                      onClick={resetForm}
                      className="bg-gray-200 hover:bg-gray-300 text-gray-800"
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Rules List */}
        {rules.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <p className="text-gray-600 mb-4">No auto-reply rules yet</p>
            <Button
              onClick={() => setShowForm(true)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Create Your First Rule
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {rules.map((rule) => (
              <div
                key={rule.id}
                className={`bg-white rounded-lg shadow p-6 ${
                  !rule.isActive ? 'opacity-60' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="text-2xl">{getTypeIcon(rule.type)}</div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900">{rule.name}</h3>
                        <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600">
                          {getTypeLabel(rule.type)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        {rule.replyTemplate.substring(0, 100)}
                        {rule.replyTemplate.length > 100 && '...'}
                      </p>
                      {rule.type === 'keyword' && rule.keywords.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {rule.keywords.slice(0, 5).map((keyword) => (
                            <span
                              key={keyword}
                              className="px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded"
                            >
                              {keyword}
                            </span>
                          ))}
                          {rule.keywords.length > 5 && (
                            <span className="text-xs text-gray-500">
                              +{rule.keywords.length - 5} more
                            </span>
                          )}
                        </div>
                      )}
                      {rule.type === 'time' && (
                        <p className="text-xs text-gray-500 mt-2">
                          {rule.daysOfWeek?.join(', ')} {rule.startTime} - {rule.endTime}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggle(rule)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        rule.isActive ? 'bg-blue-600' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          rule.isActive ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                    <button
                      onClick={() => handleEdit(rule)}
                      className="p-2 text-gray-400 hover:text-gray-600"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(rule.id)}
                      className="p-2 text-gray-400 hover:text-red-600"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
