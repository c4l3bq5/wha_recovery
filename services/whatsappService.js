const axios = require('axios');

class WhatsAppService {
  constructor() {
    this.provider = process.env.WHATSAPP_PROVIDER || 'twilio';
    this.initializeProvider();
  }

  initializeProvider() {
    switch (this.provider) {
      case 'twilio':
        this.accountSid = process.env.TWILIO_ACCOUNT_SID;
        this.authToken = process.env.TWILIO_AUTH_TOKEN;
        this.fromNumber = process.env.TWILIO_WHATSAPP_NUMBER;
        this.apiUrl = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;
        break;
      
      case 'waba':
        this.wabaToken = process.env.WABA_TOKEN;
        this.wabaPhoneId = process.env.WABA_PHONE_ID;
        this.apiUrl = `https://graph.facebook.com/v18.0/${this.wabaPhoneId}/messages`;
        break;
      
      case 'baileys':
        break;
      
      default:
        console.warn('Proveedor de WhatsApp no configurado, usando modo mock');
        this.provider = 'mock';
    }
  }

  async sendVerificationCode(phoneNumber, code, userName = '') {
    try {
      const message = this.buildVerificationMessage(code, userName);
      const formattedPhone = this.formatPhoneNumber(phoneNumber);

      if (this.provider === 'mock') {
        console.log('[MOCK] WhatsApp enviado a:', formattedPhone);
        console.log('[MOCK] Codigo:', code);
        console.log('[MOCK] Mensaje:', message);
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

      console.log('Twilio response:', response.status);
      return response.status === 201;

    } catch (error) {
      console.error('Error Twilio:', error.response?.data || error.message);
      return false;
    }
  }

  async sendViaWABA(phone, message) {
    try {
      const response = await axios.post(
        this.apiUrl,
        {
          messaging_product: 'whatsapp',
          to: phone,
          type: 'template',
          template: {
            name: 'verification_code',
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

  buildVerificationMessage(code, userName = '') {
    const greeting = userName ? `Hola ${userName},` : 'Hola,';
    
    return `${greeting}\n\n` +
           `Sistema de Traumatologia\n\n` +
           `Tu codigo de verificacion es: *${code}*\n\n` +
           `Este codigo expira en 10 minutos.\n` +
           `Si no solicitaste este codigo, ignora este mensaje.`;
  }

  formatPhoneNumber(phone) {
    // IMPORTANTE: Convertir a string primero
    let cleaned = String(phone).replace(/\D/g, '');
    
    // Si no tiene codigo de pais, asumir Bolivia (+591)
    if (!cleaned.startsWith('591') && cleaned.length === 8) {
      cleaned = '591' + cleaned;
    }
    
    // Agregar + al inicio
    if (!cleaned.startsWith('+')) {
      cleaned = '+' + cleaned;
    }
    
    console.log(`Telefono formateado: ${phone} -> ${cleaned}`);
    return cleaned;
  }

  isValidPhoneNumber(phone) {
    const cleaned = String(phone).replace(/\D/g, '');
    // Bolivia: 591 + 8 digitos
    return /^(591)?[67]\d{7}$/.test(cleaned);
  }
}

module.exports = new WhatsAppService();