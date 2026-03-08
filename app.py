import os
import json
import time
import uuid
import threading
import requests
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from functools import wraps
from flask import Flask, request, jsonify, send_from_directory, session, redirect, url_for

app = Flask(__name__, static_url_path='', static_folder='static')
app.secret_key = 'pulsemon_static_secret_key_123'

DATA_FILE = 'data/domains.json'
LOCK = threading.Lock()

# Static Credentials
USERNAME = 'admin'
PASSWORD = 'redhat'

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'logged_in' not in session:
            return jsonify({"error": "Unauthorized"}), 401
        return f(*args, **kwargs)
    return decorated_function

def load_domains():
    if not os.path.exists(DATA_FILE):
        return []
    try:
        with open(DATA_FILE, 'r') as f:
            return json.load(f)
    except json.JSONDecodeError:
        return []

def save_domains(domains):
    os.makedirs(os.path.dirname(DATA_FILE), exist_ok=True)
    with open(DATA_FILE, 'w') as f:
        json.dump(domains, f, indent=4)

def check_domain(url):
    try:
        # Give a 5s timeout, only fetch headers to be faster
        start = time.time()
        response = requests.get(url, timeout=5, stream=True)
        response.close() # Close connection immediately after headers
        end = time.time()
        
        latency_ms = int((end - start) * 1000)
        
        if 200 <= response.status_code < 1000:
            return "UP", latency_ms
        else:
            return "DOWN", latency_ms
    except requests.RequestException:
        return "DOWN", 0

def process_single_domain(domain):
    status, latency = check_domain(domain['url'])
    
    domain['status'] = status
    domain['latency'] = latency
    domain['last_checked'] = datetime.utcnow().isoformat() + "Z"
    
    domain['total_checks'] = domain.get('total_checks', 0) + 1
    if status == "UP":
        domain['successful_checks'] = domain.get('successful_checks', 0) + 1
        
    domain['uptime_percentage'] = round(
        (domain['successful_checks'] / domain['total_checks']) * 100, 2
    )

def monitor_loop():
    while True:
        with LOCK:
            domains = load_domains()
            
        if domains:
            # Use ThreadPool to check domains in parallel for much faster execution
            with ThreadPoolExecutor(max_workers=10) as executor:
                executor.map(process_single_domain, domains)
                
            with LOCK:
                save_domains(domains)
                
        # Wait 30 seconds before next check to be more responsive
        time.sleep(30)

@app.route('/')
def serve_index():
    if 'logged_in' not in session:
        return redirect(url_for('serve_login'))
    return send_from_directory('static', 'index.html')

@app.route('/login', methods=['GET'])
def serve_login():
    if 'logged_in' in session:
        return redirect(url_for('serve_index'))
    return send_from_directory('static', 'login.html')

@app.route('/api/login', methods=['POST'])
def api_login():
    data = request.json
    if data.get('username') == USERNAME and data.get('password') == PASSWORD:
        session['logged_in'] = True
        return jsonify({"message": "Login successful"}), 200
    return jsonify({"error": "Invalid credentials"}), 401

@app.route('/api/logout', methods=['POST'])
def api_logout():
    session.pop('logged_in', None)
    return jsonify({"message": "Logged out"}), 200

@app.route('/api/domains', methods=['GET'])
@login_required
def get_domains():
    with LOCK:
        domains = load_domains()
    return jsonify(domains)

@app.route('/api/domains', methods=['POST'])
@login_required
def add_domain():
    data = request.json
    url = data.get('url')
    name = data.get('name', url)
    
    if not url:
        return jsonify({"error": "URL is required"}), 400
        
    if not url.startswith('http://') and not url.startswith('https://'):
        url = 'https://' + url

    new_domain = {
        "id": str(uuid.uuid4()),
        "name": name,
        "url": url,
        "created_at": datetime.utcnow().isoformat() + "Z",
        "status": "PENDING",
        "latency": 0,
        "uptime_percentage": 100.0,
        "total_checks": 0,
        "successful_checks": 0,
        "last_checked": None
    }
    
    with LOCK:
        domains = load_domains()
        domains.append(new_domain)
        save_domains(domains)
        
    return jsonify(new_domain), 201

@app.route('/api/domains/<domain_id>', methods=['PUT'])
@login_required
def update_domain(domain_id):
    data = request.json
    
    with LOCK:
        domains = load_domains()
        for idx, d in enumerate(domains):
            if d['id'] == domain_id:
                if 'name' in data:
                    domains[idx]['name'] = data['name']
                if 'url' in data:
                    domains[idx]['url'] = data['url']
                    if not domains[idx]['url'].startswith('http'):
                        domains[idx]['url'] = 'https://' + domains[idx]['url']
                save_domains(domains)
                return jsonify(domains[idx])
                
    return jsonify({"error": "Domain not found"}), 404

@app.route('/api/domains/<domain_id>', methods=['DELETE'])
@login_required
def delete_domain(domain_id):
    with LOCK:
        domains = load_domains()
        filtered = [d for d in domains if d['id'] != domain_id]
        if len(domains) == len(filtered):
            return jsonify({"error": "Domain not found"}), 404
        save_domains(filtered)
        
    return jsonify({"message": "Deleted successfully"}), 200

if __name__ == '__main__':
    os.makedirs('data', exist_ok=True)
    os.makedirs('static', exist_ok=True)
    
    # Start monitor thread
    monitor_thread = threading.Thread(target=monitor_loop, daemon=True)
    monitor_thread.start()
    
    # Run server
    app.run(host='0.0.0.0', port=5050, debug=False)
