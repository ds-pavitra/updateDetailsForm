// server.js
const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const ExcelJS = require('exceljs');
const archiver = require('archiver');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));


// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 60000 
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('Could not connect to MongoDB:', err));

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
        // Create unique filename with timestamp
        const uniquePrefix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniquePrefix + '-' + file.originalname);
    }
});

const upload = multer({ 
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        // Accept only image files
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'), false);
        }
    }
});

// Define MongoDB Schema and Model
const registrationSchema = new mongoose.Schema({
    firstName: { type: String, required: true },
    middleName: String,
    lastName: { type: String, required: true },
    mobile: { type: String, required: true },
    email: { type: String, required: true },
    dob: { type: Date, required: true },
    address: { type: String, required: true },
    photo: { type: String, required: true }, // Path to stored photo
    whoareyou: { type: String, required: true, enum: ['student', 'employee', 'business'] },
    
    // Student fields
    degree: String,
    institution: String,
    
    // Employee fields
    empDegree: String,
    profession: String,
    company: String,
    designation: String,
    
    // Business fields
    busDegree: String,
    businessType: String,
    businessName: String,
    
    createdAt: { type: Date, default: Date.now }
});

const Registration = mongoose.model('Registration', registrationSchema);

// API Routes
// Submit registration
app.post('/api/register', upload.single('photo'), async (req, res) => {
    try {
        const photoPath = req.file ? req.file.path : '';
        
        // Create new registration document
        const registration = new Registration({
            ...req.body,
            photo: photoPath
        });
        
        await registration.save();
        res.status(201).json({ message: 'Registration successful', data: registration });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Registration failed', error: error.message });
    }
});

// Get all registrations (for admin panel)
app.get('/api/registrations', async (req, res) => {
    try {
        const registrations = await Registration.find().sort({ createdAt: -1 });
        res.status(200).json(registrations);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching registrations', error: error.message });
    }
});

// Export registrations to Excel
app.get('/api/export-excel', async (req, res) => {
    try {
        const registrations = await Registration.find().sort({ createdAt: -1 });
        
        // Create Excel workbook
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Registrations');
        
        // Add columns
        worksheet.columns = [
            { header: 'First Name', key: 'firstName', width: 15 },
            { header: 'Middle Name', key: 'middleName', width: 15 },
            { header: 'Last Name', key: 'lastName', width: 15 },
            { header: 'Mobile', key: 'mobile', width: 15 },
            { header: 'Email', key: 'email', width: 25 },
            { header: 'Date of Birth', key: 'dob', width: 15 },
            { header: 'Address', key: 'address', width: 30 },
            { header: 'Who Are You', key: 'whoareyou', width: 15 },
            { header: 'Degree/Institution/Business Details', key: 'details', width: 40 }
        ];
        
        // Add rows
        registrations.forEach(reg => {
            let details = '';
            if (reg.whoareyou === 'student') {
                details = `Degree: ${reg.degree || '-'}, Institution: ${reg.institution || '-'}`;
            } else if (reg.whoareyou === 'employee') {
                details = `Degree: ${reg.empDegree || '-'}, Profession: ${reg.profession || '-'}, Company: ${reg.company || '-'}, Designation: ${reg.designation || '-'}`;
            } else if (reg.whoareyou === 'business') {
                details = `Degree: ${reg.busDegree || '-'}, Business Type: ${reg.businessType || '-'}, Business Name: ${reg.businessName || '-'}`;
            }
            
            worksheet.addRow({
                firstName: reg.firstName,
                middleName: reg.middleName,
                lastName: reg.lastName,
                mobile: reg.mobile,
                email: reg.email,
                dob: new Date(reg.dob).toLocaleDateString(),
                address: reg.address,
                whoareyou: reg.whoareyou,
                details: details
            });
        });
        
        // Style the header row
        worksheet.getRow(1).font = { bold: true };
        
        // Set response headers
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=registrations.xlsx');
        
        // Write workbook to response
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Excel export error:', error);
        res.status(500).json({ message: 'Excel export failed', error: error.message });
    }
});

// Download all photos as zip
app.get('/api/download-photos', async (req, res) => {
    try {
        const registrations = await Registration.find();
        
        // Set response headers
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', 'attachment; filename=registration-photos.zip');
        
        // Create zip file
        const archive = archiver('zip', {
            zlib: { level: 9 } // Compression level
        });
        
        // Pipe archive data to the response
        archive.pipe(res);
        
        // Add each photo to the archive
        registrations.forEach(reg => {
            if (reg.photo && fs.existsSync(reg.photo)) {
                const fileName = path.basename(reg.photo);
                archive.file(reg.photo, { name: `${reg.firstName}-${reg.lastName}-${fileName}` });
            }
        });
        
        // Finalize the archive
        archive.finalize();
    } catch (error) {
        console.error('Photos download error:', error);
        res.status(500).json({ message: 'Photos download failed', error: error.message });
    }
});

// Serve the uploaded photos
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve the frontend files
app.use(express.static(path.join(__dirname, 'public')));

// Admin panel route
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// For SPA routing
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
