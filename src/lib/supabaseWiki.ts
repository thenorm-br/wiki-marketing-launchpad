// Helper to query the 'wiki' schema using the main supabase client
// This avoids creating multiple GoTrueClient instances
import { supabase } from '@/integrations/supabase/client';

// The 'wiki' schema exists in DB but has no generated types
type QueryBuilder = ReturnType<typeof supabase.from>;
type SupabaseWithSchema = typeof supabase & {
  schema: (schema: string) => {
    from: (table: string) => QueryBuilder;
  };
};

const wikiSchema = (supabase as unknown as SupabaseWithSchema).schema('wiki');

export const supabaseWiki = {
  from: (table: string): QueryBuilder => wikiSchema.from(table),
  channel: (name: string) => supabase.channel(name),
  removeChannel: (channel: ReturnType<typeof supabase.channel>) => supabase.removeChannel(channel),
};
