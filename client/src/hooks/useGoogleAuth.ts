import { authApi } from '../services/api';
import { toastError } from '../utils/toast';

export function useGoogleAuth() {
  const signInWithGoogle = async () => {
    try {
      const res = await authApi.googleUrl();
      window.location.href = res.data.data.url;
    } catch {
      toastError('Google sign-in is not configured');
    }
  };

  return { signInWithGoogle };
}
