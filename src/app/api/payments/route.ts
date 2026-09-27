import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/connect';
import Payment from '@/models/Payment';
import Client from '@/models/Client';
import Project from '@/models/Project';
import Invoice from '@/models/Invoice';
import { PaymentService } from '@/services/payment.service';
import { NotificationService } from '@/services/notification.service';

export async function GET(req: NextRequest) {
  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);

    const clientId = searchParams.get('clientId') || undefined;
    const projectId = searchParams.get('projectId') || undefined;
    const status = searchParams.get('status') || undefined;
    const paymentType = searchParams.get('paymentType') || undefined;
    const search = searchParams.get('search') || undefined;

    const userRole = req.headers.get('x-user-role');
    const query: Record<string, any> = {};

    if (clientId) query.clientId = clientId;
    if (projectId) query.projectId = projectId;
    if (status) query.status = status;

    // Security: Clients must never view internal bonus records
    if (userRole === 'CLIENT') {
      query.paymentType = { $ne: 'CLIENT_BONUS' };
    } else if (paymentType) {
      query.paymentType = paymentType;
    }

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { paymentNumber: searchRegex },
        { transactionReference: searchRegex },
      ];
    }

    const payments = await Payment.find(query)
      .populate('clientId', 'name clientCode company')
      .populate('projectId', 'name projectCode')
      .populate('invoiceId', 'invoiceNumber')
      .sort({ paymentDate: -1 });

    return NextResponse.json({ success: true, data: payments });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: 'BAD_REQUEST', message: error.message } },
      { status: 400 }
    );
  }
}

export async function POST(req: NextRequest) {
  const actor = req.headers.get('x-user-email') || 'admin';
  const actorRole = req.headers.get('x-user-role') || 'ADMIN';

  // Role check: Only authorized admin/staff users may record payments or bonuses
  if (actorRole === 'CLIENT') {
    return NextResponse.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Clients are not authorized to record payments' } },
      { status: 403 }
    );
  }

  try {
    await dbConnect();
    const body = await req.json();

    const payment = await PaymentService.recordPayment(body, actor);

    // If payment recorded, trigger Telegram confirmation if client is linked
    // CRITICAL: CLIENT_BONUS is strictly internal-only and must NEVER trigger client notifications
    const isBonus = payment.paymentType === 'CLIENT_BONUS';
    const notifyClient = !isBonus && body.notifyClient !== false;
    if (notifyClient && payment.projectId) {
      const client = await Client.findById(payment.clientId);
      if (client && client.telegramConnected) {
        try {
          await NotificationService.sendPaymentNotification(
            payment.clientId.toString(),
            payment.projectId.toString(),
            payment._id.toString()
          );
        } catch (notifErr) {
          console.error('Failed to dispatch payment Telegram notification:', notifErr);
        }
      }
    }

    return NextResponse.json({ success: true, data: payment });
  } catch (error: any) {
    console.error('Failed to record payment:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'PAYMENT_RECORDING_FAILED',
          message: error.message || 'Could not record payment',
        },
      },
      { status: 500 }
    );
  }
}
