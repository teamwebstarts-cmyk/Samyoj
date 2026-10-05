import { describe, expect, it } from 'vitest';
import { AxiosError } from 'axios';
import { supportChatErrorMessage } from './errors';

function axiosErr(status: number, message: string, network = false, code?: string) {
  const err = new AxiosError(message, network ? 'ERR_NETWORK' : 'ERR_BAD_REQUEST');
  if (!network) {
    err.response = {
      status,
      data: { error: { message, ...(code ? { code } : {}) } },
      statusText: 'Error',
      headers: {},
      config: { headers: {} as never },
    };
  }
  return err;
}

describe('supportChatErrorMessage', () => {
  it('maps network, 401, and 5xx without leaking provider secrets', () => {
    expect(supportChatErrorMessage(axiosErr(0, 'Network Error', true))).toMatch(/connection/i);
    expect(supportChatErrorMessage(axiosErr(401, 'Authentication required'))).toMatch(/Sign in/i);
    expect(
      supportChatErrorMessage(axiosErr(503, 'No AI brain configured. Set SARVAM_API_KEY in server/.env.'))
    ).not.toMatch(/SARVAM|API_KEY|\.env/);
    expect(
      supportChatErrorMessage(axiosErr(503, 'No AI brain configured. Set SARVAM_API_KEY in server/.env.'))
    ).toMatch(/Try again/);
  });

  it('maps Help Center disable and daily cap without asking to upgrade a plan', () => {
    expect(
      supportChatErrorMessage(axiosErr(403, 'Help assistant is turned off for this workspace.', false, 'HELP_CENTER_DISABLED'))
    ).toMatch(/turned off/i);
    expect(
      supportChatErrorMessage(
        axiosErr(429, 'Help assistant limit for today — try tomorrow, or ask your platform admin.', false, 'HELP_CENTER_DAILY_CAP')
      )
    ).toMatch(/limit for today/i);
    expect(
      supportChatErrorMessage(axiosErr(429, 'Help assistant limit for today', false, 'HELP_CENTER_DAILY_CAP'))
    ).not.toMatch(/upgrade|Growth|plan/i);
  });
});
