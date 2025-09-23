# Dockerfile Simple - Architecture ILN Multi-Language
# Fichiers séparés : main.go + app.js + app.py + package.json

# ===============================================
# ÉTAPE 1: COMPILATION GO
# ===============================================
FROM golang:1.22-alpine AS go-builder
WORKDIR /go-app
COPY main.go .
RUN go mod init go-service && go build -o go-service main.go

# ===============================================  
# ÉTAPE 2: SETUP NODE.JS (Docker gère les dépendances)
# ===============================================
FROM node:18-alpine AS node-builder
WORKDIR /node-app

# Docker gère les dépendances au lieu de package.json
RUN npm install express --production

# Copier seulement le code applicatif
COPY app.js ./

# ===============================================
# ÉTAPE 3: CONTAINER FINAL PYTHON
# ===============================================
FROM python:3.11-slim AS final

# Installer Node.js dans le container final
RUN apt-get update && apt-get install -y \
    nodejs npm \
    && rm -rf /var/lib/apt/lists/*

# Installer les dépendances Python
RUN pip install --no-cache-dir \
    flask \
    requests

# Créer la structure des services
RUN mkdir -p /app/services/node-service

# Copier tous les services compilés/préparés
COPY --from=go-builder /go-app/go-service /app/services/
COPY --from=node-builder /node-app/ /app/services/node-service/

# Copier l'orchestrateur principal Python
COPY app.py /app/app.py

# Variables d'environnement
ENV PORT=8000
ENV PYTHONUNBUFFERED=1
ENV GO_PORT=8001
ENV NODE_PORT=8002

# Point de démarrage
WORKDIR /app
EXPOSE 8000 8001 8002

CMD ["python", "app.py"]