import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';

const PORT = 3000;
const DATA_FILE = path.join(process.cwd(), 'data', 'saved_records.json');

// Ensure data directory exists
try {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
} catch (e) {
  console.error('Failed to create data directory:', e);
}

// In-memory cache
let savedData: {
  records: any[];
  syncSourceInfo: any;
  updatedAt: string;
} | null = null;

// Attempt to load from disk on boot
try {
  if (fs.existsSync(DATA_FILE)) {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    savedData = JSON.parse(raw);
    console.log(`Loaded ${savedData?.records?.length || 0} records from persistent storage.`);
  }
} catch (e) {
  console.error('Failed to read data file on startup:', e);
}

async function startServer() {
  const app = express();

  // Parse JSON payloads up to 50MB (supporting full raw spreadsheets)
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Get current shared records across all users
  app.get('/api/records', (req, res) => {
    res.json({
      success: true,
      hasCustomData: Boolean(savedData && savedData.records && savedData.records.length > 0),
      records: savedData?.records || null,
      syncSourceInfo: savedData?.syncSourceInfo || null,
      updatedAt: savedData?.updatedAt || null,
    });
  });

  // Save updated records (from Excel import, Google Sheet sync, or manual edits)
  app.post('/api/records', (req, res) => {
    try {
      const { records, syncSourceInfo } = req.body;
      if (!Array.isArray(records)) {
        return res.status(400).json({ success: false, error: 'Invalid records array' });
      }

      const updatedAt = new Date().toISOString();
      savedData = {
        records,
        syncSourceInfo: syncSourceInfo || {
          fileName: 'Shared JO ACTIVATED',
          sheetName: 'JO ACTIVATED',
          isScreenshotSample: false,
          lastSyncTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          rowCount: records.length,
        },
        updatedAt,
      };

      // Persist to disk asynchronously
      fs.writeFile(DATA_FILE, JSON.stringify(savedData), 'utf-8', (err) => {
        if (err) console.error('Error saving data to disk:', err);
      });

      res.json({
        success: true,
        count: records.length,
        updatedAt,
      });
    } catch (e: any) {
      console.error('Error saving records:', e);
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // Reset to default
  app.post('/api/records/reset', (req, res) => {
    try {
      savedData = null;
      if (fs.existsSync(DATA_FILE)) {
        fs.unlinkSync(DATA_FILE);
      }
      res.json({ success: true, message: 'Reset to default seed data' });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
