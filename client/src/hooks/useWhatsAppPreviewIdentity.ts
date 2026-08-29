import { useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useWhatsAppNumber } from '../contexts/WhatsAppNumberContext';
import {
  resolveWhatsAppPreviewIdentity,
  type WhatsAppPreviewIdentity,
  type WhatsAppPreviewIdentityInput,
} from '../utils/whatsappPreviewIdentity';

export function useWhatsAppPreviewIdentity(
  overrides?: WhatsAppPreviewIdentityInput,
): WhatsAppPreviewIdentity {
  const { organization } = useAuth();
  const { activeNumber } = useWhatsAppNumber();

  return useMemo(
    () =>
      resolveWhatsAppPreviewIdentity({
        companyName: overrides?.companyName ?? organization?.companyName,
        phoneNumber: overrides?.phoneNumber ?? activeNumber?.phoneNumber,
        officialBusinessAccount:
          overrides?.officialBusinessAccount ?? activeNumber?.officialBusinessAccount,
      }),
    [
      activeNumber?.officialBusinessAccount,
      activeNumber?.phoneNumber,
      organization?.companyName,
      overrides?.companyName,
      overrides?.officialBusinessAccount,
      overrides?.phoneNumber,
    ],
  );
}
