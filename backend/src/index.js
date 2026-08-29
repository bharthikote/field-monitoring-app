import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';
import { healthRouter } from './routes/health.js';
import { authRouter } from './routes/auth.js';
import { adminRouter } from './routes/admin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

app.use(cors());
app.use(express.json());
app.use(healthRouter);
app.use(authRouter);
app.use(adminRouter);

app.get('/admin', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'admin.html'));
});

const port = process.env.PORT || 4000;

app.listen(port, () => {
  console.log(`Backend listening on http://localhost:${port}`);
});
