const apiClient = require('../services/apiClientService'); // ← CAMBIO: usar apiClient en lugar de db
const whatsappService = require('../services/whatsappService');
const crypto = require('crypto');

// Almacenamiento temporal de códigos (en producción usa Redis)
const verificationCodes = new Map();
const CODE_EXPIRY = 10 * 60 * 1000; // 10 minutos

class RecoveryController {
  // Paso 1: Solicitar código de verificación
  async requestCode(req, res) {
    try {
      const { identifier } = req.body; // CI o correo

      if (!identifier) {
        return res.status(400).json({ 
          error: 'Se requiere CI o correo electrónico' 
        });
      }

      // Buscar usuario por CI o mail usando el API principal
      const user = await apiClient.findUserByIdentifier(identifier);

      if (!user) {
        // Por seguridad, no revelar si el usuario existe o no
        return res.json({ 
          message: 'Si el usuario existe, recibirá un código de verificación',
          sent: false
        });
      }

      // Verificar que el usuario esté activo
      if (user.activo !== 'activo') {
        return res.status(400).json({ 
          error: 'El usuario no está activo' 
        });
      }

      if (!user.telefono) {
        return res.status(400).json({ 
          error: 'El usuario no tiene un número de teléfono registrado' 
        });
      }

      // Generar código de 6 dígitos
      const code = crypto.randomInt(100000, 999999).toString();
      
      // Guardar código con expiración
      verificationCodes.set(user.usuario_id, {
        code,
        phone: user.telefono,
        expiresAt: Date.now() + CODE_EXPIRY,
        attempts: 0
      });

      // Enviar código por WhatsApp (con nombre del usuario)
      const sent = await whatsappService.sendVerificationCode(
        user.telefono, 
        code,
        user.nombre // ← CAMBIO: pasamos el nombre
      );

      if (!sent) {
        verificationCodes.delete(user.usuario_id);
        return res.status(500).json({ 
          error: 'Error al enviar el código de verificación' 
        });
      }

      // Log de auditoría
      await apiClient.createLog(
        user.usuario_id,
        'SOLICITUD_CODIGO_RECUPERACION',
        `Código enviado al teléfono ${this.maskPhone(user.telefono)}`
      );

      res.json({ 
        message: 'Código de verificación enviado por WhatsApp',
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

  // Paso 2: Verificar código
  async verifyCode(req, res) {
    try {
      const { identifier, code } = req.body;

      if (!identifier || !code) {
        return res.status(400).json({ 
          error: 'Se requiere identificador y código' 
        });
      }

      const user = await apiClient.findUserByIdentifier(identifier);

      if (!user) {
        return res.status(400).json({ 
          error: 'Código inválido o expirado' 
        });
      }

      const storedData = verificationCodes.get(user.usuario_id);

      if (!storedData) {
        return res.status(400).json({ 
          error: 'Código inválido o expirado' 
        });
      }

      // Verificar expiración
      if (Date.now() > storedData.expiresAt) {
        verificationCodes.delete(user.usuario_id);
        await apiClient.createLog(
          user.usuario_id,
          'CODIGO_EXPIRADO',
          'Intento de verificación con código expirado'
        );
        return res.status(400).json({ 
          error: 'Código expirado, solicite uno nuevo' 
        });
      }

      // Verificar intentos
      if (storedData.attempts >= 3) {
        verificationCodes.delete(user.usuario_id);
        await apiClient.createLog(
          user.usuario_id,
          'INTENTOS_MAXIMOS_EXCEDIDOS',
          'Máximo de intentos de verificación excedidos'
        );
        return res.status(429).json({ 
          error: 'Máximo de intentos excedidos' 
        });
      }

      // Verificar código
      if (storedData.code !== code) {
        storedData.attempts++;
        await apiClient.createLog(
          user.usuario_id,
          'CODIGO_INCORRECTO',
          `Intento fallido (${storedData.attempts}/3)`
        );
        return res.status(400).json({ 
          error: 'Código incorrecto',
          attemptsLeft: 3 - storedData.attempts
        });
      }

      // Generar token temporal para cambio de contraseña
      const resetToken = crypto.randomBytes(32).toString('hex');
      const tokenExpiry = Date.now() + 15 * 60 * 1000; // 15 minutos

      // Guardar token
      verificationCodes.set(`reset_${user.usuario_id}`, {
        token: resetToken,
        expiresAt: tokenExpiry
      });

      // Limpiar código de verificación
      verificationCodes.delete(user.usuario_id);

      await apiClient.createLog(
        user.usuario_id,
        'CODIGO_VERIFICADO',
        'Código verificado correctamente'
      );

      res.json({ 
        message: 'Código verificado correctamente',
        resetToken,
        expiresIn: 15 * 60 // segundos
      });

    } catch (error) {
      console.error('Error en verifyCode:', error);
      res.status(500).json({ 
        error: 'Error al verificar el código',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Paso 3: Cambiar contraseña
  async resetPassword(req, res) {
    try {
      const { identifier, resetToken, newPassword } = req.body;

      if (!identifier || !resetToken || !newPassword) {
        return res.status(400).json({ 
          error: 'Datos incompletos' 
        });
      }

      // Validar contraseña
      if (newPassword.length < 8) {
        return res.status(400).json({ 
          error: 'La contraseña debe tener al menos 8 caracteres' 
        });
      }

      const user = await apiClient.findUserByIdentifier(identifier);

      if (!user) {
        return res.status(400).json({ 
          error: 'Token inválido o expirado' 
        });
      }

      const storedToken = verificationCodes.get(`reset_${user.usuario_id}`);

      if (!storedToken || storedToken.token !== resetToken) {
        await apiClient.createLog(
          user.usuario_id,
          'TOKEN_RESET_INVALIDO',
          'Intento de cambio de contraseña con token inválido'
        );
        return res.status(400).json({ 
          error: 'Token inválido o expirado' 
        });
      }

      if (Date.now() > storedToken.expiresAt) {
        verificationCodes.delete(`reset_${user.usuario_id}`);
        return res.status(400).json({ 
          error: 'Token expirado' 
        });
      }

      // Cambiar contraseña usando el API principal
      const updated = await apiClient.updatePassword(user.usuario_id, newPassword);

      if (!updated) {
        return res.status(500).json({ 
          error: 'Error al actualizar la contraseña' 
        });
      }

      // Limpiar token
      verificationCodes.delete(`reset_${user.usuario_id}`);

      // Cerrar todas las sesiones activas del usuario
      await apiClient.closeAllUserSessions(user.usuario_id);

      await apiClient.createLog(
        user.usuario_id,
        'CONTRASENA_RESTABLECIDA',
        'Contraseña restablecida exitosamente vía recuperación'
      );

      res.json({ 
        message: 'Contraseña actualizada correctamente',
        success: true
      });

    } catch (error) {
      console.error('Error en resetPassword:', error);
      res.status(500).json({ 
        error: 'Error al restablecer la contraseña',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Utilidad: Enmascarar número de teléfono
  maskPhone(phone) {
    if (!phone || phone.length < 4) return '****';
    return phone.slice(0, -4).replace(/\d/g, '*') + phone.slice(-4);
  }

  // Limpiar códigos expirados (llamar periódicamente)
  cleanExpiredCodes() {
    const now = Date.now();
    for (const [key, data] of verificationCodes.entries()) {
      if (data.expiresAt && now > data.expiresAt) {
        verificationCodes.delete(key);
      }
    }
  }
}

// Limpiar códigos expirados cada 5 minutos
setInterval(() => {
  const controller = new RecoveryController();
  controller.cleanExpiredCodes();
}, 5 * 60 * 1000);

module.exports = new RecoveryController();