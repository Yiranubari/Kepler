interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_REOWN_PROJECT_ID: string;
  readonly VITE_BITCOIN_NETWORK: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
