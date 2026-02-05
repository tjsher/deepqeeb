import { redirect } from 'next/navigation';
import ScriptList from '@/components/ScriptList';

export default async function DashboardPage() {
  // SQLite 版本简化处理
  // 使用固定用户 ID 进行开发
  const mockUser = {
    id: 'mock-user-001',
    email: 'dev@example.com'
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="h-16 bg-white border-b border-gray-200 flex items-center px-8 justify-between">
        <span className="text-xl font-bold text-gray-900">DeepQeeb</span>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">{mockUser.email}</span>
          <form action="/api/auth/signout" method="post">
            <button type="submit" className="text-sm text-blue-600 hover:text-blue-800">
              退出
            </button>
          </form>
        </div>
      </header>
      <main className="flex-1">
        <ScriptList userId={mockUser.id} />
      </main>
    </div>
  );
}
