import { formatPhoneDisplay } from './formatPhone';

export function whatsappNotConnectedCopy(
  disconnected: Array<{ phoneNumber: string }>,
  options?: { task?: string }
) {
  const phone = disconnected[0]?.phoneNumber
    ? formatPhoneDisplay(disconnected[0].phoneNumber)
    : null;
  const task = options?.task || 'send and receive WhatsApp messages';
  if (phone) {
    return {
      disconnected: true as const,
      phone,
      title: `${phone} is disconnected`,
      description: `This WhatsApp number is off. Reconnect it to ${task}.`,
      cta: 'Reconnect WhatsApp',
    };
  }
  return {
    disconnected: false as const,
    phone: null as string | null,
    title: 'Connect WhatsApp first',
    description: `Connect a WhatsApp Business number to ${task}.`,
    cta: 'Connect WhatsApp',
  };
}
