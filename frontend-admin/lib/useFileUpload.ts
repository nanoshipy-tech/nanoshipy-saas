import { useState } from 'react';
import { apiClient } from './apiClient';

interface UploadOptions {
  maxSizeBytes?: number;
  allowedMimeTypes?: string[];
}

export const useFileUpload = () => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const uploadFile = async (
    url: string,
    file: File,
    fieldName: string = 'file',
    extraData: Record<string, string> = {},
    options: UploadOptions = {}
  ) => {
    const maxSizeBytes = options.maxSizeBytes || 10 * 1024 * 1024; // Default 10MB
    if (file.size > maxSizeBytes) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      const limitMB = Math.round(maxSizeBytes / (1024 * 1024));
      throw new Error(`File size (${sizeMB}MB) exceeds the maximum allowed size of ${limitMB}MB.`);
    }

    if (options.allowedMimeTypes && options.allowedMimeTypes.length > 0) {
      if (file.type && !options.allowedMimeTypes.includes(file.type)) {
        throw new Error(`File type (${file.type}) is not supported. Allowed formats: ${options.allowedMimeTypes.join(', ')}`);
      }
    }

    setIsUploading(true);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append(fieldName, file);
    
    Object.entries(extraData).forEach(([key, value]) => {
      formData.append(key, value);
    });

    try {
      const response = await apiClient.post(url, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(percentCompleted);
          }
        },
      });

      return response.data;
    } catch (error) {
      throw error;
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  return { uploadFile, isUploading, uploadProgress };
};
