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
        if (u.get("name") or "").lower().strip() == name:
            return u

    return None


# ---------------- HELPERS ----------------

def safe_float(value):
    try:
        return float(value)
    except:
        return 0.0


def make_txn_id():
    return "TXN" + datetime.now().strftime("%Y%m%d%H%M%S%f")


def make_reference(txn_id):
    return "REF-" + txn_id[-8:]


def make_hash(txn_id):
    return "0x" + txn_id.lower()


def get_next_block_no():
    history = read_json(HISTORY_FILE, [])
    return len(history) + 1


def parse_time_for_sort(value):
    if not value:
        return datetime.min

    text = str(value).strip()
    if not text:
        return datetime.min

    formats = [
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%d",
        "%d-%m-%Y %H:%M:%S",
        "%d-%m-%Y",
        "%d/%m/%Y %H:%M:%S",
        "%d/%m/%Y",
    ]

    for fmt in formats:
        try:
            return datetime.strptime(text, fmt)
        except:
            pass

    try:
        return datetime.fromisoformat(text)
    except:
        return datetime.min


def sort_history_desc(items):
    items.sort(
        key=lambda x: parse_time_for_sort(x.get("time") or x.get("date") or x.get("timestamp") or ""),
        reverse=True
    )
    return items


def normalize_history_item(tx, current_user=None):
    """
    Old history format + new history format render panna common format.
    """

    tx_id = tx.get("id") or make_txn_id()
    raw_type = (tx.get("type") or "").lower().strip()

    sender = tx.get("sender") or tx.get("from") or ""
    receiver = tx.get("receiver") or tx.get("to") or ""
    amount = safe_float(tx.get("amount") or 0)
    time_value = tx.get("time") or tx.get("date") or tx.get("timestamp") or ""
    status = tx.get("status") or "success"
    user_value = tx.get("user") or tx.get("username") or ""

    # type normalize
    if raw_type in ["pay", "paid", "send", "sent", "transfer_sent", "debit"]:
        tx_type = "transfer_sent"
    elif raw_type in ["transfer_received", "received", "credit"]:
        tx_type = "transfer_received"
    elif raw_type in ["deposit", "addmoney", "add_money", "topup", "money_added"]:
        tx_type = "deposit"
    else:
        if sender and receiver:
            tx_type = "transfer_sent"
        elif receiver and not sender:
            tx_type = "transfer_received"
        else:
            tx_type = "deposit"

    title = tx.get("title") or ""

    if not title:
        if tx_type == "transfer_sent":
            title = f"Sent to {receiver or 'User'}"
        elif tx_type == "transfer_received":
            title = f"Received from {sender or 'User'}"
        else:
            title = "Money added"

    normalized = {
        "id": tx_id,
        "reference": tx.get("reference") or make_reference(tx_id),
        "hash": tx.get("hash") or make_hash(tx_id),
        "type": tx_type,
        "title": title,
        "sender": sender,
        "receiver": receiver,
        "from": sender,
        "to": receiver,
        "amount": amount,
        "status": status,
        "time": time_value,
        "date": time_value,
        "user": user_value,
        "balance_after": tx.get("balance_after"),
        "block_no": tx.get("block_no") if tx.get("block_no") is not None else tx.get("block")
    }

    # current user perspective ku convert
    if current_user:
        cu = (current_user or "").lower().strip()
        s = (sender or "").lower().strip()
        r = (receiver or "").lower().strip()

        if tx_type == "transfer_sent":
            if cu == r:
                normalized["type"] = "transfer_received"
                normalized["title"] = f"Received from {sender or 'User'}"
            elif cu == s:
                normalized["type"] = "transfer_sent"
                normalized["title"] = f"Sent to {receiver or 'User'}"

        elif tx_type == "transfer_received":
            if cu == s:
                normalized["type"] = "transfer_sent"
                normalized["title"] = f"Sent to {receiver or 'User'}"
            elif cu == r:
                normalized["type"] = "transfer_received"
                normalized["title"] = f"Received from {sender or 'User'}"

    return normalized


def append_history(txn):
    history = read_json(HISTORY_FILE, [])
    history.append(txn)
    write_json(HISTORY_FILE, history)


def get_user_history(username):
    history = read_json(HISTORY_FILE, [])
    uname = (username or "").lower().strip()
    result = []

    for tx in history:
        normalized = normalize_history_item(tx, username)

        sender = (normalized.get("sender") or "").lower().strip()
        receiver = (normalized.get("receiver") or "").lower().strip()
        user_val = (normalized.get("user") or "").lower().strip()

        if uname == sender or uname == receiver or uname == user_val:
            result.append(normalized)

    return sort_history_desc(result)


# ---------------- FRONTEND ROUTES ----------------

@app.get("/")
def index():
    return send_from_directory(FRONTEND_DIR, "index.html")


# ---------------- HEALTH ----------------

@app.get("/api/health")
def health():
    return jsonify({"ok": True})


# ---------------- LOGIN ----------------

@app.post("/api/login")
def login():
    data = request.get_json(force=True) or {}

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

@app.post("/send")
@app.post("/api/send")
def send():
    data = request.get_json(force=True) or {}

    sender = (data.get("sender") or "").strip()
    receiver = (data.get("receiver") or "").strip()
    amount = safe_float(data.get("amount") or 0)

    users = read_json(USERS_FILE, [])

    s = find_user(users, sender)
    r = find_user(users, receiver)

    if not sender:
        return jsonify({"error": "Sender is required"}), 400

    if not receiver:
        return jsonify({"error": "Receiver is required"}), 400

    if amount <= 0:
        return jsonify({"error": "Amount must be greater than 0"}), 400

    if sender.lower() == receiver.lower():
        return jsonify({"error": "Sender and receiver cannot be same"}), 400

    if not s:
        return jsonify({"error": "Sender not found"}), 404

    if not r:
        return jsonify({"error": "Receiver not found"}), 404

    if safe_float(s["balance"]) < amount:
        return jsonify({"error": "Insufficient balance"}), 400

    s["balance"] = safe_float(s["balance"]) - amount
    r["balance"] = safe_float(r["balance"]) + amount

    write_json(USERS_FILE, users)

    txn_id = make_txn_id()
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    txn = {
        "type": "pay",
        "id": txn_id,
        "reference": make_reference(txn_id),
        "hash": make_hash(txn_id),
        "sender": s["name"],
        "receiver": r["name"],
        "from": s["name"],
        "to": r["name"],
        "user": s["name"],
        "amount": amount,
        "status": "success",
        "date": now_str,
        "time": now_str,
        "balance_after": s["balance"],
        "block_no": get_next_block_no(),
        "title": f"Sent to {r['name']}"
    }

    append_history(txn)

    return jsonify({
        "ok": True,
        "id": txn["id"],
        "reference": txn["reference"],
        "sender_balance": s["balance"],
        "receiver_balance": r["balance"]
    })


# ---------------- HISTORY ----------------

@app.get("/api/history")
def history():
    history = read_json(HISTORY_FILE, [])
    normalized = [normalize_history_item(tx) for tx in history]
    normalized = sort_history_desc(normalized)

    return jsonify({
        "ok": True,
        "history": normalized
    })


@app.get("/api/history/<username>")
def history_by_user(username):
    user_history = get_user_history(username)

    return jsonify({
        "ok": True,
        "history": user_history
    })


# extra support for frontend fallback
@app.get("/history/<username>")
def history_by_user_plain(username):
    user_history = get_user_history(username)

    return jsonify({
        "ok": True,
        "history": user_history
    })


# extra support for query param route
@app.get("/api/statement")
@app.get("/api/history-by-user")
def history_query_user():
    username = (
        (request.args.get("user") or "").strip() or
        (request.args.get("username") or "").strip() or
        (request.args.get("name") or "").strip()
    )

    if not username:
        return jsonify({
            "ok": False,
            "message": "Username is required",
            "history": []
        }), 400

    user_history = get_user_history(username)

    return jsonify({
        "ok": True,
        "history": user_history
    })


# ---------------- ADD MONEY ----------------

@app.post("/api/addmoney")
def addmoney():
    data = request.get_json(force=True) or {}

    username = (data.get("username") or "").strip()
    amount = safe_float(data.get("amount") or 0)

    users = read_json(USERS_FILE, [])

    u = find_user(users, username)

    if not username:
        return jsonify({"error": "Username is required"}), 400

    if amount <= 0:
        return jsonify({"error": "Amount must be greater than 0"}), 400

    if not u:
        return jsonify({"error": "User not found"}), 404

    u["balance"] = safe_float(u["balance"]) + amount

    write_json(USERS_FILE, users)

    txn_id = make_txn_id()
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    txn = {
        "type": "deposit",
        "id": txn_id,
        "reference": make_reference(txn_id),
        "hash": make_hash(txn_id),
        "sender": "Self / Bank",
        "receiver": u["name"],
        "from": "Self / Bank",
        "to": u["name"],
        "user": u["name"],
        "amount": amount,
        "status": "success",
        "date": now_str,
        "time": now_str,
        "balance_after": u["balance"],
        "block_no": get_next_block_no(),
        "title": "Money added"
    }

    append_history(txn)

    return jsonify({
        "ok": True,
        "balance": u["balance"],
        "id": txn["id"],
        "reference": txn["reference"]
    })


# ---------------- FRONTEND FILE ROUTE ----------------

@app.get("/<path:path>")
def serve_file(path):
    if path.startswith("api/"):
        return jsonify({
            "ok": False,
            "message": "API route not found"
        }), 404

    file_path = os.path.join(FRONTEND_DIR, path)

    if os.path.exists(file_path):
        return send_from_directory(FRONTEND_DIR, path)

    return send_from_directory(FRONTEND_DIR, "index.html")


# ---------------- RUN ----------------

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))

    app.run(
        host="0.0.0.0",
        port=port
    )