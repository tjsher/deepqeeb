import IDE from '@/components/IDE';

export default async function WorkspacePage() {
  // SQLite 版本简化处理
  const mockUser = {
    id: 'mock-user-001',
    email: 'dev@example.com'
  };

  // 使用一个默认脚本 ID
  const defaultScriptId = 'default-script';

  return (
    <div className="h-screen">
      <IDE userId={mockUser.id} scriptId={defaultScriptId} />
    </div>
  );
}
