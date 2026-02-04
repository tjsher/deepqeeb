const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function migrate() {
    const connectionString = "postgresql://postgres:2315073343sY@db.crlfeaprmayjsthhxbze.supabase.co:5432/postgres";
    const client = new Client({ connectionString });

    try {
        console.log('Connected to database');
        await client.connect();

        console.log('Cleaning up old schema (Selective drop to refresh policies)...');
        // Selective drop policies we want to update
        const dropPolicies = `
            DROP POLICY IF EXISTS "Users can view their own scripts" ON public.scripts;
            DROP POLICY IF EXISTS "Users can insert their own scripts" ON public.scripts;
            DROP POLICY IF EXISTS "Users can update their own scripts" ON public.scripts;
            DROP POLICY IF EXISTS "Users can delete their own scripts" ON public.scripts;
            
            DROP POLICY IF EXISTS "Users can view files of their scripts" ON public.files;
            DROP POLICY IF EXISTS "Users can insert files to their scripts" ON public.files;
            DROP POLICY IF EXISTS "Users can update files of their scripts" ON public.files;
            DROP POLICY IF EXISTS "Users can delete files of their scripts" ON public.files;

            DROP POLICY IF EXISTS "Users can view conversations of their scripts" ON public.conversations;
            DROP POLICY IF EXISTS "Users can insert conversations to their scripts" ON public.conversations;
            DROP POLICY IF EXISTS "Users can update conversations of their scripts" ON public.conversations;
            DROP POLICY IF EXISTS "Users can delete conversations of their scripts" ON public.conversations;

            DROP POLICY IF EXISTS "Users can view messages of their conversations" ON public.messages;
            DROP POLICY IF EXISTS "Users can insert messages to their conversations" ON public.messages;
        `;
        await client.query(dropPolicies);

        // Re-read and apply schema
        const sqlPath = path.join(__dirname, '../supabase_schema.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('Applying updated schema...');
        await client.query(sql);

        console.log('Migration completed successfully');
    } catch (err) {
        console.error('Migration failed:', err.message);
    } finally {
        await client.end();
    }
}

migrate();
