const axios = require('axios');

const MAIN_API_URL = process.env.MAIN_API_URL || 'http://localhost:3000/api';
const MASTER_TOKEN = process.env.API_MASTER_TOKEN; // Token para autenticación entre servicios

class ApiClient {
  constructor() {
    this.client = axios.create({
      baseURL: MAIN_API_URL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        // Agregar token de autorización para llamadas entre servicios
        ...(MASTER_TOKEN && { 'Authorization': `Bearer ${MASTER_TOKEN}` })
      }
    });

    // Interceptor para logs
    this.client.interceptors.request.use(
      (config) => {
        console.log(`📤 API Request: ${config.method.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        console.error('📤 API Request Error:', error.message);
        return Promise.reject(error);
      }
    );

    this.client.interceptors.response.use(
      (response) => {
        console.log(`📥 API Response: ${response.status} ${response.config.url}`);
        return response;
      },
      (error) => {
        console.error('📥 API Response Error:', error.response?.status, error.message);
        return Promise.reject(error);
      }
    );
  }

  // ==================== MÉTODOS DE USUARIO ====================

  /**
   * Obtener usuario por ID
   */
  async getUserById(userId) {
    try {
      const response = await this.client.get(`/users/${userId}`);
      return response.data.data || response.data;
    } catch (error) {
      console.error(`❌ Error getting user ${userId}:`, error.message);
      throw new Error(`No se pudo obtener el usuario: ${error.message}`);
    }
  }


  async verifyCredentials(username, password) {
    try {
      const response = await this.client.post('/auth/login', {
        usuario: username,
        contrasena: password
      });
      return response.data;
    } catch (error) {
      console.error('❌ Error verifying credentials:', error.message);
      throw new Error('Credenciales inválidas');
    }
  }

  async updateUser(userId, updateData) {
    try {
      const response = await this.client.put(`/users/${userId}`, updateData);
      return response.data;
    } catch (error) {
      console.error(`❌ Error updating user ${userId}:`, error.message);
      throw new Error(`No se pudo actualizar el usuario: ${error.message}`);
    }
  }

  async updateUserPassword(userId, passwordData) {
    try {
      const response = await this.client.patch(`/users/${userId}/password`, passwordData);
      return response.data.data || response.data;
    } catch (error) {
      console.error(`❌ Error updating password for user ${userId}:`, error.message);
      throw new Error(`No se pudo actualizar la contraseña: ${error.message}`);
    }
  }


  async enableMFA(userId, secret) {
    try {
      const response = await this.client.patch(`/users/${userId}/enable-mfa`, {
        mfa_secreto: secret
      });
      return response.data;
    } catch (error) {
      console.error(`❌ Error enabling MFA for user ${userId}:`, error.message);
      throw new Error(`No se pudo habilitar MFA: ${error.message}`);
    }
  }

  async disableMFA(userId) {
    try {
      const response = await this.client.patch(`/users/${userId}/disable-mfa`);
      return response.data;
    } catch (error) {
      console.error(`❌ Error disabling MFA for user ${userId}:`, error.message);
      throw new Error(`No se pudo deshabilitar MFA: ${error.message}`);
    }
  }

  async updateMFASettings(userId, mfaData) {
    try {
      const response = await this.client.patch(`/users/${userId}/enable-mfa`, mfaData);
      return response.data;
    } catch (error) {
      console.error(`❌ Error updating MFA settings for user ${userId}:`, error.message);
      throw new Error(`No se pudo actualizar MFA: ${error.message}`);
    }
  }

  async createSession(userId, token) {
    try {
      const response = await this.client.post('/sessions', {
        usuario_id: userId,
        token: token
      });
      return response.data;
    } catch (error) {
      console.error(`❌ Error creating session for user ${userId}:`, error.message);
      throw new Error(`No se pudo crear la sesión: ${error.message}`);
    }
  }

 
  async closeSession(token) {
    try {
      const response = await this.client.post('/sessions/logout', {}, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      return response.data;
    } catch (error) {
      console.error('❌ Error closing session:', error.message);
      throw new Error(`No se pudo cerrar la sesión: ${error.message}`);
    }
  }


  async healthCheck() {
    try {
      const response = await this.client.get('/health');
      return response.data;
    } catch (error) {
      console.error('❌ Health check failed:', error.message);
      return { status: 'error', message: error.message };
    }
  }


  async getAuthenticatedUser(token) {
    try {
      const response = await this.client.get('/auth/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      return response.data.data || response.data;
    } catch (error) {
      console.error('❌ Error getting authenticated user:', error.message);
      throw new Error(`No se pudo obtener usuario autenticado: ${error.message}`);
    }
  }
}

module.exports = new ApiClient();