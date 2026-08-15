import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/connect';
import Payment from '@/models/Payment';
import Client from '@/models/Client';
import { PaymentService } from '@/services/payment.service';
import { NotificationService } from '@/services/notification.service';

export async function GET(req: NextRequest) {
  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);

    const clientId = searchParams.get('clientId') || undefined;
    const projectId = searchParams.get('projectId') || undefined;
    const status = searchParams.get('status') || undefined;
    const search = searchParams.get('search') || undefined;

    const query: Record<string, any> = {};

    if (clientId) query.clientId = clientId;
    if (projectId) query.projectId = projectId;
    if (status) query.status = status;

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
  try {
    await dbConnect();
    const body = await req.json();

    const payment = await PaymentService.recordPayment(body, actor);

    // If payment recorded, trigger Telegram confirmation if client is linked
    const notifyClient = body.notifyClient !== false;
    if (notifyClient) {
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
