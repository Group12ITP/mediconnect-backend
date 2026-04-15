const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

// Routes
const authRoutes = require('./routes/authRoutes');
const patientAuthRoutes = require('./routes/patientAuthRoutes');
const availabilityRoutes = require('./routes/availabilityRoutes');
const scheduleRoutes = require('./routes/scheduleRoutes');
const prescriptionRoutes = require('./routes/prescriptionRoutes');
const appointmentRoutes = require('./routes/appointmentRoutes');
const reportRoutes = require('./routes/reportRoutes');
const doctorRoutes = require('./routes/doctorRoutes');
const patientRoutes = require('./routes/patientRoutes');
const pharmacistAuthRoutes = require('./routes/Pharmacistroutes');
const pharmacyRoutes = require('./routes/Pharmacyroutes');
const inventoryRoutes = require('./routes/Inventoryroutes');
const finderRoutes = require('./routes/Finderroutes');
const brandRoutes = require('./routes/Brandroutes');
const analyzeReportRoutes = require('./routes/analyzeReportRoutes');
const adminAuthRoutes = require('./routes/adminAuthRoutes');
const adminRoutes = require('./routes/adminRoutes');



const errorMiddleware = require('./middleware/errorMiddleware');

const app = express();

const i18n = require('i18n');
i18n.configure({
  locales: ['en', 'es', 'fr'],
  directory: path.join(__dirname, 'locales'),
  defaultLocale: 'en',
  queryParameter: 'lang',
  objectNotation: true
});
app.use(i18n.init);

// Security middleware
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  optionsSuccessStatus: 200
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Body parser middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files (reports)
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// ── Routes ─────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);                   // Doctor auth
app.use('/api/patient/auth', patientAuthRoutes);    // Patient auth
app.use('/api/availability', availabilityRoutes);   // Doctor availability
app.use('/api/schedule', scheduleRoutes);           // Doctor schedule view
app.use('/api/prescriptions', prescriptionRoutes);  // Doctor prescriptions
app.use('/api/appointments', appointmentRoutes);    // Booking + lifecycle
app.use('/api/reports', reportRoutes);              // Medical reports
app.use('/api/doctors', doctorRoutes);              // Doctor profile + list
app.use('/api/patient', patientRoutes);             // Patient dashboard/history
app.use('/api/pharmacy/auth', pharmacistAuthRoutes); // Pharmacist auth
app.use('/api/pharmacy/profile', pharmacyRoutes);    // Pharmacy profile
app.use('/api/pharmacy/inventory', inventoryRoutes); // Inventory management
app.use('/api/finder', finderRoutes);                // Pharmacy finder
app.use('/api/medicines', brandRoutes);              // Brand scoring/suggestions
app.use('/api/patient/:patientId/health-reports', analyzeReportRoutes);
app.use('/api/admin/auth', adminAuthRoutes);         // Admin auth
app.use('/api/admin', adminRoutes);                  // Admin operations

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'MediConnect Backend is running',
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware (must be last)
app.use(errorMiddleware);

module.exports = app;