const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const queryRouter = require('./routes/query');
const modelsRouter = require('./routes/models');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Routes
app.use('/query', queryRouter); // POST /query, GET /query/images -> controller
app.use('/', modelsRouter);     // legacy in-process mocks: /vqa, /grounding, /change-detection

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'SatAsk backend is running' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    status: 'error',
    error: {
      code: 'SERVER_ERROR',
      message: 'An unexpected error occurred.'
    }
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
