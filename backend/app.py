from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import os, json, tempfile
from datetime import datetime

# ---------------- PATHS ----------------

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(BASE_DIR)

FRONTEND_DIR = os.path.join(PROJECT_DIR, "frontend")

USERS_FILE = os.path.join(BASE_DIR, "users.json")
HISTORY_FILE = os.path.join(BASE_DIR, "history.json")

# ---------------- APP ----------------

app = Flask(__name__, static_folder=None)

# ✅ CORS: allow all (demo). For production you can restrict origins.
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
    """
    ✅ Atomic write: prevents corrupted JSON if Render restarts mid-write
    """
    folder = os.path.dirname(path)
    os.makedirs(folder, exist_ok=True)

    fd, tmp_path = tempfile.mkstemp(prefix="tmp_", suffix=".json", dir=folder)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
        os.replace(tmp_path, path)
    finally:
        try:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
        except:
            pass

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

def norm_name(name: str) -> str:
    return (name or "").strip()

def find_user(users, name):
    name = (name or "").lower().strip()
    for u in users:
        if (u.get("name") or "").lower().strip() == name:
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

# ---------------- SIGNUP (UNLIMITED USERS) ----------------

@app.post("/api/signup")
def signup():
    data = request.get_json(force=True)

    name = norm_name(data.get("name"))
    password = norm_name(data.get("password"))

    if not name or not password:
        return jsonify({"error": "Name and password required"}), 400

    # Optional: block very short password
    if len(password) < 3:
        return jsonify({"error": "Password too short"}), 400

    users = read_json(USERS_FILE, [])

    if find_user(users, name):
        return jsonify({"error": "User already exists"}), 409

    # ✅ create user
    new_user = {
        "name": name,
        "password": password,
        "balance": 0
    }

    users.append(new_user)
    write_json(USERS_FILE, users)

    return jsonify({"ok": True, "name": name, "balance": 0})

# ---------------- LOGIN ----------------

@app.post("/api/login")
def login():
    data = request.get_json(force=True)

    name = norm_name(data.get("name"))
    password = norm_name(data.get("password"))

    users = read_json(USERS_FILE, [])
    u = find_user(users, name)

    if not u or (u.get("password") or "") != password:
        return jsonify({"error": "Invalid credentials"}), 401

    return jsonify({
        "ok": True,
        "name": u["name"],
        "balance": u.get("balance", 0)
    })

# ---------------- USERS ----------------

@app.get("/api/users")
def users():
    users = read_json(USERS_FILE, [])
    safe = []
    for u in users:
        safe.append({
            "name": u.get("name", ""),
            "balance": u.get("balance", 0)
        })
    return jsonify({"ok": True, "users": safe})

# ---------------- BALANCE ----------------

@app.get("/api/balance/<username>")
def balance(username):
    users = read_json(USERS_FILE, [])
    u = find_user(users, username)

    if not u:
        return jsonify({"error": "User not found"}), 404

    return jsonify({"ok": True, "balance": u.get("balance", 0)})

# ---------------- SEND MONEY ----------------
# ✅ support both /send and /api/send

@app.post("/send")
@app.post("/api/send")
def send():
    data = request.get_json(force=True)

    sender = norm_name(data.get("sender"))
    receiver = norm_name(data.get("receiver"))

    try:
        amount = float(data.get("amount"))
    except:
        amount = 0.0

    if amount <= 0:
        return jsonify({"error": "Invalid amount"}), 400

    users = read_json(USERS_FILE, [])

    s = find_user(users, sender)
    r = find_user(users, receiver)

    if not s:
        return jsonify({"error": "Sender not found"}), 404

    if not r:
        return jsonify({"error": "Receiver not found"}), 404

    if float(s.get("balance", 0)) < amount:
        return jsonify({"error": "Insufficient balance"}), 400

    s["balance"] = float(s.get("balance", 0)) - amount
    r["balance"] = float(r.get("balance", 0)) + amount

    write_json(USERS_FILE, users)

    history = read_json(HISTORY_FILE, [])

    now = datetime.now()
    txn = {
        "type": "pay",
        "id": "TXN" + now.strftime("%Y%m%d%H%M%S") + str(int(now.microsecond/1000)).zfill(3),
        "sender": s["name"],
        "receiver": r["name"],
        "amount": amount,
        "date": now.strftime("%Y-%m-%d %H:%M:%S")
    }

    history.append(txn)
    write_json(HISTORY_FILE, history)

    return jsonify({
        "ok": True,
        "id": txn["id"],
        "sender_balance": s["balance"],
        "receiver_balance": r["balance"]
    })

# ---------------- HISTORY ----------------

@app.get("/api/history")
def history():
    history = read_json(HISTORY_FILE, [])
    return jsonify({"ok": True, "history": history})

# ---------------- ADD MONEY ----------------

@app.post("/api/addmoney")
def addmoney():
    data = request.get_json(force=True)

    username = norm_name(data.get("username"))
    try:
        amount = float(data.get("amount"))
    except:
        amount = 0.0

    if amount <= 0:
        return jsonify({"error": "Invalid amount"}), 400

    users = read_json(USERS_FILE, [])
    u = find_user(users, username)

    if not u:
        return jsonify({"error": "User not found"}), 404

    u["balance"] = float(u.get("balance", 0)) + amount
    write_json(USERS_FILE, users)

    return jsonify({"ok": True, "balance": u["balance"]})

# ---------------- RUN ----------------

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)