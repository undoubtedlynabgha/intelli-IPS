export {};

declare global {
  interface Window {
    electron?: {
      getApiKey: () => string | null;
    };
  }
}



