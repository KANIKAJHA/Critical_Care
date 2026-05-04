import pandas as pd

def load_data(path):
    df = pd.read_csv(path)
    return df

def preprocess_data(df):
    
    # Drop unnecessary columns
    df = df.drop(columns=["Timestamp"], errors='ignore')

    # Convert Gender
    df['Gender'] = df['Gender'].map({'Male': 0, 'Female': 1})

    # Convert Risk Category (Target)
    df['Risk Category'] = df['Risk Category'].map({
        'Low Risk': 0,
        'High Risk': 1
    })

    # Remove null rows (important)
    df = df.dropna()

    return df