'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';

export default function Navigation() {
  const { user, logout, isLoading } = useAuth();

  if (isLoading) {
    return (
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <Link href="/" className="text-xl font-bold text-blue-600">
              FB AutoPost
            </Link>
            <div className="w-20 h-8 bg-gray-200 animate-pulse rounded"></div>
          </div>
        </div>
      </nav>
    );
  }

  return (
    <nav className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <Link href="/" className="text-xl font-bold text-blue-600">
            FB AutoPost
          </Link>

          <div className="flex items-center space-x-4">
            {user ? (
              <>
                <Link
                  href="/dashboard"
                  className="text-gray-700 hover:text-blue-600"
                >
                  Dashboard
                </Link>
                <Link
                  href="/posts/list"
                  className="text-gray-700 hover:text-blue-600"
                >
                  Posts
                </Link>
                <Link
                  href="/schedule"
                  className="text-gray-700 hover:text-blue-600"
                >
                  Schedule
                </Link>
                <Link
                  href="/rules"
                  className="text-gray-700 hover:text-blue-600"
                >
                  Rules
                </Link>
                <Link
                  href="/comments"
                  className="text-gray-700 hover:text-blue-600"
                >
                  Comments
                </Link>
                <Link
                  href="/analytics"
                  className="text-gray-700 hover:text-blue-600"
                >
                  Analytics
                </Link>
                <Link
                  href="/settings"
                  className="text-gray-700 hover:text-blue-600"
                >
                  Settings
                </Link>
                <div className="flex items-center space-x-2 ml-4 pl-4 border-l">
                  <span className="text-sm text-gray-600">{user.name}</span>
                  <button
                    onClick={logout}
                    className="text-sm text-gray-500 hover:text-red-600"
                  >
                    Logout
                  </button>
                </div>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-gray-700 hover:text-blue-600"
                >
                  Login
                </Link>
                <Link
                  href="/register"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
