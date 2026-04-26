import React from 'react';
import { Box, Text } from 'ink';
import { LOGO } from '../logo.js';

export function Logo(): React.JSX.Element {
  return (
    <Box flexDirection="column" alignItems="flex-start">
      {LOGO.map((line, i) => (
        <Text key={i} dimColor>
          {line}
        </Text>
      ))}
    </Box>
  );
}
