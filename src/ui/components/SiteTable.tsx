import React from 'react';
import { Box, Text } from 'ink';
import type { Site } from '../../core/store.js';

interface SiteTableProps {
  sites: Site[];
  profilesBySite?: Map<string, string[]>;
  selectedIndex?: number;
}

export function SiteTable({
  sites,
  profilesBySite,
  selectedIndex,
}: SiteTableProps): React.JSX.Element {
  if (sites.length === 0) {
    return <Text dimColor>no sites yet</Text>;
  }
  return (
    <Box flexDirection="column">
      {sites.map((site, idx) => {
        const isSelected = selectedIndex === idx;
        const profiles = profilesBySite?.get(site.id) ?? [];
        const profilesText = profiles.length === 0 ? '—' : profiles.join(', ');
        return (
          <Box key={site.id}>
            <Text>{isSelected ? '▌ ' : '  '}</Text>
            <Text bold={isSelected} dimColor={!isSelected}>
              {site.url}
            </Text>
            <Text dimColor>  ·  {profilesText}</Text>
          </Box>
        );
      })}
    </Box>
  );
}
