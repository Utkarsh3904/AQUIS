// ml-build-spec §12.3 — API_BASE points at Node backend (:3000)
// Switch to real endpoint by setting EXPO_PUBLIC_API_URL in .env
// Zero code changes needed — just set the variable and restart dev server
export const API_BASE = process.env.EXPO_PUBLIC_API_URL || "";
export const USE_MOCKS = !API_BASE;
