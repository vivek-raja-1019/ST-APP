from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import os, json
from datetime import datetime

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.join(os.path.dirname(BASE_DIR), "frontend")

USERS_FILE = os.path.join(BASE_DIR, "users.json")
HISTORY_FILE = os.path.join(BASE_DIR, "history.json")

app = Flask(__name__, static_folder=None)
CORS(app)

def _read_json(path, default):
    try:
        # if file not exists -> create with default
        if not os.path.exists(path):
            return default

        # if file exists but empty -> treat as default
        if os.path.getsize(path) == 0:
            return default

        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return default

def _write_json(path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

def _ensure_files():
    # ✅ create users.json if missing or empty
    if (not os.path.exists(USERS_FILE)) or os.path.getsize(USERS_FILE) == 0:
        demo = [
            {"name": "Aravind", "password": "123", "balance": 5000},
            {"name": "gojo", "password": "123", "balance": 4000},
            {"name": "rosyy", "password": "123", "balance": 3000},
            {"name": "Vivek", "password": "123", "balance": 6000},
            {"name": "advika", "password": "123", "balance": 2000},
        ]
        _write_json(USERS_FILE, demo)

    # ✅ create history.json if missing or empty
    if (not os.path.exists(HISTORY_FILE)) or os.path.getsize(HISTORY_FILE) == 0:
        _write_json(HISTORY_FILE, [])

_ensure_files()

# ---------- Frontend serving ----------
@app.get("/")
def home():
    return send_from_directory(FRONTEND_DIR, "index.html")

@app.get("/<path:filename>")
def serve_frontend(filename):
    return send_from_directory(FRONTEND_DIR, filename)

# ---------- Helpers ----------
# ✅ FIX: case-insensitive find
def find_user(users, name):
    name = (name or "").strip().lower()
    for u in users:
        if (u.get("name") or "").strip().lower() == name:
            return u
    return None

# ---------- API: login ----------
@app.post("/api/login")
def api_login():
    data = request.get_json(force=True)
    name = (data.get("name") or "").strip()
    password = (data.get("password") or "").strip()

    if not name or not password:
        return jsonify({"error": "name/password required"}), 400

    users = _read_json(USERS_FILE, [])
    u = find_user(users, name)
    if not u or (u.get("password") != password):
        return jsonify({"error": "Invalid credentials"}), 401

    # return stored name (original case)
    return jsonify({"ok": True, "name": u.get("name"), "balance": u.get("balance", 0)})

# ---------- API: get balance ----------
@app.get("/api/balance/<username>")
def api_balance(username):
    users = _read_json(USERS_FILE, [])
    u = find_user(users, username)
    if not u:
        return jsonify({"error": "User not found"}), 404
    return jsonify({"ok": True, "balance": u.get("balance", 0)})

# ---------- API: list users (password hidden) ----------
@app.get("/api/users")
def api_users():
    users = _read_json(USERS_FILE, [])
    safe_users = []
    for u in users:
        safe_users.append({
            "name": u.get("name"),
            "balance": u.get("balance", 0)
        })
    return jsonify({"ok": True, "users": safe_users})

# ---------- API: send money ----------
@app.post("/send")
def send_money():
    data = request.get_json(force=True)
    sender = (data.get("sender") or "").strip()
    receiver = (data.get("receiver") or "").strip()
    amount_raw = data.get("amount")

    try:
        amount = float(amount_raw)
    except Exception:
        return jsonify({"error": "Invalid amount"}), 400

    if not sender or not receiver:
        return jsonify({"error": "sender/receiver required"}), 400
    if amount <= 0:
        return jsonify({"error": "Amount must be > 0"}), 400

    users = _read_json(USERS_FILE, [])
    s = find_user(users, sender)
    r = find_user(users, receiver)

    if not s:
        return jsonify({"error": "Sender not found"}), 404
    if not r:
        return jsonify({"error": "Receiver not found"}), 404

    if float(s.get("balance", 0)) < amount:
        return jsonify({"error": "Insufficient balance"}), 400

    # ✅ update balances
    s["balance"] = float(s.get("balance", 0)) - amount
    r["balance"] = float(r.get("balance", 0)) + amount
    _write_json(USERS_FILE, users)

    # ✅ history update
    history = _read_json(HISTORY_FILE, [])
    txn_id = "TXN" + datetime.now().strftime("%Y%m%d%H%M%S")
    history.append({
        "type": "pay",
        "id": txn_id,
        "sender": s.get("name"),     # store original case
        "receiver": r.get("name"),   # store original case
        "amount": amount,
        "date": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    })
    _write_json(HISTORY_FILE, history)

    return jsonify({
        "ok": True,
        "id": txn_id,
        "sender_balance": s["balance"],
        "receiver_balance": r["balance"]
    })

# ---------- API: history ----------
@app.get("/api/history")
def api_history():
    history = _read_json(HISTORY_FILE, [])
    return jsonify({"ok": True, "history": history})

# ---------- API: reset demo data ----------
@app.post("/api/reset-demo")
def reset_demo():
    demo = [
        {"name": "Aravind", "password": "123", "balance": 5000},
        {"name": "gojo", "password": "123", "balance": 4000},
        {"name": "rosyy", "password": "123", "balance": 3000},
        {"name": "Vivek", "password": "123", "balance": 6000},
        {"name": "advika", "password": "123", "balance": 2000},
    ]
    _write_json(USERS_FILE, demo)
    _write_json(HISTORY_FILE, [])
    return jsonify({"ok": True, "message": "Demo data reset successfully"})

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)