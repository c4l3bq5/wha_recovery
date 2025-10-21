const axios = require('axios');

/**
 * Cliente para comunicarse con el API principal
 */
class ApiClientService {
  constructor() {
    this.baseUrl = process.env.MAIN_API_URL;
    this.masterToken = process.env.API_MASTER_TOKEN;
    
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.masterToken}`
      },
      timeout: 10000 // 10 segundos
    });

    // Interceptor para logging
    this.client.interceptors.request.use(
      (config) => {
        console.log(`[API Request] ${config.method.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        console.error('[API Request Error]', error);
        return Promise.reject(error);
      }
    );

    this.client.interceptors.response.use(
      (response) => {
        console.log(`[API Response] ${response.status} ${response.config.url}`);
        return response;
      },
      (error) => {
        console.error('[API Response Error]', error.response?.data || error.message);
        return Promise.reject(error);
      }
    );
  }

  /**
   * Busca usuario por CI o email
   */
  async findUserByIdentifier(identifier) {
    try {
      // Buscar en persons usando el endpoint de búsqueda
      const response = await this.client.get('/persons/search', {
        params: { q: identifier }
      });

      if (!response.data || response.data.length === 0) {
        return null;
      }

      // Obtener el primer resultado
      const person = response.data[0];

      // Ahora obtener el usuario asociado a esta persona
      const userResponse = await this.client.get('/users', {
        params: { persona_id: person.id }
      });

      if (!userResponse.data || userResponse.data.length === 0) {
        return null;
      }

      const user = userResponse.data[0];

      // Combinar datos de persona y usuario
      return {
        usuario_id: user.id,
        usuario: user.usuario,
        persona_id: person.id,
        ci: person.ci,
        mail: person.mail,
        telefono: person.telefono,
        nombre: person.nombre,
        a_paterno: person.a_paterno,
        a_materno: person.a_materno,
        activo: user.activo
      };

    } catch (error) {
      console.error('Error en findUserByIdentifier:', error);
      
      // Si es 404, el usuario no existe
      if (error.response?.status === 404) {
        return null;
      }
      
      throw error;
    }
  }

  /**
   * Actualiza la contraseña de un usuario
   */
  async updatePassword(userId, newPassword) {
    try {
      const response = await this.client.put(`/users/${userId}`, {
        contrasena: newPassword
      });

      return response.status === 200;

    } catch (error) {
      console.error('Error en updatePassword:', error);
      throw error;
    }
  }

  /**
   * Cierra todas las sesiones de un usuario
   */
  async closeAllUserSessions(userId) {
    try {
      const response = await this.client.delete(`/sessions/user/${userId}`);
      return response.status === 200;

    } catch (error) {
      console.error('Error en closeAllUserSessions:', error);
      // No es crítico si falla, continuar
      return false;
    }
  }

  /**
   * Crea un log de auditoría
   */
  async createLog(userId, action, description) {
    try {
      // Si tu API tiene endpoint de logs, usarlo
      // Si no, los triggers de BD lo manejarán automáticamente
      const response = await this.client.post('/logs', {
        usuario_id: userId,
        accion: action,
        descripcion: description
      });

      return response.status === 201 || response.status === 200;

    } catch (error) {
      console.error('Error en createLog:', error);
      // Los logs son importantes pero no críticos
      // Los triggers de BD crearán logs automáticamente
      return false;
    }
  }

  /**
   * Obtiene información básica del usuario
   */
  async getUserInfo(userId) {
    try {
      const response = await this.client.get(`/users/${userId}`);
      return response.data;

    } catch (error) {
      console.error('Error en getUserInfo:', error);
      return null;
    }
  }

  /**
   * Health check del API principal
   */
  async healthCheck() {
    try {
      const response = await this.client.get('/health', {
        timeout: 5000
      });
      return response.status === 200;
    } catch (error) {
      console.error('Health check failed:', error.message);
      return false;
    }
  }
}

module.exports = new ApiClientService();