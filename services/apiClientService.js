const axios = require('axios');

const MAIN_API_URL = process.env.MAIN_API_URL || 'https://api-med-op32.onrender.com/api';
const MASTER_TOKEN = process.env.API_MASTER_TOKEN;

class ApiClient {
  constructor() {
    this.client = axios.create({
      baseURL: MAIN_API_URL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        ...(MASTER_TOKEN && { 'Authorization': Bearer ${MASTER_TOKEN} })
      }
    });

    this.client.interceptors.request.use(
      (config) => {
        console.log(📤 API Request: ${config.method.toUpperCase()} ${config.url});
        return config;
      },
      (error) => {
        console.error('📤 API Request Error:', error.message);
        return Promise.reject(error);
      }
    );

    this.client.interceptors.response.use(
      (response) => {
        console.log(📥 API Response: ${response.status} ${response.config.url});
        return response;
      },
      (error) => {
        console.error('📥 API Response Error:', error.response?.status, error.message);
        return Promise.reject(error);
      }
    );
  }

  async findUserByIdentifier(identifier) {
    try {
      console.log(Buscando usuario por identifier: ${identifier});
      const response = await this.client.get(/users/by-identifier/internal/${encodeURIComponent(identifier)});
      const userData = response.data.data;
      
      if (userData && userData.id) {
        const result = {
          usuario_id: userData.id,
          usuario: userData.usuario,
          persona_id: userData.persona_id,
          activo: userData.activo || 'activo',
          nombre: userData.persona.nombre,
          telefono: userData.persona.telefono,
          ci: userData.persona.ci,
          mail: userData.persona.mail
        };
        
        console.log(Usuario encontrado: ${result.usuario});
        console.log(Telefono: ${result.telefono});
        return result;
      }
      
      console.log('Usuario no encontrado');
      return null;
    } catch (error) {
      if (error.response?.status === 404) {
        console.log('User not found by identifier');
        return null;
      }
      
      console.error('Error finding user by identifier:', error.message);
      return null;
    }
  }

  async updatePassword(userId, newPassword) {
    try {
      console.log(Actualizando contraseña para usuario ${userId});
      const response = await this.client.patch(/users/${userId}/internal/password, {
        contrasena: newPassword,
        es_temporal: false
      });
      console.log('Contraseña actualizada');
      return true;
    } catch (error) {
      console.error(Error updating password for user ${userId}:, error.message);
      return false;
    }
  }

  async createLog(userId, action, details) {
    try {
      const response = await this.client.post('/logs', {
        usuario_id: userId,
        accion: action,
        detalles: details,
        ip_address: '0.0.0.0',
        user_agent: 'Recovery-Service'
      });
      console.log('Log creado');
      return response.data;
    } catch (error) {
      console.error('Error creating log:', error.message);
      return null;
    }
  }

  async closeAllUserSessions(userId) {
    try {
      console.log(Cerrando todas las sesiones del usuario ${userId});
      const response = await this.client.delete(/sessions/user/${userId});
      console.log('Sesiones cerradas');
      return response.data;
    } catch (error) {
      console.error(Error closing sessions for user ${userId}:, error.message);
      return null;
    }
  }

  async getUserById(userId) {
    try {
      const response = await this.client.get(/users/${userId}/internal);
      return response.data.data || response.data;
    } catch (error) {
      console.error(Error getting user ${userId}:, error.message);
      throw new Error(No se pudo obtener el usuario: ${error.message});
    }
  }

  async healthCheck() {
    try {
      const response = await this.client.get('/health');
      return true;
    } catch (error) {
      console.error('Health check failed:', error.message);
      return false;
    }
  }
}

module.exports = new ApiClient();