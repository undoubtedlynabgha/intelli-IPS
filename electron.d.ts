export {};

declare global {
  interface Window {
    electron?: {
      /** Returns the Gemini API key from file-based config or baked-in build value */
      getApiKey: () => string | null;

      /** Returns the Electron app userData directory path (e.g. %APPDATA%\Intelli IPS) */
      getUserDataPath: () => string | null;

      /**
       * Registers a callback that fires when the Python backend process is
       * confirmed to be listening on port 8000.
       */
      onBackendReady: (callback: () => void) => void;
    };
  }
}
