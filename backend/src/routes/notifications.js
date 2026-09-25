import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/requireAuth.js';

export const notificationsRouter = Router();

// Fired from the issues routes at each lifecycle step - never lets a
// notification failure break the issue action it's attached to.
export async function createNotification(userId, issueId, type, message) {
  try {
    await pool.query(
      `insert into notifications (user_id, issue_id, type, message) values ($1, $2, $3, $4)`,
      [userId, issueId, type, message],
    );
  } catch (err) {
    console.error('Failed to create notification:', err);
  }
}

// One round trip for many notifications (bulk verify can close dozens of
// issues at once - a query per notification would take a minute over a
// slow connection). Same never-break-the-caller rule as createNotification.
export async function createNotifications(rows) {
  if (rows.length === 0) return;
  try {
    await pool.query(
      `insert into notifications (user_id, issue_id, type, message)
       select * from unnest($1::uuid[], $2::uuid[], $3::text[], $4::text[])`,
      [rows.map((r) => r.userId), rows.map((r) => r.issueId), rows.map((r) => r.type), rows.map((r) => r.message)],
    );
  } catch (err) {
    console.error('Failed to create notifications:', err);
  }
}

notificationsRouter.get('/notifications', requireAuth, async (req, res) => {
  const result = await pool.query(
    `select id, issue_id, type, message, read, created_at
     from notifications where user_id = $1 order by created_at desc limit 100`,
    [req.user.userId],
  );
  res.json({ notifications: result.rows });
});

notificationsRouter.get('/notifications/unread-count', requireAuth, async (req, res) => {
  const result = await pool.query(
    `select count(*)::int as count from notifications where user_id = $1 and read = false`,
    [req.user.userId],
  );
  res.json({ count: result.rows[0].count });
});

notificationsRouter.post('/notifications/:id/read', requireAuth, async (req, res) => {
  await pool.query(
    `update notifications set read = true where id = $1 and user_id = $2`,
    [req.params.id, req.user.userId],
  );
  res.json({ ok: true });
});

notificationsRouter.post('/notifications/read-all', requireAuth, async (req, res) => {
  await pool.query(`update notifications set read = true where user_id = $1 and read = false`, [req.user.userId]);
  res.json({ ok: true });
});
