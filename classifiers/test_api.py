# ============================================================
# tests/test_api.py
# ============================================================
# Start server first:  uvicorn src.serve:app --port 8000
# Then run:            python tests/test_api.py
# ============================================================

import json
import urllib.request
import urllib.error

BASE = "http://localhost:8000"

def post(endpoint, payload):
    data = json.dumps(payload).encode()
    req  = urllib.request.Request(
        f"{BASE}{endpoint}", data=data,
        headers={"Content-Type": "application/json"}, method="POST"
    )
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())

def get(endpoint):
    with urllib.request.urlopen(f"{BASE}{endpoint}") as r:
        return json.loads(r.read())

def run_test(name, fn):
    try:
        result = fn()
        print(f"  ✅  {name}")
        return result
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f"  ❌  {name}  →  HTTP {e.code}: {body[:200]}")
        return None
    except Exception as e:
        print(f"  ❌  {name}  →  {e}")
        return None

# ── Sample patients ──────────────────────────────────────────
HIGH_RISK = {
    "age": 62, "gender": "Male", "bmi": 31.2,
    "resting_hr": 95, "systolic_bp": 158, "diastolic_bp": 98,
    "cholesterol": 290, "glucose": 115,
    "smoker": 1, "cigsperday": 20,
    "hypertension": 1, "diabetes": 1,
    "bp_medication": 1, "prev_stroke": 0,
}
LOW_RISK = {
    "age": 28, "gender": "Female", "bmi": 21.5,
    "resting_hr": 62, "systolic_bp": 110, "diastolic_bp": 70,
    "cholesterol": 175, "glucose": 82,
    "smoker": 0, "cigsperday": 0,
    "hypertension": 0, "diabetes": 0,
    "bp_medication": 0, "prev_stroke": 0,
}
MISSING_CLINICAL = {
    # User doesn't know clinical values — all set to None
    "age": 45, "gender": "Male", "bmi": 27.0,
    "resting_hr": None, "systolic_bp": None,
    "diastolic_bp": None, "cholesterol": None, "glucose": None,
    "smoker": 1, "cigsperday": 10,
    "hypertension": 0, "diabetes": 0,
    "bp_medication": 0, "prev_stroke": 0,
}

print("\n" + "="*50)
print("Prosper API Test Suite")
print("="*50)

# ── 1. Meta endpoints ────────────────────────────────────────
print("\n[1] Meta endpoints")

r = run_test("GET /health", lambda: get("/health"))
if r:
    # Print whatever keys the server returns — works with any serve.py version
    for k, v in r.items():
        print(f"       {k}: {v}")

r = run_test("GET /model-info", lambda: get("/model-info"))
if r:
    for k, v in r.items():
        print(f"       {k}: {v}")

# ── 2. High risk ─────────────────────────────────────────────
print("\n[2] High-risk patient (62yo male, smoker, hypertensive, diabetic)")
r = run_test("POST /predict", lambda: post("/predict", HIGH_RISK))
if r:
    print(f"       probability : {r['risk_probability']}")
    print(f"       category    : {r['risk_category']}")
    print(f"       at_risk     : {r['at_risk']}")
    if "top_factors" in r:
        print(f"       top factors :")
        for f in r["top_factors"]:
            direction = f.get("direction", "")
            print(f"         {f['feature']:20s}  impact={f['impact']:+.4f}  {direction}")

# ── 3. Low risk ──────────────────────────────────────────────
print("\n[3] Low-risk patient (28yo female, healthy)")
r = run_test("POST /predict", lambda: post("/predict", LOW_RISK))
if r:
    print(f"       probability : {r['risk_probability']}")
    print(f"       category    : {r['risk_category']}")
    print(f"       at_risk     : {r['at_risk']}")

# ── 4. Missing clinical values ───────────────────────────────
print("\n[4] Missing clinical values (imputation test)")
r = run_test("POST /predict", lambda: post("/predict", MISSING_CLINICAL))
if r:
    print(f"       probability : {r['risk_probability']}")
    print(f"       category    : {r['risk_category']}")
    print(f"       ✅ Imputation worked — no crash with null values")

# ── 5. Validation errors (should be rejected) ────────────────
print("\n[5] Input validation — bad inputs should return HTTP 422")

def expect_rejection(name, payload):
    try:
        post("/predict", payload)
        print(f"  ❌  {name} — should have been rejected but wasn't")
    except urllib.error.HTTPError as e:
        if e.code == 422:
            print(f"  ✅  {name} correctly rejected (HTTP 422)")
        else:
            print(f"  ⚠️  {name} rejected with unexpected HTTP {e.code}")

expect_rejection("gender='Other'",  {**LOW_RISK, "gender": "Other"})
expect_rejection("age=999",         {**LOW_RISK, "age": 999})
expect_rejection("bmi=5 (too low)", {**LOW_RISK, "bmi": 5})

# ── 6. Full response dump ────────────────────────────────────
print("\n[6] Full response for high-risk patient:")
r = run_test("POST /predict (full dump)", lambda: post("/predict", HIGH_RISK))
if r:
    print(json.dumps(r, indent=6))

print("\n" + "="*50)
print("Tests complete.")
print("="*50 + "\n")