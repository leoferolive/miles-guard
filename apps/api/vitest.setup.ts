process.env.NODE_ENV = 'test';
process.env.PORT = '3000';
process.env.PUBLIC_URL = 'http://localhost:3000';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.JWT_SECRET = 'test-jwt-secret-must-be-32-chars!!';
process.env.AUTH_EMAIL = 'dono@example.com';
// Hash bcrypt da senha de teste `senha-correta` (gerado com bcryptjs.hashSync(...,10)).
process.env.AUTH_PASSWORD_HASH = '$2a$10$scWw7Etl3S0XdFVKUXS6FOiOe0zDRWvsgVn4z2UdLR4BGF8OQ3PDO';
