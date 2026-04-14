const express = require('express');
const Docker  = require('dockerode');
const path    = require('path');

const app    = express();
const docker = new Docker({ socketPath: '/var/run/docker.sock' });
const PORT   = 9999;

// Servicios a monitorear y su color en hex
const SERVICES = [
  { name: 'ms1-user-service',          color: '#60a5fa', label: 'USER-SERVICE     ' },
  { name: 'ms2-account-service',       color: '#34d399', label: 'ACCOUNT-SERVICE  ' },
  { name: 'ms3-notification-service',  color: '#f59e0b', label: 'NOTIFICATION-SVC ' },
  { name: 'ms4-audit-service',         color: '#a78bfa', label: 'AUDIT-SERVICE    ' },
  { name: 'ms5-card-service',          color: '#f87171', label: 'CARD-SERVICE     ' },
  { name: 'frontend',                  color: '#94a3b8', label: 'FRONTEND         ' },
];

app.use(express.static(path.join(__dirname, 'public')));

// SSE endpoint — stream de todos los logs
app.get('/logs', (req, res) => {
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.flushHeaders();

  const streams = [];

  SERVICES.forEach(({ name, color, label }) => {
    docker.getContainer(name).logs(
      { follow: true, stdout: true, stderr: true, tail: 50, timestamps: false },
      (err, stream) => {
        if (err) {
          const msg = `data: ${JSON.stringify({ color: '#ef4444', label: 'LOG-VIEWER      ', text: `[${name}] no disponible: ${err.message}` })}\n\n`;
          res.write(msg);
          return;
        }

        // Docker multiplexed stream → text
        docker.modem.demuxStream(stream, {
          write(chunk) {
            const lines = chunk.toString('utf8').split('\n');
            lines.forEach(line => {
              const text = line.trim();
              if (text) {
                res.write(`data: ${JSON.stringify({ color, label, text })}\n\n`);
              }
            });
          }
        }, {
          write(chunk) {
            const lines = chunk.toString('utf8').split('\n');
            lines.forEach(line => {
              const text = line.trim();
              if (text) {
                res.write(`data: ${JSON.stringify({ color, label, text })}\n\n`);
              }
            });
          }
        });

        streams.push(stream);
      }
    );
  });

  req.on('close', () => {
    streams.forEach(s => { try { s.destroy(); } catch(_) {} });
  });
});

app.listen(PORT, () => {
  console.log(`[LOG-VIEWER] Visor de logs corriendo en http://localhost:${PORT}`);
});
