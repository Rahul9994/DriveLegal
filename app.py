import os

import requests
from dotenv import load_dotenv
from flask import Flask, jsonify, render_template, request
from flask_cors import CORS

load_dotenv()

app = Flask(__name__)
CORS(app)

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
MODEL = os.getenv("OPENROUTER_MODEL", "meta-llama/llama-3.3-70b-instruct")

SYSTEM_PROMPT = """
You are DriveLegal AI, a precise traffic law assistant.

Knowledge scope:
- Indian traffic laws, including the Motor Vehicles Act 1988 and 2019 amendments
- Telangana and Maharashtra state-specific enforcement where relevant
- US, UK, EU, Singapore, and other global traffic law basics

Behavior:
- Prioritize the user's selected region.
- Give concise, practical answers with fine amounts where known.
- Mention when laws vary by state, city, or enforcement authority.
- Cite sections or authority names when possible.
- For challan calculations, return this exact machine-readable format when useful:
  CHALLAN_CARD|Violation 1: Rs. amount|Violation 2: Rs. amount|TOTAL: Rs. total
- End serious violations such as DUI or reckless driving with a safety reminder.
""".strip()


@app.route("/")
def home():
    return render_template("index.html")


@app.route("/chat", methods=["POST"])
def chat():
    data = request.get_json(silent=True) or {}
    user_message = (data.get("message") or "").strip()
    region = (data.get("region") or "India").strip()
    history = data.get("history") or []

    if not user_message:
        return jsonify({"success": False, "reply": "", "error": "Message is required."}), 400

    if not OPENROUTER_API_KEY:
        return jsonify({
            "success": False,
            "reply": "Offline Mode Active. OPENROUTER_API_KEY is missing in .env.",
            "error": "OPENROUTER_API_KEY is not configured."
        }), 500

    messages = [
        {
            "role": "system",
            "content": f"{SYSTEM_PROMPT}\n\nCurrent user region: {region}."
        }
    ]

    for item in history[-10:]:
        role = item.get("role")
        content = item.get("content")
        if role in {"user", "assistant"} and isinstance(content, str) and content.strip():
            messages.append({"role": role, "content": content.strip()})

    if not messages or messages[-1].get("content") != user_message:
        messages.append({"role": "user", "content": user_message})

    try:
        response = requests.post(
            OPENROUTER_URL,
            headers={
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                "Content-Type": "application/json",
                "HTTP-Referer": request.host_url.rstrip("/"),
                "X-Title": "DriveLegal AI"
            },
            json={
                "model": MODEL,
                "messages": messages,
                "temperature": 0.4,
                "max_tokens": 800
            },
            timeout=45
        )
        response.raise_for_status()
        result = response.json()
        reply = result.get("choices", [{}])[0].get("message", {}).get("content")

        if not reply:
            raise ValueError("OpenRouter returned an empty response.")

        return jsonify({"success": True, "reply": reply})

    except Exception as exc:
        return jsonify({
            "success": False,
            "reply": "Offline Mode Active. Could not reach AI server.",
            "error": str(exc)
        }), 502


if __name__ == "__main__":
    app.run(debug=True)
