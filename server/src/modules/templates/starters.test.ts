import { describe, expect, it } from 'vitest';
import { buildTenantLibraryCards, META_LIBRARY_PACK } from './meta-library-pack';

describe('Meta tenant library pack', () => {
  it('ships hello_world plus a small Meta library clone set', () => {
    expect(META_LIBRARY_PACK).toHaveLength(7);
    expect(META_LIBRARY_PACK[0]?.id).toBe('hello_world');
    expect(META_LIBRARY_PACK[0]?.kind).toBe('waba_sample');
    const cloneIds = META_LIBRARY_PACK.filter((row) => row.kind === 'meta_clone').map((row) => row.id);
    expect(cloneIds).toEqual([
      'hello_account',
      'order_confirmation',
      'shipment_confirmation',
      'delivery_update',
      'payment_confirmation',
      'otp_login',
    ]);
  });

  it('marks hello_world ready only when it is already on the WABA', () => {
    const missing = buildTenantLibraryCards([], new Set());
    expect(missing[0]?.ready).toBe(false);
    expect(missing[0]?.submitMode).toBe('ready');
    const present = buildTenantLibraryCards([], new Set(['hello_world']));
    expect(present[0]?.ready).toBe(true);
    expect(present[0]?.source).toBe('ready');
  });

  it('uses Meta library names from Graph when the usecase matches', () => {
    const cards = buildTenantLibraryCards(
      [
        {
          name: 'account_creation_confirmation_3',
          usecase: 'ACCOUNT_CREATION_CONFIRMATION',
          category: 'UTILITY',
          body: 'Hi {{1}}, welcome aboard.',
        },
        {
          name: 'delivery_update_1',
          usecase: 'DELIVERY_UPDATE',
          category: 'UTILITY',
        },
      ],
      new Set()
    );
    const hello = cards.find((row) => row.id === 'hello_account');
    expect(hello?.libraryTemplateName).toBe('account_creation_confirmation_3');
    expect(hello?.body).toBe('Hi {{1}}, welcome aboard.');
    expect(hello?.submitMode).toBe('clone');
    const delivery = cards.find((row) => row.id === 'delivery_update');
    expect(delivery?.libraryTemplateName).toBe('delivery_update_1');
  });
});
