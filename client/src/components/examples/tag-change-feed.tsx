import { TagChangeFeed } from '../tag-change-feed';

export default function TagChangeFeedExample() {
  const mockChanges = [
    {
      id: "1",
      tagName: "google-analytics.com/analytics.js",
      changeType: "added" as const,
      changeDate: "2 hours ago",
      tagUrl: "https://www.google-analytics.com/analytics.js?id=UA-123456-1",
      identifiedIds: ["UA-123456-1"],
      firstSeenDate: "Jan 15, 2025",
      company: "Google LLC",
    },
    {
      id: "2",
      tagName: "facebook.com/pixel",
      changeType: "modified" as const,
      changeDate: "1 day ago",
      tagUrl: "https://connect.facebook.net/en_US/fbevents.js",
      identifiedIds: ["987654321"],
      firstSeenDate: "Dec 1, 2024",
      lastSeenDate: "Jan 14, 2025",
      company: "Meta Platforms, Inc.",
    },
    {
      id: "3",
      tagName: "doubleclick.net/tag.js",
      changeType: "removed" as const,
      changeDate: "3 days ago",
      firstSeenDate: "Nov 20, 2024",
      lastSeenDate: "Jan 12, 2025",
    },
  ];

  return (
    <div className="p-8 max-w-3xl">
      <TagChangeFeed changes={mockChanges} />
    </div>
  );
}
