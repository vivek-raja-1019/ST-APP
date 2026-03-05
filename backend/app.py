from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import os, json
from datetime import datetime

# ---------------- PATHS ----------------

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(BASE_DIR)

FRONTEND_DIR = os.path.join(PROJECT_DIR, "frontend")

USERS_FILE = os.path.join(BASE_DIR, "users.json")
HISTORY_FILE = os.path.join(BASE_DIR, "history.json")

# ---------------- APP ----------------

app = Flask(__name__, static_folder=None)
CORS(app)

# ---------------- JSON HELPERS ----------------

def read_json(path, default):
    try:
        if not os.path.exists(path):
            return default

        if os.path.getsize(path) == 0:
            return default

        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)

    except:
        return default


def write_json(path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

# ---------------- CREATE FILES ----------------

def ensure_files():

    if not os.path.exists(USERS_FILE):

        users = [
            {"name": "Aravind", "password": "123", "balance": 5000},
            {"name": "gojo", "password": "123", "balance": 4000},
            {"name": "rosyy", "password": "123", "balance": 3000},
            {"name": "Vivek", "password": "123", "balance": 6000},
            {"name": "advika", "password": "123", "balance": 2000},
        ]

        write_json(USERS_FILE, users)


    if not os.path.exists(HISTORY_FILE):
        write_json(HISTORY_FILE, [])


ensure_files()

# ---------------- USER FIND ----------------

def find_user(users, name):

    name = (name or "").lower().strip()

    for u in users:

        if (u.get("name") or "").lower() == name:
            return u

    return None


# ---------------- FRONTEND ROUTES ----------------

@app.get("/")
def index():
    return send_from_directory(FRONTEND_DIR, "index.html")


@app.get("/<path:path>")
def serve_file(path):

    file_path = os.path.join(FRONTEND_DIR, path)

    if os.path.exists(file_path):
        return send_from_directory(FRONTEND_DIR, path)

    return send_from_directory(FRONTEND_DIR, "index.html")


# ---------------- HEALTH ----------------

@app.get("/api/health")
def health():
    return jsonify({"ok": True})


# ---------------- LOGIN ----------------

@app.post("/api/login")
def login():

    data = request.get_json(force=True)

    name = (data.get("name") or "").strip()
    password = (data.get("password") or "").strip()

    users = read_json(USERS_FILE, [])

    u = find_user(users, name)

    if not u or u.get("password") != password:
        return jsonify({"error": "Invalid credentials"}), 401

    return jsonify({
        "ok": True,
        "name": u["name"],
        "balance": u["balance"]
    })


# ---------------- USERS ----------------

@app.get("/api/users")
def users():

    users = read_json(USERS_FILE, [])

    safe = []

    for u in users:

        safe.append({
            "name": u["name"],
            "balance": u["balance"]
        })

    return jsonify({"ok": True, "users": safe})


# ---------------- BALANCE ----------------

@app.get("/api/balance/<username>")
def balance(username):

    users = read_json(USERS_FILE, [])

    u = find_user(users, username)

    if not u:
        return jsonify({"error": "User not found"}), 404

    return jsonify({
        "ok": True,
        "balance": u["balance"]
    })


# ---------------- SEND MONEY ----------------
# NOTE: Original route /send kept (NOT removed)

def _to_amount(val):
    """ADDED: safe amount parsing"""
    try:
        return float(val)
    except:
        return 0.0

def _make_txn_id():
    """ADDED: id uniqueness better than seconds only"""
    return "TXN" + datetime.now().strftime("%Y%m%d%H%M%S%f")

def _now_str():
    """ADDED: keep readable datetime"""
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")

def _append_history(txn):
    """ADDED: common history append"""
    history = read_json(HISTORY_FILE, [])
    if not isinstance(history, list):
        history = []
    history.append(txn)
    write_json(HISTORY_FILE, history)

@app.post("/send")
def send():

    data = request.get_json(force=True)

    sender = (data.get("sender") or "").strip()
    receiver = (data.get("receiver") or "").strip()

    # ADDED: method/note support (frontend can send)
    method = (data.get("method") or "UPI").strip()
    note = (data.get("note") or "").strip()

    amount = _to_amount(data.get("amount") or 0)

    # ADDED: basic validations
    if amount <= 0:
        return jsonify({"error": "Amount must be > 0"}), 400

    users = read_json(USERS_FILE, [])

    s = find_user(users, sender)
    r = find_user(users, receiver)

    if not s:
        return jsonify({"error": "Sender not found"}), 404

    if not r:
        return jsonify({"error": "Receiver not found"}), 404

    if s["balance"] < amount:
        return jsonify({"error": "Insufficient balance"}), 400

    s["balance"] -= amount
    r["balance"] += amount

    write_json(USERS_FILE, users)

    txn = {
        "type": "pay",
        "id": _make_txn_id(),
        "sender": s["name"],
        "receiver": r["name"],
        "amount": amount,
        "method": method,  # ADDED
        "note": note,      # ADDED
        "date": _now_str()
    }

    _append_history(txn)

    return jsonify({
        "ok": True,
        "id": txn["id"],
        "sender_balance": s["balance"],
        "receiver_balance": r["balance"]
    })

# ✅ ADDED: alias routes (frontend may call these)
@app.post("/api/send")
def api_send():
    return send()

@app.post("/api/transfer")
def api_transfer():
    return send()


# ---------------- HISTORY ----------------

@app.get("/api/history")
def history():

    history = read_json(HISTORY_FILE, [])
    if not isinstance(history, list):
        history = []

    return jsonify({
        "ok": True,
        "history": history
    })


# ---------------- ADD MONEY ----------------

@app.post("/api/addmoney")
def addmoney():

    data = request.get_json(force=True)

    username = (data.get("username") or "").strip()

    # ADDED: method/note support
    method = (data.get("method") or "UPI").strip()
    note = (data.get("note") or "").strip()

    amount = _to_amount(data.get("amount") or 0)

    # ADDED: basic validations
    if amount <= 0:
        return jsonify({"error": "Amount must be > 0"}), 400

    users = read_json(USERS_FILE, [])

    u = find_user(users, username)

    if not u:
        return jsonify({"error": "User not found"}), 404

    u["balance"] += amount

    write_json(USERS_FILE, users)

    # ✅ ADDED: write addmoney into history (so History tab shows)
    txn = {
        "type": "addmoney",
        "id": _make_txn_id(),
        "sender": u["name"],     # optional field
        "receiver": u["name"],   # optional field
        "amount": amount,
        "method": method,
        "note": note,
        "date": _now_str()
    }
    _append_history(txn)

    return jsonify({
        "ok": True,
        "balance": u["balance"]
    })


# ---------------- RUN ----------------

if __name__ == "__main__":

    port = int(os.environ.get("PORT", 5000))

    app.run(
        host="0.0.0.0",
        port=port
    )