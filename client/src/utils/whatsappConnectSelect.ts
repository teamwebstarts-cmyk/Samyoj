export type ConnectPhoneChoice = {
  wabaId: string;
  phoneNumberId: string;
};

export function phoneOptionKey(phone: ConnectPhoneChoice): string {
  return `${phone.wabaId}:${phone.phoneNumberId}`;
}

/** Prefer a number this workspace does not already have, so adding a second line is one click. */
export function defaultPhoneSelectionKey(
  phones: ConnectPhoneChoice[],
  alreadyConnectedPhoneNumberIds: string[]
): string {
  if (phones.length === 0) return '';
  const connected = new Set(alreadyConnectedPhoneNumberIds.filter(Boolean));
  const next = phones.find((phone) => !connected.has(phone.phoneNumberId)) ?? phones[0];
  return phoneOptionKey(next);
}

export function isWhatsAppOAuthCodeConsumed(message: string): boolean {
  return /authorization code has been used|already completed/i.test(message);
}
