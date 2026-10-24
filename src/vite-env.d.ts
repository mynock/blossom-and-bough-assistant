// Client-side env vars. Vite embeds every VITE_* value into the public
// bundle at build time, so never put secrets here.
interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_NOTION_DATABASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
