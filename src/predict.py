import joblib
import pandas as pd

# load model
model = joblib.load("model.pkl")

# load data
df = pd.read_csv("data/human_vital_signs_dataset_2024.csv")

# 🔥 EXACT SAME FEATURES (IMPORTANT)
columns = [
    'Heart Rate',
    'Respiratory Rate',
    'Body Temperature',
    'Oxygen Saturation',
    'Systolic Blood Pressure',
    'Diastolic Blood Pressure',
    'Age',
    'Gender',
    'Weight (kg)',
    'Height (m)',
    'Derived_HRV',
    'Derived_Pulse_Pressure',
    'Derived_BMI',
    'Derived_MAP'
]

# 🔥 sirf required columns hi lo
df = df[columns]

# sirf 30 patients
df = df.head(30)

for i in range(len(df)):

    # 🔥 yaha fix hai
    data = df.iloc[[i]]   # double bracket → DataFrame

    prob = model.predict_proba(data)[0][1]

    score = int((1 - prob) * 100)

    if score >= 80:
        status = "Stable 🟢"
    elif score >= 50:
        status = "Moderate 🟡"
    else:
        status = "Critical 🔴"

    print(f"Patient {i+1} → Score: {score}% → {status}")