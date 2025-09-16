export interface CacheEntry {
  sessionId: string;
  cookies: any[];
  localStorage: Record<string, string>;
  sessionStorage: Record<string, string>;
  timestamp: number;
  expiresAt: number;
  appName: string;
  userAgent: string;
  lastUsedFlow: string;
  usageCount: number;
  isLoggedIn: boolean;
}