/* eslint-disable @typescript-eslint/no-explicit-any */
// TypeScript interfaces for type safety
export interface GeneratedImage {
  image_url: string;
  prompt: string;
  created_at: string;
  remaining_requests: number;
}

export interface RateLimitInfo {
  remaining_requests: number;
  reset_time: string;
  is_limited: boolean;
}

export interface DynamicObject {
    [key: string]: any;
}