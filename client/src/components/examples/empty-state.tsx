import { EmptyState } from '../empty-state';
import { Globe } from 'lucide-react';

export default function EmptyStateExample() {
  return (
    <div className="p-8">
      <EmptyState
        icon={Globe}
        title="No sites yet"
        description="Create your first site to start monitoring advertising tags and tracking changes over time."
        actionLabel="Create New Site"
        onAction={() => console.log('Create site clicked')}
      />
    </div>
  );
}
