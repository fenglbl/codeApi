const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const healthRoutes = require('./routes/health.routes');
const adminAuthRoutes = require('./routes/admin.auth.routes');
const adminUpstreamRoutes = require('./routes/admin.upstream.routes');
const adminLocalKeyRoutes = require('./routes/admin.local-key.routes');
const adminRequestLogRoutes = require('./routes/admin.request-log.routes');
const adminUploadRoutes = require('./routes/admin.upload.routes');
const v1Routes = require('./routes/v1.routes');
const errorHandler = require('./middlewares/error.middleware');
const env = require('./config/env');

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: env.jsonBodyLimit }));
app.use(morgan('dev'));

app.use('/health', healthRoutes);
app.use('/api/admin/auth', adminAuthRoutes);
app.use('/api/admin/upstreams', adminUpstreamRoutes);
app.use('/api/admin/local-keys', adminLocalKeyRoutes);
app.use('/api/admin/request-logs', adminRequestLogRoutes);
app.use('/api/admin/uploads', adminUploadRoutes);
app.use('/v1', v1Routes);

const adminDistDir = path.join(__dirname, '..', '..', 'admin', 'dist');
app.use('/admin', express.static(adminDistDir));
app.get('/admin/*', (req, res) => {
  res.sendFile(path.join(adminDistDir, 'index.html'));
});

app.use(errorHandler);

module.exports = app;
