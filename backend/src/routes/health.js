import { Router } from 'express';
import { pool } from '../db/pool.js';

export const healthRouter = Router();

healthRouter.get('/health', async (_req, res) => {
  try {
    const result = await pool.query('select now()');
    res.json({ status: 'ok', dbTime: result.rows[0].now });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});
