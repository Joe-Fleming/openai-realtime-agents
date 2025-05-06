import { RefObject } from "react";

export async function createRealtimeConnection(
  EPHEMERAL_KEY: string,
  audioElement: RefObject<HTMLAudioElement | null>
): Promise<{ pc: RTCPeerConnection; dc: RTCDataChannel }> {
  const pc = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
  });

  // Handle incoming audio stream
  pc.ontrack = (event) => {
    if (audioElement.current && event.streams[0]) {
      audioElement.current.srcObject = event.streams[0];
    }
  };

  try {
    // Request both system audio and microphone
    const [systemStream, micStream] = await Promise.all([
      navigator.mediaDevices.getDisplayMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
        video: false
      }),
      navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: { ideal: true },
          noiseSuppression: { ideal: true },
          autoGainControl: { ideal: true },
          channelCount: { ideal: 1 },
          sampleRate: { ideal: 16000 },
          sampleSize: { ideal: 16 }
        },
        video: false
      })
    ]);

    // Create a combined stream with both audio sources
    const stream = new MediaStream([
      ...systemStream.getAudioTracks(),
      ...micStream.getAudioTracks()
    ]);

    // Add each audio track to the peer connection
    stream.getAudioTracks().forEach(track => {
      pc.addTrack(track, stream);
    });

    // Create data channel for events
    const dc = pc.createDataChannel("oai-events", {
      ordered: true
    });

    // Create and set local description
    const offer = await pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: false
    });
    await pc.setLocalDescription(offer);

    // Send offer to OpenAI's realtime API
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
    await pc.setRemoteDescription({
      type: "answer",
      sdp: answerSdp,
    });

    return { pc, dc };
  } catch (error) {
    console.error("Error in WebRTC setup:", error);
    throw error;
  }
}