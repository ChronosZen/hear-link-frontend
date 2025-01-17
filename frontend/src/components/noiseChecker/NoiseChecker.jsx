import { useReducer, useEffect, useRef } from "react";
import ButtonFunc from "../reusable/ButtonFunc";
import { StyleSheet, Dimensions } from "react-native";
import { Audio } from 'expo-av';
import { Colors, Spacing, Typography } from "../../styles";
import { checkPermissions, requestPermissions } from "./UserPermissions";
import { useRoute, useNavigation } from "@react-navigation/native";
import HeaderText from "../reusable/HeaderText";
import SVG from "../svg/SVG";
import LottieView from "lottie-react-native";
import {
    noiseCheckIcon,
    closeIcon,
    wave
} from "../svg/svgs";
import {
    HStack,
    Pressable,
    VStack,
    Text,
    Heading,
    View
} from '@gluestack-ui/themed';

const windowHeight = Dimensions.get('window').height

const initialState = {
    isNoiseChecking: false,
    recording: null,
    noiseLevel: -40,
    isSafeLevel: false,
    noiseLevelUpdateInterval: null,
    safeDuration: 4,
    isMicrophonePermGranted: false,
    isRecordingPermGranted: false,
};

const reducer = (state, action) => {
    switch (action.type) {
        case "SET_IS_NOISE_CHECKING":
            return {
                ...state,
                isNoiseChecking: action.payload
            }
        case "SET_RECORDING":
            return {
                ...state,
                recording: action.payload
            }
        case "SET_NOISE_LEVEL":
            return {
                ...state,
                noiseLevel: action.payload
            }
        case "SET_IS_SAFE_LEVEL":
            return {
                ...state,
                isSafeLevel: action.payload
            }
        case "SET_IMCREMENT_SAFE_DURATION":
            return {
                ...state,
                safeDuration: state.safeDuration + action.payload
            }
        case "RESET_SAFE_DURATION":
            return {
                ...state,
                safeDuration: 0
            }
        case "SET_NOISE_LEVEL_UPDATE_INTERVAL":
            return {
                ...state,
                noiseLevelUpdateInterval: action.payload
            }
        case "SET_MICROPHONE_PERM_GRANTED":
            return {
                ...state,
                isMicrophonePermGranted: action.payload
            }
        case "SET_RECORDING_PERM_GRANTED":
            return {
                ...state,
                isRecordingPermGranted: action.payload
            }
        default:
            return state;
    }
}

const NoiseChecker = ({ text }) => {
    // console.log("Message from NoiseChecker component.") -> OK
    // console.log("route name from noise checker", route.route.route.name)

    const script = text
    const waveRef = useRef()

    const calcWaveScaleY = (noiseLevel) => {
        if (noiseLevel > -10) {
            return 1.2;
        } else if (noiseLevel <= -10 && noiseLevel > -12) {
            return 0.9;
        } else {
            return 0.6;
        }
    }

    const route = useRoute()
    const routeName = route.name
    // console.log("routeName", routeName)

    const navigation = useNavigation()
    // console.log(navigation);

    const [state, dispatch] = useReducer(reducer, initialState);

    // Check microphone access and recording permission status.
    const handleCheckPermissions = async () => {
        await checkPermissions(dispatch)
    }
    // console.log("handleCheckPermission is working ->", state)

    const handleRequestPermissions = async () => {
        await requestPermissions(dispatch, state)
    }

    const startNoiseCheck = async () => {
        try {
            if ((!state.isPermissionGranted) || (!state.isRecordingPermGranted)) {
                handleRequestPermissions()
            }
            if (state.recording !== null) {
                await stopNoiseCheck()
                await state.recording.stopAndUnloadAsync();
                dispatch({ type: "SET_RECORDING", payload: null });
            }
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
            });
            // console.log('Starting recording.. and isNoiseChecking ->', state.isNoiseChecking)

            const recordingObj = new Audio.Recording()
            // console.log("this is recording instance -> ", JSON.stringify(recordingObj))

            await recordingObj.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY)
            await recordingObj.startAsync()

            dispatch({ type: "SET_IS_NOISE_CHECKING", payload: true })
            dispatch({ type: "SET_RECORDING", payload: recordingObj })
            dispatch({ type: "RESET_SAFE_DURATION", payload: 0 })
            // console.log("check the state of recording after start the recording ->", recordingObj)

            const noiseCheckInterval = setInterval(async () => {
                try {
                    // console.log("state.recording from setInterval->", state.recording)
                    if (recordingObj !== null) {
                        const recordingStatus = await recordingObj.getStatusAsync();
                        const meteringDbFS = recordingStatus.metering?.toFixed(1);
                        const floatMeteringDbFS = parseFloat(meteringDbFS)
                        // console.log("recordingStatus in inside of interval ->", recordingStatus);
                        // console.log("recordingStatus.metering", meteringDbFS)

                        dispatch({ type: "SET_NOISE_LEVEL", payload: floatMeteringDbFS })

                        if (floatMeteringDbFS <= -12) {
                            dispatch({ type: "SET_IMCREMENT_SAFE_DURATION", payload: 1 })
                        } else {
                            dispatch({ type: "RESET_SAFE_DURATION", payload: 0 })
                        }
                    }
                } catch (error) {
                    console.error("noiseCheckInterval is Error: ", error)
                }
            }, 1000)

            dispatch({ type: "SET_NOISE_LEVEL_UPDATE_INTERVAL", payload: noiseCheckInterval })

        } catch (error) {
            console.error("startNoiseCheck is Error: ", error)
        }
    }
    // console.log('Recording started or stopped and isNoiseChecking ->', state.isNoiseChecking);
    // console.log("safeDuration ->", state.safeDuration)
    // console.log("recording", state.recording)

    const stopNoiseCheck = async () => {
        try {
            // console.log("check if the recording instance insn't null ->", state.recording)
            if (state.recording !== null) {
                // console.log("this is from stopNoiseCheck function and in side of if(state.recording !== null) statement.")
                await state.recording.stopAndUnloadAsync();
                await Audio.setAudioModeAsync(
                    {
                        allowsRecordingIOS: false,
                    }
                )
                dispatch({ type: "SET_IS_NOISE_CHECKING", payload: false })
                dispatch({ type: "SET_RECORDING", payload: null })
                dispatch({ type: "SET_NOISE_LEVEL", payload: 0 })

                clearInterval(state.noiseLevelUpdateInterval)

                dispatch({ type: "SET_NOISE_LEVEL_UPDATE_INTERVAL", payload: null })
                // console.log("noiseCheckInterval is cleared? ->", state.noiseLevelUpdateInterval)
            }
        } catch (error) {
            console.error("stopNoiseCheck is Error: ", error)
        }
    }
    // console.log("isNoiseChecking ->", state.isNoiseChecking)

    useEffect(() => {
        handleCheckPermissions()
        if (!state.isMicrophonePermGranted) {
            handleRequestPermissions()
        }
        return async () => {
            await stopNoiseCheck()
        }
    }, [])

    return (
        <VStack flex={1}>
            <VStack flex={1}>
                <VStack>
                    <HStack justifyContent="space-between" alignItems="center">
                        <HStack alignItems="center" space="sm">
                            <SVG xml={noiseCheckIcon} width="40" height="40"></SVG>
                            <HeaderText text="Noise Check" underlineColor={Colors.primary.p5} />
                        </HStack>
                        {routeName === "Parental Control Noise Check"
                            ?
                            <Pressable onPress={() => {
                                stopNoiseCheck();
                                navigation.navigate("ParentalControl")

                            }}
                                style={{ zIndex: 10 }}
                            >
                                <SVG xml={closeIcon} width="40" height="40"></SVG>
                            </Pressable>
                            :
                            <Pressable onPress={() => {
                                stopNoiseCheck();
                                navigation.navigate("HearingTest")
                            }}
                            >
                                <SVG xml={closeIcon} width="40" height="40"></SVG>
                            </Pressable>
                        }
                    </HStack>
                    <Text style={styles.text}>{script}</Text>
                </VStack>
                {state.isNoiseChecking ? (
                    <>
                        {state.noiseLevel <= -12 && (
                            <VStack>
                                <VStack alignItems="center">
                                    <View style={styles.animationContainer}>
                                        <LottieView style={{ ...styles.animation, transform: [{ scaleY: calcWaveScaleY(state.noiseLevel) }] }} source={require('../animation/SoundWaves.json')} autoPlay loop />
                                    </View>
                                </VStack>
                                <VStack style={styles.levelContainer}>
                                    <Text style={styles.levelHeading}>Safe Level</Text>
                                    <Text style={styles.levelText}>No risk of hearing loss, no matter how long you listen.</Text>
                                </VStack>
                            </VStack>
                        )}
                        {state.noiseLevel <= -20 && state.noiseLevel > -25 && (
                            <VStack>
                                <VStack alignItems="center">
                                    <View style={styles.animationContainer}>
                                        <LottieView style={{ ...styles.animation, transform: [{ scaleY: calcWaveScaleY(state.noiseLevel)}] }} source={require('../animation/SoundWaves.json')} autoPlay loop />
                                    </View>
                                </VStack>
                                <VStack style={styles.levelContainer}>
                                    <Text style={styles.levelHeading}>Moderate Risk Level</Text>
                                    <Text style={styles.levelText}>Avoid being in this environment 8 hour or more.</Text>
                                </VStack>
                            </VStack>
                        )}
                        {state.noiseLevel > -20 && (
                            <VStack>
                                <VStack alignItems="center">
                                    <View style={styles.animationContainer}>
                                        <LottieView style={{ ...styles.animation,  transform: [{ scaleY: calcWaveScaleY(state.noiseLevel)}] }} source={require('../animation/SoundWaves.json')} autoPlay loop />
                                    </View>
                                </VStack>
                                <VStack position="relative">
                                    <VStack style={styles.levelContainer}>
                                        <Text style={styles.levelHeading}>High Risk Level</Text>
                                        <Text style={styles.levelText}>Avoid being in this environment 45 minutes or more.</Text>
                                    </VStack>
                                </VStack>
                            </VStack>
                        )}
                    </>
                ) : (
                    <>
                        <VStack alignItems="center">
                            <View style={styles.animationContainer}>
                                <LottieView ref={waveRef} style={{ ...styles.animation, transform: [{ scaleY: calcWaveScaleY(state.noiseLevel)}] }}  source={require('../animation/SoundWaves.json')} />
                            </View>
                        </VStack>
                    </>
                )
                }
            </VStack>

            <VStack>
                {routeName === "Parental Control Noise Check"
                    ? (state.isNoiseChecking === false
                        ? <ButtonFunc
                            handleOnPress={async () => {
                                await startNoiseCheck()
                            }}
                            disabled={!state.isMicrophonePermGranted || !state.isRecordingPermGranted}
                            text={"START NOISE CHECK"}
                        />
                        :
                        <>
                        </>
                    )
                    :
                    <ButtonFunc
                        handleOnPress={async () => {
                            state.isNoiseChecking
                                ? (await stopNoiseCheck(),
                                    navigation.navigate("Pretest Volume Adjustment"))
                                : await startNoiseCheck();
                        }}
                        isDisabled={
                            !state.isMicrophonePermGranted ||
                            !state.isRecordingPermGranted ||
                            state.safeDuration < 3
                        }
                        text={
                            state.isNoiseChecking && state.safeDuration > 2
                                ? "Proceed to Test"
                                : "CHECK"
                        }
                    />
                }
            </VStack>
        </VStack>
    )
}

export default NoiseChecker;

const styles = StyleSheet.create({
    text: {
        ...Typography.body.bl,
    },
    levelContainer: {
        position: "absolute",
        bottom: -40
    },
    levelHeading: {
        ...Typography.heading.h4,
        paddingBottom: Spacing.m,
        alignSelf: "center"
    },
    levelText: {
        ...Typography.body.bl,
        paddingHorizontal: 48,
        alignSelf: "center",
        textAlign: "center"
    },
    animationContainer: {
        height: windowHeight * 0.5,
        aspectRatio: 2
    },
    animation: {
        flex: 1,
        zIndex: -1
    }
})