import joblib
import pandas as pd

# load model
model = joblib.load("model.pkl")

# load data
df = pd.read_csv("data/human_vital_signs_dataset_2024.csv")

# preprocessing SAME as training
df = df.drop(columns=["Timestamp"], errors='ignore')
df['Gender'] = df['Gender'].map({'Male': 0, 'Female': 1})

# features
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

df = df[columns].head(30)

print("\n--- PATIENT RESULTS ---\n")

for i in range(len(df)):

    row = df.iloc[i]
    data = df.iloc[[i]]

    # 🔥 ML prediction
    prob = model.predict_proba(data)[0][1]
    score = int((1-prob) * 100)

    # 🔥 REASONS (doctor logic)
    reasons = []

    if row["Oxygen Saturation"] < 90:
        reasons.append("Low Oxygen")

    if row["Respiratory Rate"] > 30:
        reasons.append("High Breathing Rate")

    if row["Heart Rate"] > 120:
        reasons.append("High Heart Rate")

    if row["Systolic Blood Pressure"] < 90:
        reasons.append("Low BP")

    # 🔥 STATUS DECISION (HYBRID)
    if len(reasons) > 0:
        status = "Critical 🔴"
    else:
        if score >= 70:
            status = "Stable 🟢"
        elif score >= 40:
            status = "Moderate 🟡"
        else:
            status = "Critical 🔴"
    print(f"Patient {i+1}")
    print(f"Score: {score}%")
    print(f"Status: {status}")

    # 🔥 VITALS SHOW (UI style)
    print(f"Heart Rate: {int(row['Heart Rate'])} bpm")
    print(f"SpO2: {row['Oxygen Saturation']} %")
    print(f"BP: {int(row['Systolic Blood Pressure'])}/{int(row['Diastolic Blood Pressure'])}")
    print(f"Temperature: {round(row['Body Temperature'], 1)} °C")

    print("----------------------")