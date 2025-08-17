/* eslint-disable @typescript-eslint/no-explicit-any */
// src/App.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Download, Loader2, Sparkles, Clock } from 'lucide-react';
import axios from 'axios';
import '../styles/App.css';
import type { GeneratedImage, RateLimitInfo } from '../types/types';
import { getErrorMessage } from './utils';
import { RateLimit } from './RateLimit';
import { ErrorAlert } from './ErrorAlert';
import { ImageView } from './ImageView';

const App: React.FC = () => {
  // --- Memoized constants ---
  const API_URL = useMemo(() => import.meta.env.VITE_API_URL || 'http://localhost:8000', []);
  const CLIENT_IP = useMemo(() => '127.0.0.1', []);

  // --- Local State ---
  const [prompt, setPrompt] = useState<string>('');
  const [generatedImage, setGeneratedImage] = useState<GeneratedImage | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [rateLimitInfo, setRateLimitInfo] = useState<RateLimitInfo | null>(null);

  // --- Fetch current rate limit status ---
  const fetchRateLimitInfo = useCallback(async () => {
    try {
      const response = await axios.get<RateLimitInfo>(
        `${API_URL}/api/rate-limit/${CLIENT_IP}`
      );
      setRateLimitInfo(response.data);
    } catch (error) {
      // Silent fail is ok here for UX
      console.error('Failed to fetch rate limit info:', error);
    }
  }, [API_URL, CLIENT_IP]);

  useEffect(() => {
    fetchRateLimitInfo();
  }, [fetchRateLimitInfo]);

  // --- Submit handler: Generate Image ---
  const handleGenerateImage = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const userPrompt = prompt.trim();
      if (!userPrompt) {
        setError('Please enter a prompt');
        return;
      }
      if (userPrompt.length < 3) {
        setError('Prompt must be at least 3 characters long');
        return;
      }
      setIsLoading(true);
      setError('');
      setGeneratedImage(null);
      try {
        const response = await axios.post<GeneratedImage>(
          `${API_URL}/api/generate-image`,
          {
            prompt: userPrompt,
            size: '1024x1024',
            quality: 'standard',
          },
          {
            headers: { 'Content-Type': 'application/json' },
            timeout: 60000,
          }
        );
        setGeneratedImage(response.data);
        setRateLimitInfo(prev =>
          prev
            ? { ...prev, remaining_requests: response.data.remaining_requests }
            : null
        );
      } catch (error: any) {
        setError(getErrorMessage(error));
      } finally {
        setIsLoading(false);
      }
    },
    [prompt, API_URL]
  );

  // --- Handler: Download Image ---
  const handleDownloadImage = useCallback(async () => {
    if (!generatedImage) return;
    try {
      const response = await axios.get(generatedImage.image_url, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `visualize-ai-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      setError('Failed to download image');
    }
  }, [generatedImage]);

  // --- Main Render ---
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <Sparkles className="w-8 h-8 text-yellow-400 mr-2" />
            <h1 className="text-4xl md:text-6xl font-bold text-white">
              Aivizio
            </h1>
          </div>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            Transform your imagination into stunning visuals with AI-powered image generation
          </p>
        </div>

        {/* Rate Limit Info */}
        <RateLimit info={rateLimitInfo} />

        {/* Main Content */}
        <div className="max-w-4xl mx-auto">
          {/* Input Form */}
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 mb-8 border border-white/20">
            <form onSubmit={handleGenerateImage} className="space-y-4">
              <div>
                <label htmlFor="prompt" className="block text-white text-sm font-medium mb-2">
                  Describe your vision
                </label>
                <textarea
                  id="prompt"
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  placeholder="e.g., A majestic dragon flying over a cyberpunk city at sunset..."
                  className="w-full p-4 bg-white/20 border border-white/30 rounded-lg text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                  rows={4}
                  maxLength={1000}
                  disabled={isLoading}
                />
                <div className="text-right text-sm text-gray-400 mt-1">
                  {prompt.length}/1000
                </div>
              </div>
              <button
                type="submit"
                disabled={
                  isLoading ||
                  !prompt.trim() ||
                  (rateLimitInfo?.is_limited ?? false)
                }
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-gray-600 disabled:to-gray-600 text-white font-semibold py-4 px-6 rounded-lg transition-all duration-200 flex items-center justify-center space-x-2 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Generating magic...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    <span>Generate Image</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Error Display */}
          {error && <ErrorAlert error={error} />}

          {/* Generated Image Display */}
          {generatedImage && (
            <ImageView image={generatedImage} onDownload={handleDownloadImage} />
          )}

          {/* Feature Info */}
          <div className="mt-12 grid md:grid-cols-3 gap-6 text-center">
            <div className="bg-white/5 backdrop-blur-sm rounded-lg p-6 border border-white/10">
              <Sparkles className="w-8 h-8 text-yellow-400 mx-auto mb-3" />
              <h3 className="text-white font-semibold mb-2">AI-Powered</h3>
              <p className="text-gray-400 text-sm">
                Powered by OpenAI's DALL-E for stunning image generation
              </p>
            </div>
            <div className="bg-white/5 backdrop-blur-sm rounded-lg p-6 border border-white/10">
              <Clock className="w-8 h-8 text-blue-400 mx-auto mb-3" />
              <h3 className="text-white font-semibold mb-2">Rate Limited</h3>
              <p className="text-gray-400 text-sm">
                10 free generations per hour to ensure fair usage
              </p>
            </div>
            <div className="bg-white/5 backdrop-blur-sm rounded-lg p-6 border border-white/10">
              <Download className="w-8 h-8 text-green-400 mx-auto mb-3" />
              <h3 className="text-white font-semibold mb-2">Download Ready</h3>
              <p className="text-gray-400 text-sm">
                Download your creations in high quality PNG format
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
