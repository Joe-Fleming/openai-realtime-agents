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

  try {
    // Microphone setup
    const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    
    // System audio setup
    const systemStream = await navigator.mediaDevices.getDisplayMedia({
      audio: true,
      video: false
    });

    // Setup audio context and analyzers
    const audioContext = new AudioContext();
    const micSource = audioContext.createMediaStreamSource(micStream);
    const systemSource = audioContext.createMediaStreamSource(systemStream);
    
    const micAnalyser = audioContext.createAnalyser();
    const systemAnalyser = audioContext.createAnalyser();
    
    micSource.connect(micAnalyser);
    systemSource.connect(systemAnalyser);

    let activeSource = 'sales_rep';
    let currentInterval: NodeJS.Timeout | null = null;
    
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
          const sender = pc.getSenders().find(s => s.track?.kind === 'audio');
          if (sender) {
            sender.replaceTrack(micStream.getTracks()[0]);
          }
        }
      } else if (systemLevel > 30 && micLevel < 30) {
        if (activeSource !== 'prospect') {
          activeSource = 'prospect';
          const sender = pc.getSenders().find(s => s.track?.kind === 'audio');
          if (sender) {
            sender.replaceTrack(systemStream.getTracks()[0]);
          }
        }
      }
    };

    // Start monitoring audio levels
    currentInterval = setInterval(detectAudioActivity, 100);

    // Add initial track (microphone)
    pc.addTrack(micStream.getTracks()[0]);

    // Clean up function
    const cleanup = () => {
      if (currentInterval) {
        clearInterval(currentInterval);
      }
      micStream.getTracks().forEach(track => track.stop());
      systemStream.getTracks().forEach(track => track.stop());
      audioContext.close();
    };

    // Add cleanup to peer connection close event
    pc.addEventListener('connectionstatechange', () => {
      if (pc.connectionState === 'closed') {
        cleanup();
      }
    });

    // Return cleanup function
    return cleanup;
  } catch (error) {
    console.error('Error setting up audio streams:', error);
    throw error;
  }

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