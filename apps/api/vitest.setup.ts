process.env.NODE_ENV = 'test';
process.env.PORT = '3000';
process.env.PUBLIC_URL = 'http://localhost:3000';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.JWT_SECRET = 'test-jwt-secret-must-be-32-chars!!';
process.env.ALLOWED_EMAILS = 'dono@example.com';
// Sem GOOGLE_CLIENT_ID/SECRET: o OAuth fica desabilitado nos testes.
