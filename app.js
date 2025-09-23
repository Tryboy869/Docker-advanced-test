const express = require('express');
const app = express();

// Middleware
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        service: 'node-service',
        status: 'running',
        message: 'Node.js reactive engine active',
        port: process.env.NODE_PORT || '8002'
    });
});

// Reactive processing endpoint
app.post('/process', (req, res) => {
    const { data, eventType } = req.body;
    
    // Simulation de traitement réactif JavaScript-style
    const result = {
        service: 'node-service',
        action: 'reactive_processing',
        eventType: eventType || 'default',
        eventId: `evt_${Date.now()}`,
        data: data,
        processed: true,
        timestamp: new Date().toISOString(),
        asyncReady: true
    };
    
    // Simulation d'événement asynchrone
    setTimeout(() => {
        console.log(`Event processed: ${result.eventId}`);
    }, 100);
    
    res.json(result);
});

// WebSocket-like event simulation
app.get('/events/:eventType', (req, res) => {
    const { eventType } = req.params;
    
    res.json({
        service: 'node-service',
        eventType: eventType,
        message: `Event ${eventType} registered`,
        reactive: true,
        callback: `Event will be processed asynchronously`
    });
});

const port = process.env.NODE_PORT || 8002;

app.listen(port, () => {
    console.log(`Node service starting on :${port}`);
});

module.exports = app;