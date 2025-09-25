# syntax=docker/dockerfile:1

# SOLUTION DÉFINITIVE - Architecture 1B JavaScript Orchestrateur
# Résout : npm "idealTree" + pip "externally-managed-environment"

# === STAGE 1: BUILD GO SERVICE ===
FROM golang:1.22-alpine AS go-builder
WORKDIR /go-service
COPY main.go .

RUN go mod init go-service && \
    go build -ldflags="-s -w" -o go-service main.go && \
    chmod +x go-service

# === STAGE 2: PRÉPARER SERVICE PYTHON ===  
FROM python:3.11-slim AS python-builder
WORKDIR /python-service

# SOLUTION PEP 668 : Forcer installation avec --break-system-packages
RUN pip install --break-system-packages flask requests

COPY python-service.py .

# === STAGE FINAL: NODE.JS ORCHESTRATEUR ===
FROM node:18-slim AS final

# Installation système + Python avec gestion PEP 668
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        python3 \
        python3-pip \
        ca-certificates \
        curl && \
    rm -rf /var/lib/apt/lists/*

# SOLUTION npm idealTree : Installation via package.json pré-créé
WORKDIR /tmp
RUN echo '{"dependencies":{"express":"^4.18.2"}}' > package.json && \
    npm install --no-audit --no-fund --production

# SOLUTION PEP 668 : Installation Python avec flag approprié  
RUN pip3 install --break-system-packages flask requests

# Configuration application
RUN mkdir -p /app/services
WORKDIR /app

# Copier node_modules depuis installation temp
RUN cp -r /tmp/node_modules /app/

# Copier services compilés
COPY --from=go-builder --chmod=755 /go-service/go-service /app/services/
COPY --from=python-builder /python-service/ /app/services/python-service/

# Copier orchestrateur JavaScript
COPY app.js /app/

# Configuration sécurisée
RUN groupadd -r appgroup && \
    useradd -r -g appgroup -s /bin/false appuser && \
    chown -R appuser:appgroup /app

# Variables d'environnement
ENV PORT=8000
ENV PYTHONUNBUFFERED=1
ENV NODE_ENV=production

# Configuration finale
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

USER appuser

CMD ["node", "app.js"]