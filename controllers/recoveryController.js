const apiClient = require('../services/apiClientService');
const whatsappService = require('../services/whatsappService');
const crypto = require('crypto');

// Almacenamiento temporal de codigos (en produccion usa Redis)
const verificationCodes = new Map();
const CODE_EXPIRY = 10 * 60 * 1000; // 10 minutos

class RecoveryController {
  // Paso 1: Solicitar codigo de verificacion
  async requestCode(req, res) {
    try {
      const { identifier } = req.body; // CI o correo

      if (!identifier) {
        return res.status(400).json({ 
          error: 'Se requiere CI o correo electronico' 
        });
      }

      // Buscar usuario por CI o mail usando el API principal
      const user = await apiClient.findUserByIdentifier(identifier);

      if (!user) {
        // Por seguridad, no revelar si el usuario existe o no
        return res.json({ 
          message: 'Si el usuario existe, recibira un codigo de verificacion',
          sent: false
        });
      }

      // Verificar que el usuario este activo
      if (user.activo !== 'activo') {
        return res.status(400).json({ 
          error: 'El usuario no esta activo' 
        });
      }

      if (!user.telefono) {
        return res.status(400).json({ 
          error: 'El usuario no tiene un numero de telefono registrado' 
        });
      }

      // Generar codigo de 6 digitos
      const code = crypto.randomInt(100000, 999999).toString();
      
      // Guardar codigo con expiracion
      verificationCodes.set(user.usuario_id, {
        code,
        phone: user.telefono,
        expiresAt: Date.now() + CODE_EXPIRY,
        attempts: 0
      });

      // Enviar codigo por WhatsApp (con nombre del usuario)
      const sent = await whatsappService.sendVerificationCode(
        user.telefono, 
        code,
        user.nombre
      );

      if (!sent) {
        verificationCodes.delete(user.usuario_id);
        return res.status(500).json({ 
          error: 'Error al enviar el codigo de verificacion' 
        });
      }

      // Log de auditoria
      await apiClient.createLog(
        user.usuario_id,
        'SOLICITUD_CODIGO_RECUPERACION',
        `Codigo enviado al telefono ${this.maskPhone(user.telefono)}`
      );

      res.json({ 
        message: 'Codigo de verificacion enviado por WhatsApp',
        sent: true,
        expiresIn: CODE_EXPIRY / 1000 // segundos
      });

    } catch (error) {
      console.error('Error en requestCode:', error);
      res.status(500).json({ 
        error: 'Error al procesar la solicitud',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Paso 2: Verificar codigo
  async verifyCode(req, res) {
    try {
      const { identifier, code } = req.body;

      if (!identifier || !code) {
        return res.status(400).json({ 
          error: 'Se requiere identificador y codigo' 
        });
      }

      const user = await apiClient.findUserByIdentifier(identifier);

      if (!user) {
        return res.status(400).json({ 
          error: 'Codigo invalido o expirado' 
        });
      }

      const storedData = verificationCodes.get(user.usuario_id);

      if (!storedData) {
        return res.status(400).json({ 
          error: 'Codigo invalido o expirado' 
        });
      }

      // Verificar expiracion
      if (Date.now() > storedData.expiresAt) {
        verificationCodes.delete(user.usuario_id);
        await apiClient.createLog(
          user.usuario_id,
          'CODIGO_EXPIRADO',
          'Intento de verificacion con codigo expirado'
        );
        return res.status(400).json({ 
          error: 'Codigo expirado, solicite uno nuevo' 
        });
      }

      // Verificar intentos
      if (storedData.attempts >= 3) {
        verificationCodes.delete(user.usuario_id);
        await apiClient.createLog(
          user.usuario_id,
          'INTENTOS_MAXIMOS_EXCEDIDOS',
          'Maximo de intentos de verificacion excedidos'
        );
        return res.status(429).json({ 
          error: 'Maximo de intentos excedidos' 
        });
      }

      // Verificar codigo
      if (storedData.code !== code) {
        storedData.attempts++;
        await apiClient.createLog(
          user.usuario_id,
          'CODIGO_INCORRECTO',
          `Intento fallido (${storedData.attempts}/3)`
        );
        return res.status(400).json({ 
          error: 'Codigo incorrecto',
          attemptsLeft: 3 - storedData.attempts
        });
      }

      // Generar token temporal para cambio de contrasena
      const resetToken = crypto.randomBytes(32).toString('hex');
      const tokenExpiry = Date.now() + 15 * 60 * 1000; // 15 minutos

      // Guardar token
      verificationCodes.set(`reset_${user.usuario_id}`, {
        token: resetToken,
        expiresAt: tokenExpiry
      });

      // Limpiar codigo de verificacion
      verificationCodes.delete(user.usuario_id);

      await apiClient.createLog(
        user.usuario_id,
        'CODIGO_VERIFICADO',
        'Codigo verificado correctamente'
      );

      res.json({ 
        message: 'Codigo verificado correctamente',
        resetToken,
        expiresIn: 15 * 60 // segundos
      });

    } catch (error) {
      console.error('Error en verifyCode:', error);
      res.status(500).json({ 
        error: 'Error al verificar el codigo',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Paso 3: Cambiar contrasena
  async resetPassword(req, res) {
    try {
      const { identifier, resetToken, newPassword } = req.body;

      if (!identifier || !resetToken || !newPassword) {
        return res.status(400).json({ 
          error: 'Datos incompletos' 
        });
      }

      // Validar contrasena
      if (newPassword.length < 8) {
        return res.status(400).json({ 
          error: 'La contrasena debe tener al menos 8 caracteres' 
        });
      }

      const user = await apiClient.findUserByIdentifier(identifier);

      if (!user) {
        return res.status(400).json({ 
          error: 'Token invalido o expirado' 
        });
      }

      const storedToken = verificationCodes.get(`reset_${user.usuario_id}`);

      if (!storedToken || storedToken.token !== resetToken) {
        await apiClient.createLog(
          user.usuario_id,
          'TOKEN_RESET_INVALIDO',
          'Intento de cambio de contrasena con token invalido'
        );
        return res.status(400).json({ 
          error: 'Token invalido o expirado' 
        });
      }

      if (Date.now() > storedToken.expiresAt) {
        verificationCodes.delete(`reset_${user.usuario_id}`);
        return res.status(400).json({ 
          error: 'Token expirado' 
        });
      }

      // Cambiar contrasena usando el API principal
      const updated = await apiClient.updatePassword(user.usuario_id, newPassword);

      if (!updated) {
        return res.status(500).json({ 
          error: 'Error al actualizar la contrasena' 
        });
      }

      // Limpiar token
      verificationCodes.delete(`reset_${user.usuario_id}`);

      // Cerrar todas las sesiones activas del usuario
      await apiClient.closeAllUserSessions(user.usuario_id);

      await apiClient.createLog(
        user.usuario_id,
        'CONTRASENA_RESTABLECIDA',
        'Contrasena restablecida exitosamente via recuperacion'
      );

      res.json({ 
        message: 'Contrasena actualizada correctamente',
        success: true
      });

    } catch (error) {
      console.error('Error en resetPassword:', error);
      res.status(500).json({ 
        error: 'Error al restablecer la contrasena',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Utilidad: Enmascarar numero de telefono
  maskPhone(phone) {
    if (!phone) return '****';
    const phoneStr = String(phone);
    if (phoneStr.length < 4) return '****';
    return phoneStr.slice(0, -4).replace(/\d/g, '*') + phoneStr.slice(-4);
  }

  // Limpiar codigos expirados (llamar periodicamente)
  cleanExpiredCodes() {
    const now = Date.now();
    for (const [key, data] of verificationCodes.entries()) {
      if (data.expiresAt && now > data.expiresAt) {
        verificationCodes.delete(key);
      }
    }
  }
}

// Limpiar codigos expirados cada 5 minutos
setInterval(() => {
  const controller = new RecoveryController();
  controller.cleanExpiredCodes();
}, 5 * 60 * 1000);

module.exports = new RecoveryController();