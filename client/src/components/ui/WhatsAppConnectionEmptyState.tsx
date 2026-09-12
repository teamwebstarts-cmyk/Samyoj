import { Settings2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import AppButton from './AppButton';
import EmptyState from './EmptyState';
import { whatsappNotConnectedCopy } from '../../utils/whatsappConnectionCopy';

interface WhatsAppConnectionEmptyStateProps {
  disconnectedNumbers: Array<{ phoneNumber: string }>;
  task: string;
  returnTask: string;
}

export default function WhatsAppConnectionEmptyState({
  disconnectedNumbers,
  task,
  returnTask,
}: WhatsAppConnectionEmptyStateProps) {
  const copy = whatsappNotConnectedCopy(disconnectedNumbers, { task });

  return (
    <div className="p-4 sm:p-6">
      <EmptyState
        icon={Settings2}
        title={copy.title}
        description={copy.description}
        steps={
          copy.disconnected
            ? ['Open Settings', 'Reconnect this WhatsApp number', returnTask]
            : ['Open Settings', 'Connect your WhatsApp number', returnTask]
        }
        action={
          <Link to="/settings?tab=whatsapp">
            <AppButton icon={<Settings2 size={16} />}>{copy.cta}</AppButton>
          </Link>
        }
      />
    </div>
  );
}
