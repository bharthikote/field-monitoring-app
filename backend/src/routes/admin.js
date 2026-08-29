import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAdmin } from '../middleware/requireAdmin.js';

export const adminRouter = Router();

adminRouter.get('/admin/me', requireAdmin, async (req, res) => {
  const result = await pool.query(`select id, name, role from users where id = $1`, [req.user.userId]);
  res.json({ user: result.rows[0] });
});

adminRouter.get('/admin/users/pending', requireAdmin, async (_req, res) => {
  const result = await pool.query(
    `select id, name, mobile_number, email, role, status, created_at
     from users where status = 'pending' order by created_at asc`,
  );
  res.json({ users: result.rows });
});

adminRouter.post('/admin/users/:id/approve', requireAdmin, async (req, res) => {
  const result = await pool.query(
    `update users set status = 'approved', reviewed_by = $2, reviewed_at = now(), updated_at = now()
     where id = $1 and status = 'pending' returning id, name, status`,
    [req.params.id, req.user.userId],
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
