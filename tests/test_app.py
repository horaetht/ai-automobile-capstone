"""Automated tests for the Online Garage Flask app.

Every test uses temporary CSV files (via the `client` fixture below) so the
real files under data/ are never read from or written to, except for the
read-only symptom dataset which is safe to read directly.
"""
from pathlib import Path

import pytest

from app import main as app_main

REPO_ROOT = Path(__file__).resolve().parent.parent
REAL_SYMPTOM_DATASET = REPO_ROOT / "data" / "symptom_problem_dataset.csv"

VEHICLES_HEADER = "id,year,make,model,mileage,vin,status,battery_voltage,fuel_level,engine_temperature,dtc_code,last_synced_at\n"
SEED_VEHICLE_ROW = "bmw_335i,2009,BMW,335i,44859.0,N/A,Active Garage Vehicle,13.25,23.0,194,,\n"

MAINTENANCE_HEADER = "Vehicle_ID,Date,Mileage,Description,Replaced Parts,Notes\n"
LOGS_HEADER = "timestamp,vehicle_id,mileage,battery_voltage,fuel_level,engine_temperature,dtc_code\n"


@pytest.fixture
def client(tmp_path, monkeypatch):
    """Flask test client backed by throwaway CSV files in a temp directory."""
    vehicles_csv = tmp_path / "vehicles.csv"
    vehicles_csv.write_text(VEHICLES_HEADER + SEED_VEHICLE_ROW)

    maintenance_csv = tmp_path / "maintenance_records.csv"
    maintenance_csv.write_text(MAINTENANCE_HEADER)

    logs_csv = tmp_path / "vehicle_data_logs.csv"
    logs_csv.write_text(LOGS_HEADER)

    monkeypatch.setattr(app_main, "VEHICLES_CSV", str(vehicles_csv))
    monkeypatch.setattr(app_main, "MAINTENANCE_CSV", str(maintenance_csv))
    monkeypatch.setattr(app_main, "VEHICLE_LOGS_CSV", str(logs_csv))
    monkeypatch.setattr(app_main, "SYMPTOM_DATASET_CSV", str(REAL_SYMPTOM_DATASET))

    app_main.app.config.update(TESTING=True)
    with app_main.app.test_client() as test_client:
        test_client.vehicles_csv_path = vehicles_csv
        yield test_client


def valid_vehicle_form(**overrides):
    form = {
        "year": "2021",
        "make": "  Honda  ",
        "model": "  Civic  ",
        "mileage": "15000",
        "vin": "1HGBH41JXMN109186",
    }
    form.update(overrides)
    return form


def test_home_page_returns_200(client):
    response = client.get("/")
    assert response.status_code == 200


def test_vehicles_page_returns_200(client):
    response = client.get("/vehicles")
    assert response.status_code == 200


def test_dashboard_returns_200(client):
    response = client.get("/dashboard")
    assert response.status_code == 200


def test_symptom_checker_get_returns_200(client):
    response = client.get("/symptom-checker")
    assert response.status_code == 200


def test_symptom_checker_valid_post_returns_diagnosis(client):
    response = client.post("/symptom-checker", data={"symptom": "car overheating"})
    assert response.status_code == 200
    assert b"Cooling system issue" in response.data


def test_valid_vehicle_submission_creates_vehicle(client):
    response = client.post("/vehicles", data=valid_vehicle_form(), follow_redirects=True)
    assert response.status_code == 200
    assert b"Honda" in response.data
    assert b"Civic" in response.data

    csv_content = client.vehicles_csv_path.read_text()
    assert csv_content.count("\n") == 3  # header + seed row + new row


def test_vehicle_submission_missing_required_field_shows_error(client):
    response = client.post("/vehicles", data=valid_vehicle_form(make=""))
    assert response.status_code == 200
    assert b"Make is required" in response.data

    csv_content = client.vehicles_csv_path.read_text()
    assert csv_content.count("\n") == 2  # header + seed row only, nothing added


def test_vehicle_submission_invalid_year_does_not_crash(client):
    response = client.post("/vehicles", data=valid_vehicle_form(year="not-a-year"))
    assert response.status_code == 200
    assert b"Year must be" in response.data


def test_vehicle_submission_invalid_mileage_does_not_crash(client):
    response = client.post("/vehicles", data=valid_vehicle_form(mileage="not-a-number"))
    assert response.status_code == 200
    assert b"Mileage must be" in response.data


def test_vehicle_submission_negative_mileage_rejected(client):
    response = client.post("/vehicles", data=valid_vehicle_form(mileage="-10"))
    assert response.status_code == 200
    assert b"Mileage cannot be negative" in response.data


def test_vehicle_submission_out_of_range_year_rejected(client):
    response = client.post("/vehicles", data=valid_vehicle_form(year="1800"))
    assert response.status_code == 200
    assert b"Year must be" in response.data


def test_vehicle_submission_invalid_vin_length_rejected(client):
    response = client.post("/vehicles", data=valid_vehicle_form(vin="SHORTVIN"))
    assert response.status_code == 200
    assert b"VIN must be exactly 17 characters" in response.data


def test_invalid_vehicle_id_handled_safely(client):
    response = client.get("/dashboard?vehicle_id=does_not_exist")
    assert response.status_code == 404
    assert b"not found" in response.data.lower()
    assert b"My Garage" in response.data


def test_invalid_vehicle_id_maintenance_handled_safely(client):
    response = client.get("/maintenance?vehicle_id=does_not_exist")
    assert response.status_code == 404
    assert b"not found" in response.data.lower()


def test_vehicle_sync_returns_404_for_unknown_vehicle(client):
    response = client.post("/api/vehicles/does_not_exist/sync")
    assert response.status_code == 404
    assert response.get_json()["error"] == "Vehicle not found"
