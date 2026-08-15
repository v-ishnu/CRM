import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { dbConnect } from '@/lib/db/connect';
import User from '@/models/User';
import { signJWT } from '@/lib/auth/jwt';
import { bootstrapAdmin } from '@/lib/auth/bootstrap';

// Simple in-memory rate limiting map (IP -> list of attempt timestamps)
const rateLimitMap = new Map<string, number[]>();
const LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 5;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const attempts = rateLimitMap.get(ip) || [];
  
  // Filter attempts outside the current window
  const recentAttempts = attempts.filter((timestamp) => now - timestamp < LIMIT_WINDOW_MS);
  rateLimitMap.set(ip, recentAttempts);
  
  return recentAttempts.length >= MAX_ATTEMPTS;
}

function recordAttempt(ip: string) {
  const attempts = rateLimitMap.get(ip) || [];
  attempts.push(Date.now());
  rateLimitMap.set(ip, attempts);
}

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  
  if (isRateLimited(ip)) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many login attempts. Please try again after 15 minutes.',
        },
      },
      { status: 429 }
    );
  }

  try {
    await dbConnect();
    await bootstrapAdmin();

    const body = await req.json();
    const result = loginSchema.safeParse(body);

    if (!result.success) {
      recordAttempt(ip);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid input fields',
            details: result.error.format(),
          },
        },
        { status: 400 }
      );
    }

    const { email, password } = result.data;
    const user = await User.findOne({ email });

    if (!user) {
      recordAttempt(ip);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid email or password',
          },
        },
        { status: 401 }
      );
    }

    const isMatch = await bcrypt.compare(password, user.password!);

    if (!isMatch) {
      recordAttempt(ip);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid email or password',
          },
        },
        { status: 401 }
      );
    }

    // Generate JWT
    const token = await signJWT({
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      name: user.name,
    });

    const response = NextResponse.json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        name: user.name,
      },
    });

    // Set secure HttpOnly cookie
    response.cookies.set({
      name: 'session',
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24, // 24 hours
      path: '/',
    });

    // Reset rate limiting on successful login
    rateLimitMap.delete(ip);

    return response;
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: 'An internal server error occurred',
        },
      },
      { status: 500 }
    );
  }
}
