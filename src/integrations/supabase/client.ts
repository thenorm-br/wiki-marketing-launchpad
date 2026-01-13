import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://svxcmirrhbgfkpetfafk.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_b5Cod3_vGQPxSiJusIJAhA_NvoAeT92";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});
