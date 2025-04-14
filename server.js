// server.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const ExcelJS = require('exceljs');
const archiver = require('archiver');
const mysql = require('mysql2/promise');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// MySQL DB Connection
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'registrationDB',
};
let db;
mysql.createConnection(dbConfig).then((connection) => {
    db = connection;
    console.log('Connected to MySQL');
    createTable(); // Auto-create table
}).catch((err) => {
    console.error('Failed to connect to MySQL:', err);
});

// Create table if it doesn't exist
const createTable = async () => {
    await db.query(`
        CREATE TABLE IF NOT EXISTS registrations (
            id INT AUTO_INCREMENT PRIMARY KEY,
            firstName VARCHAR(255),
            middleName VARCHAR(255),
            lastName VARCHAR(255),
            mobile VARCHAR(20),
            email VARCHAR(255),
            dob DATE,
            address TEXT,
            photo TEXT,
            whoareyou ENUM('student','employee','business'),
            degree VARCHAR(255),
            institution VARCHAR(255),
            empDegree VARCHAR(255),
            profession VARCHAR(255),
            company VARCHAR(255),
            designation VARCHAR(255),
            busDegree VARCHAR(255),
            businessType VARCHAR(255),
            businessName VARCHAR(255),
            createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);
};

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
                firstName, middleName, lastName, mobile, email, dob, address, photo, whoareyou,
                degree, institution, empDegree, profession, company, designation,
                busDegree, businessType, businessName
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const values = [
            data.firstName, data.middleName, data.lastName, data.mobile, data.email, data.dob,
            data.address, photoPath, data.whoareyou,
            data.degree, data.institution, data.empDegree, data.profession,
            data.company, data.designation,
            data.busDegree, data.businessType, data.businessName
        ];

        const [result] = await db.query(query, values);
        res.status(201).json({ message: 'Registration successful', id: result.insertId });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Registration failed', error: error.message });
    }
});

// API: Get all registrations
app.get('/api/registrations', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM registrations ORDER BY createdAt DESC');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching registrations', error: error.message });
    }
});

// API: Export to Excel
app.get('/api/export-excel', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM registrations ORDER BY createdAt DESC');
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
                details = `Degree: ${reg.empDegree || '-'}, Profession: ${reg.profession || '-'}, Company: ${reg.company || '-'}, Designation: ${reg.designation || '-'}`;
            } else if (reg.whoareyou === 'business') {
                details = `Degree: ${reg.busDegree || '-'}, Business Type: ${reg.businessType || '-'}, Business Name: ${reg.businessName || '-'}`;
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
        const [rows] = await db.query('SELECT * FROM registrations');
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', 'attachment; filename=registration-photos.zip');

        const archive = archiver('zip', { zlib: { level: 9 } });
        archive.pipe(res);

        rows.forEach(reg => {
            if (reg.photo && fs.existsSync(reg.photo)) {
                const fileName = path.basename(reg.photo);
                archive.file(reg.photo, { name: `${reg.firstName}-${reg.lastName}-${fileName}` });
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
