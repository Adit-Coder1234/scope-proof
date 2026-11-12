"""
ScopeProof - Direct Phone Call Trigger
Places a real PSTN phone call from Twilio to the verified user mobile number.
"""

import os
import sys
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

print("=" * 60)
print("[ScopeProof] Initiating Voice Call to Mobile Phone")
print("=" * 60)
print(f"From (Twilio Carrier) : {from_number}")
print(f"To (Your Mobile Phone): {to_number}")
print("Connecting to Twilio carrier...")

# Twilio Trial accounts require the approved template Url parameter
url = f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Calls.json"

post_data = urllib.parse.urlencode({
    "To": to_number,
    "From": from_number,
    "Url": "https://webhooks.twilio.com/v1/Voice/Template/voice_speech_recognition"
}).encode("utf-8")

req = urllib.request.Request(url, data=post_data, method="POST")
auth_string = base64.b64encode(f"{account_sid}:{auth_token}".encode("utf-8")).decode("utf-8")
req.add_header("Authorization", f"Basic {auth_string}")

try:
    with urllib.request.urlopen(req) as response:
        res = json.loads(response.read().decode("utf-8"))
        call_sid = res.get("sid")
        status = res.get("status")
        print("\n[SUCCESS] CALL PLACED SUCCESSFULLY!")
        print(f"Call SID : {call_sid}")
        print(f"Status   : {status}")
        print("-" * 60)
        print(">>> YOUR PHONE IS RINGING RIGHT NOW! <<<")
        print("Answer your phone to test the voice connection.")
        print("-" * 60)
except Exception as e:
    print(f"\n[ERROR] Call Failed: {e}")
    if hasattr(e, "read"):
        print("Twilio Details:", e.read().decode("utf-8"))
    sys.exit(1)

