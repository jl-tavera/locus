import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { Heading } from '../components/Heading.js';
import {
  addSiteToProfile,
  createProfile,
  deleteProfile,
  getProfile,
  listProfiles,
  removeSiteFromProfile,
  type ProfileWithSites,
} from '../../core/profiles.js';

type Mode = 'list' | 'creating' | 'detail' | 'addingSite';

export function Profiles(): React.JSX.Element {
  const [profiles, setProfiles] = useState<ProfileWithSites[]>(() => listProfiles());
  const [mode, setMode] = useState<Mode>('list');
  const [cursor, setCursor] = useState(0);
  const [siteCursor, setSiteCursor] = useState(0);
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const refresh = () => {
    const next = listProfiles();
    setProfiles(next);
    setCursor((c) => Math.min(c, Math.max(0, next.length - 1)));
  };

  const refreshDetail = (profileName: string): ProfileWithSites | null => {
    try {
      return getProfile(profileName);
    } catch {
      return null;
    }
  };

  const current = mode === 'detail' || mode === 'addingSite' ? profiles[cursor] : undefined;

  useInput((rawInput, key) => {
    if (mode === 'list') {
      if (key.upArrow) setCursor((c) => Math.max(0, c - 1));
      else if (key.downArrow) setCursor((c) => Math.min(profiles.length - 1, c + 1));
      else if (rawInput === 'c') {
        setError(null);
        setInfo(null);
        setInput('');
        setMode('creating');
      } else if (rawInput === 'd' && profiles.length > 0) {
        const profile = profiles[cursor];
        if (!profile) return;
        try {
          deleteProfile(profile.name);
          setInfo(`deleted ${profile.name}`);
          refresh();
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
        }
      } else if (key.return && profiles.length > 0) {
        setSiteCursor(0);
        setMode('detail');
      }
    } else if (mode === 'detail') {
      if (!current) return;
      if (key.upArrow) setSiteCursor((c) => Math.max(0, c - 1));
      else if (key.downArrow)
        setSiteCursor((c) => Math.min(current.sites.length - 1, c + 1));
      else if (rawInput === 'a') {
        setError(null);
        setInput('');
        setMode('addingSite');
      } else if (rawInput === 'r' && current.sites.length > 0) {
        const site = current.sites[siteCursor];
        if (!site) return;
        try {
          removeSiteFromProfile(current.name, site.url);
          setInfo(`removed ${site.url} from ${current.name}`);
          refresh();
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    }
  });

  const submitCreate = () => {
    const value = input.trim();
    if (!value) {
      setMode('list');
      return;
    }
    try {
      createProfile(value);
      setInfo(`created ${value}`);
      setInput('');
      setMode('list');
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const submitAddSite = () => {
    if (!current) return;
    const value = input.trim();
    if (!value) {
      setMode('detail');
      return;
    }
    try {
      const result = addSiteToProfile(current.name, value);
      setInfo(`added ${result.siteUrl} to ${current.name}`);
      setInput('');
      setMode('detail');
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Heading>profiles</Heading>
      <Box marginTop={1} marginBottom={1} flexDirection="column">
        {profiles.length === 0 ? (
          <Text dimColor>no profiles yet</Text>
        ) : (
          profiles.map((p, idx) => {
            const isSelected = idx === cursor;
            return (
              <Box key={p.id}>
                <Text>{isSelected ? '▌ ' : '  '}</Text>
                <Text bold={isSelected} dimColor={!isSelected}>
                  {p.name}
                </Text>
                <Text dimColor>  ·  {p.sites.length} site{p.sites.length === 1 ? '' : 's'}</Text>
              </Box>
            );
          })
        )}
      </Box>

      {mode === 'detail' && current ? (
        <Box flexDirection="column" marginBottom={1}>
          <Text dimColor>— {current.name.toLowerCase()} —</Text>
          {current.sites.length === 0 ? (
            <Text dimColor>(empty)</Text>
          ) : (
            current.sites.map((s, idx) => (
              <Box key={s.id}>
                <Text>{idx === siteCursor ? '▌ ' : '  '}</Text>
                <Text bold={idx === siteCursor} dimColor={idx !== siteCursor}>
                  {s.url}
                </Text>
              </Box>
            ))
          )}
        </Box>
      ) : null}

      {mode === 'creating' ? (
        <Box>
          <Text>new profile: </Text>
          <TextInput value={input} onChange={setInput} onSubmit={submitCreate} placeholder="Work" />
        </Box>
      ) : mode === 'addingSite' ? (
        <Box>
          <Text>add site to {current?.name}: </Text>
          <TextInput
            value={input}
            onChange={setInput}
            onSubmit={submitAddSite}
            placeholder="example.com"
          />
        </Box>
      ) : mode === 'detail' ? (
        <Text dimColor>a add site · r remove site · esc back</Text>
      ) : (
        <Text dimColor>c create · d delete · enter open · esc back</Text>
      )}

      {info ? (
        <Box marginTop={1}>
          <Text dimColor>{info}</Text>
        </Box>
      ) : null}
      {error ? (
        <Box marginTop={1}>
          <Text bold>error: {error}</Text>
        </Box>
      ) : null}
    </Box>
  );
}
