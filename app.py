#!/usr/bin/env python3
"""
Orchestrateur Principal Python - ILN Multi-Language Architecture 1
Gère les services Go, Node.js et fournit l'API principale
"""

import os
import time
import subprocess
import threading
import requests
import json
from typing import Dict, Any, Optional
from datetime import datetime
from flask import Flask, request, jsonify

class MultiLanguageOrchestrator:
    """Orchestrateur ILN pour services multi-langages"""
    
    def __init__(self):
        self.services = {
            'go-service': {
                'command': ['./services/go-service'],
                'port': 8001,
                'health_endpoint': '/health',
                'process': None,
                'status': 'stopped'
            },
            'node-service': {
                'command': ['node', './services/node-service/app.js'],
                'port': 8002, 
                'health_endpoint': '/health',
                'process': None,
                'status': 'stopped'
            }
        }
        self.running = True
    
    def start_service(self, service_name: str) -> bool:
        """Démarre un service spécifique"""
        if service_name not in self.services:
            return False
        
        service = self.services[service_name]
        
        try:
            print(f"Starting {service_name}...")
            process = subprocess.Popen(
                service['command'],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                env=dict(os.environ, 
                        GO_PORT=str(service['port']) if 'go' in service_name else os.environ.get('GO_PORT', '8001'),
                        NODE_PORT=str(service['port']) if 'node' in service_name else os.environ.get('NODE_PORT', '8002'))
            )
            
            service['process'] = process
            service['status'] = 'starting'
            
            # Attendre que le service soit prêt
            time.sleep(3)
            if self.check_service_health(service_name):
                service['status'] = 'running'
                print(f"✅ {service_name} started successfully")
                return True
            else:
                service['status'] = 'failed'
                print(f"❌ {service_name} failed to start properly")
                return False
                
        except Exception as e:
            print(f"❌ Error starting {service_name}: {e}")
            service['status'] = 'failed'
            return False
    
    def check_service_health(self, service_name: str) -> bool:
        """Vérifier la santé d'un service"""
        service = self.services[service_name]
        
        try:
            response = requests.get(
                f"http://localhost:{service['port']}{service['health_endpoint']}",
                timeout=2
            )
            return response.status_code == 200
        except:
            return False
    
    def call_service(self, service_name: str, endpoint: str, data: Optional[Dict] = None) -> Optional[Dict]:
        """Appeler un service spécifique"""
        if service_name not in self.services:
            return None
        
        service = self.services[service_name]
        url = f"http://localhost:{service['port']}{endpoint}"
        
        try:
            if data:
                response = requests.post(url, json=data, timeout=5)
            else:
                response = requests.get(url, timeout=5)
            
            return response.json() if response.status_code == 200 else None
        except Exception as e:
            print(f"Error calling {service_name}: {e}")
            return None
    
    def get_system_status(self) -> Dict[str, Any]:
        """Statut complet du système"""
        status = {
            'orchestrator': 'python',
            'services': {},
            'timestamp': datetime.now().isoformat()
        }
        
        for service_name, service in self.services.items():
            is_healthy = self.check_service_health(service_name)
            status['services'][service_name] = {
                'status': service['status'],
                'healthy': is_healthy,
                'port': service['port'],
                'pid': service['process'].pid if service['process'] else None
            }
        
        return status
    
    def start_all_services(self):
        """Démarre tous les services"""
        print("🌌 Starting Multi-Language ILN System...")
        
        for service_name in self.services.keys():
            self.start_service(service_name)
            time.sleep(1)  # Délai entre démarrages
    
    def shutdown_all(self):
        """Arrêt gracieux"""
        print("Shutting down all services...")
        self.running = False
        
        for service_name, service in self.services.items():
            if service['process']:
                service['process'].terminate()

# Créer l'orchestrateur global
orchestrator = MultiLanguageOrchestrator()

# Application Flask principale
app = Flask(__name__)

@app.route('/')
def home():
    """Page d'accueil avec interface de test"""
    return """
    <!DOCTYPE html>
    <html>
    <head>
        <title>ILN Multi-Language Architecture 1</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; min-height: 100vh; }
            .container { max-width: 800px; margin: 0 auto; background: rgba(255,255,255,0.1); padding: 30px; border-radius: 15px; backdrop-filter: blur(10px); }
            .service-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin: 20px 0; }
            .service-card { background: rgba(255,255,255,0.2); padding: 20px; border-radius: 10px; }
            button { background: linear-gradient(45deg, #FF6B6B, #4ECDC4); color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; margin: 5px; }
            .results { background: rgba(0,0,0,0.3); padding: 20px; border-radius: 10px; margin: 20px 0; white-space: pre-wrap; font-family: monospace; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>ILN Architecture 1 - Multi-Language Container</h1>
            <p><strong>Services:</strong> Python (Orchestrateur) + Go (Concurrence) + Node.js (Réactivité)</p>
            
            <div class="service-grid">
                <div class="service-card">
                    <h3>🐍 Python</h3>
                    <p>Orchestrateur principal</p>
                    <button onclick="testPython()">Test Python</button>
                </div>
                <div class="service-card">
                    <h3>🐹 Go Service</h3>
                    <p>Moteur de concurrence</p>
                    <button onclick="testGo()">Test Go</button>
                </div>
                <div class="service-card">
                    <h3>🌐 Node.js Service</h3>
                    <p>Moteur réactif</p>
                    <button onclick="testNode()">Test Node</button>
                </div>
            </div>
            
            <button onclick="testOrchestration()">🎯 Test Orchestration Complète</button>
            <button onclick="getStatus()">📊 Statut Système</button>
            
            <div class="results" id="results">
                Cliquez sur les boutons pour tester les services multi-langages...
            </div>
        </div>

        <script>
            async function testPython() {
                document.getElementById('results').innerHTML = 'Testing Python orchestrator...';
                try {
                    const response = await fetch('/api/python-test');
                    const result = await response.json();
                    document.getElementById('results').innerHTML = JSON.stringify(result, null, 2);
                } catch (error) {
                    document.getElementById('results').innerHTML = `Error: ${error.message}`;
                }
            }
            
            async function testGo() {
                document.getElementById('results').innerHTML = 'Testing Go service...';
                try {
                    const response = await fetch('/api/test-go');
                    const result = await response.json();
                    document.getElementById('results').innerHTML = JSON.stringify(result, null, 2);
                } catch (error) {
                    document.getElementById('results').innerHTML = `Error: ${error.message}`;
                }
            }
            
            async function testNode() {
                document.getElementById('results').innerHTML = 'Testing Node.js service...';
                try {
                    const response = await fetch('/api/test-node');
                    const result = await response.json();
                    document.getElementById('results').innerHTML = JSON.stringify(result, null, 2);
                } catch (error) {
                    document.getElementById('results').innerHTML = `Error: ${error.message}`;
                }
            }
            
            async function testOrchestration() {
                document.getElementById('results').innerHTML = 'Testing complete orchestration...';
                try {
                    const response = await fetch('/api/orchestration-test');
                    const result = await response.json();
                    document.getElementById('results').innerHTML = JSON.stringify(result, null, 2);
                } catch (error) {
                    document.getElementById('results').innerHTML = `Error: ${error.message}`;
                }
            }
            
            async function getStatus() {
                document.getElementById('results').innerHTML = 'Getting system status...';
                try {
                    const response = await fetch('/api/status');
                    const result = await response.json();
                    document.getElementById('results').innerHTML = JSON.stringify(result, null, 2);
                } catch (error) {
                    document.getElementById('results').innerHTML = `Error: ${error.message}`;
                }
            }
        </script>
    </body>
    </html>
    """

@app.route('/api/status')
def api_status():
    """API pour obtenir le statut du système"""
    return jsonify(orchestrator.get_system_status())

@app.route('/api/python-test')
def python_test():
    """Test du service Python natif"""
    return jsonify({
        'service': 'python-orchestrator',
        'message': 'Python orchestrator running',
        'capabilities': ['orchestration', 'coordination', 'api_management'],
        'timestamp': datetime.now().isoformat()
    })

@app.route('/api/test-go')
def test_go():
    """Test du service Go"""
    result = orchestrator.call_service('go-service', '/process')
    if result:
        return jsonify(result)
    else:
        return jsonify({'error': 'Go service not available'}), 503

@app.route('/api/test-node')
def test_node():
    """Test du service Node.js"""
    test_data = {
        'data': 'test_data',
        'eventType': 'api_test'
    }
    result = orchestrator.call_service('node-service', '/process', test_data)
    if result:
        return jsonify(result)
    else:
        return jsonify({'error': 'Node.js service not available'}), 503

@app.route('/api/orchestration-test')
def orchestration_test():
    """Test d'orchestration complète utilisant tous les services"""
    results = {
        'orchestration_test': True,
        'timestamp': datetime.now().isoformat(),
        'services_tested': []
    }
    
    # Test Go
    go_result = orchestrator.call_service('go-service', '/process')
    if go_result:
        results['go_service'] = go_result
        results['services_tested'].append('go')
    
    # Test Node
    node_data = {'data': 'orchestration_test', 'eventType': 'multi_test'}
    node_result = orchestrator.call_service('node-service', '/process', node_data)
    if node_result:
        results['node_service'] = node_result
        results['services_tested'].append('node')
    
    # Python processing
    results['python_orchestrator'] = {
        'service': 'python',
        'role': 'coordinator',
        'message': 'Successfully orchestrated multi-language processing',
        'services_coordinated': results['services_tested']
    }
    
    return jsonify(results)

if __name__ == '__main__':
    print("🌌 ILN Multi-Language Architecture 1")
    print("Starting orchestrator...")
    
    # Démarrer tous les services en arrière-plan
    threading.Thread(target=orchestrator.start_all_services, daemon=True).start()
    
    # Attendre que les services démarrent
    time.sleep(5)
    
    # Démarrer l'API principale
    port = int(os.environ.get('PORT', 8000))
    print(f"Python orchestrator starting on port {port}")
    app.run(host='0.0.0.0', port=port, debug=False)
