import { createBrowserClient } from "@supabase/ssr";
import { supabaseProjectUrl } from "@/lib/supabase/url";

export function supabaseBrowser() {
  return createBrowserClient(supabaseProjectUrl(process.env.NEXT_PUBLIC_SUPABASE_URL), process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
}
