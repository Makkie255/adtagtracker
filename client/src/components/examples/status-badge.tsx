import { StatusBadge } from '../status-badge';

export default function StatusBadgeExample() {
  return (
    <div className="p-8 flex gap-4 flex-wrap">
      <StatusBadge status="active" />
      <StatusBadge status="inactive" />
      <StatusBadge status="success" />
      <StatusBadge status="failed" />
    </div>
  );
}
