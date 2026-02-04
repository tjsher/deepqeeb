// 浏览器端 Supabase 客户端
export const createClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase environment variables');
  }
  
  const { createBrowserClient } = require('@supabase/ssr');
  return createBrowserClient(supabaseUrl, supabaseKey);
};

// Admin 客户端 (用于服务端操作)
export const createAdminClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !serviceKey) {
    throw new Error('Missing Supabase environment variables');
  }
  
  const { createClient: createServerClient } = require('@supabase/supabase-js');
  return createServerClient(supabaseUrl, serviceKey);
};
