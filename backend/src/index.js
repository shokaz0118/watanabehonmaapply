const express = require("express");
const app = express();
const port = process.env.PORT || 3001;

require('dotenv').config();

app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

const { register, login } = require('./auth');
app.post('/api/auth/register', register);
app.post('/api/auth/login', login);

app.listen(port, () => {
  console.log(`Backend listening at http://localhost:${port}`);
});
