// Helper to query the 'wiki' schema using the main supabase client
// This avoids creating multiple GoTrueClient instances
import { supabase } from '@/integrations/supabase/client';

// Cast to any to bypass TypeScript's schema type checking
// The 'wiki' schema exists in DB but has no generated types
const wikiSchema = (supabase as any).schema('wiki');

// Export a helper for wiki schema queries (returns any to avoid type conflicts)
export const supabaseWiki = {
  from: (table: string): any => wikiSchema.from(table),
  channel: (name: string) => supabase.channel(name),
  removeChannel: (channel: ReturnType<typeof supabase.channel>) => supabase.removeChannel(channel),
};
