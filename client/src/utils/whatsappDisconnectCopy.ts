import type { WhatsappNumberOption } from '../contexts/WhatsAppNumberContext';

export function isCoexistenceLinkedNumber(number: {
  isOnBizApp?: boolean;
  coexistenceStatus?: string | null;
}): boolean {
  if (
    number.coexistenceStatus === 'offboarded' ||
    number.coexistenceStatus === 'partner_removed'
  ) {
    return false;
  }
  return Boolean(number.isOnBizApp || number.coexistenceStatus === 'active');
}

type DisconnectMeta = Pick<WhatsappNumberOption, 'isOnBizApp' | 'coexistenceStatus'>;

export function whatsappDisconnectDialogCopy(number?: DisconnectMeta | null): {
  description: string;
  details: string[];
} {
  const historyLine = 'Chats, contacts, and history stay saved in this workspace';
  const inboundLine = 'New messages will not appear in Inbox until you connect again';

  if (number && isCoexistenceLinkedNumber(number)) {
    return {
      description:
        'This removes Samyoj from this number in your workspace. Your WhatsApp Business app on the phone is not logged out by this step.',
      details: [
        inboundLine,
        historyLine,
        'Fully unlinking Samyoj in Meta Business settings is separate — that flow may log out the Business app and affect your shared portfolio',
      ],
    };
  }

  return {
    description: 'You are about to disconnect this phone line from your Samyoj workspace.',
    details: [inboundLine, historyLine, 'Sending from Samyoj stops until you reconnect'],
  };
}
