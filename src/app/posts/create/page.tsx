// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navigation from '@/components/Navigation';
import FileUpload from '@/components/FileUpload';
import Button from '@/components/ui/Button';
import { useAuth } from '@/lib/auth-context';

interface BrandVoice {
  id: string;
  name: string;
  description: string;
  tone: string;
}

export default function CreatePostPage() {
  const router = useRouter();
  const [brandVoices, setBrandVoices] = useState<BrandVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [caption, setCaption] = useState('');
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [hashtagInput, setHashtagInput] = useState('');
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [scheduledAt, setScheduledAt] = useState('');
  const [language, setLanguage] = useState<'EN' | 'BN'>('EN');
  const [tone, setTone] = useState('professional');
  const [autoReply, setAutoReply] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const { token } = useAuth();

  useEffect(() => {
    fetchBrandVoices();
  }, []);

  const fetchBrandVoices = async () => {
    try {
      const response = await fetch('/api/brand-voices', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (response.ok) {
        const data = await response.json();
        setBrandVoices(data.voices);
      }
    } catch (error) {
      console.error('Failed to fetch brand voices:', error);
    }
  };

  const handleGenerateCaption = async () => {
    if (!description) {
      alert('Please enter a description first');
      return;
    }

    setGenerating(true);
    try {
      const response = await fetch('/api/ai/caption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          imageUrl,
          description,
          language,
          tone,
          brandVoiceId: selectedVoice || null,
          includeHashtags: true,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate caption');
      }

      const data = await response.json();
      setCaption(data.caption || data.data?.caption || '');
      setHashtags(data.hashtags || data.data?.hashtags || []);
    } catch (error: any) {
      alert(error.message || 'Failed to generate caption');
    } finally {
      setGenerating(false);
    }
  };

  const handleAnalyzeImage = async () => {
    if (!imageUrl) return;
    setAnalyzing(true);
    try {
      const response = await fetch('/api/ai/image/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ imageUrl }),
      });
      if (!response.ok) throw new Error('Failed to analyze image');
      const data = await response.json();
      const result = data.data || data;
      setDescription(result.description || '');
    } catch (error: any) {
      alert(error.message || 'Failed to analyze image');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSave = async (status: 'draft' | 'scheduled') => {
    if (!caption) {
      alert('Please enter a caption');
      return;
    }

    if (status === 'scheduled' && !scheduledAt) {
      alert('Please select a date and time to schedule');
      return;
    }

    setSaving(true);
    try {
      // Convert local datetime-local value to ISO with timezone offset
      // e.g. "2026-07-15T18:53" → "2026-07-15T18:53:00+06:00"
      let isoScheduledAt = null;
      if (status === 'scheduled' && scheduledAt) {
        const localDate = new Date(scheduledAt);
        const offset = -localDate.getTimezoneOffset();
        const sign = offset >= 0 ? '+' : '-';
        const h = Math.floor(Math.abs(offset) / 60).toString().padStart(2, '0');
        const m = (Math.abs(offset) % 60).toString().padStart(2, '0');
        isoScheduledAt = scheduledAt + ':00' + sign + h + ':' + m;
      }

      const response = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          caption,
          hashtags,
          imageUrl,
          brandVoiceId: selectedVoice || null,
          scheduledAt: isoScheduledAt,
          language,
          autoReply,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save post');
      }

      router.push('/dashboard');
    } catch (error: any) {
      alert(error.message || 'Failed to save post');
    } finally {
      setSaving(false);
    }
  };

  const addHashtag = () => {
    if (hashtagInput && !hashtags.includes(hashtagInput)) {
      setHashtags([...hashtags, hashtagInput.replace('#', '')]);
      setHashtagInput('');
    }
  };

  const removeHashtag = (tag: string) => {
    setHashtags(hashtags.filter((h) => h !== tag));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-8">Create New Post</h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column - Content */}
          <div className="space-y-6">
            {/* Image Upload */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Media</h2>
              {imageUrl ? (
                <div className="relative">
                  <img
                    src={imageUrl}
                    alt="Preview"
                    className="w-full h-64 object-cover rounded-lg"
                  />
                  <button
                    onClick={() => setImageUrl(null)}
                    className="absolute top-2 right-2 bg-red-600 text-white p-2 rounded-full hover:bg-red-700"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <FileUpload onUpload={(url) => setImageUrl(url)} />
              )}
              {imageUrl ? (
                <p className="mt-2 text-sm text-green-600 flex items-center gap-1">
                  <span className="inline-block w-2 h-2 rounded-full bg-green-500"></span>
                  Image attached
                  <button
                    onClick={handleAnalyzeImage}
                    disabled={analyzing}
                    className="ml-2 text-blue-600 hover:text-blue-800 underline"
                  >
                    {analyzing ? 'Analyzing...' : 'Analyze image'}
                  </button>
                </p>
              ) : (
                <p className="mt-2 text-sm text-gray-400 flex items-center gap-1">
                  <span className="inline-block w-2 h-2 rounded-full bg-gray-300"></span>
                  No image attached — post will be text only
                </p>
              )}
            </div>

            {/* Description */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Description</h2>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your post for AI caption generation..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 h-32"
              />
            </div>

            {/* Language, Tone, Auto-reply */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Post Settings</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Language</label>
                  <div className="flex rounded-lg border border-gray-300 overflow-hidden">
                    <button
                      onClick={() => setLanguage('EN')}
                      className={`flex-1 py-2 text-sm font-medium ${language === 'EN' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                    >
                      English
                    </button>
                    <button
                      onClick={() => setLanguage('BN')}
                      className={`flex-1 py-2 text-sm font-medium ${language === 'BN' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                    >
                      বাংলা
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tone</label>
                  <select
                    value={tone}
                    onChange={(e) => setTone(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="professional">Professional</option>
                    <option value="casual">Casual</option>
                    <option value="funny">Funny</option>
                    <option value="inspirational">Inspirational</option>
                    <option value="educational">Educational</option>
                    <option value="romantic">Romantic</option>
                    <option value="witty">Witty</option>
                  </select>
                </div>
              </div>
              <div className="mt-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoReply}
                    onChange={(e) => setAutoReply(e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Enable auto-reply for comments on this post</span>
                </label>
              </div>
            </div>

            {/* Caption */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Caption</h2>
                <Button
                  onClick={handleGenerateCaption}
                  disabled={generating || !description}
                  className="bg-purple-600 hover:bg-purple-700 text-sm"
                >
                  {generating ? 'Generating...' : 'Generate with AI'}
                </Button>
              </div>
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Write your caption or generate one with AI..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 h-40"
              />
              <p className="mt-2 text-sm text-gray-500">{caption.length}/500 characters</p>
            </div>

            {/* Hashtags */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Hashtags</h2>
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  value={hashtagInput}
                  onChange={(e) => setHashtagInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addHashtag()}
                  placeholder="Add hashtag..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <Button onClick={addHashtag} className="bg-gray-200 hover:bg-gray-300 text-gray-800">
                  Add
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {hashtags.map((tag) => (
                  <span
                    key={tag}
                    className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm flex items-center gap-1"
                  >
                    #{tag}
                    <button
                      onClick={() => removeHashtag(tag)}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column - Settings */}
          <div className="space-y-6">
            {/* Brand Voice */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Brand Voice</h2>
              <select
                value={selectedVoice}
                onChange={(e) => setSelectedVoice(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select a brand voice...</option>
                {brandVoices.map((voice) => (
                  <option key={voice.id} value={voice.id}>
                    {voice.name} - {voice.tone}
                  </option>
                ))}
              </select>
              {selectedVoice && (
                <p className="mt-2 text-sm text-gray-600">
                  {brandVoices.find((v) => v.id === selectedVoice)?.description}
                </p>
              )}
            </div>

            {/* Schedule */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Schedule</h2>
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="mt-2 text-sm text-gray-500">
                Leave empty to save as draft
              </p>
            </div>

            {/* Actions */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Actions</h2>
              <div className="space-y-3">
                <Button
                  onClick={() => handleSave('scheduled')}
                  disabled={saving || !caption}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  {saving ? 'Saving...' : 'Schedule Post'}
                </Button>
                <Button
                  onClick={() => handleSave('draft')}
                  disabled={saving || !caption}
                  className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800"
                >
                  {saving ? 'Saving...' : 'Save as Draft'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
