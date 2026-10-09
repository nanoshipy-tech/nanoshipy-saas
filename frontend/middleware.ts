import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Auth is handled client-side by the AuthProvider.
// The refresh_token cookie is set by api.nanoshipy.com (cross-subdomain),
// so server-side middleware cannot reliably intercept it here.
// Dashboard pages check auth client-side and redirect to /login if unauthenticated.
export function middleware(request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*'],
};
