# syntax=docker/dockerfile:1
# check=error=true

# ARCHITECTURE 1B CORRIGÉE - JavaScript Orchestrateur Multi-Language
# Basée sur les validations expérimentales et syntaxe Docker 2025

# === STAGE 1: BUILD GO SERVICE ===
FROM golang:1.22-alpine AS go-builder
WORKDIR /go-service

# Optimisation cache - Copier go.mod en premier si existe
COPY main.go .

# Initialiser module et builder avec optimisations
RUN <<EOF
go mod init go-service
go build -ldflags="-s -w" -o go-service main.go
chmod +x go-service
EOF

# === STAGE 2: PRÉPARER SERVICE PYTHON ===
FROM python:3.11-slim AS python-builder
WORKDIR /python-service

# Installation dépendances Python avec cache mount
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --no-deps flask requests

# Copier service Python
COPY service.py .

# === STAGE FINAL: NODE.JS ORCHESTRATEUR ===
FROM node:18-slim AS final

# Installation runtimes dans l'ordre correct
RUN <<EOF
apt-get update
apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*
EOF

# Installation dépendances Node.js avec cache mount
RUN --mount=type=cache,target=/root/.npm \
    npm install express

# Installation dépendances Python dans le container final
RUN --mount=type=cache,target=/root/.cache/pip \
    pip3 install --no-cache-dir flask requests

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