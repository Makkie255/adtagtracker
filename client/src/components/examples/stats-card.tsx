import { StatsCard } from '../stats-card';
import { Activity, Globe, Bell, TrendingUp } from 'lucide-react';

export default function StatsCardExample() {
  return (
    <div className="p-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <StatsCard
        title="Total Scans"
        value="1,234"
        icon={Activity}
        trend={{ value: "+12% from last month", isPositive: true }}
      />
      <StatsCard
        title="Active Sites"
        value="42"
        icon={Globe}
      />
      <StatsCard
        title="Tag Changes"
        value="89"
        icon={TrendingUp}
        trend={{ value: "+23% from last month", isPositive: true }}
      />
      <StatsCard
        title="Notifications"
        value="156"
        icon={Bell}
      />
    </div>
  );
}
