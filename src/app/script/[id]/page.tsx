import { redirect } from 'next/navigation';
import IDE from '@/components/IDE';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ScriptPage({ params }: PageProps) {
  const { id } = await params;

  // SQLite 版本简化处理
  // 使用固定用户 ID
  const mockUser = {
    id: 'mock-user-001',
    email: 'dev@example.com'
  };

  return (
    <div className="h-screen flex flex-col">
      <IDE userId={mockUser.id} scriptId={id} />
    </div>
  );
}
