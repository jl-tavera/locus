import React from 'react';
import { Text } from 'ink';

export function Heading({ children }: { children: string }): React.JSX.Element {
  return (
    <Text bold>
      — {children.toLowerCase()} —
    </Text>
  );
}
