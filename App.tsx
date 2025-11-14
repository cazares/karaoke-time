// App.js — Mixterious (Simulator-friendly: stream MP3 via <audio> in WebView)
import React, { useState } from 'react';
import {
  SafeAreaView, View, Text, TextInput, TouchableOpacity,
  ActivityIndicator, StyleSheet, Alert, Linking
} from 'react-native';
import { WebView } from 'react-native-webview';

const DEFAULT_API_BASE = 'http://127.0.0.1:8000'; // Simulator → your Mac

export default function App() {
  const [apiBase, setApiBase] = useState(DEFAULT_API_BASE);
  const [ytUrl, setYtUrl] = useState('https://www.youtube.com/watch?v=OIxRRR3gS_E');
  const [busy, setBusy] = useState(false);
  const [playerUrl, setPlayerUrl] = useState<string | null>(null); // e.g. http://127.0.0.1:8000/files/<id>.mp3

  const createAndPlay = async () => {
    const base = apiBase.trim().replace(/\/$/, '');
    if (!/^https?:\/\//i.test(base)) return Alert.alert('Invalid API base', 'e.g. http://127.0.0.1:8000');
    if (!/^https?:\/\//i.test(ytUrl.trim())) return Alert.alert('Invalid URL', 'Paste a full YouTube URL.');

    setBusy(true);
    setPlayerUrl(null);
    try {
      // 1) Ask API to create MP3
      const res = await fetch(`${base}/mp3`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ youtube_url: ytUrl.trim(), bitrate_kbps: 192 }),
      });
      if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
      const data = await res.json();
      if (!data?.download_url) throw new Error('Malformed API response');
      // 2) Stream it in-app via WebView <audio>
      setPlayerUrl(`${base}${data.download_url}`);
    } catch (e: any) {
      Alert.alert('Error', String(e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  const htmlFor = (src: string) => `
    <!doctype html>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <body style="margin:0;background:#0b0b0b;color:#fff;font:16px -apple-system,system-ui">
      <div style="padding:16px">
        <h3 style="margin:0 0 12px">Mixterious — Player</h3>
        <audio controls autoplay src="${src}" style="width:100%"></audio>
        <p style="opacity:.75;margin-top:12px">
          If audio doesn’t start, tap play. You can also
          <a href="${src}" target="_blank" style="color:#7fb0ff">open in Safari</a>.
        </p>
      </div>
    </body>
  `;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>Mixterious — YouTube → MP3</Text>

        <Text style={styles.label}>API Base (Simulator)</Text>
        <TextInput
          value={apiBase}
          onChangeText={setApiBase}
          placeholder="http://127.0.0.1:8000"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          style={styles.input}
        />

        <Text style={styles.label}>YouTube URL</Text>
        <TextInput
          value={ytUrl}
          onChangeText={setYtUrl}
          placeholder="https://www.youtube.com/watch?v=..."
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          style={styles.input}
        />

        <TouchableOpacity style={[styles.btn, busy && styles.btnDisabled]} onPress={createAndPlay} disabled={busy}>
          <Text style={styles.btnText}>{busy ? 'Working…' : 'Create + Play'}</Text>
        </TouchableOpacity>

        {busy && (
          <View style={styles.row}>
            <ActivityIndicator />
            <Text style={styles.progress}>Processing…</Text>
          </View>
        )}

        {playerUrl && (
          <View style={{ flex: 1, marginTop: 12, borderRadius: 10, overflow: 'hidden' }}>
            <WebView
              source={{ html: htmlFor(playerUrl) }}
              originWhitelist={['*']}
              allowsInlineMediaPlayback
              mediaPlaybackRequiresUserAction={false}
            />
            <TouchableOpacity
              onPress={() => Linking.openURL(playerUrl)}
              style={[styles.btn, { marginTop: 8, backgroundColor: '#3a3a3c' }]}
            >
              <Text style={styles.btnText}>Open in Safari</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0b0b0b' },
  container: { flex: 1, padding: 16 },
  title: { color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 8 },
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
});
// end of App.js
