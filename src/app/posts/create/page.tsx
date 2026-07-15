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
          brandVoice: selectedVoice || 'professional',
          hashtags: true,
          maxHashtags: 5,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate caption');
      }

      const data = await response.json();
      setCaption(data.caption);
      setHashtags(data.hashtags);
    } catch (error: any) {
      alert(error.message || 'Failed to generate caption');
    } finally {
      setGenerating(false);
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
      const response = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          caption,
          hashtags,
          imageUrl,
          brandVoiceId: selectedVoice || null,
          scheduledAt: status === 'scheduled' ? scheduledAt : null,
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
