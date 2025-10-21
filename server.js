const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const recoveryRoutes = require('./routes/recovery');
const apiClient = require('./services/apiClientService'); // ← NUEVO: importar apiClient

const app = express();
const PORT = process.env.PORT || 3002; // ← CAMBIO: usar puerto 3002

// Middlewares de seguridad
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true
}));
app.use(express.json());

// Rate limiting para prevenir abuso
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // límite de 10 solicitudes por ventana
  message: 'Demasiados intentos, por favor intente más tarde'
});

app.use('/api/recovery', limiter);

// Rutas
app.use('/api/recovery', recoveryRoutes);

// Health check - MODIFICADO: verificar conexión con API principal
app.get('/health', async (req, res) => {
  try {
    // Verificar conexión con API principal
    const apiHealthy = await apiClient.healthCheck();
    
    res.json({ 
      status: apiHealthy ? 'ok' : 'degraded',
      service: 'password_recovery_api',
      mainApi: apiHealthy ? 'connected' : 'disconnected',
      mainApiUrl: process.env.MAIN_API_URL,
      whatsappProvider: process.env.WHATSAPP_PROVIDER || 'mock',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Manejo de errores
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Error interno del servidor',
    timestamp: new Date().toISOString()
  });
});

// Ruta no encontrada
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Ruta no encontrada',
    path: req.path 
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Password Recovery API corriendo en puerto ${PORT}`);
  console.log(`📡 Conectado a API principal: ${process.env.MAIN_API_URL}`);
  console.log(`📱 Proveedor WhatsApp: ${process.env.WHATSAPP_PROVIDER || 'mock'}`);
});

module.exports = app;