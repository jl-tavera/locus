import React from 'react';
import { Box, Text } from 'ink';
import SelectInput from 'ink-select-input';

export interface MenuItem<V extends string = string> {
  label: string;
  value: V;
}

interface MenuProps<V extends string = string> {
  items: MenuItem<V>[];
  onSelect: (item: MenuItem<V>) => void;
  isFocused?: boolean;
}

export function Menu<V extends string = string>({
  items,
  onSelect,
  isFocused = true,
}: MenuProps<V>): React.JSX.Element {
  return (
    <Box flexDirection="column">
      <SelectInput
        items={items}
        onSelect={onSelect as (item: { label: string; value: V }) => void}
        isFocused={isFocused}
        indicatorComponent={({ isSelected }) => (
          <Text>{isSelected ? '▌ ' : '  '}</Text>
        )}
        itemComponent={({ label, isSelected }) => (
          <Text bold={isSelected} dimColor={!isSelected}>
            {label}
          </Text>
        )}
      />
    </Box>
  );
}
