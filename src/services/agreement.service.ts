import mongoose from 'mongoose';
import Agreement, { IAgreement } from '@/models/Agreement';
import Project from '@/models/Project';
import Client from '@/models/Client';
import { AuditService } from './audit.service';
import { TelegramService } from './telegram.service';
import { dbConnect } from '@/lib/db/connect';

export class AgreementService {
  /**
   * Create an agreement for a project and dispatch terms to client
   */
  static async createAgreement(
    projectId: string,
    terms: string,
    actor: string
  ): Promise<IAgreement> {
    await dbConnect();

    const project = await Project.findById(projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    const client = await Client.findById(project.clientId);
    if (!client) {
      throw new Error('Client not found');
    }

    if (!terms || terms.trim() === '') {
      throw new Error('Agreement terms cannot be empty');
    }

    // Build immutable snapshot of contract terms
    const snapshot = {
      projectName: project.name,
      projectCode: project.projectCode,
      serviceType: project.serviceType,
      totalAmount: project.totalAmount,
      currency: project.currency,
      terms: terms.trim(),
      scope: project.scope || project.description || '',
      startDate: project.startDate,
      expectedCompletionDate: project.expectedCompletionDate,
      clientName: client.name,
      clientEmail: client.email,
      createdAt: new Date(),
    };

    // Find existing agreement or create new
    let agreement = await Agreement.findOne({ projectId: project._id });
    if (agreement) {
      agreement.terms = terms.trim();
      agreement.totalAmount = project.totalAmount;
      agreement.currency = project.currency;
      agreement.status = 'PENDING_REVIEW';
      agreement.snapshot = snapshot;
      agreement.acceptedAt = undefined;
      agreement.acceptedBy = undefined;
      agreement.rejectedAt = undefined;
      agreement.rejectionReason = undefined;
      agreement.version += 1;
      await agreement.save();
    } else {
      agreement = await Agreement.create({
        projectId: project._id,
        clientId: client._id,
        terms: terms.trim(),
        totalAmount: project.totalAmount,
        currency: project.currency,
        status: 'PENDING_REVIEW',
        snapshot,
        version: 1,
      });
    }

    // Update project state
    project.agreementId = agreement._id as any;
    project.terms = terms.trim();
    project.status = 'PENDING_AGREEMENT';
    await project.save();

    await AuditService.logAction(actor, 'AGREEMENT_CREATED', 'Agreement', agreement._id, {
      projectId: project._id,
      projectCode: project.projectCode,
      clientId: client._id,
      version: agreement.version,
    });

    // Send Telegram message to client if connected
    if (client.telegramConnected && client.telegramChatId) {
      try {
        const formattedAmount = `${project.currency} ${project.totalAmount.toLocaleString('en-IN')}`;
        const messageText =
          `📜 <b>Project Agreement & Terms</b>\n\n` +
          `Hello <b>${client.name}</b>,\n\n` +
          `Please review the contractual terms for your project <b>${project.name}</b> (<code>${project.projectCode}</code>):\n\n` +
          `<b>Total Budget:</b> ${formattedAmount}\n` +
          `<b>Service:</b> ${project.serviceType}\n` +
          (project.expectedCompletionDate
            ? `<b>Target Completion:</b> ${new Date(project.expectedCompletionDate).toLocaleDateString('en-IN')}\n\n`
            : `\n`) +
          `<b>Agreement Terms:</b>\n${terms.trim()}\n\n` +
          `<i>Click below to accept or decline the project terms.</i>`;

        const replyMarkup = {
          inline_keyboard: [
            [
              {
                text: '✅ Accept Terms',
                callback_data: `agree:accept:${agreement._id}`,
              },
              {
                text: '❌ Decline / Changes',
                callback_data: `agree:reject:${agreement._id}`,
              },
            ],
          ],
        };

        const res = await TelegramService.sendMessageRaw(client.telegramChatId, messageText, {
          reply_markup: replyMarkup,
        });

        if (res && res.success && res.messageId) {
          agreement.telegramMessageId = String(res.messageId);
          await agreement.save();

          await AuditService.logAction('system', 'AGREEMENT_SENT', 'Agreement', agreement._id, {
            projectId: project._id,
            clientId: client._id,
            telegramChatId: client.telegramChatId,
          });
        }
      } catch (tgErr) {
        console.error('Failed to send agreement terms to client via Telegram:', tgErr);
      }
    }

    return agreement;
  }

  /**
   * Handle interactive Telegram callback queries for accept/reject agreement
   */
  static async handleAgreementCallback(
    cbId: string,
    fromUserId: string,
    cbChatId: string,
    cbData: string,
    timings?: any
  ): Promise<{ action: string; success: boolean }> {
    await dbConnect();

    const isAccept = cbData.startsWith('agree:accept:');
    const isReject = cbData.startsWith('agree:reject:');
    const agreementId = isAccept
      ? cbData.replace('agree:accept:', '')
      : cbData.replace('agree:reject:', '');

    if (!mongoose.Types.ObjectId.isValid(agreementId)) {
      await TelegramService.answerCallbackQuery(cbId, 'Invalid agreement reference.', true);
      return { action: 'agreement_invalid', success: false };
    }

    const agreement = await Agreement.findById(agreementId);
    if (!agreement) {
      await TelegramService.answerCallbackQuery(cbId, 'Agreement not found.', true);
      return { action: 'agreement_not_found', success: false };
    }

    const client = await Client.findById(agreement.clientId);
    if (!client) {
      await TelegramService.answerCallbackQuery(cbId, 'Client record not found.', true);
      return { action: 'agreement_client_not_found', success: false };
    }

    // SERVER-SIDE AUTHORIZATION: Verify user is the authorized client
    if (client.telegramUserId !== fromUserId) {
      await TelegramService.answerCallbackQuery(
        cbId,
        'Unauthorized: Only the assigned client may accept or decline this agreement.',
        true
      );
      await AuditService.logAction(fromUserId, 'TASK_ACTION_DENIED', 'Agreement', agreement._id, {
        reason: 'Unauthorized user attempted to act on client agreement',
        expectedUserId: client.telegramUserId,
        actualUserId: fromUserId,
      });
      return { action: 'agreement_unauthorized', success: false };
    }

    const project = await Project.findById(agreement.projectId);
    if (!project) {
      await TelegramService.answerCallbackQuery(cbId, 'Project not found.', true);
      return { action: 'agreement_project_not_found', success: false };
    }

    if (isAccept) {
      if (agreement.status === 'ACCEPTED') {
        await TelegramService.answerCallbackQuery(cbId, 'This agreement has already been accepted.');
        return { action: 'agreement_already_accepted', success: true };
      }

      agreement.status = 'ACCEPTED';
      agreement.acceptedAt = new Date();
      agreement.acceptedBy = {
        telegramUserId: fromUserId,
        name: client.name,
      };
      await agreement.save();

      // Project transitions to ACTIVE
      project.status = 'ACTIVE';
      await project.save();

      await AuditService.logAction(client.email, 'AGREEMENT_ACCEPTED', 'Agreement', agreement._id, {
        projectId: project._id,
        projectCode: project.projectCode,
        clientId: client._id,
        acceptedAt: agreement.acceptedAt,
      });

      await AuditService.logAction(client.email, 'PROJECT_STATUS_CHANGED', 'Project', project._id, {
        oldStatus: 'PENDING_AGREEMENT',
        newStatus: 'ACTIVE',
        reason: 'Agreement accepted by client via Telegram',
      });

      await TelegramService.answerCallbackQuery(cbId, 'Agreement accepted successfully! 🎉');

      // Send confirmation to client
      await TelegramService.sendMessageRaw(
        cbChatId,
        `✅ <b>Agreement Accepted</b>\n\n` +
          `Thank you, <b>${client.name}</b>. You have accepted the project agreement for <b>${project.name}</b> (<code>${project.projectCode}</code>).\n\n` +
          `The project is now <b>ACTIVE</b>. We are excited to begin work!`
      );

      // Notify Admin
      const adminTelegramId = process.env.ADMIN_TELEGRAM_ID;
      if (adminTelegramId) {
        await TelegramService.sendMessageRaw(
          adminTelegramId,
          `🎉 <b>Project Agreement Accepted!</b>\n\n` +
            `<b>Client:</b> ${client.name}\n` +
            `<b>Project:</b> ${project.name} (<code>${project.projectCode}</code>)\n` +
            `<b>Budget:</b> ${project.currency} ${project.totalAmount.toLocaleString('en-IN')}\n` +
            `<b>Accepted At:</b> ${new Date().toLocaleString('en-IN')}\n\n` +
            `Project status has automatically transitioned to <b>ACTIVE</b>.`
        );
      }

      return { action: 'agreement_accepted', success: true };
    }

    if (isReject) {
      agreement.status = 'REJECTED';
      agreement.rejectedAt = new Date();
      agreement.rejectionReason = 'Declined by client via Telegram';
      await agreement.save();

      // Keep project on hold until terms renegotiated
      project.status = 'ON_HOLD';
      await project.save();

      await AuditService.logAction(client.email, 'AGREEMENT_REJECTED', 'Agreement', agreement._id, {
        projectId: project._id,
        projectCode: project.projectCode,
        clientId: client._id,
        rejectedAt: agreement.rejectedAt,
      });

      await TelegramService.answerCallbackQuery(cbId, 'Agreement declined.');

      await TelegramService.sendMessageRaw(
        cbChatId,
        `❌ <b>Agreement Declined</b>\n\n` +
          `You have declined or requested changes for <b>${project.name}</b>.\n\n` +
          `Our project manager has been notified and will contact you shortly to discuss revisions.`
      );

      const adminTelegramId = process.env.ADMIN_TELEGRAM_ID;
      if (adminTelegramId) {
        await TelegramService.sendMessageRaw(
          adminTelegramId,
          `⚠️ <b>Project Agreement Declined / Changes Requested</b>\n\n` +
            `<b>Client:</b> ${client.name}\n` +
            `<b>Project:</b> ${project.name} (<code>${project.projectCode}</code>)\n\n` +
            `Please review project terms with the client.`
        );
      }

      return { action: 'agreement_rejected', success: true };
    }

    return { action: 'agreement_unknown', success: false };
  }
}
