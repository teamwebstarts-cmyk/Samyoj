import type { CSSProperties } from 'react';
import toast, { Toaster, type ToastOptions } from 'react-hot-toast';

function isDark() {
  return typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
}

function baseStyle(): CSSProperties {
  const dark = isDark();
  return {
    borderRadius: '12px',
    padding: '12px 14px',
    fontSize: '13px',
    fontWeight: 500,
    lineHeight: 1.45,
    boxShadow: dark ? '0 12px 32px rgba(0, 0, 0, 0.45)' : '0 12px 32px rgba(15, 23, 42, 0.12)',
    maxWidth: '420px',
    whiteSpace: 'pre-line',
  };
}

const sharedOptions: ToastOptions = {
  duration: 4000,
  position: 'bottom-center',
};

export function toastSuccess(message: string) {
  const dark = isDark();
  return toast.success(message, {
    ...sharedOptions,
    style: {
      ...baseStyle(),
      background: dark ? 'rgba(6, 78, 59, 0.95)' : 'rgba(236, 253, 245, 0.98)',
      color: dark ? '#a7f3d0' : '#065f46',
      border: dark ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid rgba(167, 243, 208, 0.9)',
    },
    iconTheme: {
      primary: '#059669',
      secondary: dark ? '#064e3b' : '#ecfdf5',
    },
  });
}

export function toastError(message: string, options?: Partial<ToastOptions>) {
  const dark = isDark();
  return toast.error(message, {
    ...sharedOptions,
    duration: 5000,
    ...options,
    style: {
      ...baseStyle(),
      background: dark ? 'rgba(127, 29, 29, 0.95)' : 'rgba(254, 242, 242, 0.98)',
      color: dark ? '#fecaca' : '#b91c1c',
      border: dark ? '1px solid rgba(239, 68, 68, 0.35)' : '1px solid rgba(254, 202, 202, 0.9)',
      ...options?.style,
    },
    iconTheme: {
      primary: '#dc2626',
      secondary: dark ? '#450a0a' : '#fef2f2',
    },
  });
}

export function toastInfo(message: string) {
  const dark = isDark();
  return toast(message, {
    ...sharedOptions,
    style: {
      ...baseStyle(),
      background: dark ? 'rgba(12, 74, 110, 0.95)' : 'rgba(240, 249, 255, 0.98)',
      color: dark ? '#bae6fd' : '#0c4a6e',
      border: dark ? '1px solid rgba(56, 189, 248, 0.35)' : '1px solid rgba(186, 230, 253, 0.9)',
    },
    icon: 'ℹ️',
  });
}

export function toastWarning(message: string) {
  const dark = isDark();
  return toast(message, {
    ...sharedOptions,
    duration: 4500,
    style: {
      ...baseStyle(),
      background: dark ? 'rgba(120, 53, 15, 0.95)' : 'rgba(255, 251, 235, 0.98)',
      color: dark ? '#fde68a' : '#92400e',
      border: dark ? '1px solid rgba(245, 158, 11, 0.35)' : '1px solid rgba(253, 230, 138, 0.9)',
    },
    icon: '⚠️',
  });
}

export function toastValidationErrors(errors: string[]) {
  if (!errors.length) return;
  const message =
    errors.length === 1
      ? errors[0]
      : `Please fix the following:\n${errors.map((e) => `• ${e}`).join('\n')}`;
  return toastError(message, { duration: 6000 });
}

export function AppToaster() {
  return (
    <Toaster
      position="bottom-center"
      gutter={10}
      containerStyle={{ bottom: 20, zIndex: 10050 }}
      toastOptions={{
        ...sharedOptions,
      }}
    />
  );
}
