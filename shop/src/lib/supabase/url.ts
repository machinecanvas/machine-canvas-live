/**
 * The project URL should be just https://<ref>.supabase.co, but Supabase's
 * dashboard also shows the REST endpoint (…/rest/v1/). Accept either.
 */
export function supabaseProjectUrl(raw: string | undefined): string {
  return (raw ?? "").trim().replace(/\/+$/, "").replace(/\/rest\/v1$/, "").replace(/\/+$/, "");
}
