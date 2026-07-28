'use client';

interface ToolResultCardProps {
  tool: string;
  status: 'success' | 'error';
  data: any;
  error?: string;
}

export default function ToolResultCard({ tool, status, data, error }: ToolResultCardProps) {
  if (status === 'error') {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-3 my-2">
        <p className="text-red-700 text-sm font-medium">Error: {error}</p>
      </div>
    );
  }

  switch (tool) {
    case 'generate_image':
      return (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 my-2">
          <p className="text-purple-700 text-xs font-medium mb-2">Generated Image</p>
          {data?.imageUrl && (
            <img src={data.imageUrl} alt={data.prompt || 'Generated'} className="rounded-md max-w-full max-h-64 object-cover" />
          )}
          {data?.prompt && <p className="text-gray-500 text-xs mt-2">{data.prompt}</p>}
        </div>
      );

    case 'generate_caption':
      return (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 my-2">
          <p className="text-blue-700 text-xs font-medium mb-1">Generated Caption</p>
          <p className="text-gray-800 text-sm">{data?.caption}</p>
          {data?.hashtags?.length > 0 && (
            <p className="text-blue-600 text-xs mt-1">{data.hashtags.map((h: string) => `#${h}`).join(' ')}</p>
          )}
        </div>
      );

    case 'create_post':
      return (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 my-2">
          <p className="text-green-700 text-xs font-medium">
            Post Created — <span className="font-bold">{data?.status}</span>
          </p>
          {data?.scheduledAt && (
            <p className="text-gray-500 text-xs mt-1">Scheduled for {new Date(data.scheduledAt).toLocaleString()}</p>
          )}
        </div>
      );

    case 'publish_now':
      return (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 my-2">
          <p className="text-green-700 text-xs font-medium">{data?.message || 'Published to Facebook!'}</p>
          {data?.facebookPostId && (
            <p className="text-gray-500 text-xs mt-1">Post ID: {data.facebookPostId}</p>
          )}
        </div>
      );

    case 'get_analytics':
      return (
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 my-2">
          <p className="text-indigo-700 text-xs font-medium mb-2">Analytics Summary</p>
          <pre className="text-gray-700 text-xs overflow-x-auto">{JSON.stringify(data, null, 2)}</pre>
        </div>
      );

    case 'get_comments':
      return (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 my-2">
          <p className="text-yellow-700 text-xs font-medium mb-2">Comments ({data?.total || 0})</p>
          {data?.comments?.slice(0, 5).map((c: any) => (
            <div key={c.id} className="text-xs text-gray-600 border-b border-yellow-100 py-1">
              <span className="font-medium">{c.authorName || 'User'}</span>: {c.textContent?.substring(0, 80)}
            </div>
          ))}
        </div>
      );

    case 'reply_to_comment':
      return (
        <div className="bg-teal-50 border border-teal-200 rounded-lg p-3 my-2">
          <p className="text-teal-700 text-xs font-medium">Reply sent successfully</p>
        </div>
      );

    case 'list_rules':
      return (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 my-2">
          <p className="text-gray-700 text-xs font-medium mb-2">Rules ({data?.rules?.length || 0})</p>
          {data?.rules?.slice(0, 5).map((r: any) => (
            <div key={r.id} className="text-xs text-gray-600 border-b border-gray-100 py-1">
              <span className="font-medium">{r.name}</span> — {r.type} ({r.action})
            </div>
          ))}
        </div>
      );

    case 'create_rule':
      return (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 my-2">
          <p className="text-orange-700 text-xs font-medium">Rule Created: {data?.name}</p>
        </div>
      );

    default:
      return (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 my-2">
          <pre className="text-gray-600 text-xs overflow-x-auto">{JSON.stringify(data, null, 2)}</pre>
        </div>
      );
  }
}
