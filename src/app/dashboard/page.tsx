import { createClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import ScriptList from '@/components/ScriptList';

export default async function DashboardPage() {
    const supabase = await createClient();

    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
        redirect('/login');
    }


    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            <header className="h-16 bg-white border-b border-gray-200 flex items-center px-8 justify-between">
                <span className="text-xl font-bold text-gray-900">DeepQeeb</span>
                <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-500">{session.user.email}</span>
                    <form action="/api/auth/signout" method="post">
                        <button type="submit" className="text-sm text-blue-600 hover:text-blue-800">
                            退出
                        </button>
                    </form>
                </div>
            </header>
            <main className="flex-1">
                <ScriptList userId={session.user.id} />
            </main>
        </div>
    );
}
