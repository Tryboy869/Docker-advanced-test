# ILN Architecture 1 Modifiée - JavaScript Orchestrator
# Dockerfile gère toutes les dépendances - Pas de package.json

# ===============================================
# ÉTAPE 1: COMPILATION GO
# ===============================================
FROM golang:1.22-alpine AS go-builder
WORKDIR /go-app
COPY main.go .
RUN go mod init go-service && go build -o go-service main.go

# ===============================================
# ÉTAPE 2: CONTAINER FINAL JAVASCRIPT + PYTHON
# ===============================================
FROM node:18-slim AS final

# Installer Python et dépendances système
RUN apt-get update && apt-get install -y \
    python3 python3-pip \
    && rm -rf /var/lib/apt/lists/*

# Docker gère les dépendances Node.js (pas de package.json)
RUN npm install -g \
    express \
    node-fetch

# Docker gère les dépendances Python (contournement environnement géré)
RUN pip3 install --break-system-packages --no-cache-dir \
    flask \
    psutil

# Créer la structure des services
RUN mkdir -p /app/services

# Copier le binaire Go compilé
COPY --from=go-builder /go-app/go-service /app/services/

# Copier les services
COPY app.js /app/app.js
COPY python-service.py /app/services/

# Variables d'environnement
ENV PORT=8000
ENV NODE_ENV=production
ENV PYTHONUNBUFFERED=1

# Exposer tous les ports
EXPOSE 8000 8001 8002

WORKDIR /app

# Point d'entrée : JavaScript Orchestrator
CMD ["node", "app.js"]