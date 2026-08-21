import { Navigate } from 'react-router-dom';

export default function ReportsPage() {
  return <Navigate to="/billing?tab=usage" replace />;
}
