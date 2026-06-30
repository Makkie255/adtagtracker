import { ChartsSection } from '../charts-section';

export default function ChartsSectionExample() {
  const scansData = [
    { date: "Jan 1", count: 45 },
    { date: "Jan 5", count: 52 },
    { date: "Jan 10", count: 48 },
    { date: "Jan 15", count: 67 },
    { date: "Jan 20", count: 71 },
    { date: "Jan 25", count: 64 },
    { date: "Jan 30", count: 78 },
  ];

  const changesData = [
    { date: "Jan 1", count: 2 },
    { date: "Jan 5", count: 5 },
    { date: "Jan 10", count: 3 },
    { date: "Jan 15", count: 8 },
    { date: "Jan 20", count: 4 },
    { date: "Jan 25", count: 6 },
    { date: "Jan 30", count: 9 },
  ];

  const successRateData = [
    { name: "Success", value: 92 },
    { name: "Failed", value: 8 },
  ];

  const topTagsData = [
    { tag: "Google Ads", count: 45 },
    { tag: "Meta Pixel", count: 38 },
    { tag: "Trade Desk", count: 29 },
    { tag: "LinkedIn", count: 22 },
    { tag: "Twitter", count: 18 },
  ];

  return (
    <div className="p-8">
      <ChartsSection
        scansData={scansData}
        changesData={changesData}
        successRateData={successRateData}
        topTagsData={topTagsData}
      />
    </div>
  );
}
