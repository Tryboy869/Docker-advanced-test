# Alternative plus propre : partir d'une image Python
FROM python:3.11-slim AS final

# Installer Node.js dans l'image Python
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*

# Docker gère les dépendances Node.js
RUN npm install -g \
    express \
    node-fetch

# Docker gère les dépendances Python (plus de problème d'environnement géré)
RUN pip install --no-cache-dir \
    flask \
    psutil

# Compiler Go dans une étape séparée
FROM golang:1.22-alpine AS go-builder
WORKDIR /go-app
COPY main.go .
RUN go mod init go-service && go build -o go-service main.go

# Continuer avec l'image Python
FROM final

# Créer structure et copier fichiers
RUN mkdir -p /app/services
COPY --from=go-builder /go-app/go-service /app/services/
COPY app.js /app/app.js
COPY python-service.py /app/services/

ENV PORT=8000
ENV NODE_ENV=production
ENV PYTHONUNBUFFERED=1

EXPOSE 8000 8001 8002

WORKDIR /app
CMD ["node", "app.js"]