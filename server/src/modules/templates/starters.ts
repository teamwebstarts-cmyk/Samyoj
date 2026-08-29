export const SAMYOJ_STARTERS = [
  {
    id: 'order_update',
    title: 'Order / booking update',
    category: 'UTILITY' as const,
    languages: ['en_US', 'hi_IN'] as const,
    usecase: 'ORDER_CONFIRMATION',
    libraryHint: 'order confirmation',
    body: 'Hi {{1}}, your order {{2}} is now {{3}}.',
    submitMode: 'library' as const,
  },
  {
    id: 'appointment_reminder',
    title: 'Appointment reminder',
    category: 'UTILITY' as const,
    languages: ['en_US', 'hi_IN'] as const,
    usecase: '',
    libraryHint: 'appointment reminder',
    body: 'Hi {{1}}, reminder: your appointment is on {{2}} at {{3}}.',
    submitMode: 'create' as const,
  },
  {
    id: 'otp_login',
    title: 'OTP / login code',
    category: 'AUTHENTICATION' as const,
    languages: ['en_US', 'hi_IN'] as const,
    usecase: '',
    libraryHint: 'authentication',
    body: '{{1}} is your verification code.',
    submitMode: 'library' as const,
  },
] as const;

export type SamyojStarterDefinition = (typeof SAMYOJ_STARTERS)[number];

function bodyExamplesFor(starter: SamyojStarterDefinition): string[] {
  if (starter.category === 'AUTHENTICATION') return ['123456'];
  if (starter.id === 'order_update') return ['Rahul', 'A-1024', 'shipped'];
  return ['Rahul', 'Tue 4pm', 'Clinic'];
}

export function starterCreatePayload(
  starter: SamyojStarterDefinition,
  language: string,
  name: string
) {
  return {
    name,
    language,
    category: starter.category,
    headerFormat: 'NONE' as const,
    body: starter.body,
    bodyExamples: bodyExamplesFor(starter),
    ...(starter.category === 'AUTHENTICATION'
      ? { authType: 'OTP' as const, addSecurityRecommendation: true }
      : {}),
  };
}

export function listSamyojStarters() {
  return SAMYOJ_STARTERS.map((starter) => ({
    ...starter,
    copy: 'Meta still reviews this number. Usually fast for utility and authentication. Not skipped.',
  }));
}
