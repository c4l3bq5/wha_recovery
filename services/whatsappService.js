const axios = require('axios');

/**
 * Servicio de WhatsApp Business API
 * Puedes usar Twilio, WhatsApp Business API, o Baileys (unofficial)
 * 
 * Este ejemplo usa Twilio como referencia
 * Para otros servicios, adapta los métodos según su API
 */
class WhatsAppService {
  constructor() {
    this.provider = process.env.WHATSAPP_PROVIDER || 'twilio'; // twilio, waba, baileys
    this.initializeProvider();
  }

  initializeProvider() {
    switch (this.provider) {
      case 'twilio':
        this.accountSid = process.env.TWILIO_ACCOUNT_SID;
        this.authToken = process.env.TWILIO_AUTH_TOKEN;
        this.fromNumber = process.env.TWILIO_WHATSAPP_NUMBER; // formato: whatsapp:+1234567890
        this.apiUrl = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;
        break;
      
      case 'waba': // WhatsApp Business API
        this.wabaToken = process.env.WABA_TOKEN;
        this.wabaPhoneId = process.env.WABA_PHONE_ID;
        this.apiUrl = `https://graph.facebook.com/v18.0/${this.wabaPhoneId}/messages`;
        break;
      
      case 'baileys': // Para desarrollo local
        // Implementar con @whiskeysockets/baileys si es necesario
        break;
      
      default:
        console.warn('Proveedor de WhatsApp no configurado, usando modo mock');
        this.provider = 'mock';
    }
  }

  /**
   * Envía código de verificación por WhatsApp
   * @param {string} phoneNumber - Número de teléfono
   * @param {string} code - Código de 6 dígitos
   * @param {string} userName - Nombre del usuario (opcional)
   */
  async sendVerificationCode(phoneNumber, code, userName = '') {
    try {
      const message = this.buildVerificationMessage(code, userName);
      const formattedPhone = this.formatPhoneNumber(phoneNumber);

      if (this.provider === 'mock') {
        console.log('📱 [MOCK] WhatsApp enviado a:', formattedPhone);
        console.log('📱 [MOCK] Código:', code);
        console.log('📱 [MOCK] Mensaje:', message);
        return true;
      }

      switch (this.provider) {
        case 'twilio':
          return await this.sendViaTwilio(formattedPhone, message);
        
        case 'waba':
          return await this.sendViaWABA(formattedPhone, message);
        
        default:
          throw new Error('Proveedor no soportado');
      }

    } catch (error) {
      console.error('Error al enviar WhatsApp:', error);
      return false;
    }
  }

  /**
   * Envío via Twilio
   */
  async sendViaTwilio(phone, message) {
    try {
      const params = new URLSearchParams();
      params.append('To', `whatsapp:${phone}`);
      params.append('From', this.fromNumber);
      params.append('Body', message);

      const response = await axios.post(this.apiUrl, params, {
        auth: {
          username: this.accountSid,
          password: this.authToken
        },
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      return response.status === 201;

    } catch (error) {
      console.error('Error Twilio:', error.response?.data || error.message);
      return false;
    }
  }

  /**
   * Envío via WhatsApp Business API (Meta)
   */
  async sendViaWABA(phone, message) {
    try {
      const response = await axios.post(
        this.apiUrl,
        {
          messaging_product: 'whatsapp',
          to: phone,
          type: 'template',
          template: {
            name: 'verification_code', // Debes crear este template en Meta
            language: { code: 'es' },
            components: [
              {
                type: 'body',
                parameters: [
                  { type: 'text', text: message }
                ]
              }
            ]
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.wabaToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.status === 200;

    } catch (error) {
      console.error('Error WABA:', error.response?.data || error.message);
      return false;
    }
  }

  /**
   * Construye el mensaje de verificación
   * @param {string} code - Código de 6 dígitos
   * @param {string} userName - Nombre del usuario (opcional)
   */
  buildVerificationMessage(code, userName = '') {
    const greeting = userName ? `Hola ${userName},` : 'Hola,';
    
    return `${greeting}\n\n` +
           `🔐 *Sistema de Rayos X*\n\n` +
           `Tu código de verificación es: *${code}*\n\n` +
           `Este código expira en 10 minutos.\n` +
           `Si no solicitaste este código, ignora este mensaje.`;
  }

  /**
   * Formatea número de teléfono al estándar internacional
   */
  formatPhoneNumber(phone) {
    // Remover caracteres no numéricos
    let cleaned = phone.replace(/\D/g, '');
    
    // Si no tiene código de país, asumir Bolivia (+591)
    if (!cleaned.startsWith('591') && cleaned.length === 8) {
      cleaned = '591' + cleaned;
    }
    
    // Agregar + al inicio
    if (!cleaned.startsWith('+')) {
      cleaned = '+' + cleaned;
    }
    
    return cleaned;
  }

  /**
   * Valida formato de número de teléfono
   */
  isValidPhoneNumber(phone) {
    const cleaned = phone.replace(/\D/g, '');
    // Bolivia: 591 + 8 dígitos
    return /^(591)?[67]\d{7}$/.test(cleaned);
  }
}

module.exports = new WhatsAppService();