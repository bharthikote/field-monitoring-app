import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../db/pool.js';
import { SELF_REGISTER_ROLES as ROLES } from '../roles.js';
import { generateUniqueUserCode } from '../db/userCode.js';
import { loginRateLimit } from '../middleware/loginRateLimit.js';

export const authRouter = Router();

const isEmail = (identifier) => identifier.includes('@');

authRouter.post('/auth/register', async (req, res) => {
  const { name, identifier, password, role } = req.body;

  if (!name || !identifier || !password || !role) {
    return res.status(400).json({ error: 'name, identifier, password, and role are all required' });
  }
  if (!ROLES.includes(role)) {
    return res.status(400).json({ error: `role must be one of: ${ROLES.join(', ')}` });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'password must be at least 6 characters' });
  }

  const email = isEmail(identifier) ? identifier.toLowerCase() : null;
  const mobileNumber = isEmail(identifier) ? null : identifier;
  const passwordHash = await bcrypt.hash(password, 10);

  for (let attempt = 0; attempt < 3; attempt++) {
    const userCode = await generateUniqueUserCode(pool);
    try {
      const result = await pool.query(
        `insert into users (user_code, name, mobile_number, email, password_hash, role, status)
         values ($1, $2, $3, $4, $5, $6, 'pending')
         returning id, user_code, name, mobile_number, email, role, status, created_at`,
        [userCode, name, mobileNumber, email, passwordHash, role],
      );
      return res.status(201).json({ user: result.rows[0] });
    } catch (err) {
      if (err.constraint === 'users_user_code_key') continue;
      if (err.code === '23505') {
        return res.status(409).json({ error: 'An account with that mobile number or email already exists' });
      }
      return res.status(500).json({ error: err.message });
    }
  }
  res.status(500).json({ error: 'Could not generate a unique user code, please try again' });
});

authRouter.post('/auth/login', loginRateLimit, async (req, res) => {
  const { identifier, password } = req.body;
  if (!identifier || !password) {
    return res.status(400).json({ error: 'identifier and password are required' });
  }

  const result = await pool.query(
    `select * from users where mobile_number = $1 or email = $1`,
    [identifier],
  );
  const user = result.rows[0];

  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const passwordOk = await bcrypt.compare(password, user.password_hash);
  if (!passwordOk) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  if (user.status === 'pending') {
    return res.status(403).json({ error: 'Your account is still pending Admin approval' });
  }
  if (user.status === 'rejected') {
    return res.status(403).json({ error: 'Your account registration was rejected' });
  }
  if (user.status === 'deactivated') {
    return res.status(403).json({ error: 'Your account has been deactivated. Contact your Admin.' });
  }

  const token = jwt.sign({ userId: user.id, role: user.role }, process.env.JWT_SECRET);

  res.json({
    token,
    user: {
      id: user.id,
      userCode: user.user_code,
      name: user.name,
      mobileNumber: user.mobile_number,
      email: user.email,
      role: user.role,
      status: user.status,
    },
  });
});
