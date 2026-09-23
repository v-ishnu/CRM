import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import User from '@/models/User';
import { TeamMemberService } from '@/services/team-member.service';
import { dbConnect } from '@/lib/db/connect';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await dbConnect();

  const userRole = req.headers.get('x-user-role');
  const userEmail = req.headers.get('x-user-email');

  if (userRole !== 'ADMIN' || !userEmail) {
    return NextResponse.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Admin access required to reveal bank details' } },
      { status: 403 }
    );
  }

  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { password } = body;

    if (!password) {
      return NextResponse.json(
        { success: false, error: { code: 'PASSWORD_REQUIRED', message: 'Admin password confirmation is required' } },
        { status: 400 }
      );
    }

    // Verify password against current admin user or configured admin password
    let isMatch = false;

    if (process.env.ADMIN_PASSWORD && password === process.env.ADMIN_PASSWORD) {
      isMatch = true;
    } else if (process.env.MASTER_PASSWORD && password === process.env.MASTER_PASSWORD) {
      isMatch = true;
    } else {
      const user = await User.findOne({ email: userEmail });
      if (user && user.password) {
        isMatch = await bcrypt.compare(password, user.password);
      }
    }

    if (!isMatch) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_PASSWORD', message: 'Incorrect admin password confirmation' } },
        { status: 401 }
      );
    }

    const bankDetails = await TeamMemberService.revealBankDetails(id, userEmail);

    return NextResponse.json({
      success: true,
      data: bankDetails,
    });
  } catch (error: any) {
    console.error('Reveal bank details error:', error);
    const statusCode = error.message?.includes('not found') ? 404 : 500;
    return NextResponse.json(
      {
        success: false,
        error: { code: 'REVEAL_BANK_FAILED', message: error.message || 'Failed to reveal bank details' },
      },
      { status: statusCode }
    );
  }
}
