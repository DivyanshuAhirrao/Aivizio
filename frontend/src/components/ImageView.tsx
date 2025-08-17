import React from "react";
import type { GeneratedImage } from "../types/types";
import { Download } from "lucide-react";

export const ImageView = React.memo(
  ({
    image,
    onDownload,
  }: {
    image: GeneratedImage;
    onDownload: () => void;
  }) => (
    <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
      <div className="text-center">
        <img
          src={image.image_url}
          alt={image.prompt}
          className="max-w-full h-auto rounded-lg shadow-2xl mx-auto mb-4"
          style={{ maxHeight: '70vh' }}
        />
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-left">
            <p className="text-white font-medium mb-1">Prompt:</p>
            <p className="text-gray-300 text-sm italic">"{image.prompt}"</p>
            <p className="text-gray-400 text-xs mt-2">
              Generated: {new Date(image.created_at).toLocaleString()}
            </p>
          </div>
          <button
            onClick={onDownload}
            className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200 flex items-center space-x-2"
          >
            <Download className="w-4 h-4" />
            <span>Download</span>
          </button>
        </div>
      </div>
    </div>
  )
);