"use client";

import React, { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { v4 as uuidv4 } from "uuid";

import Image from "next/image";

// UI components
import Transcript from "./components/Transcript";
import Events from "./components/Events";
import BottomToolbar from "./components/BottomToolbar";

// Types
import { AgentConfig, SessionStatus } from "@/app/types";

// Context providers & hooks
import { useTranscript } from "@/app/contexts/TranscriptContext";
import { useEvent } from "@/app/contexts/EventContext";
import { useHandleServerEvent } from "./hooks/useHandleServerEvent";

// Utilities
import { createRealtimeConnection } from "./lib/realtimeConnection";

// Agent configs
import { allAgentSets, defaultAgentSetKey } from "@/app/agentConfigs";

function App() {
  const searchParams = useSearchParams();

  const { transcriptItems, addTranscriptMessage, addTranscriptBreadcrumb } =
    useTranscript();
  const { logClientEvent, logServerEvent } = useEvent();

  const [selectedAgentName, setSelectedAgentName] = useState<string>("");
  const [selectedAgentConfigSet, setSelectedAgentConfigSet] =
    useState<AgentConfig[] | null>(null);

  const [micConnection, setMicConnection] = useState<{ pc: RTCPeerConnection | null, dc: RTCDataChannel | null } | null>(null);
  const [tabConnection, setTabConnection] = useState<{ pc: RTCPeerConnection | null, dc: RTCDataChannel | null } | null>(null);
  const micAudioRef = useRef<HTMLAudioElement | null>(null);
  const tabAudioRef = useRef<HTMLAudioElement | null>(null);
  const [micEphemeralKey, setMicEphemeralKey] = useState<string | null>(null);
  const [tabEphemeralKey, setTabEphemeralKey] = useState<string | null>(null);
  const [micStatus, setMicStatus] = useState<SessionStatus>("DISCONNECTED");
  const [tabStatus, setTabStatus] = useState<SessionStatus>("DISCONNECTED");
  const [activeSource, setActiveSource] = useState<"mic" | "tab">("mic");

  const [isEventsPaneExpanded, setIsEventsPaneExpanded] =
    useState<boolean>(true);
  const [userText, setUserText] = useState<string>("");
  const [isPTTActive, setIsPTTActive] = useState<boolean>(false);
  const [isPTTUserSpeaking, setIsPTTUserSpeaking] = useState<boolean>(false);
  const [isAudioPlaybackEnabled, setIsAudioPlaybackEnabled] =
    useState<boolean>(true);

  const sendClientEvent = (eventObj: any, eventNameSuffix = "", source: "mic" | "tab" = "mic") => {
    const connection = source === "mic" ? micConnection : tabConnection;
    if (connection?.dc && connection.dc.readyState === "open") {
      logClientEvent(eventObj, eventNameSuffix);
      connection.dc.send(JSON.stringify(eventObj));
    } else {
      logClientEvent(
        { attemptedEvent: eventObj.type },
        "error.data_channel_not_open"
      );
      console.error(
        "Failed to send message - no data channel available",
        eventObj
      );
    }
  };

  const handleServerEventRef = useHandleServerEvent({
    setSessionStatus: (status: SessionStatus, source: "mic" | "tab" = "mic") => {
      if (source === "mic") {
        setMicStatus(status);
      } else {
        setTabStatus(status);
      }
    },
    selectedAgentName,
    selectedAgentConfigSet,
    sendClientEvent,
    setSelectedAgentName,
  });

  useEffect(() => {
    let finalAgentConfig = searchParams.get("agentConfig");
    if (!finalAgentConfig || !allAgentSets[finalAgentConfig]) {
      finalAgentConfig = defaultAgentSetKey;
      const url = new URL(window.location.toString());
      url.searchParams.set("agentConfig", finalAgentConfig);
      window.location.replace(url.toString());
      return;
    }

    const agents = allAgentSets[finalAgentConfig];
    const agentKeyToUse = agents[0]?.name || "";

    setSelectedAgentName(agentKeyToUse);
    setSelectedAgentConfigSet(agents);
  }, [searchParams]);

  useEffect(() => {
    if (selectedAgentName && (micStatus === "DISCONNECTED" || tabStatus === "DISCONNECTED")) {
      if (micStatus === "DISCONNECTED") connectMic();
      if (tabStatus === "DISCONNECTED") connectTab();
    }
  }, [selectedAgentName]);

  useEffect(() => {
    if ((micStatus === "CONNECTED" || tabStatus === "CONNECTED") && selectedAgentConfigSet && selectedAgentName) {
      const currentAgent = selectedAgentConfigSet.find((a) => a.name === selectedAgentName);
      addTranscriptBreadcrumb(`Agent: ${selectedAgentName}`, currentAgent);
      if (micStatus === "CONNECTED") updateSession(true, "mic");
      if (tabStatus === "CONNECTED") updateSession(true, "tab");
    }
  }, [selectedAgentConfigSet, selectedAgentName, micStatus, tabStatus]);

  useEffect(() => {
    if (micStatus === "CONNECTED") {
      console.log(
        `updatingSession, isPTTACtive=${isPTTActive} sessionStatus=${micStatus}`
      );
      updateSession();
    }
  }, [isPTTActive]);

  const fetchEphemeralKey = async (source: "mic" | "tab"): Promise<string | null> => {
    logClientEvent({ url: "/session" }, "fetch_session_token_request");
    const tokenResponse = await fetch("/api/session");
    const data = await tokenResponse.json();
    logServerEvent(data, "fetch_session_token_response");

    if (!data.client_secret?.value) {
      logClientEvent(data, "error.no_ephemeral_key");
      console.error("No ephemeral key provided by the server");
      if (source === "mic") setMicStatus("DISCONNECTED");
      else setTabStatus("DISCONNECTED");
      return null;
    }

    return data.client_secret.value;
  };

  const connectMic = async () => {
    setMicStatus("CONNECTING");
    try {
      const key = await fetchEphemeralKey("mic");
      if (!key) throw new Error("No mic key");
      setMicEphemeralKey(key);
      if (!micAudioRef.current) {
        micAudioRef.current = document.createElement("audio");
      }
      micAudioRef.current.autoplay = isAudioPlaybackEnabled;
      const { pc, dc } = await createRealtimeConnection(key, micAudioRef, "mic");
      setMicConnection({ pc, dc });
      setMicStatus("CONNECTED");
      
      dc.addEventListener("close", () => {
        console.log("Mic data channel closed");
        setMicStatus("DISCONNECTED");
      });
      dc.addEventListener("error", (err: any) => {
        console.error("Mic data channel error:", err);
        logClientEvent({ error: err }, "mic.data_channel.error");
      });
      dc.addEventListener("message", (e: MessageEvent) => {
        handleServerEventRef.current({ ...JSON.parse(e.data), _audioSource: "mic" });
      });
      
      updateSession(true, "mic");
    } catch (err) {
      console.error("Error connecting mic:", err);
      setMicStatus("DISCONNECTED");
    }
  };

  const disconnectMic = () => {
    if (micConnection?.pc) {
      micConnection.pc.getSenders().forEach((sender) => sender.track?.stop());
      micConnection.pc.close();
    }
    setMicConnection(null);
    setMicStatus("DISCONNECTED");
  };

  const connectTab = async () => {
    setTabStatus("CONNECTING");
    try {
      const key = await fetchEphemeralKey("tab");
      if (!key) throw new Error("No tab key");
      setTabEphemeralKey(key);
      if (!tabAudioRef.current) {
        tabAudioRef.current = document.createElement("audio");
      }
      tabAudioRef.current.autoplay = isAudioPlaybackEnabled;
      const { pc, dc } = await createRealtimeConnection(key, tabAudioRef, "tab");
      setTabConnection({ pc, dc });
      setTabStatus("CONNECTED");
      
      dc.addEventListener("close", () => {
        console.log("Tab data channel closed");
        setTabStatus("DISCONNECTED");
      });
      dc.addEventListener("error", (err: any) => {
        console.error("Tab data channel error:", err);
        logClientEvent({ error: err }, "tab.data_channel.error");
      });
      dc.addEventListener("message", (e: MessageEvent) => {
        handleServerEventRef.current({ ...JSON.parse(e.data), _audioSource: "tab" });
      });
      
      updateSession(true, "tab");
    } catch (err) {
      console.error("Error connecting tab:", err);
      setTabStatus("DISCONNECTED");
    }
  };

  const disconnectTab = () => {
    if (tabConnection?.pc) {
      tabConnection.pc.getSenders().forEach((sender) => sender.track?.stop());
      tabConnection.pc.close();
    }
    setTabConnection(null);
    setTabStatus("DISCONNECTED");
  };

  const connectBoth = async () => {
    await connectMic();
    await connectTab();
  };

  const disconnectBoth = () => {
    disconnectMic();
    disconnectTab();
  };

  const sendSimulatedUserMessage = (text: string, source: "mic" | "tab" = "mic") => {
    const id = uuidv4().slice(0, 32);
    addTranscriptMessage(id, "user", text, true);

    sendClientEvent(
      {
        type: "conversation.item.create",
        item: {
          id,
          type: "message",
          role: "user",
          content: [{ type: "input_text", text }],
        },
      },
      "(simulated user text message)",
      source
    );
    sendClientEvent(
      { type: "response.create" },
      "(trigger response after simulated user text message)",
      source
    );
  };

  const updateSession = (shouldTriggerResponse: boolean = false, source: "mic" | "tab" = "mic") => {
    sendClientEvent(
      { type: "input_audio_buffer.clear" },
      "clear audio buffer on session update",
      source
    );

    const currentAgent = selectedAgentConfigSet?.find(
      (a) => a.name === selectedAgentName
    );

    // Different turn detection settings for mic vs tab
    const turnDetection = source === "tab" 
      ? {
          type: "server_vad",
          threshold: 0.3, // Lower threshold for tab audio
          prefix_padding_ms: 500, // Longer prefix padding
          silence_duration_ms: 500, // Longer silence duration
          create_response: false, // Don't create response automatically
        }
      : isPTTActive
        ? null
        : {
            type: "server_vad",
            threshold: 0.5,
            prefix_padding_ms: 300,
            silence_duration_ms: 200,
            create_response: true,
          };

    const instructions = currentAgent?.instructions || "";
    const tools = currentAgent?.tools || [];

    const sessionUpdateEvent = {
      type: "session.update",
      session: {
        modalities: ["text", "audio"],
        instructions,
        voice: "coral",
        input_audio_format: "pcm16",
        output_audio_format: "pcm16",
        input_audio_transcription: { model: "whisper-1" },
        turn_detection: turnDetection,
        tools,
      },
    };

    sendClientEvent(sessionUpdateEvent, "", source);

    if (shouldTriggerResponse) {
      sendSimulatedUserMessage("hi", source);
    }
  };

  const cancelAssistantSpeech = async (source: "mic" | "tab" = "mic") => {
    const mostRecentAssistantMessage = [...transcriptItems]
      .reverse()
      .find((item) => item.role === "assistant");

    if (!mostRecentAssistantMessage) {
      console.warn("can't cancel, no recent assistant message found");
      return;
    }
    if (mostRecentAssistantMessage.status === "DONE") {
      console.log("No truncation needed, message is DONE");
      return;
    }

    sendClientEvent({
      type: "conversation.item.truncate",
      item_id: mostRecentAssistantMessage?.itemId,
      content_index: 0,
      audio_end_ms: Date.now() - mostRecentAssistantMessage.createdAtMs,
    }, "", source);
    sendClientEvent(
      { type: "response.cancel" },
      "(cancel due to user interruption)",
      source
    );
  };

  const handleSendTextMessage = (source: "mic" | "tab" = "mic") => {
    if (!userText.trim()) return;
    cancelAssistantSpeech(source);

    sendClientEvent(
      {
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "user",
          content: [{ type: "input_text", text: userText.trim() }],
        },
      },
      "(send user text message)",
      source
    );
    setUserText("");

    sendClientEvent({ type: "response.create" }, "trigger response", source);
  };

  const handleTalkButtonDown = (source: "mic" | "tab" = "mic") => {
    const connection = source === "mic" ? micConnection : tabConnection;
    const status = source === "mic" ? micStatus : tabStatus;
    
    if (status !== "CONNECTED" || connection?.dc?.readyState !== "open")
      return;
    cancelAssistantSpeech(source);

    setIsPTTUserSpeaking(true);
    sendClientEvent({ type: "input_audio_buffer.clear" }, "clear PTT buffer", source);
  };

  const handleTalkButtonUp = (source: "mic" | "tab" = "mic") => {
    const status = source === "mic" ? micStatus : tabStatus;
    const connection = source === "mic" ? micConnection : tabConnection;
    
    if (
      status !== "CONNECTED" ||
      connection?.dc?.readyState !== "open" ||
      !isPTTUserSpeaking
    )
      return;

    setIsPTTUserSpeaking(false);
    sendClientEvent({ type: "input_audio_buffer.commit" }, "commit PTT", source);
    sendClientEvent({ type: "response.create" }, "trigger response PTT", source);
  };

  const handleAgentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newAgentConfig = e.target.value;
    const url = new URL(window.location.toString());
    url.searchParams.set("agentConfig", newAgentConfig);
    window.location.replace(url.toString());
  };

  const handleSelectedAgentChange = (
    e: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const newAgentName = e.target.value;
    setSelectedAgentName(newAgentName);
  };

  useEffect(() => {
    const storedPushToTalkUI = localStorage.getItem("pushToTalkUI");
    if (storedPushToTalkUI) {
      setIsPTTActive(storedPushToTalkUI === "true");
    }
    const storedLogsExpanded = localStorage.getItem("logsExpanded");
    if (storedLogsExpanded) {
      setIsEventsPaneExpanded(storedLogsExpanded === "true");
    }
    const storedAudioPlaybackEnabled = localStorage.getItem(
      "audioPlaybackEnabled"
    );
    if (storedAudioPlaybackEnabled) {
      setIsAudioPlaybackEnabled(storedAudioPlaybackEnabled === "true");
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("pushToTalkUI", isPTTActive.toString());
  }, [isPTTActive]);

  useEffect(() => {
    localStorage.setItem("logsExpanded", isEventsPaneExpanded.toString());
  }, [isEventsPaneExpanded]);

  useEffect(() => {
    localStorage.setItem(
      "audioPlaybackEnabled",
      isAudioPlaybackEnabled.toString()
    );
  }, [isAudioPlaybackEnabled]);

  useEffect(() => {
    if (micAudioRef.current) {
      if (isAudioPlaybackEnabled) {
        micAudioRef.current.play().catch((err) => {
          console.warn("Autoplay may be blocked by browser:", err);
        });
      } else {
        micAudioRef.current.pause();
      }
    }
  }, [isAudioPlaybackEnabled]);

  useEffect(() => {
    if (tabAudioRef.current) {
      if (isAudioPlaybackEnabled) {
        tabAudioRef.current.play().catch((err) => {
          console.warn("Autoplay may be blocked by browser:", err);
        });
      } else {
        tabAudioRef.current.pause();
      }
    }
  }, [isAudioPlaybackEnabled]);

  const agentSetKey = searchParams.get("agentConfig") || "default";

  return (
    <div className="text-base flex flex-col h-screen bg-gray-100 text-gray-800 relative">
      <div className="p-5 text-lg font-semibold flex justify-between items-center">
        <div className="flex items-center">
          <div onClick={() => window.location.reload()} style={{ cursor: 'pointer' }}>
            <Image
              src="/openai-logomark.svg"
              alt="OpenAI Logo"
              width={20}
              height={20}
              className="mr-2"
            />
          </div>
          <div>
            Realtime API <span className="text-gray-500">Agents</span>
          </div>
        </div>
        <div className="flex items-center">
          <label className="flex items-center text-base gap-1 mr-2 font-medium">
            Scenario
          </label>
          <div className="relative inline-block">
            <select
              value={agentSetKey}
              onChange={handleAgentChange}
              className="appearance-none border border-gray-300 rounded-lg text-base px-2 py-1 pr-8 cursor-pointer font-normal focus:outline-none"
            >
              {Object.keys(allAgentSets).map((agentKey) => (
                <option key={agentKey} value={agentKey}>
                  {agentKey}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 text-gray-600">
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M5.23 7.21a.75.75 0 011.06.02L10 10.44l3.71-3.21a.75.75 0 111.04 1.08l-4.25 3.65a.75.75 0 01-1.04 0L5.21 8.27a.75.75 0 01.02-1.06z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          </div>

          {agentSetKey && (
            <div className="flex items-center ml-6">
              <label className="flex items-center text-base gap-1 mr-2 font-medium">
                Agent
              </label>
              <div className="relative inline-block">
                <select
                  value={selectedAgentName}
                  onChange={handleSelectedAgentChange}
                  className="appearance-none border border-gray-300 rounded-lg text-base px-2 py-1 pr-8 cursor-pointer font-normal focus:outline-none"
                >
                  {Array.isArray(selectedAgentConfigSet) && selectedAgentConfigSet.map(agent => (
                    <option key={agent.name} value={agent.name}>
                      {agent.name}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 text-gray-600">
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M5.23 7.21a.75.75 0 011.06.02L10 10.44l3.71-3.21a.75.75 0 111.04 1.08l-4.25 3.65a.75.75 0 01-1.04 0L5.21 8.27a.75.75 0 01.02-1.06z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Dual connection controls */}
      <div className="flex items-center justify-center gap-4 p-2 bg-white border-b border-gray-200">
        <button
          className={`px-3 py-1 rounded ${micStatus === "CONNECTED" ? "bg-green-600 text-white" : "bg-gray-200 text-black"}`}
          onClick={micStatus === "CONNECTED" ? disconnectMic : connectMic}
        >
          {micStatus === "CONNECTED" ? "Disconnect Mic" : "Connect Mic"}
        </button>
        <button
          className={`px-3 py-1 rounded ${tabStatus === "CONNECTED" ? "bg-green-600 text-white" : "bg-gray-200 text-black"}`}
          onClick={tabStatus === "CONNECTED" ? disconnectTab : connectTab}
        >
          {tabStatus === "CONNECTED" ? "Disconnect Tab" : "Connect Tab"}
        </button>
        <button
          className="px-3 py-1 rounded bg-black text-white"
          onClick={connectBoth}
          disabled={micStatus === "CONNECTED" && tabStatus === "CONNECTED"}
        >
          Connect Both
        </button>
        <button
          className="px-3 py-1 rounded bg-red-600 text-white"
          onClick={disconnectBoth}
          disabled={micStatus !== "CONNECTED" && tabStatus !== "CONNECTED"}
        >
          Disconnect Both
        </button>
      </div>

      <div className="flex flex-1 gap-2 px-2 overflow-hidden relative">
        <Transcript
          userText={userText}
          setUserText={setUserText}
          onSendMessage={() => handleSendTextMessage(activeSource)}
          canSend={
            (activeSource === "mic" ? micStatus : tabStatus) === "CONNECTED" &&
            (activeSource === "mic" ? micConnection : tabConnection)?.dc?.readyState === "open"
          }
        />

        <Events isExpanded={isEventsPaneExpanded} />
      </div>

      <BottomToolbar
        sessionStatus={activeSource === "mic" ? micStatus : tabStatus}
        isPTTActive={isPTTActive}
        setIsPTTActive={setIsPTTActive}
        isPTTUserSpeaking={isPTTUserSpeaking}
        handleTalkButtonDown={() => handleTalkButtonDown(activeSource)}
        handleTalkButtonUp={() => handleTalkButtonUp(activeSource)}
        isEventsPaneExpanded={isEventsPaneExpanded}
        setIsEventsPaneExpanded={setIsEventsPaneExpanded}
        isAudioPlaybackEnabled={isAudioPlaybackEnabled}
        setIsAudioPlaybackEnabled={setIsAudioPlaybackEnabled}
        activeSource={activeSource}
        setActiveSource={setActiveSource}
      />
    </div>
  );
}

export default App;
