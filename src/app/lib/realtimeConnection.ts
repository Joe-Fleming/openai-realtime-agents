import { RefObject } from "react";

async function getSystemAudio(): Promise<MediaStream | null> {
  // Method 1: Display Media Capture
  try {
    // Check if getDisplayMedia is supported
    if (!navigator.mediaDevices?.getDisplayMedia) {
      throw new Error('Screen capture not supported in this browser');
    }

    const displayStream = await navigator.mediaDevices.getDisplayMedia({
      video: false,
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        sampleRate: 44100,
        autoGainControl: true,
        channelCount: 2
      }
    });

    // Verify we got audio tracks
    if (!displayStream.getAudioTracks().length) {
      throw new Error('No audio track available in screen capture');
    }

    return displayStream;
  } catch (error) {
    console.warn('Display media capture failed:', error instanceof Error ? error.message : 'Unknown error');
    // Continue to next method instead of returning null
  }

  // Method 2: Screen Capture with Audio
  try {
    const screenStream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        displaySurface: "monitor",
        logicalSurface: true
      },
      audio: {
        suppressLocalAudioPlayback: false
      }
    });
    return screenStream;
  } catch (err) {
    console.warn('Screen capture failed:', err instanceof Error ? err.message : err);
    throw new Error('Failed to capture screen');
  }

  // Method 3: AudioContext Method
  try {
    const audioContext = new AudioContext();
    const destination = audioContext.createMediaStreamDestination();
    const source = audioContext.createMediaElementSource(document.querySelector('audio')!);
    source.connect(destination);
    return destination.stream;
  } catch (error) {
    console.warn('AudioContext method failed:', error);
  }

  return null;
}

export async function createRealtimeConnection(
  EPHEMERAL_KEY: string,
  audioElement: RefObject<HTMLAudioElement | null>
): Promise<{ pc: RTCPeerConnection; dc: RTCDataChannel }> {
  const pc = new RTCPeerConnection();

  pc.ontrack = (e) => {
    if (audioElement.current) {
        audioElement.current.srcObject = e.streams[0];
    }
  };

  // Create a new MediaStream to combine audio sources
  const combinedStream = new MediaStream();

  // Get microphone audio with recommended settings
  try {
    const micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
        sampleRate: 24000,
        sampleSize: 16
      },
      video: false
    });

    const audioContext = new (window.AudioContext || window.webkitAudioContext)({
      sampleRate: 24000,
      latencyHint: 'interactive'
    });

    const source = audioContext.createMediaStreamSource(micStream);
    const destination = audioContext.createMediaStreamDestination();

    // Configure processor with recommended settings
    const bufferSize = 2048; // Increased for better stability
    const numberOfInputChannels = 1;
    const numberOfOutputChannels = 1;

    const processor = audioContext.createScriptProcessor(bufferSize, numberOfInputChannels, numberOfOutputChannels);

    source.connect(processor);
    processor.connect(audioContext.destination);

    // Process audio data
    processor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);
      // Convert float32 to int16
      const pcmData = new Int16Array(inputData.length);
      for (let i = 0; i < inputData.length; i++) {
        pcmData[i] = inputData[i] * 0x7fff;
      }

      // Add processed track to combined stream
      const track = micStream.getAudioTracks()[0];
      if (track) {
        combinedStream.addTrack(track);
      }
    };

  } catch (error) {
    console.error("Error getting microphone audio:", error);
    throw new Error('Failed to setup audio recording');
  }


  // Get system audio
  const systemStream = await getSystemAudio();

  // Add system audio track to combined stream if available
  if (systemStream && systemStream.getAudioTracks().length > 0) {
    combinedStream.addTrack(systemStream.getAudioTracks()[0]);
  }

  // Add the combined stream to the peer connection
  combinedStream.getTracks().forEach(track => {
    pc.addTrack(track, combinedStream);
  });

  const dc = pc.createDataChannel("oai-events");

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  const baseUrl = "https://api.openai.com/v1/realtime";
  const model = "gpt-4o-realtime-preview-2024-12-17";

  const sdpResponse = await fetch(`${baseUrl}?model=${model}`, {
    method: "POST",
    body: offer.sdp,
    headers: {
      Authorization: `Bearer ${EPHEMERAL_KEY}`,
      "Content-Type": "application/sdp",
    },
  });

  const answerSdp = await sdpResponse.text();
  const answer: RTCSessionDescriptionInit = {
    type: "answer",
    sdp: answerSdp,
  };

  await pc.setRemoteDescription(answer);

  return { pc, dc };
}