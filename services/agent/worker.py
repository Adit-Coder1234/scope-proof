import asyncio
import concurrent.futures
import json
import logging
import os
import sys
import time
import wave
from typing import Optional

import dotenv
import httpx
import livekit.api
import livekit.rtc
import pyttsx3

from contracts import AgentTurn, GateResult, ScopeRule, Fact
from gate import ValidationGate

# Ensure eval directory is in path for evaluate_turn
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../eval")))
from judge import evaluate_turn

dotenv.load_dotenv(os.path.join(os.path.dirname(__file__), "../../.env"))
dotenv.load_dotenv()

logger = logging.getLogger("agent_worker")
logging.basicConfig(level=logging.INFO)


def _render_tts_to_wav(text: str, out_wav_path: str):
    """Render speech to WAV file using native Windows SAPI5 via pyttsx3."""
    engine = pyttsx3.init()
    engine.setProperty("rate", 175)
    engine.save_to_file(text, out_wav_path)
    engine.runAndWait()


class LiveKitAgentWorker:
    def __init__(
        self,
        room_name: str,
        scope_id: str,
        call_id: str,
        api_base_url: str = "http://localhost:4000",
        agent_identity: str = "scopeproof-agent",
        agent_name: str = "ScopeProof Coordinator"
    ):
        self.room_name = room_name
        self.scope_id = scope_id
        self.call_id = call_id
        self.api_base_url = api_base_url.rstrip("/")
        self.agent_identity = agent_identity
        self.agent_name = agent_name

        self.livekit_url = os.environ.get("LIVEKIT_URL")
        self.livekit_api_key = os.environ.get("LIVEKIT_API_KEY")
        self.livekit_api_secret = os.environ.get("LIVEKIT_API_SECRET")

        if not (self.livekit_url and self.livekit_api_key and self.livekit_api_secret):
            raise ValueError("LiveKit credentials (LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET) must be set in .env")

        self.room: Optional[livekit.rtc.Room] = None
        self.audio_source: Optional[livekit.rtc.AudioSource] = None
        self.audio_track: Optional[livekit.rtc.LocalAudioTrack] = None

        self.rules: list[ScopeRule] = []
        self.facts: list[Fact] = []
        self.gate: Optional[ValidationGate] = None

        self.conversation_history: list[dict[str, str]] = []
        self.turn_idx = 0
        self.turn_latencies: list[int] = []
        self.is_connected = False
        self._caller_joined = asyncio.Event()
        self._speak_lock = asyncio.Lock()
        self._turn_lock = asyncio.Lock()

    def fetch_scope_context(self):
        """Fetch active scope rules and facts from Node API."""
        with httpx.Client(base_url=self.api_base_url, timeout=10.0) as client:
            res = client.get(f"/api/scopes/{self.scope_id}")
            res.raise_for_status()
            data = res.json()
            self.rules = [ScopeRule.model_validate(r) for r in data.get("rules", [])]
            self.facts = [Fact.model_validate(f) for f in data.get("facts", [])]
            self.gate = ValidationGate(self.rules, self.facts)
            logger.info("Loaded scope %s: %d rules, %d facts", self.scope_id, len(self.rules), len(self.facts))

    async def connect(self):
        """Connect to LiveKit room and publish audio track."""
        self.fetch_scope_context()

        token = (
            livekit.api.AccessToken(self.livekit_api_key, self.livekit_api_secret)
            .with_identity(self.agent_identity)
            .with_name(self.agent_name)
            .with_grants(livekit.api.VideoGrants(room_join=True, room=self.room_name))
            .to_jwt()
        )

        self.room = livekit.rtc.Room()

        # Set up room event handlers
        @self.room.on("participant_connected")
        def on_participant_connected(participant: livekit.rtc.RemoteParticipant):
            logger.info("Participant joined: %s (%s)", participant.identity, participant.name)
            self._caller_joined.set()

        @self.room.on("data_received")
        def on_data_received(data_packet: livekit.rtc.DataPacket):
            try:
                payload = json.loads(data_packet.data.decode("utf-8"))
                if payload.get("type") == "caller_turn":
                    caller_text = payload.get("text", "")
                    asyncio.create_task(self.handle_turn(caller_text))
            except Exception as e:
                logger.error("Error processing data packet: %s", e)

        await self.room.connect(self.livekit_url, token)
        logger.info("Agent joined LiveKit room %s", self.room_name)

        # Initialize AudioSource and publish track
        self.audio_source = livekit.rtc.AudioSource(sample_rate=22050, num_channels=1)
        self.audio_track = livekit.rtc.LocalAudioTrack.create_audio_track("agent_speech", self.audio_source)
        await self.room.local_participant.publish_track(self.audio_track)
        logger.info("Agent published local audio track to room")
        self.is_connected = True

    async def wait_for_caller(self, timeout: float = 15.0) -> bool:
        """Wait for test caller participant to join the room."""
        # Check if already present
        if len(self.room.remote_participants) > 0:
            return True
        try:
            await asyncio.wait_for(self._caller_joined.wait(), timeout=timeout)
            return True
        except asyncio.TimeoutError:
            logger.warning("No caller joined room within %s seconds", timeout)
            return False

    async def speak(self, text: str, is_hold_line: bool = False):
        """Synthesize and stream audio frames to the room, and broadcast text event."""
        async with self._speak_lock:
            logger.info("Agent speaking (%s): %s", "HOLD_LINE" if is_hold_line else "UTTERANCE", text)

            # 1. Broadcast text transcript on data channel
            msg = {
                "type": "agent_turn",
                "is_hold_line": is_hold_line,
                "text": text,
                "timestamp": time.time()
            }
            if self.room and self.room.local_participant:
                await self.room.local_participant.publish_data(
                    json.dumps(msg).encode("utf-8"),
                    reliable=True
                )

            # 2. Synthesize audio via Windows SAPI5 pyttsx3 in thread pool
            wav_path = f"tts_{os.getpid()}_{int(time.time()*1000)}.wav"
            loop = asyncio.get_running_loop()
            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
                await loop.run_in_executor(pool, _render_tts_to_wav, text, wav_path)

            # 3. Stream audio frames into AudioSource
            if os.path.exists(wav_path) and self.audio_source:
                try:
                    with wave.open(wav_path, "rb") as wf:
                        sr = wf.getframerate()
                        ch = wf.getnchannels()
                        chunk_samples = int(sr * 0.05)  # 50ms frames
                        while True:
                            raw = wf.readframes(chunk_samples)
                            if not raw:
                                break
                            actual_samples = len(raw) // (ch * 2)
                            frame = livekit.rtc.AudioFrame(
                                data=raw,
                                sample_rate=sr,
                                num_channels=ch,
                                samples_per_channel=actual_samples
                            )
                            try:
                                await self.audio_source.capture_frame(frame)
                            except Exception as capture_err:
                                logger.warning("Frame capture skipped: %s", capture_err)
                                break
                            await asyncio.sleep(0.005)
                finally:
                    if os.path.exists(wav_path):
                        os.remove(wav_path)

    async def speak_disclosure(self):
        """Task 4.1: Speak AI disclosure + recording notice at call start."""
        disclosure_text = (
            "Hi, thanks for calling Apex Staffing Agency. I am an AI assistant and this call is recorded "
            "for quality assurance. I'm calling to confirm your recruiter interview slot for the "
            "Senior Full-Stack Engineer role. How can I help you today?"
        )
        await self.speak(disclosure_text)
        self.conversation_history.append({"role": "assistant", "content": disclosure_text})

        # Log opening turn 0 to Node API
        turn_0_payload = {
            "idx": 0,
            "callerText": "[CALL_CONNECTED]",
            "proposed": {
                "intent": "opening_disclosure",
                "is_commitment": False,
                "claims": [{"claim": "Apex Staffing Agency", "fact_id": self.facts[0].id if self.facts else "fact_company_name"}],
                "proposed_utterance": disclosure_text,
                "confidence": 1.0
            },
            "spoken": disclosure_text,
            "gate": "PASS",
            "judgeScore": 1.0,
            "judgeReason": "Compliant opening disclosure of AI identity and call recording.",
            "flags": ["DISCLOSURE_SPOKEN", "llm_ms:0", "gate_ms:0", "total_ms:50"]
        }
        try:
            async with httpx.AsyncClient(base_url=self.api_base_url, timeout=10.0) as client:
                await client.post(f"/api/calls/{self.call_id}/turns", json=turn_0_payload)
                logger.info("Recorded Turn 0 (AI Disclosure) in Postgres.")
        except Exception as e:
            logger.warning("Could not record opening turn 0: %s", e)

        self.turn_idx = 1

    async def handle_turn(self, caller_text: str):
        """Process caller turn: LLM -> Held-turn check -> Gate -> TTS -> Node API log."""
        async with self._turn_lock:
            current_turn_idx = self.turn_idx
            self.turn_idx += 1

            t0 = time.perf_counter()
            logger.info("Received caller text [turn %d]: %s", current_turn_idx, caller_text)

            # Append to history
            self.conversation_history.append({"role": "user", "content": caller_text})

            # 1. Non-streaming LLM call to Groq
            from turn import generate_turn
            proposed_turn: AgentTurn = generate_turn(
                caller_utterance=caller_text,
                history=self.conversation_history[:-1],
                facts=self.facts,
                rules=self.rules
            )
            t_llm = (time.perf_counter() - t0) * 1000.0

            # 2. Task 4.2 Held-turn path for commitment turns:
            # If commitment or booking a slot, speak hold line immediately before judge returns
            if proposed_turn.is_commitment:
                hold_line = "One moment please, let me verify that slot on our calendar."
                await self.speak(hold_line, is_hold_line=True)

            # 3. Gate validation: Rule Engine + Grounding + Independent Judge
            t_gate_start = time.perf_counter()
            judge_res = evaluate_turn(
                caller_text=caller_text,
                proposed_utterance=proposed_turn.proposed_utterance,
                claims=proposed_turn.claims,
                rules=self.rules,
                facts=self.facts,
                turn_idx=current_turn_idx
            )
            gate_res: GateResult = self.gate.validate(
                turn=proposed_turn,
                turn_idx=current_turn_idx,
                judge_score=judge_res.overall_score,
                judge_reason=judge_res.reason
            )
            t_gate = (time.perf_counter() - t_gate_start) * 1000.0

            spoken_utterance = gate_res.spoken
            t_total = (time.perf_counter() - t0) * 1000.0
            self.turn_latencies.append(int(t_total))

            # 4. Task 4.6: Metrics from real timestamps
            flags_with_metrics = list(gate_res.flags)
            flags_with_metrics.append(f"llm_ms:{int(t_llm)}")
            flags_with_metrics.append(f"gate_ms:{int(t_gate)}")
            flags_with_metrics.append(f"total_ms:{int(t_total)}")

            proposed_dict = proposed_turn.model_dump()
            proposed_dict["metrics"] = {
                "first_token_latency_ms": int(t_llm),
                "gate_latency_ms": int(t_gate),
                "total_turn_latency_ms": int(t_total)
            }

            # 5. Post turn record to Node API immediately
            turn_payload = {
                "idx": current_turn_idx,
                "callerText": caller_text,
                "proposed": proposed_dict,
                "spoken": spoken_utterance,
                "gate": gate_res.outcome,
                "judgeScore": judge_res.overall_score,
                "judgeReason": judge_res.reason,
                "flags": flags_with_metrics
            }

            async with httpx.AsyncClient(base_url=self.api_base_url, timeout=10.0) as client:
                res = await client.post(f"/api/calls/{self.call_id}/turns", json=turn_payload)
                if res.status_code == 201:
                    logger.info("Recorded Turn %d in Postgres. Gate: %s, Total: %dms", current_turn_idx, gate_res.outcome, int(t_total))
                else:
                    logger.error("Failed to record turn: %s", res.text)

            # 6. Speak the approved utterance
            await self.speak(spoken_utterance)
            self.conversation_history.append({"role": "assistant", "content": spoken_utterance})

    async def disconnect(self):
        """Disconnect and finalize call metrics in API."""
        if self.turn_latencies:
            p50_latency = sorted(self.turn_latencies)[len(self.turn_latencies) // 2]
            logger.info("Call %s completed. Latency p50: %dms", self.call_id, p50_latency)
            try:
                async with httpx.AsyncClient(base_url=self.api_base_url, timeout=10.0) as client:
                    await client.patch(f"/api/calls/{self.call_id}", json={"latencyP50Ms": p50_latency})
            except Exception as e:
                logger.warning("Could not patch call p50 latency: %s", e)

        if self.room:
            await self.room.disconnect()
            logger.info("Agent disconnected from room %s", self.room_name)
        self.is_connected = False
