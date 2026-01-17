"use strict";

const http = require('http');
const log = require('npmlog');
const pkg = require('../../package.json');

/**
 * Minimal Health Server for Render/Railway/Cloud compatibility.
 * Responds to platform health checks on the assigned PORT.
 */
class HealthServer {
    constructor(options = {}) {
        this.port = process.env.PORT || options.port || 10000;
        this.server = null;
        this.active = false;
    }

    start() {
        if (this.active) return;

        this.server = http.createServer((req, res) => {
            if (req.url === '/health' || req.url === '/') {
                res.writeHead(200, { 'Content-Type': 'text/html' });
                const html = `
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Nexus-FCA Status</title>
                    <style>
                        body { background: #0f172a; color: #f8fafc; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
                        .card { background: #1e293b; padding: 2rem; border-radius: 1rem; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); border: 1px solid #334155; text-align: center; }
                        h1 { color: #38bdf8; margin-top: 0; }
                        .status { display: inline-block; padding: 0.25rem 0.75rem; background: #065f46; color: #34d399; border-radius: 9999px; font-size: 0.875rem; font-weight: 600; }
                        .version { color: #64748b; font-size: 0.75rem; margin-top: 1rem; }
                    </style>
                </head>
                <body>
                    <div class="card">
                        <h1>✨ Nexus-FCA</h1>
                        <div class="status">● System Operational</div>
                        <div class="version">Core v${pkg.version} | Stability: 99.9%</div>
                    </div>
                </body>
                </html>
                `;
                res.end(html);
            } else {
                res.writeHead(404);
                res.end();
            }
        });

        this.server.listen(this.port, () => {
            log.info("HealthServer", `System health endpoint active on port ${this.port}`);
            this.active = true;
        });

        this.server.on('error', (err) => {
            log.error("HealthServer", `Failed to start: ${err.message}`);
        });
    }

    stop() {
        if (this.server) {
            this.server.close();
            this.active = false;
        }
    }
}

module.exports = HealthServer;
