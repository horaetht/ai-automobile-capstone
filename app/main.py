from flask import Flask, render_template, request
import pandas as pd

app = Flask(__name__)

def load_dataset():
    return pd.read_csv("data/symptom_problem_dataset.csv")

def check_symptom(user_input):
    df = load_dataset()
    user_input = user_input.lower()

    for _, row in df.iterrows():
        if row["symptom"].lower() in user_input or user_input in row["symptom"].lower():
            return {
                "possible_issue": row["possible_issue"],
                "urgency": row["urgency"],
                "recommended_next_step": row["recommended_next_step"]
            }

    return {
        "possible_issue": "Unknown issue",
        "urgency": "Unknown",
        "recommended_next_step": "Please consult a mechanic for further inspection."
    }

@app.route("/", methods=["GET", "POST"])
def index():
    if request.method == "POST":
        symptom = request.form.get("symptom", "")
        result = check_symptom(symptom)
        return render_template("result.html", symptom=symptom, result=result)

    return render_template("index.html")

if __name__ == "__main__":
    app.run(debug=True)