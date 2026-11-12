import asyncio
import json
import logging
import os
import sys
import time
from typing import Optional

import dotenv
import livekit.api
import livekit.rtc

dotenv.load_dotenv(os.path.join(os.path.dirname(__file__), "../../.env"))
dotenv.load_dotenv()

logger = logging.getLogger("test_caller")
logging.basicConfig(level=logging.INFO)


class ScriptedCaller:
    def __init__(
        self,
        room_name: str,
        caller_identity: str = "test-caller",
        caller_name: str = "Alex Candidate"
    ):
        self.room_name = room_name
        self.caller_identity = caller_identity
        self.caller_name = caller_name

        self.livekit_url = os.environ.get("LIVEKIT_URL")
        self.livekit_api_key = os.environ.get("LIVEKIT_API_KEY")
        self.livekit_api_secret = os.environ.get("LIVEKIT_API_SECRET")

        if not (self.livekit_url and self.livekit_api_key and self.livekit_api_secret):
            raise ValueError("LiveKit credentials must be present in .env")

        self.room: Optional[livekit.rtc.Room] = None
        self.agent_messages: list[dict] = []
        self.incoming_queue: asyncio.Queue = asyncio.Queue()

    async def connect(self):
        """Connect to the LiveKit room as the test caller."""
        token = (
            livekit.api.AccessToken(self.livekit_api_key, self.livekit_api_secret)
            .with_identity(self.caller_identity)
            .with_name(self.caller_name)
            .with_grants(livekit.api.VideoGrants(room_join=True, room=self.room_name))
            .to_jwt()
        )

        self.room = livekit.rtc.Room()

        @self.room.on("data_received")
        def on_data_received(data_packet: livekit.rtc.DataPacket):
            try:
                msg = json.loads(data_packet.data.decode("utf-8"))
                if msg.get("type") == "agent_turn":
                    logger.info("Caller received Agent: %s (is_hold: %s)", msg.get("text"), msg.get("is_hold_line", False))
                    self.agent_messages.append(msg)
                    self.incoming_queue.put_nowait(msg)
            except Exception as e:
                logger.error("Error decoding agent message: %s", e)

        @self.room.on("track_subscribed")
        def on_track_subscribed(track, publication, participant):
            logger.info("Caller received subscribed audio track: %s from %s", track.sid, participant.identity)

        await self.room.connect(self.livekit_url, token)
        logger.info("Test caller connected to room %s", self.room_name)

    async def wait_for_agent_message(self, timeout: float = 25.0) -> Optional[dict]:
        """Wait for the next message from the agent via queue."""
        try:
            msg = await asyncio.wait_for(self.incoming_queue.get(), timeout=timeout)
            return msg
        except asyncio.TimeoutError:
            logger.warning("Timeout waiting for agent message in queue")
            return None

    async def speak(self, text: str):
        """Send caller text utterance to the room."""
        logger.info("Caller speaking: %s", text)
        msg = {
            "type": "caller_turn",
            "text": text,
            "timestamp": time.time()
        }
        await self.room.local_participant.publish_data(
            json.dumps(msg).encode("utf-8"),
            reliable=True
        )

    async def disconnect(self):
        if self.room:
            await self.room.disconnect()
            logger.info("Test caller disconnected from room %s", self.room_name)
