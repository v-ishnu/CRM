import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/connect';
import Client from '@/models/Client';
import Project from '@/models/Project';
import Payment from '@/models/Payment';
import Invoice from '@/models/Invoice';
import AuditLog from '@/models/AuditLog';

export async function GET(req: NextRequest) {
  try {
    await dbConnect();

    // 1. Total Clients
    const totalClients = await Client.countDocuments();

    // 2. Active Projects (PLANNED, ONBOARDING, IN_PROGRESS, REVIEW, ON_HOLD)
    const activeProjects = await Project.countDocuments({
      status: { $in: ['PLANNED', 'ONBOARDING', 'IN_PROGRESS', 'REVIEW', 'ON_HOLD'] },
    });

    // 3. Financial calculations
    const projects = await Project.find({ status: { $ne: 'CANCELLED' } });
    const totalRevenue = projects.reduce((sum, p) => sum + p.totalAmount, 0);

    // Regular project payments (exclude CLIENT_BONUS so outstanding balance is never distorted)
    const completedRegularPayments = await Payment.find({
      status: 'COMPLETED',
      paymentType: { $ne: 'CLIENT_BONUS' },
    });
    const totalPaid = completedRegularPayments.reduce((sum, p) => sum + p.amount, 0);
    const outstandingAmount = Math.max(0, totalRevenue - totalPaid);

    // Client bonus payments (internal accounting)
    const completedBonusPayments = await Payment.find({
      status: 'COMPLETED',
      paymentType: 'CLIENT_BONUS',
    });
    const totalBonus = completedBonusPayments.reduce((sum, p) => sum + p.amount, 0);
    const totalCashReceived = totalPaid + totalBonus;

    // 4. Payments this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const endOfMonth = new Date();
    endOfMonth.setMonth(endOfMonth.getMonth() + 1);
    endOfMonth.setDate(0);
    endOfMonth.setHours(23, 59, 59, 999);

    const thisMonthRegularPayments = await Payment.find({
      status: 'COMPLETED',
      paymentType: { $ne: 'CLIENT_BONUS' },
      paymentDate: { $gte: startOfMonth, $lte: endOfMonth },
    });
    const paymentsThisMonth = thisMonthRegularPayments.reduce((sum, p) => sum + p.amount, 0);

    const thisMonthBonusPayments = await Payment.find({
      status: 'COMPLETED',
      paymentType: 'CLIENT_BONUS',
      paymentDate: { $gte: startOfMonth, $lte: endOfMonth },
    });
    const bonusThisMonth = thisMonthBonusPayments.reduce((sum, p) => sum + p.amount, 0);

    // 5. Pending Invoices count
    const pendingInvoices = await Invoice.countDocuments({
      status: { $in: ['DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'OVERDUE'] },
    });

    // 6. Recent activities (Audit Logs)
    const recentActivity = await AuditLog.find()
      .sort({ timestamp: -1 })
      .limit(10);

    return NextResponse.json({
      success: true,
      data: {
        totalClients,
        activeProjects,
        totalRevenue,
        outstandingAmount,
        totalPaid,
        totalBonus,
        totalCashReceived,
        paymentsThisMonth,
        bonusThisMonth,
        pendingInvoices,
        recentActivity,
      },
    });
  } catch (error: any) {
    console.error('Dashboard API Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: error.message || 'An error occurred while fetching dashboard statistics',
        },
      },
      { status: 500 }
    );
  }
}
