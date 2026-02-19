const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/images', express.static(path.join(__dirname, 'data', 'images')));

// Initialize database
require('./database/db');

// API Routes
app.use('/api/categories', require('./routes/categories'));
app.use('/api/catalog', require('./routes/catalog'));
app.use('/api/lists', require('./routes/lists'));
app.use('/api/history', require('./routes/history'));

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Family Cart running at http://localhost:${PORT}`);
});
