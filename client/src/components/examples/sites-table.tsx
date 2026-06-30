import { SitesTable } from '../sites-table';

export default function SitesTableExample() {
  const mockSites = [
    {
      id: "1",
      domain: "example.com",
      status: "active" as const,
      lastScanStatus: "success" as const,
      lastScanDate: "2 hours ago",
      hasChanges: true,
      changeCount: 3,
    },
    {
      id: "2",
      domain: "brand-shop.com",
      status: "active" as const,
      lastScanStatus: "failed" as const,
      lastScanDate: "1 day ago",
      hasChanges: false,
      errorMessage: "Timeout fetching homepage",
    },
    {
      id: "3",
      domain: "mybusiness.org",
      status: "inactive" as const,
      lastScanStatus: "success" as const,
      lastScanDate: "3 days ago",
      hasChanges: false,
    },
  ];

  return (
    <div className="p-8">
      <SitesTable
        sites={mockSites}
        onEdit={(id) => console.log('Edit site:', id)}
        onDelete={(id) => console.log('Delete site:', id)}
      />
    </div>
  );
}
