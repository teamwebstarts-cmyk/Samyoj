export type PlatformRole = 'SUPER_ADMIN' | 'SUPPORT' | 'ANALYST';

export type Operator = {
  id: string;
  email: string;
  role: PlatformRole;
  mfaEnabled: boolean;
};

export type HealthFlags = {
  aiInactive: boolean;
  billingRisk: boolean;
  qualityRisk: boolean;
  webhookStale: boolean;
};

export type LoginState = 'AUTHENTICATED' | 'MFA_REQUIRED' | 'MFA_ENROLLMENT_REQUIRED';
