"""
ScopeProof - Live Phone Call with Real AI Agent
Starts a local ngrok tunnel and dials your mobile phone through Twilio,
connecting your voice directly to Groq + ScopeProof Pre-TTS Gate!
"""

import os
import sys
import time
import subprocess
import urllib.request
import urllib.parse
import json
import base64
from pathlib import Path
from dotenv import load_dotenv

# Load root .env
dotenv_path = Path(__file__).resolve().parents[2] / ".env"
load_dotenv(dotenv_path)

account_sid = os.getenv("TWILIO_ACCOUNT_SID")
auth_token = os.getenv("TWILIO_AUTH_TOKEN")
from_number = os.getenv("TWILIO_PHONE_NUMBER")
to_number = os.getenv("USER_PHONE_NUMBER")

if not account_sid or not auth_token:
    print("[ERROR] TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN must be set in .env")
    sys.exit(1)

print("=" * 65)
print("  ScopeProof AI: Live Interactive Mobile Phone Call Setup")
print("=" * 65)

# Step 0: Ensure backend Node.js API server is running on port 4000
api_healthy = False
try:
    with urllib.request.urlopen("http://127.0.0.1:4000/health", timeout=2) as resp:
        if resp.status == 200:
            api_healthy = True
except Exception:
    pass

if not api_healthy:
    print("[0/3] Node API server not detected on port 4000. Starting it now...")
    project_root = Path(__file__).resolve().parents[2]
    api_dist = project_root / "apps" / "api" / "dist" / "index.js"
    subprocess.Popen(
        ["node", str(api_dist)],
        cwd=str(project_root),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        shell=True
    )
    for _ in range(10):
        time.sleep(1)
        try:
            with urllib.request.urlopen("http://127.0.0.1:4000/health", timeout=2) as resp:
                if resp.status == 200:
                    api_healthy = True
                    break
        except Exception:
            continue

if not api_healthy:
    print("[ERROR] Could not connect to API server at http://127.0.0.1:4000.")
    print("Please run 'node apps/api/dist/index.js' in another terminal and retry.")
    sys.exit(1)

print("[✓] Backend Node.js API server active on http://127.0.0.1:4000")

# Step 1: Check if ngrok is already running, or start it
public_url = None
try:
    with urllib.request.urlopen("http://127.0.0.1:4040/api/tunnels", timeout=2) as resp:
        data = json.loads(resp.read().decode("utf-8"))
        tunnels = data.get("tunnels", [])
        for t in tunnels:
            if t.get("proto") == "https":
                public_url = t.get("public_url")
                break
except Exception:
    pass

if not public_url:
    print("[1/3] Starting ngrok tunnel on port 4000...")
    ngrok_cmd = "ngrok"
    # Try finding ngrok in AppData or PATH
    subprocess.Popen(
        [ngrok_cmd, "http", "4000"],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        shell=True
    )
    # Wait for tunnel to establish
    for _ in range(10):
        time.sleep(1)
        try:
            with urllib.request.urlopen("http://127.0.0.1:4040/api/tunnels", timeout=2) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                for t in data.get("tunnels", []):
                    if t.get("proto") == "https":
                        public_url = t.get("public_url")
                        break
            if public_url:
                break
        except Exception:
            continue

if not public_url:
    print("[ERROR] Could not start ngrok tunnel automatically.")
    print("Please run 'ngrok http 4000' in another terminal window and run this script again.")
    sys.exit(1)

print(f"[2/3] Public Tunnel Established: {public_url}")
voice_webhook_url = f"{public_url}/api/twilio/voice/incoming"
print(f"      Voice Webhook URL: {voice_webhook_url}")

# Step 2: Place the outbound call via Twilio
print(f"[3/3] Placing Call to your phone: {to_number} (From: {from_number})...")

call_api_url = f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Calls.json"
post_data = urllib.parse.urlencode({
    "To": to_number,
    "From": from_number,
    "Url": voice_webhook_url
}).encode("utf-8")

req = urllib.request.Request(call_api_url, data=post_data, method="POST")
auth_string = base64.b64encode(f"{account_sid}:{auth_token}".encode("utf-8")).decode("utf-8")
req.add_header("Authorization", f"Basic {auth_string}")

try:
    with urllib.request.urlopen(req) as resp:
        call_res = json.loads(resp.read().decode("utf-8"))
        call_sid = call_res.get("sid")
        print("\n" + "=" * 65)
        print("  SUCCESS! YOUR PHONE IS RINGING NOW!")
        print("=" * 65)
        print(f"Call SID : {call_sid}")
        print(f"Status   : {call_res.get('status')}")
        print("\nWHAT TO EXPECT WHEN YOU PICK UP:")
        print("1. You will hear: 'Hi! I am the automated scheduling assistant for Apex Staffing...'")
        print("2. Speak naturally! For example:")
        print("   - Say: 'What does this job pay?' -> Watch the Gate block the salary!")
        print("   - Say: 'I want Tuesday at 10 AM.' -> Agent confirms the slot!")
        print("   - Say: 'Please stop calling me.' -> Agent performs polite opt-out!")
        print("\nKeep http://localhost:3000/live open in your browser to watch the transcript live!")
        print("=" * 65)
except Exception as e:
    print(f"\n[ERROR] Failed to place call: {e}")
    if hasattr(e, "read"):
        print("Details:", e.read().decode("utf-8"))
    sys.exit(1)

