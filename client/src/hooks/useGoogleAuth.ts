import { authApi } from '../services/api';
import { getErrorMessage } from '../utils/errors';
import { toastError } from '../utils/toast';

const GOOGLE_SIGNIN_UNAVAILABLE =
  'Google sign-in is temporarily unavailable. Please try email sign-in or try again later.';

export function useGoogleAuth() {
  const signInWithGoogle = async (returnTo?: string) => {
    try {
      const safeReturnTo =
        returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//') ? returnTo : undefined;
      const res = await authApi.googleUrl(safeReturnTo);
      window.location.href = res.data.data.url;
    } catch (err: unknown) {
      toastError(getErrorMessage(err, GOOGLE_SIGNIN_UNAVAILABLE));
    }
  };

  return { signInWithGoogle };
}
