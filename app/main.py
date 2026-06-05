from flask import Flask, render_template, request, jsonify, redirect, url_for
import pandas as pd
import re
import time
from app.services.vehicle_sync import SimulatedVehicleDataProvider

app = Flask(__name__)

def load_vehicle(vehicle_id):
    """Load vehicle data from CSV."""
    try:
        df = pd.read_csv("data/vehicles.csv")
        vehicle = df[df["id"] == vehicle_id]
        if not vehicle.empty:
            return vehicle.iloc[0].to_dict()
        return None
    except FileNotFoundError:
        return None

def save_vehicle(vehicle_data):
    """Update vehicle record with new telemetry data."""
    try:
        df = pd.read_csv("data/vehicles.csv")
    except FileNotFoundError:
        df = pd.DataFrame(columns=["id", "year", "make", "model", "mileage", "battery_voltage", "fuel_level", "engine_temperature", "dtc_code", "last_synced_at"])

    # Update or insert vehicle record
    df = df[df["id"] != vehicle_data["id"]]
    df = pd.concat([df, pd.DataFrame([vehicle_data])], ignore_index=True)
    df.to_csv("data/vehicles.csv", index=False)

def log_vehicle_sync(vehicle_id, sync_data):
    """Log vehicle telemetry sync to history."""
    try:
        df = pd.read_csv("data/vehicle_data_logs.csv")
    except FileNotFoundError:
        df = pd.DataFrame(columns=["timestamp", "vehicle_id", "mileage", "battery_voltage", "fuel_level", "engine_temperature", "dtc_code"])

    log_entry = {
        "timestamp": sync_data.get("last_synced_at"),
        "vehicle_id": vehicle_id,
        "mileage": sync_data.get("mileage"),
        "battery_voltage": sync_data.get("battery_voltage"),
        "fuel_level": sync_data.get("fuel_level"),
        "engine_temperature": sync_data.get("engine_temperature"),
        "dtc_code": sync_data.get("dtc_code") or ""
    }
    df = pd.concat([df, pd.DataFrame([log_entry])], ignore_index=True)
    df.to_csv("data/vehicle_data_logs.csv", index=False)

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

def load_maintenance_records(vehicle_id):
    try:
        df = pd.read_csv("data/maintenance_records.csv")
        vehicle_records = df[df["Vehicle_ID"] == vehicle_id]
        return vehicle_records.to_dict('records')
    except FileNotFoundError:
        return []

def save_maintenance_record(vehicle_id, date, mileage, description, parts, notes):
    try:
        df = pd.read_csv("data/maintenance_records.csv")
    except FileNotFoundError:
        df = pd.DataFrame(columns=["Vehicle_ID", "Date", "Mileage", "Description", "Replaced Parts", "Notes"])

    new_record = {
        "Vehicle_ID": vehicle_id,
        "Date": date,
        "Mileage": mileage,
        "Description": description,
        "Replaced Parts": parts,
        "Notes": notes
    }
    df = pd.concat([df, pd.DataFrame([new_record])], ignore_index=True)
    df.to_csv("data/maintenance_records.csv", index=False)

def create_vehicle_id(year, make, model):
    raw = f"{make}_{model}_{year}".lower()
    safe = re.sub(r"[^a-z0-9_]", "_", raw)
    safe = re.sub(r"_+", "_", safe).strip("_")
    return f"{safe}_{int(time.time())}"

def save_new_vehicle(vehicle_data):
    try:
        df = pd.read_csv("data/vehicles.csv")
    except FileNotFoundError:
        df = pd.DataFrame(columns=["id", "year", "make", "model", "mileage", "battery_voltage", "fuel_level", "engine_temperature", "dtc_code", "last_synced_at"])
    df = pd.concat([df, pd.DataFrame([vehicle_data])], ignore_index=True)
    df.to_csv("data/vehicles.csv", index=False)

@app.route("/")
def home():
    return render_template("home.html")

@app.route("/vehicles", methods=["GET", "POST"])
def vehicles():
    error = None
    if request.method == "POST":
        year = request.form.get("year", "").strip()
        make = request.form.get("make", "").strip()
        model = request.form.get("model", "").strip()
        mileage = request.form.get("mileage", "").strip()
        vin = request.form.get("vin", "").strip()

        if not year or not make or not model or not mileage:
            error = "Year, Make, Model, and Mileage are required."
        else:
            vehicle_id = create_vehicle_id(year, make, model)
            new_vehicle = {
                "id": vehicle_id,
                "year": int(year),
                "make": make,
                "model": model,
                "mileage": float(mileage),
                "battery_voltage": 12.6,
                "fuel_level": 50,
                "engine_temperature": 180,
                "dtc_code": "",
                "last_synced_at": ""
            }
            save_new_vehicle(new_vehicle)
            return redirect(url_for("vehicles"))

    try:
        df = pd.read_csv("data/vehicles.csv")
        vehicles_list = df.to_dict('records')
    except FileNotFoundError:
        vehicles_list = []
    return render_template("vehicles.html", vehicles=vehicles_list, error=error)

@app.route("/dashboard")
def dashboard():
    vehicle_id = request.args.get("vehicle_id", "bmw_335i")
    vehicle_data = load_vehicle(vehicle_id)
    return render_template("dashboard.html", vehicle_data=vehicle_data)

@app.route("/symptom-checker", methods=["GET", "POST"])
def index():
    if request.method == "POST":
        symptom = request.form.get("symptom", "")
        result = check_symptom(symptom)
        return render_template("result.html", symptom=symptom, result=result)

    return render_template("index.html")

@app.route("/maintenance", methods=["GET", "POST"])
def maintenance():
    if request.method == "POST":
        vehicle_id = request.form.get("vehicle_id", "bmw_335i")
        date = request.form.get("date", "")
        mileage = request.form.get("mileage", "")
        description = request.form.get("description", "")
        parts = request.form.get("parts", "")
        notes = request.form.get("notes", "")

        if date and mileage and description:
            save_maintenance_record(vehicle_id, date, mileage, description, parts, notes)
    else:
        vehicle_id = request.args.get("vehicle_id", "bmw_335i")

    vehicle = load_vehicle(vehicle_id)
    if vehicle is None:
        vehicle = {"id": vehicle_id, "year": "Unknown", "make": "Unknown", "model": "Unknown", "mileage": "N/A"}
    vehicle.setdefault("status", "Active Garage Vehicle")
    vehicle.setdefault("vin", "N/A")

    records = load_maintenance_records(vehicle_id)
    return render_template("maintenance_log.html", records=records, vehicle=vehicle)

@app.route("/api/vehicles/<vehicle_id>/sync", methods=["POST"])
def sync_vehicle_data(vehicle_id):
    """API endpoint to sync vehicle telemetry data."""
    vehicle_data = load_vehicle(vehicle_id)
    if not vehicle_data:
        return jsonify({"error": "Vehicle not found"}), 404

    current_mileage = float(vehicle_data.get("mileage", 0))
    current_fuel = float(vehicle_data.get("fuel_level", 50))

    # Generate simulated telemetry data
    sync_data = SimulatedVehicleDataProvider.generate_sync_data(current_mileage, current_fuel)

    # Prepare updated vehicle record
    updated_vehicle = {
        "id": vehicle_id,
        "year": vehicle_data["year"],
        "make": vehicle_data["make"],
        "model": vehicle_data["model"],
        "mileage": sync_data["mileage"],
        "battery_voltage": sync_data["battery_voltage"],
        "fuel_level": sync_data["fuel_level"],
        "engine_temperature": sync_data["engine_temperature"],
        "dtc_code": sync_data["dtc_code"] or "",
        "last_synced_at": sync_data["last_synced_at"]
    }

    # Save updated vehicle data and log the sync
    save_vehicle(updated_vehicle)
    log_vehicle_sync(vehicle_id, sync_data)

    return jsonify({
        "status": "success",
        "message": "Vehicle data synced successfully",
        "data": {
            "mileage": updated_vehicle["mileage"],
            "battery_voltage": updated_vehicle["battery_voltage"],
            "fuel_level": updated_vehicle["fuel_level"],
            "engine_temperature": updated_vehicle["engine_temperature"],
            "dtc_code": updated_vehicle["dtc_code"],
            "last_synced_at": updated_vehicle["last_synced_at"]
        }
    }), 200

if __name__ == "__main__":
    app.run(debug=True)
