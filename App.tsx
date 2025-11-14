// App.tsx — Mixterious (Drawer + Tabs) with compact player + persistent Lyrics panel + debug
// TypeScript, no SafeAreaView; uses react-native-safe-area-context for insets.

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
  Modal,
  ScrollView,
} from 'react-native';
import {
  NavigationContainer,
  DefaultTheme,
  DrawerActions,
} from '@react-navigation/native';
import {
  createDrawerNavigator,
  DrawerContentScrollView,
  DrawerItem,
} from '@react-navigation/drawer';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets, SafeAreaProvider } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

// ---- Config ----
const PUBLIC_BASE = 'https://api.mixterioso.example.com'; // TODO: replace with your public hostname
const LOCAL_BASE = 'http://127.0.0.1:8000';

// ---- Edge-safe wrapper (no deprecated SafeAreaView) ----
function EdgeSafe({ children }: { children: React.ReactNode }) {
  const i = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.safe,
        {
          paddingTop: i.top,
          paddingBottom: i.bottom,
          paddingLeft: i.left,
          paddingRight: i.right,
        },
      ]}>
      {children}
    </View>
  );
}

// ---- Reusable Step Bar (bottom of content area) ----
function StepBar({
  labels,
  enabledIdx = 0,
}: {
  labels: string[];
  enabledIdx?: number;
}) {
  return (
    <View style={styles.stepBar}>
      {labels.map((label, idx) => {
        const enabled = idx === enabledIdx;
        return (
          <View
            key={label}
            style={[
              styles.stepItem,
              !enabled && styles.stepDisabled,
              idx > 0 && styles.stepDivider,
            ]}>
            <Text style={styles.stepText}>{label}</Text>
          </View>
        );
      })}
    </View>
  );
}

// ---- Download Screen (Step 1 of 6) ----
function DownloadScreen() {
  const [apiBase, setApiBase] = useState<string>(PUBLIC_BASE);
  const [input, setInput] = useState<string>('');
  const [busy, setBusy] = useState<boolean>(false);
  const [playerUrl, setPlayerUrl] = useState<string | null>(null);
  const [lyrics, setLyrics] = useState<string>('');
  const [nowPlayingTitle, setNowPlayingTitle] = useState<string>('');
  const [showLyrics, setShowLyrics] = useState<boolean>(false);
  const [lastPayload, setLastPayload] = useState<any>(null); // dev-only debug

  // Prefer localhost on Simulator if health responds quickly; else use public.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const c = new AbortController();
        const t = setTimeout(() => c.abort(), 1200);
        const r = await fetch(`${LOCAL_BASE.replace(/\/$/, '')}/health`, {
          signal: c.signal,
        });
        clearTimeout(t);
        if (!alive) return;
        setApiBase(r.ok ? LOCAL_BASE : PUBLIC_BASE);
      } catch {
        if (!alive) return;
        setApiBase(PUBLIC_BASE);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Ultra-compact HTML for the audio element (no header/padding)
  const htmlFor = (src: string): string => `
    <!doctype html>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <body style="margin:0;background:#0b0b0b;color:#fff;font:16px -apple-system,system-ui;">
      <audio controls autoplay src="${src}" style="width:100%;display:block;"></audio>
    </body>
  `;

  const onSearch = async () => {
    const base = apiBase.replace(/\/$/, '');
    const value = input.trim();
    if (!value) {
      Alert.alert(
        'Enter something',
        'Paste a YouTube URL/ID or type “artist - title”.',
      );
      return;
    }
    setBusy(true);
    setPlayerUrl(null);
    setLyrics('');
    setNowPlayingTitle('');
    setLastPayload(null);

    try {
      // unified endpoint: /search { input }
      const res = await fetch(`${base}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: value, bitrate_kbps: 192 }),
      });
      if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
      const data: any = await res.json();

      // DEV: log payload to Metro to see what keys came back
      // Remove or guard this if noisy
      console.log('[Mixterious] /search payload:', data);
      setLastPayload(data);

      if (!data?.download_url) throw new Error('Malformed API response');
      setPlayerUrl(`${base}${data.download_url}`);
      setNowPlayingTitle(data.title || data.search_metadata?.full_title || '');
      setLyrics(typeof data.lyrics_text === 'string' ? data.lyrics_text : '');
    } catch (e: any) {
      Alert.alert('Error', String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  // derived helper
  const hasLyrics = !!lyrics && lyrics.trim().length > 0;

  return (
    <EdgeSafe>
      <View style={styles.container}>
        <Text style={styles.label}>YouTube URL / ID / Query</Text>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Paste URL or ID, or type “artist - title”"
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
          returnKeyType="go"
          blurOnSubmit
          onSubmitEditing={onSearch} // enter/return triggers same action
        />

        <TouchableOpacity
          style={[styles.btn, busy && styles.btnDisabled]}
          disabled={busy}
          onPress={onSearch}>
          <Text style={styles.btnText}>
            {busy ? 'Working…' : 'Search + Download'}
          </Text>
        </TouchableOpacity>

        {busy && (
          <View style={styles.row}>
            <ActivityIndicator />
            <Text style={styles.progress}>Processing…</Text>
          </View>
        )}

        {/* Always render a Lyrics panel so you can see a placeholder even if empty */}
        <View style={styles.lyricsBox}>
          <View style={styles.lyricsHeader}>
            <Text style={styles.lyricsTitle}>Lyrics</Text>
            {hasLyrics ? (
              <TouchableOpacity onPress={() => setShowLyrics(true)}>
                <Text style={styles.lyricsMore}>Full screen</Text>
              </TouchableOpacity>
            ) : (
              <Text style={[styles.lyricsMore, { opacity: 0.5 }]}>Waiting…</Text>
            )}
          </View>
          <ScrollView style={{ maxHeight: 220 }}>
            <Text selectable style={styles.lyricsText}>
              {hasLyrics ? lyrics : 'No lyrics returned yet. Try a different query or verify the backend returns "lyrics_text".'}
            </Text>
          </ScrollView>

          {/* DEV-only: show which keys came back so you can confirm the API contract */}
          {__DEV__ && lastPayload && (
            <View style={{ marginTop: 8 }}>
              <Text style={{ color: '#9aa0a6', fontSize: 12 }}>
                Debug keys: {Object.keys(lastPayload).join(', ')}
              </Text>
            </View>
          )}
        </View>

        {playerUrl && (
          <View
            // Compact player: fixed height to leave room for lyrics/UI
            style={{ height: 84, marginTop: 12, borderRadius: 10, overflow: 'hidden' }}>
            <WebView
              source={{ html: htmlFor(playerUrl) }}
              originWhitelist={['*']}
              allowsInlineMediaPlayback
              mediaPlaybackRequiresUserAction={false}
            />
          </View>
        )}

        <Modal
          visible={showLyrics}
          animationType="slide"
          onRequestClose={() => setShowLyrics(false)}>
          <EdgeSafe>
            <View
              style={{
                paddingHorizontal: 16,
                paddingTop: 8,
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>
                Lyrics
              </Text>
              <TouchableOpacity onPress={() => setShowLyrics(false)}>
                <Text style={{ color: '#7fb0ff', fontSize: 16 }}>Close</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={{ flex: 1, padding: 16 }}>
              <Text selectable style={styles.lyricsText}>
                {lyrics}
              </Text>
            </ScrollView>
          </EdgeSafe>
        </Modal>

        <StepBar
          labels={['Download', 'Process', 'Sync', 'Calibrate', 'Generate', 'Upload']}
          enabledIdx={0}
        />
      </View>
    </EdgeSafe>
  );
}

// ---- Placeholder screens (scaffold) ----
function Placeholder({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <EdgeSafe>
      <View style={styles.container}>
        <Text style={styles.pageTitle}>{title}</Text>
        <Text style={styles.pageSubtitle}>{subtitle}</Text>
        <View style={[styles.lyricsBox, { alignItems: 'center' }]}>
          <Text style={[styles.lyricsText, { opacity: 0.6 }]}>Coming soon</Text>
        </View>
      </View>
    </EdgeSafe>
  );
}

// ---- Tabs per Drawer section ----
const Tabs = createBottomTabNavigator();

function Tabs_A() {
  return (
    <Tabs.Navigator screenOptions={{ headerShown: false, tabBarStyle: styles.tabBar }}>
      <Tabs.Screen name="Download" component={DownloadScreen} />
      <Tabs.Screen
        name="Process"
        children={() => (
          <Placeholder title="Mixterious" subtitle="Steps 1–4 of 6 — Process" />
        )}
        options={{ tabBarStyle: [styles.tabBar, { opacity: 0.4 }] }}
      />
    </Tabs.Navigator>
  );
}

function Tabs_B() {
  return (
    <Tabs.Navigator screenOptions={{ headerShown: false, tabBarStyle: styles.tabBar }}>
      <Tabs.Screen
        name="Sync"
        children={() => (
          <Placeholder title="Mixterious" subtitle="Steps 3–4 of 6 — Sync" />
        )}
        options={{ tabBarStyle: [styles.tabBar, { opacity: 0.4 }] }}
      />
      <Tabs.Screen
        name="Calibrate"
        children={() => (
          <Placeholder title="Mixterious" subtitle="Steps 3–4 of 6 — Calibrate" />
        )}
        options={{ tabBarStyle: [styles.tabBar, { opacity: 0.4 }] }}
      />
    </Tabs.Navigator>
  );
}

function Tabs_C() {
  return (
    <Tabs.Navigator screenOptions={{ headerShown: false, tabBarStyle: styles.tabBar }}>
      <Tabs.Screen
        name="Generate"
        children={() => (
          <Placeholder title="Mixterious" subtitle="Steps 5–6 of 6 — Generate" />
        )}
        options={{ tabBarStyle: [styles.tabBar, { opacity: 0.4 }] }}
      />
      <Tabs.Screen
        name="Upload"
        children={() => (
          <Placeholder title="Mixterious" subtitle="Steps 5–6 of 6 — Upload" />
        )}
        options={{ tabBarStyle: [styles.tabBar, { opacity: 0.4 }] }}
      />
    </Tabs.Navigator>
  );
}

// ---- Drawer header helpers ----
function HeaderTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800' }}>{title}</Text>
      <Text style={{ color: '#a9a9a9', fontSize: 12 }}>{subtitle}</Text>
    </View>
  );
}

function HeaderMenuButton({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Open menu"
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      style={{
        width: 64,
        height: 64,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Text style={{ color: '#fff', fontSize: 40, lineHeight: 40 }}>≡</Text>
    </TouchableOpacity>
  );
}

// ---- Drawer ----
const Drawer = createDrawerNavigator();

function DrawerContent(props: any) {
  const insets = useSafeAreaInsets();
  return (
    <DrawerContentScrollView
      {...props}
      contentContainerStyle={{
        flex: 1,
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
        backgroundColor: '#1E282D',
        justifyContent: 'center', // vertical centering
      }}>
      <Text style={styles.drawerHeader}>Steps 1-2</Text>
      <DrawerItem
        label="Download Lyrics + Audio"
        labelStyle={styles.drawerItem}
        onPress={() => props.navigation.navigate('Steps 1–4')}
      />
      <Text style={[styles.drawerHeader, { marginTop: 24 }]}>
        Steps 3-4
      </Text>
      <DrawerItem
        label="Stitch Lyrics + Audio"
        labelStyle={styles.drawerItem}
        onPress={() => props.navigation.navigate('Steps 3–4')}
      />
      <Text style={[styles.drawerHeader, { marginTop: 24 }]}>
        Steps 5–6
      </Text>
      <DrawerItem
        label="Output Lyrics Video"
        labelStyle={styles.drawerItem}
        onPress={() => props.navigation.navigate('Steps 5–6')}
      />
    </DrawerContentScrollView>
  );
}

function Root() {
  const theme = {
    ...DefaultTheme,
    colors: { ...DefaultTheme.colors, background: '#0b0b0b' },
  };

  const subtitleForRoute = (name: string) => {
    switch (name) {
      case 'Steps 1–4':
        return 'Step 1 of 6';
      case 'Steps 3–4':
        return 'Steps 3–4 of 6';
      case 'Steps 5–6':
        return 'Steps 5–6 of 6';
      default:
        return '';
    }
  };

  return (
    <NavigationContainer theme={theme}>
      <Drawer.Navigator
        initialRouteName="Steps 1–4"
        drawerContent={(p) => <DrawerContent {...p} />}
        screenOptions={({ navigation, route }) => ({
          headerShown: true,
          headerStyle: { backgroundColor: '#0b0b0b' },
          headerTintColor: '#fff',
          headerTitleAlign: 'center',
          headerTitle: () => (
            <HeaderTitle title="Mixterious" subtitle={subtitleForRoute(route.name)} />
          ),
          headerLeft: () => (
            <HeaderMenuButton
              onPress={() => navigation.dispatch(DrawerActions.toggleDrawer())}
            />
          ),
        })}>
        <Drawer.Screen name="Steps 1–4" component={Tabs_A} />
        <Drawer.Screen name="Steps 3–4" component={Tabs_B} />
        <Drawer.Screen name="Steps 5–6" component={Tabs_C} />
      </Drawer.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <Root />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0b0b0b' },
  container: { flex: 1, padding: 16 },
  pageTitle: { color: '#fff', fontSize: 24, fontWeight: '800' },
  pageSubtitle: { color: '#a9a9a9', marginBottom: 12 },
  label: { color: '#bdbdbd', marginTop: 10 },
  input: {
    backgroundColor: '#1c1c1e',
    color: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
  btn: {
    marginTop: 12,
    backgroundColor: '#2f6dfc',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  progress: { color: '#ddd' },
  lyricsBox: {
    marginTop: 12,
    backgroundColor: '#121214',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#2a2a2e',
  },
  lyricsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  lyricsTitle: { color: '#fff', fontWeight: '700' },
  lyricsMore: { color: '#7fb0ff' },
  lyricsText: { color: '#e6e6e6', fontFamily: 'Menlo' },
  stepBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#2a2a2e',
    marginTop: 10,
  },
  stepItem: { flex: 1, alignItems: 'center', paddingVertical: 6 },
  stepDisabled: { opacity: 0.4 },
  stepDivider: { borderLeftWidth: 1, borderLeftColor: '#2a2a2e' },
  stepText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  tabBar: { backgroundColor: '#121214', borderTopColor: '#2a2a2e' },
  drawerHeader: {
    color: 'white',
    fontSize: 22,
    fontWeight: '800',
    marginHorizontal: 15,
    marginBottom: 6,
    paddingTop: 35,
    justifyContent: 'space-between',
    alignContent: 'center',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'white',
  },
  drawerItem: {
    color: 'white',
    backgroundColor: '#1E282D',
    fontSize: 18,
    fontWeight: '600',
  },
});
// end of App.tsx
