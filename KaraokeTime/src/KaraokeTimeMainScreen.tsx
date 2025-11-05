import React from "react";
import { StatusBar, Text } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StyleSheet } from "react-native/types_generated/index";

function KaraokeTimeMainScreen() {
    return (
        <SafeAreaProvider>
            <StatusBar barStyle={'light-content'} />
            <Text style={styles.container}>IT'S KARAOKE TIME!!! ✅ 🎤 🎶</Text>
        </SafeAreaProvider>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    }
});

export default KaraokeTimeMainScreen;