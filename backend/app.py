from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import os
import json
from datetime import datetime

# ---------------- PATHS ----------------

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(BASE_DIR)

FRONTEND_DIR = os.path.join(PROJECT_DIR, "frontend")
if not os.path.exists(FRONTEND_DIR):
    FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")

USERS_FILE = os.path.join(BASE_DIR, "users.json")
HISTORY_FILE = os.path.join(BASE_DIR, "history.json")

# ---------------- APP ----------------

app = Flask(__name__, static_folder=None)
CORS(app, resources={r"/*": {"origins": "*"}})

# ---------------- JSON HELPERS ----------------

def read_json(path, default):
    try:
        if not os.path.exists(path):
            return default

        if os.path.getsize(path) == 0:
            return default

        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)

    except Exception as e:
        print(f"[READ_JSON_ERROR] {path} -> {e}")
        return default


def write_json(path, data):
    try:
        folder = os.path.dirname(path)
        if folder and not os.path.exists(folder):
            os.makedirs(folder, exist_ok=True)

        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
            f.flush()
            os.fsync(f.fileno())

        print(f"[WRITE_JSON_OK] {path}")

    except Exception as e:
        print(f"[WRITE_JSON_ERROR] {path} -> {e}")
        raise


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


def make_recharge_txn_id():
    return "RCH" + datetime.now().strftime("%Y%m%d%H%M%S%f")


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
        "%d %b %Y, %H:%M:%S",
        "%d %b %Y, %I:%M:%S %p",
        "%d %b %Y %H:%M:%S",
        "%d %b %Y"
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
        key=lambda x: parse_time_for_sort(
            x.get("time") or x.get("date") or x.get("timestamp") or ""
        ),
        reverse=True
    )
    return items


def normalize_history_item(tx, current_user=None):
    tx_id = tx.get("id") or make_txn_id()
    raw_type = (tx.get("type") or "").lower().strip()

    sender = tx.get("sender") or tx.get("from") or ""
    receiver = tx.get("receiver") or tx.get("to") or ""
    amount = safe_float(tx.get("amount") or 0)
    time_value = tx.get("time") or tx.get("date") or tx.get("timestamp") or ""
    status = tx.get("status") or "success"
    user_value = tx.get("user") or tx.get("username") or ""
    provider = tx.get("provider") or ""
    number = tx.get("number") or tx.get("mobile") or ""
    plan = tx.get("plan") or ""

    if raw_type in ["pay", "paid", "send", "sent", "transfer_sent", "debit"]:
        tx_type = "transfer_sent"
    elif raw_type in ["transfer_received", "received", "credit"]:
        tx_type = "transfer_received"
    elif raw_type in ["deposit", "addmoney", "add_money", "topup", "money_added"]:
        tx_type = "deposit"
    elif raw_type in ["recharge", "mobile_recharge"]:
        tx_type = "recharge"
    else:
        if provider or number or plan:
            tx_type = "recharge"
        elif sender and receiver:
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
        elif tx_type == "recharge":
            title = "Mobile Recharge"
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
        "balanceAfter": tx.get("balanceAfter") or tx.get("balance_after"),
        "block_no": tx.get("block_no") if tx.get("block_no") is not None else tx.get("block"),
        "provider": provider,
        "number": number,
        "mobile": number,
        "plan": plan,
        "subtitle": tx.get("subtitle") or tx.get("desc") or "",
        "desc": tx.get("desc") or tx.get("subtitle") or "",
        "icon": tx.get("icon") or ("📱" if tx_type == "recharge" else "")
    }

    if current_user:
        cu = (current_user or "").lower().strip()
        s = (sender or "").lower().strip()
        r = (receiver or "").lower().strip()

        if normalized["type"] == "transfer_sent":
            if cu == r:
                normalized["type"] = "transfer_received"
                normalized["title"] = f"Received from {sender or 'User'}"
            elif cu == s:
                normalized["type"] = "transfer_sent"
                normalized["title"] = f"Sent to {receiver or 'User'}"

        elif normalized["type"] == "transfer_received":
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


def get_request_json():
    try:
        return request.get_json(silent=True) or {}
    except Exception as e:
        print("[JSON_PARSE_ERROR]", e)
        return {}


# ---------------- FRONTEND ROUTES ----------------

@app.route("/", methods=["GET"])
def index():
    try:
        index_path = os.path.join(FRONTEND_DIR, "index.html")
        if os.path.exists(index_path):
            return send_from_directory(FRONTEND_DIR, "index.html")

        return jsonify({
            "ok": True,
            "message": "ST PAY backend is running",
            "frontend_dir": FRONTEND_DIR,
            "index_found": False
        })
    except Exception as e:
        print("[INDEX_ROUTE_ERROR]", e)
        return jsonify({
            "ok": False,
            "message": "Failed to load index.html",
            "error": str(e),
            "frontend_dir": FRONTEND_DIR
        }), 500


# ---------------- HEALTH ----------------

@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({
        "ok": True,
        "frontend_dir": FRONTEND_DIR,
        "frontend_exists": os.path.exists(FRONTEND_DIR),
        "index_exists": os.path.exists(os.path.join(FRONTEND_DIR, "index.html")),
        "users_file_exists": os.path.exists(USERS_FILE),
        "history_file_exists": os.path.exists(HISTORY_FILE)
    })


# ---------------- DEBUG FILES ----------------

@app.route("/api/debug/files", methods=["GET"])
def debug_files():
    users_data = read_json(USERS_FILE, [])
    history_data = read_json(HISTORY_FILE, [])

    return jsonify({
        "ok": True,
        "base_dir": BASE_DIR,
        "project_dir": PROJECT_DIR,
        "frontend_dir": FRONTEND_DIR,
        "users_file": USERS_FILE,
        "history_file": HISTORY_FILE,
        "users_file_exists": os.path.exists(USERS_FILE),
        "history_file_exists": os.path.exists(HISTORY_FILE),
        "frontend_exists": os.path.exists(FRONTEND_DIR),
        "index_exists": os.path.exists(os.path.join(FRONTEND_DIR, "index.html")),
        "users_count": len(users_data) if isinstance(users_data, list) else 0,
        "history_count": len(history_data) if isinstance(history_data, list) else 0,
        "cwd": os.getcwd()
    })


# ---------------- LOGIN ----------------

@app.route("/api/login", methods=["POST", "OPTIONS"])
def login():
    if request.method == "OPTIONS":
        return jsonify({"ok": True}), 200

    data = get_request_json()

    name = (data.get("name") or data.get("username") or "").strip()
    password = (data.get("password") or "").strip()

    users = read_json(USERS_FILE, [])
    u = find_user(users, name)

    if not u or str(u.get("password", "")).strip() != password:
        return jsonify({
            "ok": False,
            "error": "Invalid credentials"
        }), 401

    return jsonify({
        "ok": True,
        "name": u.get("name", ""),
        "username": u.get("name", ""),
        "balance": safe_float(u.get("balance", 0))
    })


# ---------------- USERS ----------------

@app.route("/api/users", methods=["GET"])
def users():
    all_users = read_json(USERS_FILE, [])

    safe = []
    for u in all_users:
        safe.append({
            "name": u.get("name", ""),
            "balance": safe_float(u.get("balance", 0))
        })

    return jsonify({"ok": True, "users": safe})


# ---------------- BALANCE ----------------

@app.route("/api/balance/<username>", methods=["GET"])
def balance(username):
    users = read_json(USERS_FILE, [])
    u = find_user(users, username)

    if not u:
        return jsonify({
            "ok": False,
            "balance": 0
        }), 404

    return jsonify({
        "ok": True,
        "balance": safe_float(u.get("balance", 0))
    })


# ---------------- SEND MONEY ----------------

@app.route("/send", methods=["POST", "OPTIONS"])
@app.route("/api/send", methods=["POST", "OPTIONS"])
def send():
    if request.method == "OPTIONS":
        return jsonify({"ok": True}), 200

    data = get_request_json()

    sender = (data.get("sender") or data.get("from") or data.get("user") or "").strip()
    receiver = (data.get("receiver") or data.get("to") or "").strip()
    amount = safe_float(data.get("amount") or 0)

    users = read_json(USERS_FILE, [])

    s = find_user(users, sender)
    r = find_user(users, receiver)

    if not sender:
        return jsonify({"ok": False, "error": "Sender is required"}), 400

    if not receiver:
        return jsonify({"ok": False, "error": "Receiver is required"}), 400

    if amount <= 0:
        return jsonify({"ok": False, "error": "Amount must be greater than 0"}), 400

    if sender.lower() == receiver.lower():
        return jsonify({"ok": False, "error": "Sender and receiver cannot be same"}), 400

    if not s:
        return jsonify({"ok": False, "error": "Sender not found"}), 404

    if not r:
        return jsonify({"ok": False, "error": "Receiver not found"}), 404

    if safe_float(s.get("balance", 0)) < amount:
        return jsonify({"ok": False, "error": "Insufficient balance"}), 400

    s["balance"] = safe_float(s.get("balance", 0)) - amount
    r["balance"] = safe_float(r.get("balance", 0)) + amount

    write_json(USERS_FILE, users)

    txn_id = make_txn_id()
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    txn = {
        "type": "pay",
        "id": txn_id,
        "reference": make_reference(txn_id),
        "hash": make_hash(txn_id),
        "sender": s.get("name", ""),
        "receiver": r.get("name", ""),
        "from": s.get("name", ""),
        "to": r.get("name", ""),
        "user": s.get("name", ""),
        "amount": amount,
        "status": "success",
        "date": now_str,
        "time": now_str,
        "balance_after": safe_float(s.get("balance", 0)),
        "block_no": get_next_block_no(),
        "title": f"Sent to {r.get('name', 'User')}"
    }

    append_history(txn)

    return jsonify({
        "ok": True,
        "id": txn["id"],
        "reference": txn["reference"],
        "balance": safe_float(s.get("balance", 0)),
        "sender_balance": safe_float(s.get("balance", 0)),
        "receiver_balance": safe_float(r.get("balance", 0))
    })


# ---------------- RECHARGE ----------------

@app.route("/recharge", methods=["POST", "OPTIONS"])
@app.route("/api/recharge", methods=["POST", "OPTIONS"])
def recharge():
    if request.method == "OPTIONS":
        return jsonify({"ok": True}), 200

    data = get_request_json()
    print("[RECHARGE_REQUEST]", data)

    username = (data.get("user") or data.get("username") or data.get("name") or "").strip()
    number = str(data.get("mobile") or data.get("number") or "").strip()
    provider = (data.get("provider") or "").strip()
    plan = (data.get("plan") or "").strip()
    amount = safe_float(data.get("amount") or 0)
    incoming_txn_id = (data.get("txnId") or data.get("txn") or "").strip()
    incoming_time = (data.get("time") or data.get("date") or "").strip()

    users = read_json(USERS_FILE, [])
    u = find_user(users, username)

    if not username:
        return jsonify({"ok": False, "error": "Username is required"}), 400

    if not number:
        return jsonify({"ok": False, "error": "Mobile number is required"}), 400

    if len(number) != 10 or not number.isdigit():
        return jsonify({"ok": False, "error": "Enter valid 10 digit mobile number"}), 400

    if not provider:
        return jsonify({"ok": False, "error": "Provider is required"}), 400

    if amount <= 0:
        return jsonify({"ok": False, "error": "Amount must be greater than 0"}), 400

    if not u:
        return jsonify({"ok": False, "error": "User not found"}), 404

    current_balance = safe_float(u.get("balance", 0))

    if current_balance < amount:
        return jsonify({"ok": False, "error": "Insufficient balance"}), 400

    new_balance = current_balance - amount
    u["balance"] = new_balance
    write_json(USERS_FILE, users)

    txn_id = incoming_txn_id if incoming_txn_id else make_recharge_txn_id()
    now_str = incoming_time if incoming_time else datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    txn = {
        "type": "recharge",
        "id": txn_id,
        "reference": make_reference(txn_id),
        "hash": make_hash(txn_id),
        "sender": u.get("name", ""),
        "receiver": provider,
        "from": u.get("name", ""),
        "to": provider,
        "user": u.get("name", ""),
        "amount": amount,
        "status": "success",
        "date": now_str,
        "time": now_str,
        "balance_after": safe_float(new_balance),
        "block_no": get_next_block_no(),
        "title": "Mobile Recharge",
        "provider": provider,
        "number": number,
        "mobile": number,
        "plan": plan,
        "subtitle": f"{provider} • {number}",
        "desc": f"{provider} • {number}",
        "category": "recharge",
        "icon": "📱"
    }

    append_history(txn)

    print("[RECHARGE_OK]", {
        "user": username,
        "balance_after": new_balance,
        "txn_id": txn_id
    })

    return jsonify({
        "ok": True,
        "message": "Recharge successful",
        "id": txn["id"],
        "txnId": txn["id"],
        "reference": txn["reference"],
        "balance": safe_float(new_balance),
        "new_balance": safe_float(new_balance),
        "balanceAfter": safe_float(new_balance),
        "history_item": normalize_history_item(txn, username)
    })


# ---------------- HISTORY ----------------

@app.route("/api/history", methods=["GET"])
def history():
    history_items = read_json(HISTORY_FILE, [])
    normalized = [normalize_history_item(tx) for tx in history_items]
    normalized = sort_history_desc(normalized)

    return jsonify({
        "ok": True,
        "history": normalized
    })


@app.route("/api/history/<username>", methods=["GET"])
def history_by_user(username):
    user_history = get_user_history(username)

    return jsonify({
        "ok": True,
        "history": user_history
    })


@app.route("/history/<username>", methods=["GET"])
def history_by_user_plain(username):
    user_history = get_user_history(username)

    return jsonify({
        "ok": True,
        "history": user_history
    })


@app.route("/api/statement", methods=["GET"])
@app.route("/api/history-by-user", methods=["GET"])
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

@app.route("/api/addmoney", methods=["POST", "OPTIONS"])
@app.route("/api/add-money", methods=["POST", "OPTIONS"])
def addmoney():
    if request.method == "OPTIONS":
        return jsonify({"ok": True}), 200

    data = get_request_json()

    username = (data.get("username") or data.get("user") or data.get("name") or "").strip()
    amount = safe_float(data.get("amount") or 0)

    users = read_json(USERS_FILE, [])
    u = find_user(users, username)

    if not username:
        return jsonify({"ok": False, "error": "Username is required"}), 400

    if amount <= 0:
        return jsonify({"ok": False, "error": "Amount must be greater than 0"}), 400

    if not u:
        return jsonify({"ok": False, "error": "User not found"}), 404

    u["balance"] = safe_float(u.get("balance", 0)) + amount
    write_json(USERS_FILE, users)

    txn_id = make_txn_id()
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    txn = {
        "type": "deposit",
        "id": txn_id,
        "reference": make_reference(txn_id),
        "hash": make_hash(txn_id),
        "sender": "Self / Bank",
        "receiver": u.get("name", ""),
        "from": "Self / Bank",
        "to": u.get("name", ""),
        "user": u.get("name", ""),
        "amount": amount,
        "status": "success",
        "date": now_str,
        "time": now_str,
        "balance_after": safe_float(u.get("balance", 0)),
        "block_no": get_next_block_no(),
        "title": "Money added"
    }

    append_history(txn)

    return jsonify({
        "ok": True,
        "balance": safe_float(u.get("balance", 0)),
        "id": txn["id"],
        "reference": txn["reference"]
    })


# ---------------- DEBUG ----------------

@app.route("/api/debug/routes", methods=["GET"])
def debug_routes():
    routes = []
    for rule in app.url_map.iter_rules():
        routes.append({
            "route": str(rule),
            "methods": sorted(list(rule.methods))
        })

    return jsonify({
        "ok": True,
        "routes": routes
    })


# ---------------- FRONTEND FILE ROUTE ----------------

@app.route("/<path:path>", methods=["GET"])
def serve_file(path):
    if path.startswith("api/"):
        return jsonify({
            "ok": False,
            "message": "API route not found"
        }), 404

    file_path = os.path.join(FRONTEND_DIR, path)

    if os.path.exists(file_path) and os.path.isfile(file_path):
        return send_from_directory(FRONTEND_DIR, path)

    index_path = os.path.join(FRONTEND_DIR, "index.html")
    if os.path.exists(index_path):
        return send_from_directory(FRONTEND_DIR, "index.html")

    return jsonify({
        "ok": False,
        "message": "Frontend file not found",
        "frontend_dir": FRONTEND_DIR,
        "requested_path": path
    }), 404


# ---------------- RUN ----------------

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))

    print("===================================")
    print("ST PAY BACKEND STARTING...")
    print("BASE_DIR:", BASE_DIR)
    print("PROJECT_DIR:", PROJECT_DIR)
    print("FRONTEND_DIR:", FRONTEND_DIR)
    print("FRONTEND_EXISTS:", os.path.exists(FRONTEND_DIR))
    print("INDEX_EXISTS:", os.path.exists(os.path.join(FRONTEND_DIR, "index.html")))
    print("USERS_FILE:", USERS_FILE)
    print("USERS_EXISTS:", os.path.exists(USERS_FILE))
    print("HISTORY_FILE:", HISTORY_FILE)
    print("HISTORY_EXISTS:", os.path.exists(HISTORY_FILE))
    print("PORT:", port)
    print("===================================")

    app.run(
        host="0.0.0.0",
        port=port,
        debug=True
    )