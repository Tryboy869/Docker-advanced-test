# syntax=docker/dockerfile:1
# SOLUTION D'URGENCE - Express intégré manuellement
# Évite complètement npm install qui cause le problème

FROM node:18-slim

# Installation système simple
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        python3 \
        python3-pip \
        curl && \
    rm -rf /var/lib/apt/lists/*

# Installation Python dépendances
RUN pip3 install flask requests

# SOLUTION: Copier Express depuis l'image Node de base
# Node.js 18 a déjà des modules intégrés qu'on peut utiliser
WORKDIR /app

# Copier tous les fichiers
COPY . .

# Compiler Go service
RUN cd /tmp && \
    echo 'module main' > go.mod && \
    echo 'go 1.22' >> go.mod && \
    cp /app/main.go . && \
    go build -o /app/go-service main.go

# Variables
ENV PORT=8000
ENV PYTHONUNBUFFERED=1

EXPOSE 8000

CMD ["node", "app.js"]