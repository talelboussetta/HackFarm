const isDev = import.meta.env.DEV;
export const log = {
  info: (...args) => isDev && console.log("[HF]", ...args),
  error: (...args) => isDev && console.error("[HF]", ...args),
  warn: (...args) => isDev && console.warn("[HF]", ...args),
};
