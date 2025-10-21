const express = require('express');
const router = express.Router();
const recoveryController = require('../controllers/recoveryController');
const validation = require('../middleware/validationMiddleware');

/**
 * @route   POST /api/recovery/request-code
 * @desc    Solicita un código de verificación por WhatsApp
 * @access  Public
 * @body    { identifier: "CI o email" }
 */
router.post(
  '/request-code',
  validation.sanitizeInputs,
  validation.validateRequestCode,
  validation.logRequest,
  recoveryController.requestCode.bind(recoveryController)
);

/**
 * @route   POST /api/recovery/verify-code
 * @desc    Verifica el código de 6 dígitos
 * @access  Public
 * @body    { identifier: "CI o email", code: "123456" }
 */
router.post(
  '/verify-code',
  validation.sanitizeInputs,
  validation.validateVerifyCode,
  validation.logRequest,
  recoveryController.verifyCode.bind(recoveryController)
);

/**
 * @route   POST /api/recovery/reset-password
 * @desc    Restablece la contraseña con el token de reset
 * @access  Public
 * @body    { identifier: "CI o email", resetToken: "token", newPassword: "nueva" }
 */
router.post(
  '/reset-password',
  validation.sanitizeInputs,
  validation.validateResetPassword,
  validation.logRequest,
  recoveryController.resetPassword.bind(recoveryController)
);

module.exports = router;