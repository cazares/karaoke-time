import React, { useEffect, useState } from "react";
import { StatusBar, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { InfoToast } from 'react-native-toast-message';

function KaraokeTimeMainScreen() {
    const [ isKaraokeTimeRunning, setIsKaraokeTimeRunning ] = useState(false);
    const [ songCount, setSongCount ] = useState(0);
    useEffect(() => {
        console.log('KaraokeTimeMainScreen mounted');

        return (() => {
            console.log('KaraokeTimeMainScreen unmounted')
        });
    }, []);
    useEffect(() => {
        if (isKaraokeTimeRunning) {
            console.log('Karaoke started');
        }
        else if (!isKaraokeTimeRunning) {
            console.log('Karaoke paused');
        }
    }, [isKaraokeTimeRunning]);
    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle={'light-content'} />
            <View style={styles.spacer} />
            <TouchableOpacity
                style={styles.bottomButton}
                onPress={() => setIsKaraokeTimeRunning(isKaraokeTimeRunning => !isKaraokeTimeRunning)}>
                    <Text style={styles.bottomButtonText}>{isKaraokeTimeRunning ? 
                    "IT'S KARAOKE TIME!!! ✅ 🎤 🎶"
                    : "Karaoke Paused"}</Text>
            </TouchableOpacity>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'space-between',
    },
    bottomButton: {
        height: 75,
        width: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'gray',
    },
    bottomButtonText: {
        fontSize: 18,
        color: 'white',
    },
    spacer: {
        flex: 1,
    }
});

export default KaraokeTimeMainScreen;