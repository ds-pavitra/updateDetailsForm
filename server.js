// server.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const ExcelJS = require('exceljs');
const archiver = require('archiver');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// PostgreSQL Configuration
const db = new Pool({
    host: process.env.PG_HOST || 'localhost',
    port: process.env.PG_PORT || 5432,
    user: process.env.PG_USER || 'your_username',
    password: process.env.PG_PASSWORD || 'your_password',
    database: process.env.PG_DATABASE || 'registrationdb',
});

// Create table if not exists
const createTable = async () => {
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS registrations (
                id SERIAL PRIMARY KEY,
                firstName TEXT,
                middleName TEXT,
                lastName TEXT,
                mobile TEXT,
                email TEXT,
                dob DATE,
                address TEXT,
                photo TEXT,
                whoareyou TEXT,
                degree TEXT,
                institution TEXT,
                empDegree TEXT,
                profession TEXT,
                company TEXT,
                designation TEXT,
                busDegree TEXT,
                businessType TEXT,
                businessName TEXT,
                createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ PostgreSQL table ready');
    } catch (err) {
        console.error('❌ Table creation failed:', err.message);
    }
};
createTable();

// File Upload Handling
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadsDir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = Date.now() + '-' + file.originalname;
        cb(null, uniqueName);
    },
});
const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) cb(null, true);
        else cb(new Error('Only image files are allowed!'), false);
    }
});

// 📌 API: Register User
app.post('/api/register', upload.single('photo'), async (req, res) => {
    try {
        const photoPath = req.file ? req.file.path : '';
        const data = req.body;

        const query = `
            INSERT INTO registrations (
                firstName, middleName, lastName, mobile, email, dob, address, photo, whoareyou,
                degree, institution, empDegree, profession, company, designation,
                busDegree, businessType, businessName
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9,
                $10, $11, $12, $13, $14, $15,
                $16, $17, $18
            )
        `;
        const values = [
            data.firstName, data.middleName, data.lastName, data.mobile, data.email, data.dob,
            data.address, photoPath, data.whoareyou,
            data.degree, data.institution, data.empDegree, data.profession,
            data.company, data.designation,
            data.busDegree, data.businessType, data.businessName
        ];

        await db.query(query, values);
        res.status(201).json({ message: 'Registration successful' });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Registration failed', error: error.message });
    }
});

// 📌 API: Fetch all registrations
app.get('/api/registrations', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM registrations ORDER BY createdAt DESC');
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching registrations', error: error.message });
    }
});

// 📌 API: Export to Excel
app.get('/api/export-excel', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM registrations ORDER BY createdAt DESC');
        const rows = result.rows;

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Registrations');

        worksheet.columns = [
            { header: 'First Name', key: 'firstName', width: 15 },
            { header: 'Middle Name', key: 'middleName', width: 15 },
            { header: 'Last Name', key: 'lastName', width: 15 },
            { header: 'Mobile', key: 'mobile', width: 15 },
            { header: 'Email', key: 'email', width: 25 },
            { header: 'DOB', key: 'dob', width: 15 },
            { header: 'Address', key: 'address', width: 30 },
            { header: 'Who Are You', key: 'whoareyou', width: 15 },
            { header: 'Details', key: 'details', width: 40 }
        ];

        rows.forEach(reg => {
            let details = '';
            if (reg.whoareyou === 'student') {
                details = `Degree: ${reg.degree || '-'}, Institution: ${reg.institution || '-'}`;
            } else if (reg.whoareyou === 'employee') {
                details = `Degree: ${reg.empdegree || '-'}, Profession: ${reg.profession || '-'}, Company: ${reg.company || '-'}, Designation: ${reg.designation || '-'}`;
            } else if (reg.whoareyou === 'business') {
                details = `Degree: ${reg.busdegree || '-'}, Business Type: ${reg.businesstype || '-'}, Business Name: ${reg.businessname || '-'}`;
            }

            worksheet.addRow({
                ...reg,
                dob: reg.dob ? new Date(reg.dob).toLocaleDateString() : '',
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

// 📌 API: Download photos as ZIP
app.get('/api/download-photos', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM registrations');
        const rows = result.rows;

        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', 'attachment; filename=registration-photos.zip');

        const archive = archiver('zip', { zlib: { level: 9 } });
        archive.pipe(res);

        rows.forEach(reg => {
            if (reg.photo && fs.existsSync(reg.photo)) {
                const fileName = path.basename(reg.photo);
                archive.file(reg.photo, { name: `${reg.firstname}-${reg.lastname}-${fileName}` });
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

// Start Server
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
