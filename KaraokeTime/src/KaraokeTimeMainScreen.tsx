import React, { useEffect, useRef, useState } from "react";
import { StatusBar, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const KaraokeTimeMainScreen = () => {
    const [ isKaraokeTimeRunning, setIsKaraokeTimeRunning ] = useState(false);
    const [ songCount, setSongCount ] = useState(0);
    const [ recommendedSong, setRecommendedSong ] = useState('');
    const [ isLoadingRecommended, setIsLoadingRecommended] = useState(true);
    const timeoutId = useRef(0);

    useEffect(() => {
        console.log('KaraokeTimeMainScreen mounted v1');

        return (() => {
            console.log('KaraokeTimeMainScreen unmounted v1')
        });
    }, []);
    useEffect(() => {
        console.log('KaraokeTimeMainScreen mounted v3');

        setIsLoadingRecommended(true);
        
        timeoutId.current = setTimeout(() => {
            setRecommendedSong("Californication");
            setIsLoadingRecommended(false);
        }, 2000);

        return (() => {
            console.log('KaraokeTimeMainScreen unmounted v3')
        });
    }, []);
    useEffect(() => {
        if (isKaraokeTimeRunning) {
            console.log('Karaoke started');
        }
        else if (!isKaraokeTimeRunning) {
            console.log('Karaoke paused');
        }

        if (!isKaraokeTimeRunning) {
            return;
        }
        const intervalId = setInterval(() => {
            setSongCount(songCount => songCount + 1);
        }, 1000);

        return () => {
            clearInterval(intervalId);
        };
    }, [isKaraokeTimeRunning]);
    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle={'light-content'} />
            <View style={styles.spacer} />
            <Text style={styles.counterText}>Songs queued: {songCount}</Text>
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
    },
    counterText: {
        textAlign: 'center',
        marginTop: 16,
        fontSize: 18,
    }
});

export default KaraokeTimeMainScreen;