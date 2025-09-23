package main

import (
    "encoding/json"
    "fmt"
    "log"
    "net/http"
    "os"
)

type Response struct {
    Service string `json:"service"`
    Status  string `json:"status"`
    Message string `json:"message"`
    Port    string `json:"port"`
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
    response := Response{
        Service: "go-service",
        Status:  "running",
        Message: "Go concurrency engine active",
        Port:    "8001",
    }
    
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(response)
}

func processHandler(w http.ResponseWriter, r *http.Request) {
    // Simulation de traitement Go-style avec goroutines
    result := map[string]interface{}{
        "service": "go-service",
        "action": "concurrent_processing",
        "goroutines": 4,
        "result": "Processing completed with Go concurrency",
    }
    
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(result)
}

func main() {
    port := os.Getenv("GO_PORT")
    if port == "" {
        port = "8001"
    }
    
    http.HandleFunc("/health", healthHandler)
    http.HandleFunc("/process", processHandler)
    
    fmt.Printf("Go service starting on :%s\n", port)
    log.Fatal(http.ListenAndServe(":"+port, nil))
}