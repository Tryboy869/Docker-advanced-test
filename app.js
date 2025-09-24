// ==========================================
// ILN Architecture 1B - SANS EXPRESS
// Serveur HTTP natif Node.js pour éviter problèmes npm
// ==========================================

const http = require('http');
const { spawn } = require('child_process');
const { URL } = require('url');

class ServiceManager {
    constructor() {
        this.services = new Map();
        this.ports = {
            orchestrator: process.env.PORT || 8000,
            goService: 8001,
            pythonService: 8002
        };
        
        this.serviceConfigs = {
            go: {
                command: './go-service',
                args: [],
                port: this.ports.goService,
                healthPath: '/health'
            },
            python: {
                command: 'python3',
                args: ['python-service.py'],
                port: this.ports.pythonService,
                healthPath: '/health',
                env: { 
                    ...process.env, 
                    FLASK_PORT: this.ports.pythonService,
                    PYTHONUNBUFFERED: '1'
                }
            }
        };
        
        this.startupLog = [];
        this.isShuttingDown = false;
    }

    log(message, level = 'INFO') {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] [${level}] ${message}`;
        console.log(logEntry);
        
        this.startupLog.push({
            timestamp,
            level,
            message
        });
        
        if (this.startupLog.length > 100) {
            this.startupLog.shift();
        }
    }

    async startService(serviceName) {
        const config = this.serviceConfigs[serviceName];
        if (!config) {
            throw new Error(`Service ${serviceName} non configuré`);
        }

        this.log(`Démarrage service ${serviceName}...`, 'INFO');
        
        const process = spawn(config.command, config.args || [], {
            env: config.env || process.env,
            stdio: ['ignore', 'pipe', 'pipe']
        });

        process.stdout.on('data', (data) => {
            this.log(`${serviceName} STDOUT: ${data.toString().trim()}`, 'DEBUG');
        });

        process.stderr.on('data', (data) => {
            const message = data.toString().trim();
            if (!message.includes('WARNING') && !message.includes('INFO')) {
                this.log(`${serviceName} STDERR: ${message}`, 'WARN');
            }
        });

        process.on('close', (code) => {
            this.log(`Service ${serviceName} fermé avec code ${code}`, 
                     code === 0 ? 'INFO' : 'ERROR');
            this.services.delete(serviceName);
        });

        process.on('error', (error) => {
            this.log(`Erreur service ${serviceName}: ${error.message}`, 'ERROR');
            this.services.delete(serviceName);
        });

        this.services.set(serviceName, {
            process,
            config,
            startTime: Date.now(),
            status: 'starting'
        });

        await this.waitForServiceHealth(serviceName);
        
        const serviceInfo = this.services.get(serviceName);
        if (serviceInfo) {
            serviceInfo.status = 'running';
            this.log(`Service ${serviceName} démarré avec succès sur le port ${config.port}`, 'INFO');
        }
    }

    async waitForServiceHealth(serviceName, maxAttempts = 30, delay = 1000) {
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                await this.checkServiceHealth(serviceName);
                this.log(`Health check ${serviceName} réussi (tentative ${attempt})`, 'DEBUG');
                return true;
            } catch (error) {
                if (attempt === maxAttempts) {
                    this.log(`Health check ${serviceName} échoué après ${maxAttempts} tentatives`, 'ERROR');
                    throw new Error(`Service ${serviceName} non disponible après ${maxAttempts} tentatives`);
                }
                
                if (attempt % 5 === 0) {
                    this.log(`Attente health check ${serviceName} - tentative ${attempt}/${maxAttempts}`, 'DEBUG');
                }
                
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    async checkServiceHealth(serviceName) {
        const config = this.serviceConfigs[serviceName];
        
        return new Promise((resolve, reject) => {
            const req = http.request({
                hostname: 'localhost',
                port: config.port,
                path: config.healthPath || '/health',
                method: 'GET',
                timeout: 5000
            }, (res) => {
                if (res.statusCode === 200) {
                    resolve(true);
                } else {
                    reject(new Error(`Health check failed: ${res.statusCode}`));
                }
            });
            
            req.on('error', reject);
            req.on('timeout', () => reject(new Error('Health check timeout')));
            req.end();
        });
    }

    async makeServiceRequest(serviceName, path = '/', method = 'GET', body = null) {
        const config = this.serviceConfigs[serviceName];
        const serviceInfo = this.services.get(serviceName);
        
        if (!serviceInfo || serviceInfo.status !== 'running') {
            throw new Error(`Service ${serviceName} non disponible`);
        }

        return new Promise((resolve, reject) => {
            const reqOptions = {
                hostname: 'localhost',
                port: config.port,
                path: path,
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'ILN-Orchestrator/1.0'
                },
                timeout: 10000
            };

            const req = http.request(reqOptions, (res) => {
                let data = '';
                
                res.on('data', (chunk) => {
                    data += chunk;
                });
                
                res.on('end', () => {
                    try {
                        const jsonData = data ? JSON.parse(data) : {};
                        resolve({
                            statusCode: res.statusCode,
                            data: jsonData
                        });
                    } catch (error) {
                        resolve({
                            statusCode: res.statusCode,
                            data: { response: data, raw: true }
                        });
                    }
                });
            });
            
            req.on('error', (error) => {
                this.log(`Erreur requête ${serviceName}: ${error.message}`, 'ERROR');
                reject(error);
            });
            
            req.on('timeout', () => {
                this.log(`Timeout requête ${serviceName}`, 'WARN');
                req.destroy();
                reject(new Error('Request timeout'));
            });
            
            if (body) {
                req.write(typeof body === 'string' ? body : JSON.stringify(body));
            }
            
            req.end();
        });
    }

    getServiceStatus() {
        const status = {};
        
        for (const [name, serviceInfo] of this.services.entries()) {
            status[name] = {
                status: serviceInfo.status,
                pid: serviceInfo.process.pid,
                startTime: serviceInfo.startTime,
                uptime: Date.now() - serviceInfo.startTime,
                port: serviceInfo.config.port
            };
        }
        
        return status;
    }

    async shutdown() {
        if (this.isShuttingDown) return;
        this.isShuttingDown = true;
        
        this.log('Arrêt des services...', 'INFO');
        
        for (const [serviceName, serviceInfo] of this.services.entries()) {
            try {
                this.log(`Arrêt service ${serviceName}`, 'INFO');
                serviceInfo.process.kill('SIGTERM');
                
                setTimeout(() => {
                    if (!serviceInfo.process.killed) {
                        serviceInfo.process.kill('SIGKILL');
                    }
                }, 5000);
            } catch (error) {
                this.log(`Erreur arrêt service ${serviceName}: ${error.message}`, 'ERROR');
            }
        }
        
        this.log('Tous les services arrêtés', 'INFO');
    }
}

// ==========================================
// SERVEUR HTTP NATIF (Sans Express)
// ==========================================

const serviceManager = new ServiceManager();

// Gestion gracieuse des arrêts
process.on('SIGTERM', async () => {
    console.log('Signal SIGTERM reçu, arrêt gracieux...');
    await serviceManager.shutdown();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('Signal SIGINT reçu, arrêt gracieux...');
    await serviceManager.shutdown();
    process.exit(0);
});

// Fonction pour parser le body des requêtes POST
function parseBody(req) {
    return new Promise((resolve) => {
        let body = '';
        req.on('data', (chunk) => {
            body += chunk;
        });
        req.on('end', () => {
            try {
                const jsonBody = body ? JSON.parse(body) : {};
                resolve(jsonBody);
            } catch (error) {
                resolve({});
            }
        });
    });
}

// Fonction pour envoyer réponse JSON
function sendJSON(res, data, statusCode = 200) {
    res.writeHead(statusCode, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end(JSON.stringify(data, null, 2));
}

// Serveur HTTP natif
const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${serviceManager.ports.orchestrator}`);
    const path = url.pathname;
    const method = req.method;
    
    try {
        // CORS preflight
        if (method === 'OPTIONS') {
            res.writeHead(200, {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            });
            res.end();
            return;
        }
        
        // Route: Health check orchestrateur
        if (path === '/health' && method === 'GET') {
            const serviceStatuses = serviceManager.getServiceStatus();
            const allHealthy = Object.values(serviceStatuses).every(s => s.status === 'running');
            
            sendJSON(res, {
                status: allHealthy ? 'healthy' : 'unhealthy',
                orchestrator: 'running',
                services: serviceStatuses,
                timestamp: new Date().toISOString()
            }, allHealthy ? 200 : 503);
            return;
        }
        
        // Route: Status détaillé
        if (path === '/status' && method === 'GET') {
            sendJSON(res, {
                orchestrator: {
                    status: 'running',
                    language: 'JavaScript',
                    version: '1.0.0',
                    uptime: process.uptime(),
                    memory: process.memoryUsage(),
                    pid: process.pid
                },
                services: serviceManager.getServiceStatus(),
                logs: serviceManager.startupLog.slice(-20)
            });
            return;
        }
        
        // Route: Traitement Go service
        if (path === '/process/go' && method === 'POST') {
            const body = await parseBody(req);
            const response = await serviceManager.makeServiceRequest('go', '/process', 'POST', body);
            
            sendJSON(res, {
                orchestrator: {
                    message: 'Successfully processed with Go service',
                    language: 'JavaScript'
                },
                go_service: response.data
            });
            return;
        }
        
        // Route: Traitement Python service
        if (path === '/process/python' && method === 'POST') {
            const body = await parseBody(req);
            const response = await serviceManager.makeServiceRequest('python', '/process', 'POST', body);
            
            sendJSON(res, {
                orchestrator: {
                    message: 'Successfully processed with Python service',
                    language: 'JavaScript'
                },
                python_service: response.data
            });
            return;
        }
        
        // Route: Traitement coordonné multi-services
        if (path === '/process/multi' && method === 'POST') {
            const body = await parseBody(req);
            const startTime = Date.now();
            
            const [goResponse, pythonResponse] = await Promise.all([
                serviceManager.makeServiceRequest('go', '/process', 'POST', body),
                serviceManager.makeServiceRequest('python', '/process', 'POST', body)
            ]);
            
            const processingTime = Date.now() - startTime;
            
            sendJSON(res, {
                orchestrator: {
                    message: 'Successfully orchestrated multi-language processing',
                    language: 'JavaScript',
                    processing_time_ms: processingTime,
                    services_coordinated: ['go', 'python']
                },
                go_service: goResponse.data,
                python_service: pythonResponse.data
            });
            return;
        }
        
        // Route: Page d'accueil
        if (path === '/' && method === 'GET') {
            sendJSON(res, {
                message: 'ILN Architecture 1B - JavaScript Orchestrateur (Sans Express)',
                capabilities: [
                    'Multi-language service orchestration',
                    'Go service integration',
                    'Python service integration', 
                    'Parallel processing coordination',
                    'Health monitoring',
                    'Service lifecycle management'
                ],
                endpoints: [
                    'GET /health - Health check',
                    'GET /status - Detailed status',
                    'POST /process/go - Process with Go service',
                    'POST /process/python - Process with Python service',
                    'POST /process/multi - Coordinated multi-service processing'
                ]
            });
            return;
        }
        
        // Route non trouvée
        sendJSON(res, {
            error: 'Route not found',
            path: path,
            method: method
        }, 404);
        
    } catch (error) {
        serviceManager.log(`Erreur serveur: ${error.message}`, 'ERROR');
        sendJSON(res, {
            error: 'Internal server error',
            message: error.message
        }, 500);
    }
});

// ==========================================
// DÉMARRAGE ORCHESTRATEUR
// ==========================================

async function startOrchestrator() {
    try {
        serviceManager.log('Démarrage ILN Architecture 1B - JavaScript Orchestrateur (Sans Express)', 'INFO');
        
        // Démarrer les services en parallèle
        await Promise.all([
            serviceManager.startService('go'),
            serviceManager.startService('python')
        ]);
        
        // Démarrer le serveur orchestrateur
        server.listen(serviceManager.ports.orchestrator, () => {
            serviceManager.log(`Orchestrateur JavaScript démarré sur le port ${serviceManager.ports.orchestrator}`, 'INFO');
            serviceManager.log('Tous les services sont opérationnels', 'INFO');
            
            console.log('\n🚀 ILN ARCHITECTURE 1B OPÉRATIONNELLE (SANS EXPRESS)');
            console.log('=====================================================');
            console.log(`🎯 Orchestrateur JavaScript: http://localhost:${serviceManager.ports.orchestrator}`);
            console.log(`⚡ Service Go: port ${serviceManager.ports.goService}`);
            console.log(`🐍 Service Python: port ${serviceManager.ports.pythonService}`);
            console.log('=====================================================\n');
        });
        
        // Gestion gracieuse des arrêts du serveur
        process.on('SIGTERM', () => {
            server.close(() => {
                serviceManager.shutdown();
            });
        });
        
    } catch (error) {
        serviceManager.log(`Erreur critique au démarrage: ${error.message}`, 'ERROR');
        console.error('❌ Échec du démarrage de l\'orchestrateur:', error);
        process.exit(1);
    }
}

// Démarrage automatique
startOrchestrator();