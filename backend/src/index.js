import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';
import { healthRouter } from './routes/health.js';
import { authRouter } from './routes/auth.js';
import { adminRouter } from './routes/admin.js';
import { locationsRouter } from './routes/locations.js';
import { masterRouter } from './routes/master.js';
import { demoPlotsRouter } from './routes/demoPlots.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '..', 'public');

const app = express();

app.use(cors());
app.use(express.json());
app.use(healthRouter);
app.use(authRouter);
app.use(adminRouter);
app.use(locationsRouter);
app.use(masterRouter);
app.use(demoPlotsRouter);
app.use(express.static(publicDir));

app.get('/admin', (_req, res) => {
  res.sendFile(path.join(publicDir, 'admin.html'));
});
app.get('/admin/locations', (_req, res) => {
  res.sendFile(path.join(publicDir, 'locations.html'));
});
app.get('/admin/manage-users', (_req, res) => {
  res.sendFile(path.join(publicDir, 'users.html'));
});
app.get('/admin/crops', (_req, res) => {
  res.sendFile(path.join(publicDir, 'crops.html'));
});

const port = process.env.PORT || 4000;

app.listen(port, () => {
  console.log(`Backend listening on http://localhost:${port}`);
});
