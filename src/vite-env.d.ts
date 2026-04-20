/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GITHUB_REPO_OWNER: string;
  readonly VITE_GITHUB_REPO_NAME: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
