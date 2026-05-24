from flask import Flask, jsonify, request, render_template, redirect, url_for, session
import joblib, warnings, json, os, hashlib, sqlite3, secrets
import pandas as pd
from functools import wraps
from src.data_preprocessing import load_data, preprocess_data

warnings.filterwarnings("ignore")

app = Flask(__name__)
app.secret_key = "criticalcare_secret_key_2026"

# ── Load model ────────────────────────────────────────────────────────────────
model = joblib.load("model.pkl")
print("[OK] model.pkl loaded — RandomForestClassifier")

# ── Patient name pool (20 patients) ───────────────────────────────────────────
NAMES = [
    "Ayush Sharma","Priya Mehta","Rohan Das","Sunita Patel",
    "Vikram Nair","Anjali Roy","Mohan Kumar","Deepa Joshi",
    "Sanjay Gupta","Kavitha Rao","Amit Verma","Neha Singh",
    "Ishaan Malhotra","Sanya Iyer","Arjun Reddy","Meera Kapoor",
    "Rahul Varma","Aditi Rao","Yash Bansal","Ananya Bir",
]

# ── User credentials (file-based) ────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_FILE = os.path.join(BASE_DIR, "criticalcare.db")
USERS_FILE = os.path.join(BASE_DIR, "users.json")
DATA_FILE = os.path.join(BASE_DIR, "data", "human_vital_signs_dataset_2024.csv")

def _get_db():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

def _hash_pw(password):
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 120000).hex()
    return f"pbkdf2_sha256${salt}${digest}"

def _verify_pw(password, stored_hash):
    if not stored_hash:
        return False
    if stored_hash.startswith("pbkdf2_sha256$"):
        _, salt, digest = stored_hash.split("$", 2)
        candidate = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 120000).hex()
        return secrets.compare_digest(candidate, digest)
    return secrets.compare_digest(hashlib.sha256(password.encode()).hexdigest(), stored_hash)

def init_auth_db():
    with _get_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        """)
        if os.path.exists(USERS_FILE):
            with open(USERS_FILE, "r") as f:
                old_users = json.load(f)
            for username, password_hash in old_users.items():
                conn.execute(
                    "INSERT OR IGNORE INTO users (username, password_hash) VALUES (?, ?)",
                    (username.strip().lower(), password_hash),
                )

def find_user(username):
    with _get_db() as conn:
        return conn.execute(
            "SELECT id, username, password_hash FROM users WHERE username = ?",
            (username.strip().lower(),),
        ).fetchone()

def create_user(username, password):
    with _get_db() as conn:
        conn.execute(
            "INSERT INTO users (username, password_hash) VALUES (?, ?)",
            (username.strip().lower(), _hash_pw(password)),
        )

init_auth_db()

# ── In-memory patient store ───────────────────────────────────────────────────
patients = {}


def build_features(v: dict) -> pd.DataFrame:
    hrv            = v["heart_rate"] if v["heart_rate"] else 0
    pulse_pressure = v["systolic_bp"] - v["diastolic_bp"]
    bmi            = v["weight_kg"] / (v["height_m"] ** 2) if v["height_m"] else 0
    map_           = (v["systolic_bp"] + 2 * v["diastolic_bp"]) / 3
    return pd.DataFrame([{
        "Heart Rate":               v["heart_rate"],
        "Respiratory Rate":         v["respiratory_rate"],
        "Body Temperature":         v["body_temperature"],
        "Oxygen Saturation":        v["oxygen_saturation"],
        "Systolic Blood Pressure":  v["systolic_bp"],
        "Diastolic Blood Pressure": v["diastolic_bp"],
        "Age":                      v["age"],
        "Gender":                   v["gender"],
        "Weight (kg)":              v["weight_kg"],
        "Height (m)":               v["height_m"],
        "Derived_HRV":              hrv,
        "Derived_Pulse_Pressure":   pulse_pressure,
        "Derived_BMI":              round(bmi, 4),
        "Derived_MAP":              round(map_, 4),
    }])


def run_model(v: dict) -> dict:
    df    = build_features(v)
    prob  = model.predict_proba(df)[0][1]
    score = int((1 - prob) * 100)
    if score >= 80:
        label, color = "Stable",   "green"
    elif score >= 50:
        label, color = "Moderate", "yellow"
    else:
        label, color = "Critical", "red"
    return {"score": score, "label": label, "color": color}


def prediction_from_features(features: pd.DataFrame) -> dict:
    prob = model.predict_proba(features)[0][1]
    score = int((1 - prob) * 100)
    if score >= 80:
        label, color = "Stable", "green"
    elif score >= 50:
        label, color = "Moderate", "yellow"
    else:
        label, color = "Critical", "red"
    return {"score": score, "label": label, "color": color}


def row_to_vitals(row: pd.Series) -> dict:
    return {
        "heart_rate":        float(row["Heart Rate"]),
        "respiratory_rate":  float(row["Respiratory Rate"]),
        "body_temperature":  round(float(row["Body Temperature"]), 2),
        "oxygen_saturation": round(float(row["Oxygen Saturation"]), 2),
        "systolic_bp":       float(row["Systolic Blood Pressure"]),
        "diastolic_bp":      float(row["Diastolic Blood Pressure"]),
        "age":               float(row["Age"]),
        "gender":            int(row["Gender"]),
        "weight_kg":         round(float(row["Weight (kg)"]), 2),
        "height_m":          round(float(row["Height (m)"]), 2),
    }


def load_dataset_patients() -> dict:
    df = preprocess_data(load_data(DATA_FILE))
    feature_cols = list(model.feature_names_in_)
    df = df.dropna(subset=feature_cols).reset_index(drop=True)
    selected = df.head(20).to_dict("records")

    loaded = {}
    for bed, row_dict in enumerate(selected, start=1):
        row = pd.Series(row_dict)
        features = row[feature_cols].to_frame().T
        pred = prediction_from_features(features)
        loaded[bed] = {
            "bed": bed,
            "source_patient_id": int(row["Patient ID"]),
            "name": NAMES[bed - 1],
            "vitals": row_to_vitals(row),
            "source": "data/human_vital_signs_dataset_2024.csv",
            **pred,
        }
    return loaded


# ── Initialise 20 beds ───────────────────────────────────────────────────────
patients = load_dataset_patients()


# ── Auth decorator ────────────────────────────────────────────────────────────
def login_required(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        if not session.get("logged_in"):
            return redirect(url_for("login_page"))
        return f(*args, **kwargs)
    return wrapper


# ── Routes ────────────────────────────────────────────────────────────────────
@app.route("/login")
def login_page():
    if session.get("logged_in"):
        return redirect(url_for("index"))
    return render_template("login.html")


@app.route("/register")
def register_page():
    if session.get("logged_in"):
        return redirect(url_for("index"))
    return render_template("register.html")


@app.route("/api/login", methods=["POST"])
def api_login():
    d = request.get_json()
    username = d.get("username", "").strip().lower()
    password = d.get("password", "")
    if not username or not password:
        return jsonify({"success": False, "error": "Please fill in all fields"}), 400
    user = find_user(username)
    if not user:
        return jsonify({"success": False, "error": "Account not found. Please register first."}), 401
    if not _verify_pw(password, user["password_hash"]):
        return jsonify({"success": False, "error": "Incorrect password"}), 401
    session["logged_in"] = True
    session["username"] = username
    session["user_id"] = user["id"]
    return jsonify({"success": True})


@app.route("/api/register", methods=["POST"])
def api_register():
    d = request.get_json()
    username = d.get("username", "").strip().lower()
    password = d.get("password", "")
    if not username or not password:
        return jsonify({"success": False, "error": "Please fill in all fields"}), 400
    if len(username) < 3:
        return jsonify({"success": False, "error": "Username must be at least 3 characters"}), 400
    if len(password) < 4:
        return jsonify({"success": False, "error": "Password must be at least 4 characters"}), 400
    if find_user(username):
        return jsonify({"success": False, "error": "Username already taken. Try logging in."}), 409
    create_user(username, password)
    user = find_user(username)
    session["logged_in"] = True
    session["username"] = username
    session["user_id"] = user["id"]
    return jsonify({"success": True})

@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("login_page"))


@app.route("/")
@login_required
def index():
    return render_template("index.html")


@app.route("/api/patients")
@login_required
def get_patients():
    return jsonify(list(patients.values()))


@app.route("/api/patient/<int:bed>")
@login_required
def get_patient(bed):
    p = patients.get(bed)
    if not p:
        return jsonify({"error": "Not found"}), 404
    return jsonify(p)


@app.route("/api/predict", methods=["POST"])
@login_required
def predict():
    d   = request.get_json()
    bed = int(d.get("bed", 0))
    if bed not in patients:
        return jsonify({"error": f"Bed {bed} not found"}), 404
    vitals = {
        "heart_rate":        float(d["heart_rate"]),
        "respiratory_rate":  float(d["respiratory_rate"]),
        "body_temperature":  float(d["body_temperature"]),
        "oxygen_saturation": float(d["oxygen_saturation"]),
        "systolic_bp":       float(d["systolic_bp"]),
        "diastolic_bp":      float(d["diastolic_bp"]),
        "age":               float(d["age"]),
        "gender":            int(d["gender"]),
        "weight_kg":         float(d["weight_kg"]),
        "height_m":          float(d["height_m"]),
    }
    pred = run_model(vitals)
    patients[bed].update({"vitals": vitals, **pred})
    return jsonify(patients[bed])


@app.route("/api/stats")
@login_required
def get_stats():
    vals = list(patients.values())
    stable   = [p for p in vals if p["label"] == "Stable"]
    moderate = [p for p in vals if p["label"] == "Moderate"]
    critical = [p for p in vals if p["label"] == "Critical"]

    def avg(lst, key):
        if not lst: return 0
        return round(sum(p["vitals"][key] for p in lst) / len(lst), 1)

    return jsonify({
        "total": len(vals),
        "stable": len(stable),
        "moderate": len(moderate),
        "critical": len(critical),
        "avg_score": round(sum(p["score"] for p in vals) / len(vals), 1) if vals else 0,
        "avg_hr": avg(vals, "heart_rate"),
        "avg_spo2": avg(vals, "oxygen_saturation"),
        "avg_temp": avg(vals, "body_temperature"),
        "avg_sbp": avg(vals, "systolic_bp"),
        "score_distribution": [p["score"] for p in sorted(vals, key=lambda x: x["bed"])],
    })

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
