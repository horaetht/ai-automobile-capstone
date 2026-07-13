# Online Garage with AI Symptom Checker

Online Garage with AI Symptom Checker is a web-based capstone project designed to help users manage basic vehicle issues, understand common car symptoms, and keep track of maintenance records.

The project started as a standalone AI vehicle symptom checker, but it has been redefined into a broader online garage platform. The symptom checker is now one core feature inside the larger system.

## Project Overview

Many drivers experience vehicle problems but do not always understand what the symptoms mean. For example, a car may shake, make unusual noises, overheat, or show a warning light. Drivers may not know whether the issue is urgent or what action they should take next.

This project provides a simple online platform where users can:

- Manage multiple vehicles in a personal garage
- Check possible vehicle issues based on symptoms
- View urgency levels and recommended next steps
- Track maintenance records per vehicle
- Review simulated live telemetry for a vehicle

The goal is not to replace a professional mechanic. Instead, the platform gives users a clearer starting point before they seek professional repair or maintenance support.

## Implemented Features (Current State)

- **Homepage** — introduces the platform and links to My Garage and the Symptom Checker.
- **My Garage (multi-vehicle management)** — lists every vehicle stored in `data/vehicles.csv` and includes a form to add a new vehicle.
- **Add Vehicle form** — creates a new vehicle record with backend-validated year, make, model, mileage, and an optional VIN.
- **Vehicle-specific dashboard** — shows details and live telemetry for a single selected vehicle (`/dashboard?vehicle_id=...`).
- **Maintenance Log tied to a vehicle** — view and add service records scoped to the selected vehicle (`/maintenance?vehicle_id=...`).
- **Rule-based Symptom Checker** — matches a typed-in symptom against a CSV-based lookup table and returns a possible issue, urgency, and recommended next step.
- **Simulated telemetry synchronization** — `POST /api/vehicles/<vehicle_id>/sync` generates randomized mileage, battery voltage, fuel level, engine temperature, and diagnostic trouble codes to emulate a telemetry feed, and logs each sync to `data/vehicle_data_logs.csv`.
- **CSV-based storage** — vehicles, maintenance records, telemetry sync history, and the symptom dataset are all stored as CSV files under `data/`; no database is used.
- **Backend input validation** — the Add Vehicle form validates required fields, numeric ranges, and VIN length on the server, independent of HTML form validation.
- **Safe handling of invalid/missing vehicle IDs** — the dashboard and maintenance log show a clear "vehicle not found" page with a link back to My Garage instead of crashing or displaying misleading placeholder data.
- **Automated tests** — `tests/test_app.py` covers the core routes, valid/invalid vehicle submissions, invalid vehicle ID handling, and the sync API, using temporary CSV files so the real data is never modified by test runs.

## Current Limitations

- The symptom checker uses simple substring matching against a small, static CSV dataset — it is **not** a real AI model and does not use any external AI or LLM API.
- Vehicle telemetry (mileage, battery voltage, fuel level, engine temperature, diagnostic codes) is **simulated** with randomized values. There is no integration with real OBD-II hardware or any real connected-vehicle API.
- Data is stored in flat CSV files with no database, no authentication, and no per-user accounts — all vehicles are visible to anyone who opens the app.
- There is no login system, so garage data is shared/global rather than tied to an individual user.

## Future Work

The following are considered future enhancements and are **not** part of the current implementation:

- User login / authentication system
- A real database (e.g., SQLite or PostgreSQL) in place of CSV files
- Integration with a real AI/LLM API for more natural-language symptom interpretation
- Real OBD-II or connected-vehicle API integration in place of simulated telemetry
- Booking appointments, mechanic accounts, or marketplace features

## Technology Stack

- Python
- Flask
- Pandas (CSV read/write)
- HTML, CSS, JavaScript
- CSV files for data storage
- pytest (automated testing)
- Git and GitHub for version control

## Project Structure

```text
ai-automobile-capstone/
│
├── app/
│   ├── main.py                    # Flask routes and application logic
│   ├── services/
│   │   └── vehicle_sync.py        # Simulated vehicle telemetry data provider
│   ├── templates/
│   │   ├── home.html
│   │   ├── vehicles.html          # My Garage: vehicle list + Add Vehicle form
│   │   ├── dashboard.html         # Vehicle-specific dashboard + live telemetry
│   │   ├── maintenance_log.html   # Maintenance records for a selected vehicle
│   │   ├── vehicle_not_found.html # Safe fallback for invalid/missing vehicle IDs
│   │   ├── index.html             # Symptom checker input form
│   │   └── result.html            # Symptom checker diagnosis result
│   └── static/
│       ├── css/
│       │   └── style.css
│       └── js/
│           └── script.js
│
├── data/
│   ├── vehicles.csv               # Vehicle records (My Garage)
│   ├── maintenance_records.csv    # Maintenance log entries
│   ├── vehicle_data_logs.csv      # Historical telemetry sync log
│   └── symptom_problem_dataset.csv
│
├── tests/
│   └── test_app.py                # pytest test suite (uses temporary CSV files)
│
├── docs/
├── README.md
├── requirements.txt
└── .gitignore
```

## Running the App

```bash
pip install -r requirements.txt
python -m flask --app app.main run
```

Then open `http://127.0.0.1:5000/` in a browser.

## Running the Tests

```bash
pytest
```

Tests use temporary CSV files (via pytest fixtures) and never read from or write to the real files in `data/`, with the exception of the read-only symptom dataset.
