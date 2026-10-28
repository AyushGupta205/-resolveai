import { ZodError } from 'zod';

export function errorHandler(err, req, res, next) {
  // Handle Zod validation errors
  if (err instanceof ZodError) {
    const formattedErrors = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    return res.status(400).json({
      error: 'Validation failed',
      details: formattedErrors,
    });
  }

  // Handle Multer upload errors
  if (err.name === 'MulterError') {
    return res.status(400).json({
      error: `File upload error: ${err.message}`,
    });
  }

  // Handle JSON parsing errors
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'Malformed JSON payload.' });
  }

  // Log error internally
  console.error('[Unhandled Server Error]', err);

  const statusCode = err.status || 500;
  const isProduction = process.env.NODE_ENV === 'production';

  // Do not expose sensitive internal error traces or database query details to clients
  const clientMessage = isProduction && statusCode >= 500
    ? 'An internal server error occurred. Please contact support.'
    : err.message || 'An internal server error occurred.';

  return res.status(statusCode).json({
    error: clientMessage,
    ...(isProduction ? {} : { stack: err.stack }),
  });
}
