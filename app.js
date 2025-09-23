#!/usr/bin/env node

/**
 * ILN Architecture 1 Modifiée - JavaScript comme Orchestrateur Principal
 * Gère l'interface utilisateur ET l'orchestration des services
 */

const express = require('express');
const { spawn } = require('child_process');
const fetch = require('node-fetch');
const path = require('path');

class ILNJavaScriptOrchestrator {
    constructor() {
        this.services = new Map();
        this.app = express();
        this.port = process.env.PORT || 8000;
        this.setupMiddleware();
        this.setupRoutes();
    }

    setupMiddleware() {
        this.app.use(express.json());
        this.app.use(express.static(path.join(__dirname, 'public')));
    }

    log(message) {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] [JS-ORCHESTRATOR] ${message}`);
    }

    async startService(serviceName, config) {
        this.log(`Démarrage du service ${serviceName}...`);
        
        try {
            const process = spawn(config.command[0], config.command.slice(1), {
                stdio: ['pipe', 'pipe', 'pipe'],
                env: { ...process.env, ...config.env }
            });

            process.stdout.on('data', (data) => {
                this.log(`[${serviceName}] ${data.toString().trim()}`);
            });

            process.stderr.on('data', (data) => {
                this.log(`[${serviceName} ERROR] ${data.toString().trim()}`);
            });

            process.on('exit', (code) => {
                this.log(`[${serviceName}] Processus terminé avec le code ${code}`);
                this.services.delete(serviceName);
            });

            this.services.set(serviceName, {
                process: process,
                config: config,
                startTime: Date.now(),
                status: 'running'
            });

            this.log(`Service ${serviceName} démarré avec PID ${process.pid}`);
            return true;
        } catch (error) {
            this.log(`Erreur lors du démarrage de ${serviceName}: ${error.message}`);
            return false;
        }
    }

    async checkServiceHealth(serviceName) {
        const service = this.services.get(serviceName);
        if (!service) {
            return { healthy: false, reason: 'Service non trouvé' };
        }

        try {
            const response = await fetch(`http://localhost:${service.config.port}/health`, {
                method: 'GET',
                timeout: 3000
            });

            if (response.ok) {
                const data = await response.json();
                return { healthy: true, data };
            } else {
                return { healthy: false, reason: `HTTP ${response.status}` };
            }
        } catch (error) {
            return { healthy: false, reason: error.message };
        }
    }

    async callService(serviceName, endpoint, data = null) {
        const service = this.services.get(serviceName);
        if (!service) {
            return { error: 'Service non disponible' };
        }

        try {
            const url = `http://localhost:${service.config.port}${endpoint}`;
            const options = {
                method: data ? 'POST' : 'GET',
                timeout: 5000,
                headers: { 'Content-Type': 'application/json' }
            };

            if (data) {
                options.body = JSON.stringify(data);
            }

            const response = await fetch(url, options);
            const result = await response.json();
            
            return { success: true, data: result };
        } catch (error) {
            return { error: error.message };
        }
    }

    getSystemStatus() {
        const status = {
            orchestrator: 'JavaScript',
            timestamp: new Date().toISOString(),
            services: {},
            totalServices: this.services.size
        };

        for (const [name, service] of this.services.entries()) {
            status.services[name] = {
                status: service.status,
                port: service.config.port,
                uptime: Date.now() - service.startTime,
                pid: service.process ? service.process.pid : null
            };
        }

        return status;
    }

    setupRoutes() {
        // Route principale avec interface utilisateur
        this.app.get('/', (req, res) => {
            res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>ILN Architecture 1 - JavaScript Orchestrator</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; min-height: 100vh; }
                    .container { max-width: 900px; margin: 0 auto; background: rgba(255,255,255,0.1); padding: 30px; border-radius: 15px; backdrop-filter: blur(10px); }
                    .service-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin: 20px 0; }
                    .service-card { background: rgba(255,255,255,0.2); padding: 20px; border-radius: 10px; }
                    button { background: linear-gradient(45deg, #FF6B6B, #4ECDC4); color: white; padding: 12px 20px; border: none; border-radius: 5px; cursor: pointer; margin: 5px; }
                    .results { background: rgba(0,0,0,0.3); padding: 20px; border-radius: 10px; margin: 20px 0; white-space: pre-wrap; font-family: monospace; }
                    .orchestrator-info { background: rgba(76, 175, 80, 0.3); padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #4CAF50; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>ILN Architecture 1 Modifiée</h1>
                    <div class="orchestrator-info">
                        <h3>🎯 JavaScript Orchestrator</h3>
                        <p>Interface utilisateur + Orchestration des services dans un seul runtime</p>
                        <p><strong>Innovation:</strong> JavaScript gère à la fois l'UI et la coordination des services</p>
                    </div>
                    
                    <div class="service-grid">
                        <div class="service-card">
                            <h3>🌐 JavaScript</h3>
                            <p>Interface + Orchestrateur</p>
                            <button onclick="testJavaScript()">Test JavaScript</button>
                        </div>
                        <div class="service-card">
                            <h3>🐹 Go Service</h3>
                            <p>Moteur de concurrence</p>
                            <button onclick="testGo()">Test Go</button>
                        </div>
                        <div class="service-card">
                            <h3>🐍 Python Service</h3>
                            <p>Moteur de traitement</p>
                            <button onclick="testPython()">Test Python</button>
                        </div>
                    </div>
                    
                    <button onclick="testFullOrchestration()">🎯 Test Orchestration Complète</button>
                    <button onclick="getStatus()">📊 Statut Système</button>
                    <button onclick="healthCheckAll()">🏥 Health Check Tous Services</button>
                    
                    <div class="results" id="results">
                        JavaScript Orchestrator prêt. Cliquez pour tester les services...
                    </div>
                </div>

                <script>
                    async function testJavaScript() {
                        document.getElementById('results').innerHTML = 'Testing JavaScript orchestrator...';
                        try {
                            const response = await fetch('/api/js-test');
                            const result = await response.json();
                            document.getElementById('results').innerHTML = JSON.stringify(result, null, 2);
                        } catch (error) {
                            document.getElementById('results').innerHTML = \`Error: \${error.message}\`;
                        }
                    }
                    
                    async function testGo() {
                        document.getElementById('results').innerHTML = 'Testing Go service via JavaScript orchestrator...';
                        try {
                            const response = await fetch('/api/test-go');
                            const result = await response.json();
                            document.getElementById('results').innerHTML = JSON.stringify(result, null, 2);
                        } catch (error) {
                            document.getElementById('results').innerHTML = \`Error: \${error.message}\`;
                        }
                    }
                    
                    async function testPython() {
                        document.getElementById('results').innerHTML = 'Testing Python service via JavaScript orchestrator...';
                        try {
                            const response = await fetch('/api/test-python');
                            const result = await response.json();
                            document.getElementById('results').innerHTML = JSON.stringify(result, null, 2);
                        } catch (error) {
                            document.getElementById('results').innerHTML = \`Error: \${error.message}\`;
                        }
                    }
                    
                    async function testFullOrchestration() {
                        document.getElementById('results').innerHTML = 'Running full orchestration test...';
                        try {
                            const response = await fetch('/api/orchestration-test');
                            const result = await response.json();
                            document.getElementById('results').innerHTML = JSON.stringify(result, null, 2);
                        } catch (error) {
                            document.getElementById('results').innerHTML = \`Error: \${error.message}\`;
                        }
                    }
                    
                    async function getStatus() {
                        document.getElementById('results').innerHTML = 'Getting system status...';
                        try {
                            const response = await fetch('/api/status');
                            const result = await response.json();
                            document.getElementById('results').innerHTML = JSON.stringify(result, null, 2);
                        } catch (error) {
                            document.getElementById('results').innerHTML = \`Error: \${error.message}\`;
                        }
                    }
                    
                    async function healthCheckAll() {
                        document.getElementById('results').innerHTML = 'Checking health of all services...';
                        try {
                            const response = await fetch('/api/health-check-all');
                            const result = await response.json();
                            document.getElementById('results').innerHTML = JSON.stringify(result, null, 2);
                        } catch (error) {
                            document.getElementById('results').innerHTML = \`Error: \${error.message}\`;
                        }
                    }
                </script>
            </body>
            </html>
            `);
        });

        // API Routes
        this.app.get('/api/status', (req, res) => {
            res.json(this.getSystemStatus());
        });

        this.app.get('/api/js-test', (req, res) => {
            res.json({
                orchestrator: 'JavaScript',
                capabilities: ['interface_management', 'service_orchestration', 'real_time_monitoring'],
                message: 'JavaScript orchestrateur fonctionnel',
                timestamp: new Date().toISOString(),
                innovation: 'Interface + Orchestration unifiées'
            });
        });

        this.app.get('/api/test-go', async (req, res) => {
            const result = await this.callService('go-service', '/process');
            res.json(result);
        });

        this.app.get('/api/test-python', async (req, res) => {
            const testData = { data: 'orchestration_test_from_js' };
            const result = await this.callService('python-service', '/process', testData);
            res.json(result);
        });

        this.app.get('/api/health-check-all', async (req, res) => {
            const healthResults = {};
            
            for (const serviceName of this.services.keys()) {
                healthResults[serviceName] = await this.checkServiceHealth(serviceName);
            }
            
            res.json({
                orchestrator: 'JavaScript',
                health_checks: healthResults,
                timestamp: new Date().toISOString()
            });
        });

        this.app.get('/api/orchestration-test', async (req, res) => {
            const results = {
                orchestration_test: true,
                orchestrator: 'JavaScript',
                timestamp: new Date().toISOString(),
                services_tested: []
            };

            // Test Go service
            const goResult = await this.callService('go-service', '/process');
            if (goResult.success) {
                results.go_service = goResult.data;
                results.services_tested.push('go');
            }

            // Test Python service  
            const pythonResult = await this.callService('python-service', '/process', {
                data: 'js_orchestrated_test'
            });
            if (pythonResult.success) {
                results.python_service = pythonResult.data;
                results.services_tested.push('python');
            }

            // JavaScript orchestration summary
            results.javascript_orchestrator = {
                role: 'interface_and_coordinator',
                message: 'Successfully orchestrated multi-language services from JavaScript',
                services_coordinated: results.services_tested,
                architecture: 'Unified UI + Orchestration'
            };

            res.json(results);
        });
    }

    async initializeServices() {
        this.log('Initialisation des services ILN...');

        // Configuration des services
        const serviceConfigs = {
            'go-service': {
                command: ['./services/go-service'],
                port: 8001,
                env: { GO_PORT: '8001' }
            },
            'python-service': {
                command: ['python3', './services/python-service.py'],
                port: 8002,
                env: { PYTHON_PORT: '8002' }
            }
        };

        // Démarrer tous les services
        for (const [name, config] of Object.entries(serviceConfigs)) {
            await this.startService(name, config);
            // Délai entre démarrages
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        this.log('Tous les services initialisés');
    }

    async start() {
        this.log('Démarrage de l\'orchestrateur JavaScript ILN...');
        
        // Démarrer les services en arrière-plan
        setTimeout(() => this.initializeServices(), 3000);
        
        // Démarrer le serveur web
        this.app.listen(this.port, () => {
            this.log(`Serveur JavaScript orchestrateur démarré sur le port ${this.port}`);
            this.log('Interface disponible sur http://localhost:' + this.port);
        });
    }
}

// Point d'entrée principal
const orchestrator = new ILNJavaScriptOrchestrator();

// Gestion propre de l'arrêt
process.on('SIGTERM', () => {
    console.log('Arrêt en cours...');
    for (const [name, service] of orchestrator.services.entries()) {
        if (service.process) {
            service.process.kill();
        }
    }
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('\\nArrêt demandé par l\'utilisateur');
    for (const [name, service] of orchestrator.services.entries()) {
        if (service.process) {
            service.process.kill();
        }
    }
    process.exit(0);
});

// Démarrage de l'orchestrateur
orchestrator.start();