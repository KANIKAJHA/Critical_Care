from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
import joblib

def train_model(df):

    X = df.drop(["Risk Category", "Patient ID" ], axis=1)
    y = df["Risk Category"]

    # Split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )

    # Model
    model = RandomForestClassifier(
    n_estimators=100,
    max_depth=5,
    random_state=42
    )
    model.fit(X_train, y_train)
    # Save model
    joblib.dump(model, "model.pkl")

    return model, X_test, y_test