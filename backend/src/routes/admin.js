import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { SELF_REGISTER_ROLES } from '../roles.js';

export const adminRouter = Router();

adminRouter.get('/admin/me', requireAdmin, async (req, res) => {
  const result = await pool.query(`select id, name, role from users where id = $1`, [req.user.userId]);
  res.json({ user: result.rows[0] });
});

adminRouter.get('/admin/users/pending', requireAdmin, async (_req, res) => {
  const result = await pool.query(
    `select id, user_code, name, mobile_number, email, role, status, created_at
     from users where status = 'pending' order by created_at asc`,
  );
  res.json({ users: result.rows });
});

adminRouter.post('/admin/users/:id/approve', requireAdmin, async (req, res) => {
  const { role } = req.body;
  if (role !== undefined && !SELF_REGISTER_ROLES.includes(role)) {
    return res.status(400).json({ error: `role must be one of: ${SELF_REGISTER_ROLES.join(', ')}` });
  }

  const result = await pool.query(
    `update users set role = coalesce($3, role), status = 'approved',
       reviewed_by = $2, reviewed_at = now(), updated_at = now()
     where id = $1 and status = 'pending' returning id, name, role, status`,
    [req.params.id, req.user.userId, role ?? null],
  );
  if (result.rowCount === 0) {
    return res.status(404).json({ error: 'No pending user with that id' });
  }
  res.json({ user: result.rows[0] });
});

adminRouter.post('/admin/users/:id/reject', requireAdmin, async (req, res) => {
  const result = await pool.query(
    `update users set status = 'rejected', reviewed_by = $2, reviewed_at = now(), updated_at = now()
     where id = $1 and status = 'pending' returning id, name, status`,
    [req.params.id, req.user.userId],
  );
  if (result.rowCount === 0) {
    return res.status(404).json({ error: 'No pending user with that id' });
  }
  res.json({ user: result.rows[0] });
});
