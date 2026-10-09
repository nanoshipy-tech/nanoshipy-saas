import React from 'react';
import './globals.css';
import { AuthProvider } from '@/lib/authStore';
import { ThemeProvider } from '@/lib/themeStore';

export const metadata = {
  title: 'Nanoshipy — Superadmin Platform',
  description: 'Elite multi-tenant courier aggregator superadmin control center',
  icons: {
    icon: '/favicon.png',
    shortcut: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.png" type="image/png" />
        <link rel="shortcut icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var saved = localStorage.getItem('admin_theme');
                  var isDark = saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches);
                  if (isDark) {
                    document.documentElement.setAttribute('data-theme', 'dark');
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.setAttribute('data-theme', 'light');
                    document.documentElement.classList.remove('dark');
                  }
                } catch (_) {}

                if (typeof window !== 'undefined') {
                  // Intercept console.error to filter out extension noise
                  var _origConsoleError = console.error;
                  console.error = function() {
                    var msg = '';
                    for (var i = 0; i < arguments.length; i++) {
                      var arg = arguments[i];
                      if (typeof arg === 'string') msg += ' ' + arg;
                      else if (arg && arg.message) msg += ' ' + arg.message;
                    }
                    if (
                      msg.indexOf('Could not establish connection') !== -1 ||
                      msg.indexOf('Receiving end does not exist') !== -1 ||
                      msg.indexOf('message channel closed') !== -1
                    ) {
                      return;
                    }
                    return _origConsoleError.apply(console, arguments);
                  };

                  window.addEventListener('unhandledrejection', function(event) {
                    var reason = event && (event.reason || event);
                    var msg = reason && (reason.message || (typeof reason === 'string' ? reason : ''));
                    if (
                      typeof msg === 'string' &&
                      (msg.indexOf('Could not establish connection') !== -1 ||
                       msg.indexOf('Receiving end does not exist') !== -1 ||
                       msg.indexOf('message channel closed') !== -1)
                    ) {
                      event.preventDefault();
                      if (event.stopImmediatePropagation) event.stopImmediatePropagation();
                    }
                  }, true);

                  window.addEventListener('error', function(event) {
                    var msg = event && (event.message || '');
                    if (
                      typeof msg === 'string' &&
                      (msg.indexOf('Could not establish connection') !== -1 ||
                       msg.indexOf('Receiving end does not exist') !== -1)
                    ) {
                      event.preventDefault();
                      if (event.stopImmediatePropagation) event.stopImmediatePropagation();
                    }
                  }, true);
                }
              })();
            `
          }}
        />
      </head>
      <body className="bg-[var(--bg)] text-[var(--ink)] antialiased font-sans selection:bg-[var(--brand)] selection:text-[var(--brand-ink)]" suppressHydrationWarning>
        <ThemeProvider>
          <AuthProvider>
            {children}
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
