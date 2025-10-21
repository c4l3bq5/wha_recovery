/**
 * Middleware de validación para endpoints de recuperación
 */

class ValidationMiddleware {
  /**
   * Valida el body de request-code
   */
  validateRequestCode(req, res, next) {
    const { identifier } = req.body;

    if (!identifier || typeof identifier !== 'string') {
      return res.status(400).json({
        error: 'El campo "identifier" es requerido y debe ser un string',
        field: 'identifier'
      });
    }

    // Sanitizar
    req.body.identifier = identifier.trim();

    if (req.body.identifier.length === 0) {
      return res.status(400).json({
        error: 'El identificador no puede estar vacío',
        field: 'identifier'
      });
    }

    next();
  }

  /**
   * Valida el body de verify-code
   */
  validateVerifyCode(req, res, next) {
    const { identifier, code } = req.body;

    // Validar identifier
    if (!identifier || typeof identifier !== 'string') {
      return res.status(400).json({
        error: 'El campo "identifier" es requerido',
        field: 'identifier'
      });
    }

    // Validar code
    if (!code || typeof code !== 'string') {
      return res.status(400).json({
        error: 'El campo "code" es requerido',
        field: 'code'
      });
    }

    // Sanitizar
    req.body.identifier = identifier.trim();
    req.body.code = code.trim();

    // Validar formato del código (6 dígitos)
    if (!/^\d{6}$/.test(req.body.code)) {
      return res.status(400).json({
        error: 'El código debe tener exactamente 6 dígitos',
        field: 'code'
      });
    }

    next();
  }

  /**
   * Valida el body de reset-password
   */
  validateResetPassword(req, res, next) {
    const { identifier, resetToken, newPassword } = req.body;

    // Validar identifier
    if (!identifier || typeof identifier !== 'string') {
      return res.status(400).json({
        error: 'El campo "identifier" es requerido',
        field: 'identifier'
      });
    }

    // Validar resetToken
    if (!resetToken || typeof resetToken !== 'string') {
      return res.status(400).json({
        error: 'El campo "resetToken" es requerido',
        field: 'resetToken'
      });
    }

    // Validar newPassword
    if (!newPassword || typeof newPassword !== 'string') {
      return res.status(400).json({
        error: 'El campo "newPassword" es requerido',
        field: 'newPassword'
      });
    }

    // Sanitizar
    req.body.identifier = identifier.trim();
    req.body.resetToken = resetToken.trim();

    // Validar longitud mínima de contraseña
    if (newPassword.length < 8) {
      return res.status(400).json({
        error: 'La contraseña debe tener al menos 8 caracteres',
        field: 'newPassword'
      });
    }

    // Validar longitud máxima
    if (newPassword.length > 128) {
      return res.status(400).json({
        error: 'La contraseña no puede exceder 128 caracteres',
        field: 'newPassword'
      });
    }

    // Validar complejidad (opcional pero recomendado)
    const hasUpperCase = /[A-Z]/.test(newPassword);
    const hasLowerCase = /[a-z]/.test(newPassword);
    const hasNumber = /[0-9]/.test(newPassword);

    if (!hasUpperCase || !hasLowerCase || !hasNumber) {
      return res.status(400).json({
        error: 'La contraseña debe contener al menos una mayúscula, una minúscula y un número',
        field: 'newPassword',
        requirements: {
          minLength: 8,
          uppercase: hasUpperCase,
          lowercase: hasLowerCase,
          number: hasNumber
        }
      });
    }

    next();
  }

  /**
   * Sanitiza y valida formato de CI boliviano
   */
  validateBolivianCI(ci) {
    if (!ci) return false;
    
    // CI boliviano: 7-10 dígitos, puede incluir extensión
    const cleaned = ci.toString().replace(/\D/g, '');
    return cleaned.length >= 7 && cleaned.length <= 10;
  }

  /**
   * Valida formato de email
   */
  validateEmail(email) {
    if (!email) return false;
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Middleware para logging de requests
   */
  logRequest(req, res, next) {
    const timestamp = new Date().toISOString();
    const { method, path, ip } = req;
    
    console.log(`[${timestamp}] ${method} ${path} - IP: ${ip}`);
    next();
  }

  /**
   * Middleware para sanitizar inputs generales
   */
  sanitizeInputs(req, res, next) {
    // Sanitizar strings en body
    if (req.body && typeof req.body === 'object') {
      for (const key in req.body) {
        if (typeof req.body[key] === 'string') {
          // Remover espacios al inicio y final
          req.body[key] = req.body[key].trim();
          
          // Remover caracteres peligrosos (básico)
          req.body[key] = req.body[key]
            .replace(/[<>]/g, '') // Prevenir XSS básico
            .substring(0, 1000); // Limitar longitud
        }
      }
    }
    
    next();
  }
}

module.exports = new ValidationMiddleware();