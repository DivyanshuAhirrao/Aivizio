import { AlertCircle } from "lucide-react";
import React from "react";

export const ErrorAlert = React.memo(({ error }: { error: string }) => (
  <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 mb-6">
    <div className="flex items-center text-red-200">
      <AlertCircle className="w-5 h-5 mr-2" />
      <span>{error}</span>
    </div>
  </div>
));