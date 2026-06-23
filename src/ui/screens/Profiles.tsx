import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { Heading } from '../components/Heading.js';
import {
  createProfile,
  deleteProfile,
  listProfiles,
  toggleSiteInProfile,
  type ProfileWithSites,
} from '../../core/profiles.js';
import { getLockProfileId, listSites, type Site } from '../../core/store.js';
import { ALL_SITES_LABEL, getLockLabel, setLockProfile } from '../../core/lock.js';

type Mode = 'list' | 'creating' | 'detail';

export function Profiles(): React.JSX.Element {
  const [profiles, setProfiles] = useState<ProfileWithSites[]>(() => listProfiles());
  const [library, setLibrary] = useState<Site[]>(() => listSites());
  const [mode, setMode] = useState<Mode>('list');
  const [cursor, setCursor] = useState(0);
  const [siteCursor, setSiteCursor] = useState(0);
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [lockId, setLockId] = useState<string | null>(() => getLockProfileId());

  const refresh = () => {
    const next = listProfiles();
    setProfiles(next);
    setLibrary(listSites());
    setCursor((c) => Math.min(c, Math.max(0, next.length - 1)));
  };

  const current = mode === 'detail' ? profiles[cursor] : undefined;
  const memberIds = current ? new Set(current.sites.map((s) => s.id)) : new Set<string>();

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
      } else if (rawInput === 'l' && profiles.length > 0) {
        const profile = profiles[cursor];
        if (!profile) return;
        setError(null);
        void setLockProfile(profile.id)
          .then(() => {
            setLockId(profile.id);
            setInfo(`locked set: ${profile.name}`);
          })
          .catch((err) => setError(err instanceof Error ? err.message : String(err)));
      } else if (rawInput === 'a') {
        setError(null);
        void setLockProfile(null)
          .then(() => {
            setLockId(null);
            setInfo(`locked set: ${ALL_SITES_LABEL}`);
          })
          .catch((err) => setError(err instanceof Error ? err.message : String(err)));
      } else if (key.return && profiles.length > 0) {
        setSiteCursor(0);
        setError(null);
        setInfo(null);
        setMode('detail');
      }
    } else if (mode === 'detail') {
      if (!current) return;
      if (key.upArrow) setSiteCursor((c) => Math.max(0, c - 1));
      else if (key.downArrow)
        setSiteCursor((c) => Math.min(library.length - 1, c + 1));
      else if (rawInput === ' ' || key.return) {
        const site = library[siteCursor];
        if (!site) return;
        try {
          const result = toggleSiteInProfile(current.name, site.id);
          setInfo(
            result.isMember
              ? `added ${site.url} to ${current.name}`
              : `removed ${site.url} from ${current.name}`,
          );
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

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Heading>profiles</Heading>
      <Box marginTop={1}>
        <Text dimColor>locked set: {lockId === null ? ALL_SITES_LABEL : getLockLabel()}</Text>
      </Box>
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
                {p.id === lockId ? <Text dimColor>  · locked</Text> : null}
              </Box>
            );
          })
        )}
      </Box>

      {mode === 'detail' && current ? (
        <Box flexDirection="column" marginBottom={1}>
          <Text dimColor>— {current.name.toLowerCase()} —</Text>
          {library.length === 0 ? (
            <Text dimColor>no sites in the library — add some from the sites screen</Text>
          ) : (
            library.map((s, idx) => {
              const checked = memberIds.has(s.id);
              const isSelected = idx === siteCursor;
              return (
                <Box key={s.id}>
                  <Text>{isSelected ? '▌ ' : '  '}</Text>
                  <Text>{checked ? '[x] ' : '[ ] '}</Text>
                  <Text bold={isSelected} dimColor={!isSelected && !checked}>
                    {s.url}
                  </Text>
                </Box>
              );
            })
          )}
        </Box>
      ) : null}

      {mode === 'creating' ? (
        <Box>
          <Text>new profile: </Text>
          <TextInput value={input} onChange={setInput} onSubmit={submitCreate} placeholder="Work" />
        </Box>
      ) : mode === 'detail' ? (
        <Text dimColor>space toggle · esc back</Text>
      ) : (
        <Text dimColor>c create · d delete · enter open · l lock profile · a lock all · esc back</Text>
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
