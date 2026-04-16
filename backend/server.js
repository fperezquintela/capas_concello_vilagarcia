require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const Database = require('better-sqlite3');
const tj = require('@mapbox/togeojson');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { DOMParser } = require('@xmldom/xmldom');
const shapefile = require('shapefile');

const app = express();
const port = process.env.PORT || 3001;

// --- SECURITY: JWT SECRET VALIDATION ---
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
    console.error('\n[FATAL] JWT_SECRET no definido o demasiado corto (mínimo 32 caracteres).');
    console.error('Por favor, genera un secreto seguro en el archivo .env del backend.');
    console.error('Ejemplo (PowerShell): [System.Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(48))\n');
    process.exit(1);
}

// --- SECURITY: HTTP HEADERS (HELMET) ---
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"], // Leaflet needs inline styles
            imgSrc: ["'self'", "data:", "blob:", "http://192.168.5.15:3001", "http://localhost:3001", "https://*.arcgisonline.com", "https://*.google.com", "https://*.googleapis.com", "https://*.gstatic.com"],
            connectSrc: ["'self'", "http://192.168.5.15:3001", "http://localhost:3001", "http://localhost:5173"],
            frameSrc: ["'none'"],
        },
    },
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// --- SECURITY: RATE LIMITING ---
const apiLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minuto
    max: 200,            // Límite generoso para el mapa
    standardHeaders: true,
    legacyHeaders: false,
});

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 10,                 // 10 intentos
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    message: { error: 'Demasiados intentos fallidos. Por favor, espera 15 minutos.' },
});

app.use('/api/', apiLimiter);

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Main Data Paths
const DATA_DIR = path.resolve(__dirname, '../data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const LAYERS_DIR = path.join(DATA_DIR, 'layers');
if (!fs.existsSync(LAYERS_DIR)) fs.mkdirSync(LAYERS_DIR, { recursive: true });

const DB_PATH = path.join(__dirname, 'dev.db');
const db = new Database(DB_PATH);

// Initialize Database Tables if they don't exist
db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user'
    );
    CREATE TABLE IF NOT EXISTS user_layers (
        userId INTEGER,
        layerFilename TEXT,
        FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(userId, layerFilename)
    );
    CREATE TABLE IF NOT EXISTS layer_metadata (
        layerFilename TEXT PRIMARY KEY,
        displayName TEXT NOT NULL,
        hasPhotos INTEGER DEFAULT 0,
        customIcon TEXT,
        defaultWeight INTEGER DEFAULT 10,
        color TEXT DEFAULT '#A41C3A',
        markerType TEXT DEFAULT 'pin',
        strokeWidth INTEGER DEFAULT 2,
        labelField TEXT,
        colorType TEXT DEFAULT 'fixed',
        showFieldLabel INTEGER DEFAULT 1,
        category TEXT DEFAULT 'Sín Categoría',
        showOpacity INTEGER DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS hidden_layers (
        layerFilename TEXT PRIMARY KEY
    );
`);

// Try to apply column migrations to existing table if necessary
try { db.prepare('ALTER TABLE layer_metadata ADD COLUMN hasPhotos INTEGER DEFAULT 0').run(); } catch(e){}
try { db.prepare('ALTER TABLE layer_metadata ADD COLUMN customIcon TEXT').run(); } catch(e){}
try { db.prepare('ALTER TABLE layer_metadata ADD COLUMN defaultWeight INTEGER DEFAULT 10').run(); } catch(e){}
try { db.prepare('ALTER TABLE layer_metadata ADD COLUMN color TEXT DEFAULT \'#A41C3A\'').run(); } catch(e){}
try { db.prepare('ALTER TABLE layer_metadata ADD COLUMN markerType TEXT DEFAULT \'pin\'').run(); } catch(e){}
try { db.prepare('ALTER TABLE layer_metadata ADD COLUMN strokeWidth INTEGER DEFAULT 2').run(); } catch(e){}
try { db.prepare('ALTER TABLE layer_metadata ADD COLUMN labelField TEXT').run(); } catch(e){}
try { db.prepare('ALTER TABLE layer_metadata ADD COLUMN colorType TEXT DEFAULT \'fixed\'').run(); } catch(e){}
try { db.prepare('ALTER TABLE layer_metadata ADD COLUMN showFieldLabel INTEGER DEFAULT 1').run(); } catch(e){}
try { db.prepare('ALTER TABLE layer_metadata ADD COLUMN category TEXT DEFAULT \'Sín Categoría\'').run(); } catch(e){}
try { db.prepare('ALTER TABLE layer_metadata ADD COLUMN showOpacity INTEGER DEFAULT 1').run(); } catch(e){}

// Ensure default admin user
const adminExists = db.prepare('SELECT 1 FROM users WHERE username = ?').get('admin');
if (!adminExists) {
    const hash = bcrypt.hashSync('1234admin', 10);
    db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)').run('admin', hash, 'admin');
    console.log('Default admin user created.');
}

// Ensure default guest user
const guestExists = db.prepare('SELECT 1 FROM users WHERE username = ?').get('guest');
if (!guestExists) {
    const hash = bcrypt.hashSync('guest_access_no_pass', 10);
    db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)').run('guest', hash, 'user');
    console.log('Default guest user created.');
}

// Multer setup for uploads
const TMP_DIR = path.join(DATA_DIR, 'tmp_uploads');
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

const upload = multer({ 
    dest: TMP_DIR,
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (['.kml', '.shp', '.shx', '.dbf', '.prj', '.cpg', '.qmd'].includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Formato no permitido. Solo KML y Shapefile (.shp, .dbf, .prj, .cpg, .qmd, etc)'), false);
        }
    }
});

// Helper to get all layer files recursively
const getAllLayerFiles = (dir, fileList = [], relativePath = '') => {
    if (!fs.existsSync(dir)) return fileList;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filePath = path.join(dir, file);
        const fileRelative = path.join(relativePath, file).replace(/\\/g, '/');
        const lowerFile = file.toLowerCase();
        if (fs.statSync(filePath).isDirectory()) getAllLayerFiles(filePath, fileList, fileRelative);
        else if (lowerFile.endsWith('.kml') || lowerFile.endsWith('.shp')) fileList.push(fileRelative);
    }
    return fileList;
};

// --- SECURITY helpers ---
const sanitizeUploadPath = (inputPath) => {
    const normalized = inputPath.replace(/\\/g, '/').trim();
    if (normalized.includes('..')) throw new Error(`Path traversal detectado: "${inputPath}"`);
    
    const dest = path.resolve(LAYERS_DIR, normalized);
    const layersDirAbs = path.resolve(LAYERS_DIR);
    
    if (!dest.startsWith(layersDirAbs + path.sep)) {
        throw new Error(`Ruta fuera del directorio permitido: "${inputPath}"`);
    }
    
    const segments = normalized.split('/');
    for (const seg of segments) {
        if (seg && !/^[\w\-. áéíóúñÁÉÍÓÚÑüÜ]+$/i.test(seg)) {
            throw new Error(`Carácter no permitido en nombre de archivo: "${seg}"`);
        }
    }
    return dest;
};

const serverError = (res, err, context = '') => {
    const id = Date.now().toString(36).toUpperCase();
    console.error(`[ERROR #${id}] ${context}:`, err.message, err.stack || '');
    res.status(500).json({ error: 'Error interno del servidor.', ref: id });
};

// In-memory GeoJSON cache for shapefiles
const geoJsonCache = new Map();

// Middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    // For media routes (images), we allow the token in the query string 
    // because <img> tags cannot send custom headers.
    const isMediaRequest = req.originalUrl.startsWith('/api/media');
    const token = (authHeader && authHeader.split(' ')[1]) || (isMediaRequest ? req.query.token : null);
    

    if (token == null) return res.sendStatus(401);
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            console.warn('JWT Verification failed:', err.message);
            return res.sendStatus(403);
        }
        req.user = user;
        next();
    });
};

const requireAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Require admin role' });
    next();
};

// Static file serving for media (photos, custom icons)
app.use('/api/media', authenticateToken, (req, res) => {
    const relativePath = decodeURIComponent(req.path);
    const absolutePath = path.resolve(DATA_DIR, relativePath.startsWith('/') ? relativePath.substring(1) : relativePath);
    
    if (!fs.existsSync(absolutePath)) {
        console.error(`[MEDIA ERROR] File not found: ${absolutePath}`);
        return res.status(404).send('Not found');
    }
    
res.sendFile(absolutePath);
});

// --- ROUTES ---
app.post('/api/login', loginLimiter, (req, res) => {
    const { username, password } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
        return res.status(401).json({ error: 'Usuario o clave incorrectos' });
    }
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
});

app.get('/api/admin/users', authenticateToken, requireAdmin, (req, res) => {
    const users = db.prepare('SELECT id, username, role FROM users').all();
    const results = users.map(u => {
        const layers = db.prepare('SELECT layerFilename FROM user_layers WHERE userId = ?').all(u.id);
        return { ...u, layers: layers.map(l => l.layerFilename) };
    });
    res.json(results);
});

app.post('/api/admin/users', authenticateToken, requireAdmin, (req, res) => {
    const { username, password } = req.body;
    if (!username || !password || password.length < 8) {
        return res.status(400).json({ error: 'Username y password (mín. 8 caracteres) son obligatorios.' });
    }
    try {
        const hash = bcrypt.hashSync(password, 10);
        const info = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(username, hash);
        res.status(201).json({ id: info.lastInsertRowid, username, role: 'user', layers: [] });
    } catch (err) {
        if (err.message.includes('UNIQUE')) res.status(400).json({ error: 'El usuario ya existe' });
        else serverError(res, err, 'POST /admin/users');
    }
});

app.put('/api/admin/users/:id/layers', authenticateToken, requireAdmin, (req, res) => {
    const userId = parseInt(req.params.id);
    const { layers } = req.body;
    const update = db.transaction(() => {
        db.prepare('DELETE FROM user_layers WHERE userId = ?').run(userId);
        const insert = db.prepare('INSERT INTO user_layers (userId, layerFilename) VALUES (?, ?)');
        for (const file of layers) insert.run(userId, file);
    });
    try { update(); res.json({ success: true }); }
    catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/admin/users/:id', authenticateToken, requireAdmin, (req, res) => {
    const userId = parseInt(req.params.id);
    const user = db.prepare('SELECT role FROM users WHERE id = ?').get(userId);
    if (user && user.role === 'admin') return res.status(403).json({ error: 'No se puede eliminar un administrador' });
    
    try {
        db.prepare('DELETE FROM users WHERE id = ?').run(userId);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/admin/users/:id/password', authenticateToken, requireAdmin, (req, res) => {
    const userId = parseInt(req.params.id);
    const { password } = req.body;
    try {
        const hash = bcrypt.hashSync(password, 10);
        db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, userId);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/admin/layers/metadata', authenticateToken, requireAdmin, (req, res) => {
    res.json(db.prepare('SELECT * FROM layer_metadata').all());
});

app.post('/api/admin/layers/metadata', authenticateToken, requireAdmin, (req, res) => {
    const { layerFilename, displayName, hasPhotos, customIcon, defaultWeight, color, markerType, strokeWidth, labelField, colorType, showFieldLabel, category, showOpacity } = req.body;
    try {
        db.prepare(`
            INSERT INTO layer_metadata (layerFilename, displayName, hasPhotos, customIcon, defaultWeight, color, markerType, strokeWidth, labelField, colorType, showFieldLabel, category, showOpacity) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(layerFilename) DO UPDATE SET 
            displayName=excluded.displayName,
            hasPhotos=excluded.hasPhotos,
            customIcon=excluded.customIcon,
            defaultWeight=excluded.defaultWeight,
            color=excluded.color,
            markerType=excluded.markerType,
            strokeWidth=excluded.strokeWidth,
            labelField=excluded.labelField,
            colorType=excluded.colorType,
            showFieldLabel=excluded.showFieldLabel,
            category=excluded.category,
            showOpacity=excluded.showOpacity
        `).run(layerFilename, displayName, hasPhotos ? 1 : 0, customIcon || null, defaultWeight || 10, color || '#A41C3A', markerType || 'pin', strokeWidth || 2, labelField || null, colorType || 'fixed', showFieldLabel ? 1 : 0, category || 'Sín Categoría', showOpacity ? 1 : 0);
        res.json({ success: true });
    } catch (err) {
        console.error('[layers/metadata] Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/admin/layers/upload', authenticateToken, requireAdmin, upload.array('files', 15), (req, res) => {
    if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'Sin archivo' });
    
    // Ensure req.body.paths is an array to match files
    let paths = req.body.paths;
    if (!paths) paths = req.files.map(f => f.originalname);
    if (!Array.isArray(paths)) paths = [paths];
    
    let resultFilename = '';
    
    // Move all uploaded files from the tmp folder to their respective destinations
    for (let i = 0; i < req.files.length; i++) {
        const file = req.files[i];
        const relativePath = (paths[i] || file.originalname).replace(/\\/g, '/');
        const lowerRel = relativePath.toLowerCase();
        
        let destPath;
        try {
            destPath = sanitizeUploadPath(relativePath);
        } catch (pathErr) {
            console.error('[upload] Bloqueado:', pathErr.message);
            try { fs.unlinkSync(file.path); } catch(e){}
            return res.status(400).json({ error: 'Ruta de archivo no permitida.' });
        }
        
        const dir = path.dirname(destPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        
        try {
            fs.renameSync(file.path, destPath);
            if (lowerRel.endsWith('.shp') || lowerRel.endsWith('.kml')) {
                resultFilename = relativePath;
            }
        } catch (err) {
            console.error('Error moving file:', file.originalname, err);
        }
    }

    if (!resultFilename && req.files.length > 0) {
       resultFilename = (paths[0] || req.files[0].originalname).replace(/\\/g, '/');
    }
    
    // Invalidate cache for the uploaded file so next request gets fresh data
    if (resultFilename) {
        geoJsonCache.delete(resultFilename);
        console.log(`[cache clear] ${resultFilename}`);
    }
    
    res.json({ success: true, filename: resultFilename });
});

app.post('/api/admin/layers/hide', authenticateToken, requireAdmin, (req, res) => {
    const { filename } = req.body;
    try {
        db.prepare('INSERT OR IGNORE INTO hidden_layers (layerFilename) VALUES (?)').run(filename);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/admin/layers/unhide', authenticateToken, requireAdmin, (req, res) => {
    const { filename } = req.body;
    try {
        db.prepare('DELETE FROM hidden_layers WHERE layerFilename = ?').run(filename);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/admin/hidden-layers', authenticateToken, requireAdmin, (req, res) => {
    res.json(db.prepare('SELECT layerFilename FROM hidden_layers').all().map(l => l.layerFilename));
});

app.get('/api/admin/all-layers', authenticateToken, requireAdmin, (req, res) => {
    const all = getAllLayerFiles(LAYERS_DIR);
    const hidden = db.prepare('SELECT layerFilename FROM hidden_layers').all().map(l => l.layerFilename);
    const result = all.filter(f => !hidden.includes(f));
    res.json(result);
});

app.get(/^\/api\/admin\/layers\/fields\/(.*)/, authenticateToken, requireAdmin, async (req, res) => {
    // We use a regex(.*) to support subdirectories in filenames
    // and decode the URL to handle encoded slashes
    const filename = decodeURIComponent(req.params[0]);
    console.log(`[fields] Request for decoded: ${filename}`);
    const filePath = path.join(LAYERS_DIR, filename);
    console.log(`[fields] Full path check: ${filePath}`);
    
    if (!fs.existsSync(filePath)) {
        console.error(`[fields] File not found after decoding: ${filePath}`);
        // Try fallback without decoding just in case
        const rawPath = path.join(LAYERS_DIR, req.params[0]);
        if (!fs.existsSync(rawPath)) {
            return res.status(404).json({ error: `File not found: ${filename}` });
        }
    }
    
    try {
        const fileExt = path.extname(filename).toLowerCase();
        let properties = [];

        if (fileExt === '.geojson' || fileExt === '.json') {
            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            if (data.features?.length > 0) {
                properties = Object.keys(data.features[0].properties || {});
            }
        } else if (fileExt === '.kml') {
            const kmlContent = fs.readFileSync(filePath, 'utf8');
            const kml = new DOMParser().parseFromString(kmlContent);
            const geojson = tj.kml(kml);
            if (geojson.features?.length > 0) {
                properties = Object.keys(geojson.features[0].properties || {});
            }
        } else if (fileExt === '.shp') {
            // Check if dbf exists
            const base = filePath.slice(0, -4);
            const dbfPath = fs.existsSync(base + '.dbf') ? base + '.dbf' : (fs.existsSync(base + '.DBF') ? base + '.DBF' : null);
            console.log(`[fields] SHP detected. DBF path: ${dbfPath}`);
            
            // Just read first few records to get keys (in case first is empty)
            const source = await shapefile.open(filePath, dbfPath);
            let result;
            let count = 0;
            while (count < 5) {
                result = await source.read();
                if (result.done) break;
                if (result.value && result.value.properties) {
                    const keys = Object.keys(result.value.properties);
                    if (keys.length > 0) {
                        properties = keys;
                        break;
                    }
                }
                count++;
            }
            console.log(`[fields] Found properties: ${properties.join(', ')}`);
            // Close source if it has close method (some versions don't)
            if (source.close) await source.close();
        }
        res.json(properties);
    } catch (err) {
        console.error(`[fields] Fatal error:`, err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/layers', authenticateToken, (req, res) => {
    let files = [];
    const hidden = db.prepare('SELECT layerFilename FROM hidden_layers').all().map(l => l.layerFilename);
    const all = getAllLayerFiles(LAYERS_DIR);

    if (req.user.role === 'admin') {
        files = all.filter(f => !hidden.includes(f));
    } else {
        const rows = db.prepare('SELECT layerFilename FROM user_layers WHERE userId = ?').all(req.user.id);
        files = rows.map(r => r.layerFilename).filter(f => !hidden.includes(f));
    }
    const metadata = db.prepare('SELECT * FROM layer_metadata').all();
    const metaMap = {}; 
    metadata.forEach(m => metaMap[m.layerFilename] = m);
    res.json(files.map(f => ({ 
        filename: f, 
        displayName: metaMap[f]?.displayName || f, 
        ...metaMap[f] 
    })));
});

app.get(/^\/api\/layers\/(.*)/, authenticateToken, async (req, res) => {
    const filename = req.params[0];
    const lowerFile = filename.toLowerCase();
    
    if (filename.includes('..') || !(lowerFile.endsWith('.kml') || lowerFile.endsWith('.shp'))) {
        return res.status(400).send('Error');
    }
    
    // Check if layer is hidden
    const isHidden = db.prepare('SELECT 1 FROM hidden_layers WHERE layerFilename = ?').get(filename);
    if (isHidden && req.user.role !== 'admin') return res.status(403).send('Denied/Hidden');

    if (req.user.role !== 'admin') {
        const permission = db.prepare('SELECT 1 FROM user_layers WHERE userId = ? AND layerFilename = ?').get(req.user.id, filename);
        if (!permission) return res.status(403).send('Denied');
    }
    const filePath = path.join(LAYERS_DIR, filename);
    if (!fs.existsSync(filePath)) return res.status(404).send('Not found');
    
    if (lowerFile.endsWith('.kml')) {
        res.sendFile(filePath);
    } else if (lowerFile.endsWith('.shp')) {
        // Serve from cache if available
        if (geoJsonCache.has(filename)) {
            console.log(`[cache hit] ${filename}`);
            return res.json(geoJsonCache.get(filename));
        }
        try {
            const shapefile = require('shapefile');
            const proj4 = require('proj4');
            
            // Helper to find file (case-insensitive)
            const findAssociatedFile = (shpPath, extension) => {
                const dir = path.dirname(shpPath);
                const baseName = path.basename(shpPath, path.extname(shpPath));
                const candidates = [
                    path.join(dir, baseName + extension.toLowerCase()),
                    path.join(dir, baseName + extension.toUpperCase())
                ];
                return candidates.find(c => fs.existsSync(c)) || candidates[0];
            };

            const dbfPath = findAssociatedFile(filePath, '.dbf');
            const prjPath = findAssociatedFile(filePath, '.prj');
            const cpgPath = findAssociatedFile(filePath, '.cpg');
            
            let encoding = 'utf-8';
            if (fs.existsSync(cpgPath)) {
                try {
                    encoding = fs.readFileSync(cpgPath, 'utf8').trim().toLowerCase();
                    if (encoding === '1252') encoding = 'windows-1252';
                    else if (encoding === 'latin1') encoding = 'iso-8859-1';
                } catch (e) {
                    console.warn('Error reading .cpg file:', e);
                }
            }
            
            let sourceProj = '+proj=utm +zone=29 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs';
            if (fs.existsSync(prjPath)) {
                sourceProj = fs.readFileSync(prjPath, 'utf8');
            }
            const destProj = 'EPSG:4326';

            const geojson = await shapefile.read(
                filePath, 
                fs.existsSync(dbfPath) ? dbfPath : undefined,
                { encoding }
            );
            
            geojson.features.forEach(feature => {
                if (feature.geometry) {
                    reprojectGeometry(feature.geometry, sourceProj, destProj, proj4);
                }
            });

            // Store in cache for subsequent requests
            geoJsonCache.set(filename, geojson);
            console.log(`[cache store] ${filename} (${geojson.features.length} features)`);
            res.json(geojson);
        } catch (err) {
            console.error('Error procesando Shapefile:', err);
            res.status(500).json({ error: 'Error procesando Shapefile' });
        }
    }
});

const reprojectGeometry = (geometry, from, to, proj4) => {
    if (geometry.type === 'Point') {
        geometry.coordinates = proj4(from, to, geometry.coordinates);
    } else if (geometry.type === 'LineString' || geometry.type === 'MultiPoint') {
        geometry.coordinates = geometry.coordinates.map(c => proj4(from, to, c));
    } else if (geometry.type === 'Polygon' || geometry.type === 'MultiLineString') {
        geometry.coordinates = geometry.coordinates.map(ring => ring.map(c => proj4(from, to, c)));
    } else if (geometry.type === 'MultiPolygon') {
        geometry.coordinates = geometry.coordinates.map(poly => poly.map(ring => ring.map(c => proj4(from, to, c))));
    }
};

app.listen(port, () => console.log('Backend a punto en el puerto 3001'));
