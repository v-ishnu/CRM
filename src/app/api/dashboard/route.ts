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

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const endOfMonth = new Date();
    endOfMonth.setMonth(endOfMonth.getMonth() + 1);
    endOfMonth.setDate(0);
    endOfMonth.setHours(23, 59, 59, 999);

    // Parallelize all dashboard queries to eliminate serial round-trip latency
    const [
      totalClients,
      activeProjects,
      projects,
      completedRegularPayments,
      completedBonusPayments,
      thisMonthRegularPayments,
      thisMonthBonusPayments,
      pendingInvoices,
      recentActivity,
    ] = await Promise.all([
      Client.countDocuments(),
      Project.countDocuments({
        status: { $in: ['PLANNED', 'ONBOARDING', 'IN_PROGRESS', 'REVIEW', 'ON_HOLD'] },
      }),
      Project.find({ status: { $ne: 'CANCELLED' } }).select('totalAmount').lean(),
      Payment.find({
        status: 'COMPLETED',
        paymentType: { $ne: 'CLIENT_BONUS' },
      }).select('amount').lean(),
      Payment.find({
        status: 'COMPLETED',
        paymentType: 'CLIENT_BONUS',
      }).select('amount').lean(),
      Payment.find({
        status: 'COMPLETED',
        paymentType: { $ne: 'CLIENT_BONUS' },
        paymentDate: { $gte: startOfMonth, $lte: endOfMonth },
      }).select('amount').lean(),
      Payment.find({
        status: 'COMPLETED',
        paymentType: 'CLIENT_BONUS',
        paymentDate: { $gte: startOfMonth, $lte: endOfMonth },
      }).select('amount').lean(),
      Invoice.countDocuments({
        status: { $in: ['DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'OVERDUE'] },
      }),
      AuditLog.find().sort({ timestamp: -1 }).limit(10).lean(),
    ]);

    const totalRevenue = projects.reduce((sum: number, p: any) => sum + (p.totalAmount || 0), 0);
    const totalPaid = completedRegularPayments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
    const outstandingAmount = Math.max(0, totalRevenue - totalPaid);
    const totalBonus = completedBonusPayments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
    const totalCashReceived = totalPaid + totalBonus;
    const paymentsThisMonth = thisMonthRegularPayments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
    const bonusThisMonth = thisMonthBonusPayments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);

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
