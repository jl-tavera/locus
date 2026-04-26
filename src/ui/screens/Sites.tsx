import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { Heading } from '../components/Heading.js';
import { SiteTable } from '../components/SiteTable.js';
import { addSite, listProfilesRaw, listSites, removeSite } from '../../core/store.js';
import { normalizeUrl } from '../../utils/url.js';

type Mode = 'list' | 'adding';

export function Sites(): React.JSX.Element {
  const [sites, setSites] = useState(() => listSites());
  const [mode, setMode] = useState<Mode>('list');
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [cursor, setCursor] = useState(0);

  const profilesBySite = (() => {
    const map = new Map<string, string[]>();
    for (const profile of listProfilesRaw()) {
      for (const id of profile.siteIds) {
        const list = map.get(id) ?? [];
        list.push(profile.name);
        map.set(id, list);
      }
    }
    return map;
  })();

  const refresh = () => {
    const next = listSites();
    setSites(next);
    setCursor((c) => Math.min(c, Math.max(0, next.length - 1)));
  };

  useInput((rawInput, key) => {
    if (mode !== 'list') return;
    if (key.upArrow) setCursor((c) => Math.max(0, c - 1));
    else if (key.downArrow) setCursor((c) => Math.min(sites.length - 1, c + 1));
    else if (rawInput === 'a') {
      setError(null);
      setInfo(null);
      setMode('adding');
    } else if (rawInput === 'd' && sites.length > 0) {
      const site = sites[cursor];
      if (!site) return;
      const removed = removeSite(site.url);
      if (removed.removed) {
        setInfo(`removed ${site.url}`);
        refresh();
      }
    }
  });

  const submit = () => {
    setError(null);
    const value = input.trim();
    if (!value) {
      setMode('list');
      return;
    }
    try {
      const url = normalizeUrl(value);
      const result = addSite(url);
      setInfo(result.created ? `added ${url}` : `already in library: ${url}`);
      setInput('');
      setMode('list');
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Heading>sites</Heading>
      <Box marginTop={1} marginBottom={1}>
        <SiteTable
          sites={sites}
          profilesBySite={profilesBySite}
          selectedIndex={mode === 'list' ? cursor : undefined}
        />
      </Box>
      {mode === 'adding' ? (
        <Box>
          <Text>add: </Text>
          <TextInput
            value={input}
            onChange={setInput}
            onSubmit={submit}
            placeholder="example.com"
          />
        </Box>
      ) : (
        <Text dimColor>a add · d delete · esc back</Text>
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
