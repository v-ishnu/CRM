'use client';

import React from 'react';
import { Modal } from '@/components/ui/Modal';
import { TeamMemberChatPanel } from './TeamMemberChatPanel';

export interface TeamMemberChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  teamMember: {
    _id: string;
    name: string;
    role?: string;
    telegramConnected: boolean;
    telegramUsername?: string;
  } | null;
  onGenerateLink?: (member: any) => void;
  onConversationUpdated?: () => void;
}

export function TeamMemberChatModal({
  isOpen,
  onClose,
  teamMember,
  onGenerateLink,
  onConversationUpdated,
}: TeamMemberChatModalProps) {
  if (!isOpen || !teamMember) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl my-auto animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <TeamMemberChatPanel
          teamMemberId={teamMember._id}
          teamMemberName={teamMember.name}
          teamMemberRole={teamMember.role}
          telegramConnected={teamMember.telegramConnected}
          telegramUsername={teamMember.telegramUsername}
          onGenerateLink={() => onGenerateLink && onGenerateLink(teamMember)}
          onClose={onClose}
          onConversationUpdated={onConversationUpdated}
          isModal={true}
        />
      </div>
    </div>
  );
}
