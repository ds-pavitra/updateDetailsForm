require('dotenv').config();

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');
const archiver = require('archiver');
const { Client } = require('pg'); // PostgreSQL client

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// PostgreSQL Database Connection
const dbConfig = {
    host: process.env.PG_HOST || 'localhost',
    port: process.env.PG_PORT || 5432,
    user: process.env.PG_USER || 'your_username', // Update with your username
    password: process.env.PG_PASSWORD || 'your_password', // Update with your password
    database: process.env.PG_DATABASE || 'registrationdb', // Update with your database name
};

const db = new Client(dbConfig);
db.connect()
  .then(() => console.log('Connected to PostgreSQL'))
  .catch((err) => console.error('Failed to connect to PostgreSQL:', err));

// Create table if it doesn't exist
const createTable = async () => {
    try {
        const query = `
            CREATE TABLE IF NOT EXISTS registrations (
                id SERIAL PRIMARY KEY,
                first_name VARCHAR(255),
                middle_name VARCHAR(255),
                last_name VARCHAR(255),
                mobile VARCHAR(20),
                email VARCHAR(255),
                dob DATE,
                address TEXT,
                photo TEXT,
                whoareyou VARCHAR(255),
                degree VARCHAR(255),
                institution VARCHAR(255),
                emp_degree VARCHAR(255),
                profession VARCHAR(255),
                company VARCHAR(255),
                designation VARCHAR(255),
                bus_degree VARCHAR(255),
                business_type VARCHAR(255),
                business_name VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `;
        await db.query(query);
    } catch (error) {
        console.error('Error creating table:', error);
    }
};

// Run table creation on server start
createTable();

// Set up multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadsDir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const uniquePrefix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniquePrefix + '-' + file.originalname);
    }
});
const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) cb(null, true);
        else cb(new Error('Only image files are allowed!'), false);
    }
});

// API: Submit Registration
app.post('/api/register', upload.single('photo'), async (req, res) => {
    try {
        const photoPath = req.file ? req.file.path : '';
        const data = req.body;

        const query = `
            INSERT INTO registrations (
                first_name, middle_name, last_name, mobile, email, dob, address, photo, whoareyou,
                degree, institution, emp_degree, profession, company, designation,
                bus_degree, business_type, business_name
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        `;
        const values = [
            data.firstName, data.middleName, data.lastName, data.mobile, data.email, data.dob,
            data.address, photoPath, data.whoareyou,
            data.degree, data.institution, data.empDegree, data.profession,
            data.company, data.designation,
            data.busDegree, data.businessType, data.businessName
        ];

        const result = await db.query(query, values);
        res.status(201).json({ message: 'Registration successful', id: result.rows[0].id });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Registration failed', error: error.message });
    }
});

// API: Get all registrations
app.get('/api/registrations', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM registrations ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching registrations', error: error.message });
    }
});

// API: Export to Excel
app.get('/api/export-excel', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM registrations ORDER BY created_at DESC');
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Registrations');

        worksheet.columns = [
            { header: 'First Name', key: 'first_name', width: 15 },
            { header: 'Middle Name', key: 'middle_name', width: 15 },
            { header: 'Last Name', key: 'last_name', width: 15 },
            { header: 'Mobile', key: 'mobile', width: 15 },
            { header: 'Email', key: 'email', width: 25 },
            { header: 'DOB', key: 'dob', width: 15 },
            { header: 'Address', key: 'address', width: 30 },
            { header: 'Who Are You', key: 'whoareyou', width: 15 },
            { header: 'Details', key: 'details', width: 40 }
        ];

        result.rows.forEach(reg => {
            let details = '';
            if (reg.whoareyou === 'student') {
                details = `Degree: ${reg.degree || '-'}, Institution: ${reg.institution || '-'}`;
            } else if (reg.whoareyou === 'employee') {
                details = `Degree: ${reg.emp_degree || '-'}, Profession: ${reg.profession || '-'}, Company: ${reg.company || '-'}, Designation: ${reg.designation || '-'}`;
            } else if (reg.whoareyou === 'business') {
                details = `Degree: ${reg.bus_degree || '-'}, Business Type: ${reg.business_type || '-'}, Business Name: ${reg.business_name || '-'}`;
            }

            worksheet.addRow({
                ...reg,
                dob: new Date(reg.dob).toLocaleDateString(),
                details
            });
        });

        worksheet.getRow(1).font = { bold: true };
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=registrations.xlsx');
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Excel export error:', error);
        res.status(500).json({ message: 'Excel export failed', error: error.message });
    }
});

// API: Download photos as ZIP
app.get('/api/download-photos', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM registrations');
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', 'attachment; filename=registration-photos.zip');

        const archive = archiver('zip', { zlib: { level: 9 } });
        archive.pipe(res);

        result.rows.forEach(reg => {
            if (reg.photo && fs.existsSync(reg.photo)) {
                const fileName = path.basename(reg.photo);
                archive.file(reg.photo, { name: `${reg.first_name}-${reg.last_name}-${fileName}` });
            }
        });

        archive.finalize();
    } catch (error) {
        console.error('Photos download error:', error);
        res.status(500).json({ message: 'Photos download failed', error: error.message });
    }
});

// Serve uploaded photos
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve frontend
app.use(express.static(path.join(__dirname, 'public')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
