import React from "react";
import type { RateLimitInfo } from "../types/types";
import { Clock } from "lucide-react";

// --- Sub-Components ---
export const RateLimit = React.memo(({ info }: { info: RateLimitInfo | null }) => {
  if (!info) return null;
  return (
    <div className="max-w-md mx-auto mb-6 p-4 bg-white/10 backdrop-blur-sm rounded-lg border border-white/20">
      <div className="flex items-center justify-between text-white">
        <div className="flex items-center">
          <Clock className="w-4 h-4 mr-2" />
          <span className="text-sm">Requests remaining:</span>
        </div>
        <span className="font-bold text-yellow-400">{info.remaining_requests}</span>
      </div>
      {info.is_limited && (
        <p className="text-red-400 text-sm mt-2">
          Rate limit exceeded. Try again later.
        </p>
      )}
    </div>
  );
});