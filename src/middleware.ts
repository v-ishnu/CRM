import { NextRequest, NextResponse } from 'next/server';
import { verifyJWT } from '@/lib/auth/jwt';

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  
  // Define public paths that shouldn't require auth
  const isAuthRoute = pathname.startsWith('/api/auth');
  const isWebhookRoute = pathname.startsWith('/api/telegram/webhook');
  const isLatencyRoute = pathname.startsWith('/api/telegram/test-latency');
  const isLoginRoute = pathname === '/login';
  
  // Grab session cookie
  const sessionToken = req.cookies.get('session')?.value;

  // Let public routes pass
  if (isAuthRoute || isWebhookRoute || isLatencyRoute) {
    return NextResponse.next();
  }

  // If visiting /login and already logged in, redirect to dashboard
  if (isLoginRoute) {
    if (sessionToken) {
      const payload = await verifyJWT(sessionToken);
      if (payload) {
        return NextResponse.redirect(new URL('/dashboard', req.url));
      }
    }
    return NextResponse.next();
  }

  // Check if accessing dashboard routes or protected api routes
  const isDashboardRoute = pathname.startsWith('/dashboard') || pathname === '/';
  const isProtectedRoute = pathname.startsWith('/api/') && !isAuthRoute && !isWebhookRoute && !isLatencyRoute;

  if (isDashboardRoute || isProtectedRoute) {
    if (!sessionToken) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          {
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
          },
          { status: 401 }
        );
      }
      return NextResponse.redirect(new URL('/login', req.url));
    }

    const payload = await verifyJWT(sessionToken);
    if (!payload) {
      // Token invalid or expired
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          {
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'Invalid or expired session' },
          },
          { status: 401 }
        );
      }
      
      const response = NextResponse.redirect(new URL('/login', req.url));
      response.cookies.delete('session');
      return response;
    }

    // Rewrite `/` to `/dashboard`
    if (pathname === '/') {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }

    // Add user info to headers so downstream route handlers can access it if needed
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set('x-user-id', payload.id);
    requestHeaders.set('x-user-email', payload.email);
    requestHeaders.set('x-user-role', payload.role);
    requestHeaders.set('x-user-name', payload.name);

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/api/:path*', '/login', '/'],
};
