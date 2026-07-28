'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import Navigation from '@/components/Navigation';
import ChatWindow from '@/components/assistant/ChatWindow';

export default function AssistantPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navigation />
      <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full">
        <div className="py-4 px-6 border-b border-gray-200">
          <h1 className="text-lg font-semibold text-gray-900">AI Assistant</h1>
          <p className="text-sm text-gray-500">Create posts, generate images, manage your page with natural language.</p>
        </div>
        <div className="flex-1 flex flex-col min-h-0">
          <ChatWindow />
        </div>
      </div>
    </div>
  );
}
