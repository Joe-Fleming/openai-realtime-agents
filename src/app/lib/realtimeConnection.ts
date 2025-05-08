import { RefObject } from "react";

export async function createRealtimeConnection(
  EPHEMERAL_KEY: string,
  audioElement: RefObject<HTMLAudioElement | null>,
  audioSource: "mic" | "tab"
): Promise<{ pc: RTCPeerConnection; dc: RTCDataChannel }> {
  const pc = new RTCPeerConnection();

  pc.ontrack = (e) => {
    if (audioElement.current) {
        audioElement.current.srcObject = e.streams[0];
    }
  };

  let stream: MediaStream | null = null;

  if (audioSource === "tab") {
    alert("In the next dialog, select the tab you want to share audio from. Make sure the tab is playing audio!");
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        audio: true,
        video: true
      });
    } catch (err) {
      alert('No stream was captured. Please try again.');
      throw new Error('No stream was captured.');
    }
    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack || audioTrack.label.toLowerCase().includes('microphone')) {
      alert('You selected a source that does not provide tab audio. Please select a tab that is playing audio.');
      throw new Error('No tab audio found.');
    }
    pc.addTrack(audioTrack);
  } else {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      alert('Microphone access denied or not available.');
      throw new Error('No mic audio found.');
    }
    const audioTrack = stream.getAudioTracks()[0];
    if (audioTrack) {
      pc.addTrack(audioTrack);
    } else {
      alert('No microphone audio track found.');
      throw new Error('No mic audio found.');
    }
  }

  const dc = pc.createDataChannel("oai-events");

  // Create a promise that resolves when the data channel is open
  const dataChannelOpen = new Promise<void>((resolve) => {
    dc.onopen = () => {
      console.log(`Data channel opened for ${audioSource}`);
      resolve();
    };
  });

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  const baseUrl = "https://api.openai.com/v1/realtime";
  const model = "gpt-4o-mini-realtime-preview-2024-12-17";

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

  // Wait for the data channel to be open before returning
  await dataChannelOpen;

  return { pc, dc };
} 