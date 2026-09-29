// next.config.ts basePath. <Link> adds it automatically; fetch() calls don't.
export const BASE_PATH = "/shop";
export const api = (path: string) => `${BASE_PATH}/api${path}`;
