import { TagTrackingConfig } from '../tag-tracking-config';
import { useState } from 'react';

export default function TagTrackingConfigExample() {
  const [trackAllTags, setTrackAllTags] = useState(false);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['google-ads', 'meta-pixel']);
  const [customDomains, setCustomDomains] = useState<string[]>(['example-tracker.com']);

  return (
    <div className="p-8 max-w-3xl">
      <TagTrackingConfig
        trackAllTags={trackAllTags}
        onTrackAllChange={setTrackAllTags}
        selectedPlatforms={selectedPlatforms}
        onPlatformsChange={setSelectedPlatforms}
        customDomains={customDomains}
        onCustomDomainsChange={setCustomDomains}
      />
    </div>
  );
}
