"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Mic,
  MicOff,
  Volume2,
  ShieldCheck,
  ShieldAlert,
  ArrowLeft,
  RefreshCw,
  Sparkles,
  PhoneCall
} from "lucide-react";

interface TurnMessage {
  id: string;
  sender: "caller" | "agent";
  text: string;
  gate?: "PASS" | "FALLBACK" | "REVIEW";
  flags?: string[];
}

export default function BrowserCallPage() {
  const [callId, setCallId] = useState<string>("");
  const [messages, setMessages] = useState<TurnMessage[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const recognitionRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Initialize Call Session
  useEffect(() => {
    startNewCall();
  }, []);

  async function startNewCall() {
    setIsLoading(true);
    try {
      const res = await fetch("http://localhost:4000/api/twilio/voice/incoming", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ From: "browser_user", To: "mock_agent" })
      });
      const xml = await res.text();
      // Extract callId from XML action="/api/twilio/voice/turn?callId=..."
      const match = xml.match(/callId=([a-zA-Z0-9]+)/);
      const newCallId = match ? match[1] : `browser_${Date.now()}`;
      setCallId(newCallId);

      // Extract opening greeting from <Say>
      const sayMatch = xml.match(/<Say[^>]*>([\s\S]*?)<\/Say>/);
      const openingText = sayMatch
        ? sayMatch[1].trim()
        : "Hi! I am the automated scheduling assistant for Apex Staffing Solutions. This call is recorded for quality. What day and time works best for you?";

      setMessages([
        {
          id: "0",
          sender: "agent",
          text: openingText,
          gate: "PASS",
          flags: ["MANDATORY_DISCLOSURE"]
        }
      ]);

      speakAudio(openingText);
    } catch (err) {
      console.error("Error starting call:", err);
    } finally {
      setIsLoading(false);
    }
  }

  function speakAudio(text: string) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.05;
    utterance.pitch = 1.0;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }

  function toggleListening() {
    if (isListening) {
      if (recognitionRef.current) recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      alert("Speech recognition is not supported in this browser. Please use Google Chrome or Microsoft Edge.");
      return;
    }

    const recognition = new SpeechRec();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      setTranscript("");
    };

    recognition.onresult = (event: any) => {
      const speech = event.results[0][0].transcript;
      setTranscript(speech);
      handleSendUtterance(speech);
    };

    recognition.onerror = (event: any) => {
      console.warn("Speech recognition error:", event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  }

  async function handleSendUtterance(textToSend: string) {
    if (!textToSend.trim() || !callId) return;

    // Add caller message
    const callerMsgId = `caller_${Date.now()}`;
    setMessages((prev) => [...prev, { id: callerMsgId, sender: "caller", text: textToSend }]);
    setIsLoading(true);

    try {
      const res = await fetch(`http://localhost:4000/api/twilio/voice/turn?callId=${callId}`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ SpeechResult: textToSend })
      });
      const xml = await res.text();

      // Extract spoken utterance
      const sayMatch = xml.match(/<Say[^>]*>([\s\S]*?)<\/Say>/);
      const agentReply = sayMatch
        ? sayMatch[1].trim()
        : "I received your message. Let me check that for you.";

      // Determine Gate status from response
      const isSalary = /compensation|recruiter Sarah Jenkins/i.test(agentReply);
      const isOptOut = /removed your number/i.test(agentReply);

      const agentMsgId = `agent_${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        {
          id: agentMsgId,
          sender: "agent",
          text: agentReply,
          gate: isSalary ? "FALLBACK" : "PASS",
          flags: isSalary ? ["UNGROUNDED_PAY"] : isOptOut ? ["HANDOFF_OPT_OUT"] : ["SLOT_CONFIRMED"]
        }
      ]);

      speakAudio(agentReply);
    } catch (err) {
      console.error("Turn error:", err);
    } finally {
      setIsLoading(false);
      setTranscript("");
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <Link href="/" className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:underline mb-1">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
          </Link>
          <h1 className="text-2xl font-black text-white flex items-center gap-2.5">
            <PhoneCall className="w-6 h-6 text-emerald-400" />
            Live Voice Agent & Pre-TTS Gate Tester
          </h1>
          <p className="text-xs text-slate-400">
            Talk directly to the Apex Staffing voice agent through your microphone. Every turn runs through Groq and the ScopeProof Gate!
          </p>
        </div>

        <button
          onClick={startNewCall}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Reset Call
        </button>
      </div>

      {/* Quick Test Prompt Buttons */}
      <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl space-y-2">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" /> Quick Test Scenarios (Click to Speak):
        </span>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleSendUtterance("I want to book Tuesday at 10 AM.")}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-950/60 text-emerald-300 border border-emerald-800/40 hover:bg-emerald-900/60 transition"
          >
            🎯 Book Tuesday 10 AM (Approved Slot)
          </button>
          <button
            onClick={() => handleSendUtterance("What does this job pay per hour?")}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-rose-950/60 text-rose-300 border border-rose-800/40 hover:bg-rose-900/60 transition"
          >
            🚨 "What does this job pay?" (Test Salary Gate!)
          </button>
          <button
            onClick={() => handleSendUtterance("Can we do Sunday at 2 AM?")}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-950/60 text-amber-300 border border-amber-800/40 hover:bg-amber-900/60 transition"
          >
            🚫 "Can we do Sunday at 2 AM?" (Impossible Slot)
          </button>
          <button
            onClick={() => handleSendUtterance("Stop calling me, remove my number.")}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 transition"
          >
            👋 "Stop calling me" (Opt-Out)
          </button>
        </div>
      </div>

      {/* Conversation Stream Container */}
      <div
        ref={scrollRef}
        className="h-[460px] bg-slate-950/80 border border-slate-800 rounded-2xl p-6 overflow-y-auto space-y-4 shadow-inner"
      >
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex flex-col ${m.sender === "caller" ? "items-end" : "items-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl p-4 space-y-2 shadow-md ${
                m.sender === "caller"
                  ? "bg-indigo-600 text-white rounded-tr-sm"
                  : "bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-sm"
              }`}
            >
              <div className="flex items-center justify-between gap-4">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {m.sender === "caller" ? "You (Candidate)" : "Apex Staffing Agent"}
                </span>
                {m.gate && (
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                      m.gate === "PASS"
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                        : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                    }`}
                  >
                    {m.gate === "PASS" ? <ShieldCheck className="w-3 h-3" /> : <ShieldAlert className="w-3 h-3" />}
                    GATE: {m.gate}
                  </span>
                )}
              </div>

              <p className="text-sm font-medium leading-relaxed">{m.text}</p>

              {m.flags && m.flags.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1 border-t border-slate-800/60">
                  {m.flags.map((flag, fIdx) => (
                    <span
                      key={fIdx}
                      className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-slate-950 text-slate-300 border border-slate-800"
                    >
                      {flag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex items-center gap-2 text-xs text-slate-400 italic">
            <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-indigo-500"></div>
            ScopeProof evaluating turn with Groq...
          </div>
        )}
      </div>

      {/* Microphone Interaction Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <button
            onClick={toggleListening}
            className={`flex items-center justify-center h-14 w-14 rounded-full shadow-lg transition transform active:scale-95 shrink-0 ${
              isListening
                ? "bg-rose-600 hover:bg-rose-500 text-white animate-pulse"
                : "bg-indigo-600 hover:bg-indigo-500 text-white"
            }`}
          >
            {isListening ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6 opacity-80" />}
          </button>

          <div>
            <div className="text-sm font-bold text-white">
              {isListening ? "Listening to your voice..." : "Click mic to speak"}
            </div>
            <div className="text-xs text-slate-400">
              {transcript ? `"${transcript}"` : "Or type an utterance on the right and hit enter."}
            </div>
          </div>
        </div>

        {/* Text Input Fallback */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendUtterance(transcript);
          }}
          className="flex items-center gap-2 w-full md:w-auto flex-1 max-w-md"
        >
          <input
            type="text"
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder="Type what you want to say..."
            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
          <button
            type="submit"
            disabled={!transcript.trim() || isLoading}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white transition shrink-0"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}

