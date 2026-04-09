const allowedOrigins = (process.env.CORS_ORIGINS || process.env.BASE_URL || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

// In development, allow localhost origins
if (process.env.NODE_ENV !== 'production') {
  allowedOrigins.push('http://localhost:3000');
  allowedOrigins.push('http://localhost:5173');
  allowedOrigins.push('http://127.0.0.1:3000');
  allowedOrigins.push('http://127.0.0.1:5173');
}

export const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);

    if (
      allowedOrigins.length === 0 ||
      allowedOrigins.includes('*') ||
      allowedOrigins.includes(origin)
    ) {
      return callback(null, true);
    }

    return callback(new Error('Not allowed by CORS'));
  },
  credentials: String(process.env.CORS_CREDENTIALS ?? 'true') === 'true',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
