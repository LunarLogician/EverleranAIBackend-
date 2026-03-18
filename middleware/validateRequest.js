/**
 * Input Validation Middleware
 * Validates requests against Joi schemas
 */

const validateRequest = (schema, dataSource = 'body') => {
  return (req, res, next) => {
    const data = dataSource === 'body' ? req.body : req.params;
    const { error, value } = schema.validate(data, { abortEarly: false });

    if (error) {
      const messages = error.details.map(d => d.message).join(', ');
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(d => ({
          field: d.path.join('.'),
          message: d.message,
        })),
      });
    }

    req.validatedData = value;
    next();
  };
};

module.exports = validateRequest;
