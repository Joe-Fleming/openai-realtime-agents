import { RefObject } from "react";

async function getSystemAudio(): Promise<MediaStream | null> {
  // Method 1: Display Media Capture
  try {
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
    return displayStream;
  } catch (error) {
    console.warn('Display media capture failed:', error);
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
  } catch (error) {
    console.warn('Screen capture failed:', error);
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

  // Get microphone audio
  const micStream = await navigator.mediaDevices.getUserMedia({ 
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      sampleRate: 44100
    }
  });
  
  // Add microphone track to combined stream
  combinedStream.addTrack(micStream.getTracks()[0]);

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