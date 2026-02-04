import { createClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import IDE from '@/components/IDE';

interface ScriptPageProps {
    params: Promise<{
        id: string;
    }>;
}

export default async function ScriptPage({ params }: ScriptPageProps) {
    const { id: scriptId } = await params;
    const supabase = await createClient();


    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
        redirect('/login');
    }

    return (
        <div className="h-screen flex flex-col">
            {/* 顶部导航栏 */}
            <header className="h-12 bg-gray-900 text-white flex items-center px-4 justify-between">
                <div className="flex items-center gap-4">
                    <a href="/dashboard" className="font-bold text-lg hover:text-blue-400">DeepQeeb</a>
                    <span className="text-gray-500 text-sm">|</span>
                    <span className="text-gray-300 text-sm">剧本编辑器</span>
                </div>
                <div className="flex items-center gap-6">
                    <span className="text-xs text-gray-400">{session.user.email}</span>
                    <a href="/dashboard" className="text-sm text-gray-300 hover:text-white transition-colors">返回仪表盘</a>
                </div>
            </header>

            {/* IDE 主体 */}
            <main className="flex-1 overflow-hidden">
                <IDE userId={session.user.id} scriptId={scriptId} />
            </main>
        </div>
    );
}
