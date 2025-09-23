#!/usr/bin/env python3
"""
Service Python Autonome pour ILN Architecture 1
Orchestré par JavaScript
"""

import os
import time
import json
import psutil
from datetime import datetime
from flask import Flask, request, jsonify

app = Flask(__name__)

# Configuration
PORT = int(os.environ.get('PYTHON_PORT', 8002))
START_TIME = time.time()

def get_system_info():
    """Informations système détaillées"""
    process = psutil.Process()
    return {
        'memory_usage_mb': round(process.memory_info().rss / 1024 / 1024, 2),
        'cpu_percent': round(process.cpu_percent(), 2),
        'uptime_seconds': round(time.time() - START_TIME, 2),
        'threads': process.num_threads()
    }

@app.route('/')
def root():
    """Route racine du service Python"""
    return jsonify({
        'service': 'python-service',
        'message': 'Python service running under JavaScript orchestrator',
        'available_endpoints': ['/health', '/process', '/status', '/analyze'],
        'port': PORT,
        'orchestrated_by': 'JavaScript'
    })

@app.route('/health')
def health():
    """Health check endpoint"""
    return jsonify({
        'service': 'python-service',
        'status': 'running',
        'message': 'Python processing engine active - Orchestrated by JavaScript',
        'port': PORT,
        'uptime': f"{time.time() - START_TIME:.1f}s",
        'orchestrator': 'JavaScript'
    })

@app.route('/process', methods=['GET', 'POST'])
def process():
    """Endpoint de traitement principal"""
    start_time = time.time()
    
    # Récupérer les données
    if request.method == 'POST':
        data = request.json or {}
        input_data = data.get('data', 'default_processing_data')
    else:
        input_data = 'get_request_processing'
    
    # Simulation de traitement Python
    processed_words = []
    if isinstance(input_data, str):
        words = input_data.split()
        processed_words = [f"{word}({len(word)})" for word in words]
    
    # Traitement mathématique
    numbers = [i**2 for i in range(1, 6)]  # Carrés de 1 à 5
    sum_squares = sum(numbers)
    
    processing_time = time.time() - start_time
    
    return jsonify({
        'service': 'python-service',
        'action': 'python_processing',
        'input_data': input_data,
        'processed_words': processed_words,
        'mathematical_processing': {
            'squares': numbers,
            'sum_of_squares': sum_squares
        },
        'result': 'Python processing completed successfully',
        'processing_time_ms': round(processing_time * 1000, 2),
        'orchestrated_by': 'JavaScript',
        'timestamp': datetime.now().isoformat()
    })

@app.route('/analyze', methods=['POST'])
def analyze():
    """Endpoint d'analyse de données"""
    start_time = time.time()
    
    data = request.json or {}
    text_data = data.get('text', 'sample text for analysis')
    
    # Analyse textuelle simple
    analysis = {
        'character_count': len(text_data),
        'word_count': len(text_data.split()),
        'sentence_count': text_data.count('.') + text_data.count('!') + text_data.count('?'),
        'unique_words': len(set(text_data.lower().split())),
        'readability_score': len(text_data.split()) / max(1, len(text_data.split('.')))
    }
    
    processing_time = time.time() - start_time
    
    return jsonify({
        'service': 'python-service',
        'action': 'text_analysis',
        'input_text': text_data[:100] + "..." if len(text_data) > 100 else text_data,
        'analysis': analysis,
        'processing_time_ms': round(processing_time * 1000, 2),
        'orchestrated_by': 'JavaScript',
        'timestamp': datetime.now().isoformat()
    })

@app.route('/status')
def status():
    """Statut détaillé du service"""
    system_info = get_system_info()
    
    return jsonify({
        'service': 'python-service',
        'status': 'healthy',
        'orchestrator': 'JavaScript',
        'system_metrics': system_info,
        'capabilities': [
            'text_processing',
            'mathematical_computation', 
            'data_analysis',
            'json_api_responses'
        ],
        'python_version': f"{os.sys.version_info.major}.{os.sys.version_info.minor}.{os.sys.version_info.micro}",
        'uptime': f"{time.time() - START_TIME:.1f}s",
        'timestamp': datetime.now().isoformat()
    })

# Configuration CORS
@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    return response

if __name__ == '__main__':
    print(f"Python service starting on port {PORT}")
    print(f"Orchestrated by: JavaScript")
    print(f"Available endpoints: /health, /process, /status, /analyze")
    
    app.run(
        host='0.0.0.0',
        port=PORT,
        debug=False,
        threaded=True
    )
