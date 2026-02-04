'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import type { Script } from '@/types/database';

interface ScriptListProps {
    userId: string;
}

export default function ScriptList({ userId }: ScriptListProps) {
    const [scripts, setScripts] = useState<Script[]>([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const supabase = createClient();

    const loadScripts = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('scripts')
            .select('*')
            .eq('user_id', userId)
            .order('updated_at', { ascending: false });

        if (error) {
            console.error('加载剧本失败:', error.message);
            setLoading(false);
            return;
        }

        setScripts(data || []);
        setLoading(false);
    };

    useEffect(() => {
        loadScripts();
    }, [userId]);

    const handleCreate = async () => {
        const name = prompt('请输入剧本名称');
        if (!name) return;

        // 1. 创建 Script
        const { data, error } = await supabase
            .from('scripts')
            .insert({
                user_id: userId,
                name,
                description: 'New Script Project',
            })
            .select()
            .single();

        if (error) {
            alert('创建失败: ' + error.message);
            return;
        }

        // 2. 自动创建一些初始文件夹
        // 虚拟文件系统初始化
        const scriptId = data.id;
        const initialFiles = [
            { script_id: scriptId, path: '/剧本', type: 'folder' },
            { script_id: scriptId, path: '/src', type: 'folder' },
            { script_id: scriptId, path: '/剧本/readme.md', type: 'file', content: `# ${name}\n\n这是你的新剧本。` }
        ];

        await supabase.from('files').insert(initialFiles);

        // 跳转
        router.push(`/script/${scriptId}`);
    };

    if (loading) return <div className="p-8 text-center text-gray-500">加载中...</div>;

    return (
        <div className="p-8 max-w-5xl mx-auto">
            <div className="flex items-center justify-between mb-8">
                <h1 className="text-2xl font-bold text-gray-800">我的剧本</h1>
                <button
                    onClick={handleCreate}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                >
                    + 创作新剧本
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {scripts.map((script) => (
                    <div
                        key={script.id}
                        onClick={() => router.push(`/script/${script.id}`)}
                        className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 hover:shadow-md hover:border-blue-400 cursor-pointer transition flex flex-col h-48"
                    >
                        <h3 className="text-lg font-semibold text-gray-800 mb-2 truncate">
                            {script.name}
                        </h3>
                        <p className="text-sm text-gray-500 line-clamp-2 flex-1">
                            {script.description || '暂无描述'}
                        </p>
                        <div className="mt-4 text-xs text-gray-400">
                            更新于 {new Date(script.updated_at).toLocaleDateString()}
                        </div>
                    </div>
                ))}

                {/* Empty State placeholder if needed */}
                {scripts.length === 0 && (
                    <div className="col-span-full py-12 text-center text-gray-400 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                        <p>还没有创建任何剧本</p>
                        <p className="text-sm mt-1">点击右上角按钮开始创作</p>
                    </div>
                )}
            </div>
        </div>
    );
}
