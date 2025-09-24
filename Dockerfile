# syntax=docker/dockerfile:1
# check=error=true

# ARCHITECTURE 1B ALTERNATIVE - Sans cache mount pour éviter conflits
# JavaScript Orchestrateur Multi-Language - Version Stable

# === STAGE 1: BUILD GO SERVICE ===
FROM golang:1.22-alpine AS go-builder
WORKDIR /go-service

COPY main.go .

# Build optimisé sans cache mount
RUN <<EOF
go mod init go-service
go build -ldflags="-s -w" -o go-service main.go
chmod +x go-service
EOF

# === STAGE 2: PRÉPARER SERVICE PYTHON ===
FROM python:3.11-slim AS python-builder
WORKDIR /python-service

# Installation simple sans cache mount
RUN pip install --no-cache-dir flask requests

COPY python-service.py .

# === STAGE FINAL: NODE.JS ORCHESTRATEUR ===
FROM node:18-slim AS final

# Installation runtimes - Version simplifiée
RUN <<EOF
apt-get update
apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*
EOF

# Installation Express sans cache mount
RUN npm install express --no-audit --no-fund

# Installation dépendances Python sans cache mount
RUN pip3 install --no-cache-dir flask requests

# Structure services
RUN mkdir -p /app/services

# Copier executables avec bonnes permissions
COPY --from=go-builder --chmod=755 /go-service/go-service /app/services/
COPY --from=python-builder /python-service/ /app/services/python-service/

# Copier orchestrateur JavaScript
COPY app.js /app/

# Variables d'environnement
ENV PORT=8000
ENV PYTHONUNBUFFERED=1
ENV NODE_ENV=production

# Configuration utilisateur sécurisé
RUN <<EOF
groupadd -r appgroup
useradd -r -g appgroup -s /bin/false appuser
chown -R appuser:appgroup /app
EOF

# Configuration finale
WORKDIR /app
EXPOSE 8000

# Health check obligatoire
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Utilisateur non-root obligatoire
USER appuser

# Point d'entrée JavaScript orchestrateur
CMD ["node", "app.js"]