import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://gyzftxfvpqkznztphnlf.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5emZ0eGZ2cHFrem56dHBobmxmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk3Nzk3NjMsImV4cCI6MjA3NTM1NTc2M30.6e8uirtzU_83hyfxwtOPzISAMi6-FtTMHNe2hw60EP4';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
    }
});