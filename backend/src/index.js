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
import { simpleMasterListsRouter } from './routes/simpleMasterLists.js';
import { demoPlotsRouter } from './routes/demoPlots.js';
import { reportsRouter } from './routes/reports.js';
import { visitsRouter } from './routes/visits.js';
import { issuesRouter } from './routes/issues.js';
import { trainingsRouter } from './routes/trainings.js';
import { fieldDaysRouter } from './routes/fieldDays.js';
import { farmersRouter } from './routes/farmers.js';
import { institutionsRouter } from './routes/institutions.js';
import { institutionVisitsRouter } from './routes/institutionVisits.js';
import { agroDealersRouter } from './routes/agroDealers.js';
import { agroDealerVisitsRouter } from './routes/agroDealerVisits.js';
import { dataCollectionFormsRouter } from './routes/dataCollectionForms.js';
import { tfoDemosRouter } from './routes/tfoDemos.js';
import { tfoHomeGardensRouter } from './routes/tfoHomeGardens.js';
import { activitiesRouter } from './routes/activities.js';
import { nutrientConfigurationsRouter } from './routes/nutrientConfigurations.js';
import { activityReturnsRouter } from './routes/activityReturns.js';
import { projectsRouter } from './routes/projects.js';
import { countriesRouter } from './routes/countries.js';
import { notificationsRouter } from './routes/notifications.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '..', 'public');

// A single bad request (e.g. a malformed id hitting a raw DB query) must
// never take the whole server down for every other user. Node's default
// for an unhandled promise rejection is to crash the process - override
// that so it just gets logged instead.
process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
});

const app = express();

app.use(cors());
app.use(express.json());
app.use(healthRouter);
app.use(authRouter);
app.use(adminRouter);
app.use(locationsRouter);
app.use(masterRouter);
app.use(simpleMasterListsRouter);
app.use(demoPlotsRouter);
app.use(reportsRouter);
app.use(visitsRouter);
app.use(issuesRouter);
app.use(trainingsRouter);
app.use(fieldDaysRouter);
app.use(farmersRouter);
app.use(institutionsRouter);
app.use(institutionVisitsRouter);
app.use(agroDealersRouter);
app.use(agroDealerVisitsRouter);
app.use(dataCollectionFormsRouter);
app.use(tfoDemosRouter);
app.use(tfoHomeGardensRouter);
app.use(activitiesRouter);
app.use(nutrientConfigurationsRouter);
app.use(activityReturnsRouter);
app.use(projectsRouter);
app.use(countriesRouter);
app.use(notificationsRouter);
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
app.get('/admin/master-lists', (_req, res) => {
  res.sendFile(path.join(publicDir, 'master-lists.html'));
});
app.get('/admin/user-profile/:id', (_req, res) => {
  res.sendFile(path.join(publicDir, 'user-profile.html'));
});
app.get('/admin/create-user', (_req, res) => {
  res.sendFile(path.join(publicDir, 'create-user.html'));
});
app.get('/admin/reports/farmers', (_req, res) => {
  res.sendFile(path.join(publicDir, 'report-farmers.html'));
});
app.get('/admin/reports/demos', (_req, res) => {
  res.sendFile(path.join(publicDir, 'report-demos.html'));
});
app.get('/admin/reports/master-list', (_req, res) => {
  res.sendFile(path.join(publicDir, 'report-master-list.html'));
});
app.get('/admin/data-collection-forms', (_req, res) => {
  res.sendFile(path.join(publicDir, 'data-collection-forms.html'));
});
app.get('/admin/data-collection-forms/:id', (_req, res) => {
  res.sendFile(path.join(publicDir, 'data-collection-form-edit.html'));
});
app.get('/admin/activity-costs', (_req, res) => {
  res.sendFile(path.join(publicDir, 'activity-costs.html'));
});
app.get('/admin/activity-costs/:id', (_req, res) => {
  res.sendFile(path.join(publicDir, 'activity-cost-detail.html'));
});
app.get('/admin/nutrient-configurations', (_req, res) => {
  res.sendFile(path.join(publicDir, 'nutrient-configurations.html'));
});
app.get('/admin/activity-returns', (_req, res) => {
  res.sendFile(path.join(publicDir, 'activity-returns.html'));
});
app.get('/admin/activity-returns/:id', (_req, res) => {
  res.sendFile(path.join(publicDir, 'activity-return-detail.html'));
});
app.get('/admin/projects', (_req, res) => {
  res.sendFile(path.join(publicDir, 'projects.html'));
});
app.get('/admin/projects/:id', (_req, res) => {
  res.sendFile(path.join(publicDir, 'project-detail.html'));
});
app.get('/admin/countries', (_req, res) => {
  res.sendFile(path.join(publicDir, 'countries.html'));
});
app.get('/admin/countries/:id', (_req, res) => {
  res.sendFile(path.join(publicDir, 'country-detail.html'));
});

const port = process.env.PORT || 4000;

app.listen(port, () => {
  console.log(`Backend listening on http://localhost:${port}`);
});
