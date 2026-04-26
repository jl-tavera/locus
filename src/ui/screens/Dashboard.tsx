import React from 'react';
import { Box, Text } from 'ink';
import { Logo } from '../components/Logo.js';
import { Menu, type MenuItem } from '../components/Menu.js';
import type { ScreenName } from '../App.js';

interface DashboardProps {
  onNavigate: (screen: ScreenName) => void;
}

const items: MenuItem<ScreenName>[] = [
  { label: 'sites', value: 'sites' },
  { label: 'profiles', value: 'profiles' },
  { label: 'focus', value: 'focus' },
  { label: 'status', value: 'status' },
  { label: 'quit', value: 'quit' },
];

export function Dashboard({ onNavigate }: DashboardProps): React.JSX.Element {
  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Logo />
      <Box marginTop={1} marginBottom={1}>
        <Text dimColor>minimal site blocker · monochrome</Text>
      </Box>
      <Menu items={items} onSelect={(item) => onNavigate(item.value)} />
      <Box marginTop={1}>
        <Text dimColor>↑↓ navigate · enter select · esc back</Text>
      </Box>
    </Box>
  );
}
