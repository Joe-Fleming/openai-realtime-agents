import { RefObject } from "react";

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

  // Setup audio context and analyzers
  const audioContext = new AudioContext();
  
  // Microphone setup
  const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const micSource = audioContext.createMediaStreamSource(micStream);
  const micAnalyser = audioContext.createAnalyser();
  micSource.connect(micAnalyser);

  // System audio setup
  const systemStream = await navigator.mediaDevices.getDisplayMedia({
    audio: true,
    video: false
  });
  const systemSource = audioContext.createMediaStreamSource(systemStream);
  const systemAnalyser = audioContext.createAnalyser();
  systemSource.connect(systemAnalyser);

  let activeSource = 'sales_rep';
  
  // Function to detect audio activity
  const detectAudioActivity = () => {
    const micData = new Uint8Array(micAnalyser.frequencyBinCount);
    const systemData = new Uint8Array(systemAnalyser.frequencyBinCount);
    
    micAnalyser.getByteFrequencyData(micData);
    systemAnalyser.getByteFrequencyData(systemData);
    
    const micLevel = micData.reduce((a, b) => a + b) / micData.length;
    const systemLevel = systemData.reduce((a, b) => a + b) / systemData.length;
    
    // Switch source based on audio levels
    if (micLevel > 30 && systemLevel < 30) {
      if (activeSource !== 'sales_rep') {
        activeSource = 'sales_rep';
        pc.getSenders()[0].replaceTrack(micStream.getTracks()[0]);
      }
    } else if (systemLevel > 30 && micLevel < 30) {
      if (activeSource !== 'prospect') {
        activeSource = 'prospect';
        pc.getSenders()[0].replaceTrack(systemStream.getTracks()[0]);
      }
    }
  };

  // Start monitoring audio levels
  setInterval(detectAudioActivity, 100);

  // Create a new MediaStream for both sources
  const combinedStream = new MediaStream();
  combinedStream.addTrack(micStream.getTracks()[0]);
  combinedStream.addTrack(systemStream.getTracks()[0]);
  
  // Add the combined stream track
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