// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';
import Button from '@/components/ui/Button';

interface QueueItem {
  id: string;
  postId: string;
  scheduledAt: string;
  position: number;
  post: {
    id: string;
    content: string;
    mediaUrls: string[];
    status: string;
  };
}

export default function QueueManager() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggedItem, setDraggedItem] = useState<QueueItem | null>(null);

  useEffect(() => {
    fetchQueue();
  }, []);

  const fetchQueue = async () => {
    try {
      const response = await fetch('/api/schedule');
      if (response.ok) {
        const data = await response.json();
        setQueue(
          data.schedules.map((s: any, idx: number) => ({
            ...s,
            position: idx + 1,
          }))
        );
      }
    } catch (error) {
      console.error('Failed to fetch queue:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDragStart = (item: QueueItem) => {
    setDraggedItem(item);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetItem: QueueItem) => {
    e.preventDefault();
    if (!draggedItem || draggedItem.id === targetItem.id) return;

    const newQueue = [...queue];
    const draggedIdx = newQueue.findIndex((item) => item.id === draggedItem.id);
    const targetIdx = newQueue.findIndex((item) => item.id === targetItem.id);

    const [removed] = newQueue.splice(draggedIdx, 1);
    newQueue.splice(targetIdx, 0, removed);

    // Update positions
    const updatedQueue = newQueue.map((item, idx) => ({
      ...item,
      position: idx + 1,
    }));

    setQueue(updatedQueue);
    setDraggedItem(null);

    // TODO: Save new order to backend
    saveOrder(updatedQueue);
  };

  const saveOrder = async (items: QueueItem[]) => {
    // This would call an API to save the queue order
    console.log('Saving queue order:', items.map((i) => ({ id: i.id, position: i.position })));
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newQueue = [...queue];
    [newQueue[index - 1], newQueue[index]] = [newQueue[index], newQueue[index - 1]];
    const updatedQueue = newQueue.map((item, idx) => ({
      ...item,
      position: idx + 1,
    }));
    setQueue(updatedQueue);
    saveOrder(updatedQueue);
  };

  const handleMoveDown = (index: number) => {
    if (index === queue.length - 1) return;
    const newQueue = [...queue];
    [newQueue[index], newQueue[index + 1]] = [newQueue[index + 1], newQueue[index]];
    const updatedQueue = newQueue.map((item, idx) => ({
      ...item,
      position: idx + 1,
    }));
    setQueue(updatedQueue);
    saveOrder(updatedQueue);
  };

  const handleRemoveFromQueue = async (item: QueueItem) => {
    if (!confirm('Remove this post from the queue?')) return;

    try {
      const response = await fetch(`/api/schedule/${item.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await fetchQueue();
      }
    } catch (error) {
      console.error('Failed to remove from queue:', error);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-2 text-gray-600">Loading queue...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 border-b">
        <h3 className="font-semibold text-gray-900">Post Queue</h3>
        <p className="text-sm text-gray-500">Drag to reorder posts</p>
      </div>

      {queue.length === 0 ? (
        <div className="p-8 text-center text-gray-500">
          No posts in queue
        </div>
      ) : (
        <div className="divide-y">
          {queue.map((item, index) => (
            <div
              key={item.id}
              draggable
              onDragStart={() => handleDragStart(item)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, item)}
              className={`p-4 flex items-center gap-4 cursor-move ${
                draggedItem?.id === item.id ? 'bg-blue-50' : 'hover:bg-gray-50'
              }`}
            >
              <div className="flex-shrink-0 w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-sm font-medium">
                {item.position}
              </div>

              <div className="flex-1 min-w-0">
                {item.post.mediaUrls?.[0] && (
                  <img
                    src={item.post.mediaUrls[0]}
                    alt=""
                    className="w-12 h-12 object-cover rounded"
                  />
                )}
                <p className="text-sm text-gray-900 line-clamp-1">{item.post.content}</p>
                <p className="text-xs text-gray-500">
                  {new Date(item.scheduledAt).toLocaleString()}
                </p>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleMoveUp(index)}
                  disabled={index === 0}
                  className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  onClick={() => handleMoveDown(index)}
                  disabled={index === queue.length - 1}
                  className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                >
                  ↓
                </button>
                <button
                  onClick={() => handleRemoveFromQueue(item)}
                  className="p-1 text-red-400 hover:text-red-600"
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
