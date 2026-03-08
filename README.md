# PulseMon: Domain Monitoring Dashboard

A lightweight, modern web-based dashboard for monitoring the uptime and latency of domains. Built with a Flask backend and a Vanilla HTML/CSS/JS frontend featuring a premium dark mode design.

## Features
- **Dashboard UI**: Clean, responsive layout with dark mode aesthetic and status indicators.
- **Background Worker**: Python thread continuously checks domains every 60 seconds.
- **Metrics**: Tracks response latency, uptime percentage (based on successful checks vs total), and current UP/DOWN status.
- **CRUD Operations**: Add, Edit, and Delete monitored domains via real-time modals.
- **Search & Filter**: Find specific domains easily.
- **Data Persistence**: Uses a simple, flat JSON file (`data/domains.json`).

## Project Structure
```text
m:\Ping
│   app.py                 # Main Flask Application + Background Worker
│   requirements.txt       # Python Dependencies
│   README.md              # Instructions
├── data
│   └── domains.json       # Database (auto-generated on first run)
└── static
    ├── index.html         # Main dashboard layout
    ├── styles.css         # Modern dark theme and animations
    └── app.js             # API communication and DOM updates
```

## Running the Project

### Prerequisites
- Python 3.8+ installed.

### Setup Instructions (Windows)

1. **Navigate to the Project Directory**
   Open your PowerShell or Command Prompt and run:
   ```powershell
   cd m:\Ping
   ```

2. **Create a Virtual Environment (Optional but Recommended)**
   ```powershell
   python -m venv venv
   .\venv\Scripts\activate
   ```

3. **Install Dependencies**
   ```powershell
   pip install -r requirements.txt
   ```

4. **Run the Application**
   ```powershell
   python app.py
   ```

5. **Access the Dashboard**
   Open your web browser and navigate to: [http://127.0.0.1:5000](http://127.0.0.1:5000)

## How it works
- When you start `app.py`, a background thread immediately begins iterating over any domains saved in `data/domains.json`.
- It uses the `requests` library to perform an HTTP payload check, recording latency and status code.
- A 2xx or 3xx status code denotes the domain is `UP`. 
- Uptime is updated continuously, and the frontend polls the backend `/api/domains` endpoint every 10 seconds to refresh the UI seamlessly.
