package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"runtime"
	"time"
)

type HealthResponse struct {
	Service   string `json:"service"`
	Status    string `json:"status"`
	Message   string `json:"message"`
	Port      string `json:"port"`
	GoVersion string `json:"go_version"`
	Uptime    string `json:"uptime"`
}

type ProcessResponse struct {
	Service       string      `json:"service"`
	Action        string      `json:"action"`
	Goroutines    int         `json:"goroutines"`
	Workers       int         `json:"workers"`
	Result        string      `json:"result"`
	ProcessingTime string     `json:"processing_time"`
	Data         interface{} `json:"data,omitempty"`
}

var startTime time.Time

func init() {
	startTime = time.Now()
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	uptime := time.Since(startTime).Round(time.Second).String()
	port := os.Getenv("GO_PORT")
	if port == "" {
		port = "8001"
	}

	response := HealthResponse{
		Service:   "go-service",
		Status:    "running",
		Message:   "Go concurrency engine active - Orchestrated by JavaScript",
		Port:      port,
		GoVersion: runtime.Version(),
		Uptime:    uptime,
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	json.NewEncoder(w).Encode(response)
}

func processHandler(w http.ResponseWriter, r *http.Request) {
	start := time.Now()
	
	// Simulation de traitement concurrent avec goroutines
	workers := 4
	ch := make(chan string, workers)
	
	for i := 0; i < workers; i++ {
		go func(id int) {
			// Simulation de traitement concurrent
			time.Sleep(time.Millisecond * 50)
			ch <- fmt.Sprintf("goroutine_%d_completed", id)
		}(i)
	}

	// Collecte des résultats
	var results []string
	for i := 0; i < workers; i++ {
		results = append(results, <-ch)
	}

	processingTime := time.Since(start)

	response := ProcessResponse{
		Service:        "go-service",
		Action:         "concurrent_processing",
		Goroutines:     runtime.NumGoroutine(),
		Workers:        workers,
		Result:         "Go concurrent processing completed successfully",
		ProcessingTime: processingTime.String(),
		Data:          results,
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	json.NewEncoder(w).Encode(response)
}

func statusHandler(w http.ResponseWriter, r *http.Request) {
	var m runtime.MemStats
	runtime.ReadMemStats(&m)

	status := map[string]interface{}{
		"service":          "go-service",
		"status":           "healthy",
		"uptime":          time.Since(startTime).Round(time.Second).String(),
		"goroutines":      runtime.NumGoroutine(),
		"memory_usage_mb": m.Alloc / 1024 / 1024,
		"gc_runs":         m.NumGC,
		"go_version":      runtime.Version(),
		"orchestrated_by": "JavaScript",
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	json.NewEncoder(w).Encode(status)
}

func corsHandler(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next(w, r)
	}
}

func main() {
	port := os.Getenv("GO_PORT")
	if port == "" {
		port = "8001"
	}

	// Routes
	http.HandleFunc("/health", corsHandler(healthHandler))
	http.HandleFunc("/process", corsHandler(processHandler))
	http.HandleFunc("/status", corsHandler(statusHandler))

	// Route racine
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"service":         "go-service",
			"message":         "Go service running under JavaScript orchestrator",
			"available_endpoints": []string{"/health", "/process", "/status"},
			"port":           port,
		})
	})

	fmt.Printf("Go service starting on :%s\n", port)
	fmt.Printf("Orchestrated by: JavaScript\n")
	fmt.Printf("Available endpoints: /health, /process, /status\n")
	
	log.Fatal(http.ListenAndServe(":"+port, nil))
}