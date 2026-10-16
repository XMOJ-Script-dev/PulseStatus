/// <reference types="vite/client" />

import type { SiteConfig } from './types/status';

declare global {
  interface Window {
    PulseStatusConfig?: SiteConfig;
  }
}
