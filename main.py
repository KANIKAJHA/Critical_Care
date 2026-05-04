from src.data_preprocessing import load_data, preprocess_data
from src.train_model import train_model
from src.evaluate_model import evaluate

df = load_data("data/human_vital_signs_dataset_2024.csv")

df = preprocess_data(df)

model, X_test, y_test = train_model(df)

evaluate(model, X_test, y_test)