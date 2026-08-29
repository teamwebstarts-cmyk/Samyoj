import { useCallback, useState } from 'react';
import { useWhatsAppConnectOAuth } from './useWhatsAppConnectOAuth';

/** Opens a connect-mode picker before launching Meta Embedded Signup. */
export function useWhatsAppConnectPicker(options?: {
  returnPath?: string;
  onConnected?: () => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);

  const standard = useWhatsAppConnectOAuth({
    returnPath: options?.returnPath,
    connectMode: 'standard',
    onConnected: options?.onConnected,
  });

  const coexistence = useWhatsAppConnectOAuth({
    returnPath: options?.returnPath,
    connectMode: 'coexistence',
    onConnected: options?.onConnected,
  });

  const openPicker = useCallback(() => setPickerOpen(true), []);
  const closePicker = useCallback(() => setPickerOpen(false), []);

  const connectStandard = useCallback(() => {
    setPickerOpen(false);
    standard.connect();
  }, [standard]);

  const connectCoexistence = useCallback(() => {
    setPickerOpen(false);
    coexistence.connect();
  }, [coexistence]);

  const connecting = standard.connecting || coexistence.connecting;
  const connectUnavailableReason =
    standard.connectUnavailableReason || coexistence.connectUnavailableReason;

  return {
    pickerOpen,
    openPicker,
    closePicker,
    connectStandard,
    connectCoexistence,
    connecting,
    connectUnavailableReason,
  };
}
