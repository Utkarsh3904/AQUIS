// ml-build-spec §12.3 — API_BASE points at ML service
// Set EXPO_PUBLIC_API_URL in .env to override the default
export const API_BASE = process.env.EXPO_PUBLIC_API_URL || "https://solving-wells-civil-synopsis.trycloudflare.com";
export const USE_MOCKS = process.env.EXPO_PUBLIC_USE_MOCKS === "true";
