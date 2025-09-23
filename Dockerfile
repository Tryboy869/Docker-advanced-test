# Dockerfile avec Orchestrateur K8s-inspired interne
FROM golang:1.22-alpine AS go-builder
WORKDIR /go-app
COPY main.go .
RUN echo 'package main
import (
    "fmt"
    "net/http"
    "log"
    "encoding/json"
)

func main() {
    http.HandleFunc("/go-service", func(w http.ResponseWriter, r *http.Request) {
        response := map[string]interface{}{
            "service": "go-service",
            "status": "running",
            "message": "Go concurrency engine active"
        }
        json.NewEncoder(w).Encode(response)
    })
    
    log.Println("Go service starting on :8001")
    log.Fatal(http.ListenAndServe(":8001", nil))
}' > main.go
RUN go mod init go-service && go build -o go-service main.go

FROM node:18-alpine AS node-builder
WORKDIR /node-app
RUN echo '{
  "name": "node-service",
  "version": "1.0.0",
  "main": "app.js",
  "scripts": {"start": "node app.js"}
}' > package.json

RUN echo 'const express = require("express");
const app = express();

app.get("/node-service", (req, res) => {
    res.json({
        service: "node-service",
        status: "running", 
        message: "Node.js reactive engine active"
    });
});

const port = 8002;
app.listen(port, () => {
    console.log(`Node service starting on :${port}`);
});' > app.js

RUN npm install express

FROM python:3.11-slim AS final-container
WORKDIR /app

# Installer supervisor (équivalent K8s pour container)
RUN pip install supervisor requests

# Copier tous les services
COPY --from=go-builder /go-app/go-service ./services/go-service
COPY --from=node-builder /node-app/ ./services/node-service/

# Installer Node.js dans le container final
RUN apt-get update && apt-get install -y nodejs npm && rm -rf /var/lib/apt/lists/*

# Créer l'orchestrateur K8s-inspired
RUN echo '#!/usr/bin/env python3
"""
Orchestrateur K8s-inspired pour container multi-process
Simule les concepts K8s : Services, Deployments, Health Checks
"""

import subprocess
import requests
import time
import threading
import json
import signal
import sys
from typing import Dict, List, Any

class KubernetesInspiredOrchestrator:
    """Orchestrateur inspiré des concepts Kubernetes pour un seul container"""
    
    def __init__(self):
        self.services = {
            "go-service": {
                "command": ["./services/go-service"],
                "port": 8001,
                "health_path": "/go-service",
                "replicas": 1,
                "restart_policy": "always",
                "process": None
            },
            "node-service": {
                "command": ["node", "./services/node-service/app.js"], 
                "port": 8002,
                "health_path": "/node-service",
                "replicas": 1,
                "restart_policy": "always",
                "process": None
            },
            "python-service": {
                "command": ["python3", "-c", self._python_service_code()],
                "port": 8003,
                "health_path": "/python-service",
                "replicas": 1,
                "restart_policy": "always", 
                "process": None
            }
        }
        self.running = True
        
    def _python_service_code(self):
        return """
from flask import Flask, jsonify
app = Flask(__name__)

@app.route("/python-service")
def health():
    return jsonify({
        "service": "python-service",
        "status": "running",
        "message": "Python orchestration engine active"
    })

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8003)
        """
    
    def start_service(self, service_name: str):
        """Démarre un service (équivalent kubectl create deployment)"""
        service_config = self.services[service_name]
        
        try:
            print(f"🚀 Starting {service_name}...")
            process = subprocess.Popen(
                service_config["command"],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE
            )
            service_config["process"] = process
            print(f"✅ {service_name} started with PID {process.pid}")
        except Exception as e:
            print(f"❌ Failed to start {service_name}: {e}")
    
    def check_service_health(self, service_name: str) -> bool:
        """Health check (équivalent K8s liveness probe)"""
        service_config = self.services[service_name]
        
        try:
            response = requests.get(
                f"http://localhost:{service_config['port']}{service_config['health_path']}",
                timeout=2
            )
            return response.status_code == 200
        except:
            return False
    
    def restart_service(self, service_name: str):
        """Redémarre un service (équivalent K8s restart policy)"""
        print(f"🔄 Restarting {service_name}...")
        
        service_config = self.services[service_name]
        if service_config["process"]:
            service_config["process"].terminate()
        
        time.sleep(2)
        self.start_service(service_name)
    
    def monitor_services(self):
        """Surveillance continue (équivalent K8s controller)"""
        while self.running:
            for service_name, service_config in self.services.items():
                if not service_config["process"]:
                    continue
                    
                # Vérifier si le processus est toujours vivant
                if service_config["process"].poll() is not None:
                    print(f"💀 {service_name} process died, restarting...")
                    self.restart_service(service_name)
                    continue
                
                # Health check
                if not self.check_service_health(service_name):
                    if service_config["restart_policy"] == "always":
                        print(f"🏥 {service_name} health check failed, restarting...")
                        self.restart_service(service_name)
                
            time.sleep(10)  # Check every 10 seconds
    
    def get_service_status(self) -> Dict[str, Any]:
        """Status des services (équivalent kubectl get pods)"""
        status = {}
        for service_name, service_config in self.services.items():
            if service_config["process"]:
                is_running = service_config["process"].poll() is None
                is_healthy = self.check_service_health(service_name) if is_running else False
            else:
                is_running = False
                is_healthy = False
                
            status[service_name] = {
                "running": is_running,
                "healthy": is_healthy,
                "port": service_config["port"],
                "pid": service_config["process"].pid if service_config["process"] else None
            }
        
        return status
    
    def shutdown_all(self):
        """Arrêt gracieux de tous les services"""
        print("🛑 Shutting down all services...")
        self.running = False
        
        for service_name, service_config in self.services.items():
            if service_config["process"]:
                print(f"  Stopping {service_name}...")
                service_config["process"].terminate()
        
        # Attendre que tous se terminent
        time.sleep(5)
        
        # Force kill si nécessaire
        for service_name, service_config in self.services.items():
            if service_config["process"] and service_config["process"].poll() is None:
                service_config["process"].kill()
    
    def run(self):
        """Point d'entrée principal de l'orchestrateur"""
        print("🌌 K8s-inspired Orchestrator starting...")
        
        # Gérer les signaux pour arrêt gracieux
        signal.signal(signal.SIGTERM, lambda s, f: self.shutdown_all())
        signal.signal(signal.SIGINT, lambda s, f: self.shutdown_all())
        
        # Démarrer tous les services
        for service_name in self.services.keys():
            self.start_service(service_name)
            time.sleep(2)  # Délai entre démarrages
        
        # Démarrer la surveillance dans un thread séparé
        monitor_thread = threading.Thread(target=self.monitor_services)
        monitor_thread.daemon = True
        monitor_thread.start()
        
        # Service principal avec API de status
        self._start_orchestrator_api()
    
    def _start_orchestrator_api(self):
        """API pour interroger l'orchestrateur (équivalent K8s API server)"""
        try:
            from flask import Flask
            app = Flask(__name__)
            
            @app.route("/")
            def root():
                return jsonify({
                    "orchestrator": "K8s-inspired Container Orchestrator",
                    "services": list(self.services.keys()),
                    "status": "running"
                })
            
            @app.route("/status")
            def status():
                return jsonify(self.get_service_status())
            
            @app.route("/services/<service_name>/restart", methods=["POST"])
            def restart_service_endpoint(service_name):
                if service_name in self.services:
                    self.restart_service(service_name)
                    return jsonify({"message": f"{service_name} restart initiated"})
                return jsonify({"error": "Service not found"}), 404
            
            print("🎯 Orchestrator API starting on :8000")
            app.run(host="0.0.0.0", port=8000, debug=False)
        except KeyboardInterrupt:
            self.shutdown_all()
            sys.exit(0)

if __name__ == "__main__":
    orchestrator = KubernetesInspiredOrchestrator()
    orchestrator.run()
' > k8s_orchestrator.py

RUN chmod +x k8s_orchestrator.py

# Installer Flask pour l'API orchestrateur
RUN pip install flask

# Créer les répertoires nécessaires
RUN mkdir -p services logs

# Variables d'environnement
ENV PYTHONUNBUFFERED=1

# Exposer tous les ports
EXPOSE 8000 8001 8002 8003

# Démarrer l'orchestrateur K8s-inspired
CMD ["python3", "k8s_orchestrator.py"]