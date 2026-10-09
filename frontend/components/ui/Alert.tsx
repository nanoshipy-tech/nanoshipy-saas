import React from 'react';

export const Alert = ({ type = 'info', message, className = '' }: { type?: 'info' | 'error' | 'success', message: string, className?: string }) => {
  const styles = {
    info: 'bg-purple-50 dark:bg-purple-950/20 text-[#4D0582] dark:text-purple-300 border-purple-200 dark:border-blue-900/30',
    error: 'bg-red-50 dark:bg-red-950/20 text-red-800 dark:text-red-300 border-red-200 dark:border-red-900/30',
    success: 'bg-green-50 dark:bg-green-950/20 text-green-800 dark:text-green-300 border-green-200 dark:border-green-900/30',
  };

  return (
    <div className={`p-4 border rounded-md ${styles[type]} ${className}`}>
      {message}
    </div>
  );
};
