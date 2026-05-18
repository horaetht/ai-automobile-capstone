# Online Garage with AI Symptom Checker

Online Garage with AI Symptom Checker is a web-based capstone project designed to help users manage basic vehicle issues, understand common car symptoms, and keep track of maintenance records.

The project started as a standalone AI vehicle symptom checker, but it has been redefined into a broader online garage platform. The AI symptom checker is now one core feature inside the larger system.

## Project Overview

Many drivers experience vehicle problems but do not always understand what the symptoms mean. For example, a car may shake, make unusual noises, overheat, or show a warning light. Drivers may not know whether the issue is urgent or what action they should take next.

This project aims to provide a simple online platform where users can:

- Check possible vehicle issues based on symptoms
- View urgency levels and recommended next steps
- Track basic maintenance records
- Organize vehicle issue history in one place

The goal is not to replace a professional mechanic. Instead, the platform gives users a clearer starting point before they seek professional repair or maintenance support.

## Core Features

### 1. Dashboard

The dashboard provides a simple overview of the user's vehicle information and quick access to the main platform features.

Planned dashboard content includes:

- Demo vehicle information
- Vehicle status summary
- Quick links to the symptom checker
- Quick links to the maintenance log

### 2. AI-Assisted Symptom Checker

The symptom checker allows users to enter a vehicle symptom, such as:

- Engine light on and car shaking
- Brake squeaking
- Clicking sound when starting
- Car overheating

The system will return:

- Possible issue
- Urgency level
- Recommended next step
- Simple explanation for non-expert users

The first version may use rule-based matching and a structured dataset. Future versions may use an AI API to better interpret natural language symptom descriptions and generate user-friendly explanations.

### 3. Diagnosis Result Page

The result page displays the output from the symptom checker in a clear format.

Example output:

- Original symptom
- Possible issue
- Urgency level
- Recommended next step
- Explanation

### 4. Maintenance Log

The maintenance log allows users to track basic service and repair history.

Planned record fields include:

- Service date
- Mileage
- Repair description
- Replaced parts
- Notes

This feature is based on stakeholder feedback. Repair technicians and daily drivers said that accurate maintenance records can make future repairs easier and reduce inspection time.

## MVP Scope

This project is focused on building a realistic minimum viable product for a capstone project.

### Included in MVP

- Dashboard page
- Symptom checker page
- Diagnosis result page
- Maintenance log page
- CSV-based data storage
- Basic Flask backend
- Simple frontend using HTML, CSS, and JavaScript

### Not Included in MVP

The following features are considered future work and are not part of the first version:

- User login system
- Payment system
- Booking appointments
- Real mechanic accounts
- Full marketplace features
- Live repair shop recommendations
- Real-time vehicle hardware integration

## Technology Stack

- Python
- Flask
- HTML
- CSS
- JavaScript
- CSV files for simple data storage
- Git and GitHub for version control

Possible future tools:

- OpenAI API or similar AI API
- OBD-II vehicle data integration
- Connected vehicle APIs
- Database such as SQLite or PostgreSQL

## Project Structure

```text
ai-automobile-capstone/
│
├── app/
│   ├── main.py
│   ├── templates/
│   │   ├── dashboard.html
│   │   ├── symptom_checker.html
│   │   ├── result.html
│   │   └── maintenance_log.html
│   └── static/
│       ├── css/
│       │   └── style.css
│       └── js/
│           └── script.js
│
├── data/
│   ├── symptom_problem_dataset.csv
│   └── maintenance_records.csv
│
├── docs/
├── screenshots/
├── tests/
├── README.md
├── requirements.txt
└── .gitignore