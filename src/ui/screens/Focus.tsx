import React, { useState } from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import { Heading } from '../components/Heading.js';
import { Menu, type MenuItem } from '../components/Menu.js';
import { listProfiles } from '../../core/profiles.js';
import { listSites } from '../../core/store.js';
import { parseDuration } from '../../utils/duration.js';
import { ALL_SITES_LABEL, startFocus, endFocus } from '../../core/focus.js';
import { FocusRunner } from './FocusRunner.js';

type Step = 'pickProfile' | 'pickDuration' | 'running';

const ALL_SITES_VALUE = '__all_sites__';

interface FocusProps {
  resumed?: { profileName: string; endsAt: Date };
  onExit: () => void;
}

export function Focus({ resumed, onExit }: FocusProps): React.JSX.Element {
  const profiles = listProfiles();
  const totalSites = listSites().length;
  const [step, setStep] = useState<Step>(resumed ? 'running' : 'pickProfile');
  const [selectedProfile, setSelectedProfile] = useState<string | null>(
    resumed?.profileName ?? null,
  );
  const [endsAt, setEndsAt] = useState<Date | null>(resumed?.endsAt ?? null);
  const [durationInput, setDurationInput] = useState('25m');
  const [error, setError] = useState<string | null>(null);

  if (step === 'running' && selectedProfile && endsAt) {
    return (
      <FocusRunner
        profileName={selectedProfile}
        endsAt={endsAt}
        onCleanup={async () => {
          await endFocus();
          onExit();
        }}
      />
    );
  }

  if (step === 'pickProfile') {
    const profileItems: MenuItem[] = profiles
      .filter((p) => p.sites.length > 0)
      .map((p) => ({ label: `${p.name}  ·  ${p.sites.length} sites`, value: p.name }));
    const items: MenuItem[] = [];
    if (totalSites > 0) {
      items.push({
        label: `${ALL_SITES_LABEL}  ·  ${totalSites} site${totalSites === 1 ? '' : 's'}`,
        value: ALL_SITES_VALUE,
      });
    }
    items.push(...profileItems);

    if (items.length === 0) {
      return (
        <Box flexDirection="column" paddingX={2} paddingY={1}>
          <Heading>focus</Heading>
          <Box marginTop={1}>
            <Text dimColor>no sites yet. add some from the sites screen first.</Text>
          </Box>
        </Box>
      );
    }
    return (
      <Box flexDirection="column" paddingX={2} paddingY={1}>
        <Heading>focus</Heading>
        <Box marginTop={1} marginBottom={1} flexDirection="column">
          <Text dimColor>pick what to block</Text>
          <Text dimColor>
            all sites blocks everything in your library · or pick one of your saved profiles
          </Text>
          <Text dimColor>(create new profiles from the profiles screen)</Text>
        </Box>
        <Menu
          items={items}
          onSelect={(item) => {
            setSelectedProfile(item.value === ALL_SITES_VALUE ? null : item.value);
            setStep('pickDuration');
          }}
        />
      </Box>
    );
  }

  // pickDuration
  const submit = async () => {
    setError(null);
    try {
      const ms = parseDuration(durationInput);
      const { endsAt: ea, profileName } = await startFocus(selectedProfile, ms);
      setSelectedProfile(profileName);
      setEndsAt(ea);
      setStep('running');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Heading>{`focus · ${selectedProfile ?? ALL_SITES_LABEL}`}</Heading>
      <Box marginTop={1} marginBottom={1}>
        <Text dimColor>duration (e.g. 25m, 1h, 1h30m, 90s)</Text>
      </Box>
      <Box>
        <Text>duration: </Text>
        <TextInput value={durationInput} onChange={setDurationInput} onSubmit={submit} />
      </Box>
      {error ? (
        <Box marginTop={1}>
          <Text bold>error: {error}</Text>
        </Box>
      ) : null}
    </Box>
  );
}
