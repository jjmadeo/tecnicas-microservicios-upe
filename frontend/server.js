const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = 3000;
const MS1_URL = process.env.MS1_URL || 'http://localhost:8080';

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/users', async (req, res) => {
  const { nombre, apellido, email, edad } = req.body;

  console.log('[FRONTEND] ================================================');
  console.log('[FRONTEND] Nueva solicitud de registro recibida');
  console.log(`[FRONTEND] Datos: nombre=${nombre}, apellido=${apellido}, email=${email}, edad=${edad}`);
  console.log(`[FRONTEND] Reenviando a MS1 (User Service) en: ${MS1_URL}/api/users`);

  try {
    const response = await axios.post(
      `${MS1_URL}/api/users`,
      { nombre, apellido, email, edad },
      { headers: { 'Content-Type': 'application/json' }, timeout: 15000 }
    );

    console.log(`[FRONTEND] MS1 respondio con status ${response.status}`);
    console.log(`[FRONTEND] userId=${response.data.userId} | correlationId=${response.data.correlationId}`);
    console.log('[FRONTEND] Evento propagado en la red de microservicios');
    console.log('[FRONTEND] ================================================');

    res.status(response.status).json(response.data);
  } catch (error) {
    if (error.response) {
      console.error(`[FRONTEND] MS1 retorno error ${error.response.status}: ${JSON.stringify(error.response.data)}`);
      res.status(error.response.status).json(error.response.data);
    } else {
      console.error(`[FRONTEND] No se pudo contactar MS1: ${error.message}`);
      res.status(503).json({
        error: 'User Service no disponible',
        message: 'El servicio esta iniciando, intenta nuevamente en unos segundos.'
      });
    }
  }
});

app.listen(PORT, () => {
  console.log('[FRONTEND] ================================================');
  console.log(`[FRONTEND] Servidor web iniciado en puerto ${PORT}`);
  console.log(`[FRONTEND] Formulario disponible en: http://localhost:${PORT}`);
  console.log(`[FRONTEND] MS1 User Service URL: ${MS1_URL}`);
  console.log('[FRONTEND] ================================================');
});
