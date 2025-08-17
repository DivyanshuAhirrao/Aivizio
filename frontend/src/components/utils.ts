/* eslint-disable @typescript-eslint/no-explicit-any */
export const getErrorMessage = (error: any): string => {
  if (error.response?.status === 429) return 'Rate limit exceeded. Please try again later.';
  if (error.response?.status === 400) return error.response.data.detail || 'Invalid request';
  if (error.code === 'ECONNABORTED') return 'Request timeout. Please try again.';
  return 'Failed to generate image. Please try again.';
};