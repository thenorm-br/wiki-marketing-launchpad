// Custom Supabase client configured to use the 'wiki' schema
import { createClient, SupabaseClientOptions } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Create options with wiki schema - using type assertion to bypass schema type restriction
const options: SupabaseClientOptions<'public'> = {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
  db: {
    schema: 'wiki' as 'public' // Type assertion - actual schema used is 'wiki'
  }
};

// Create a client that uses the 'wiki' schema instead of 'public'
export const supabaseWiki = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, options);
