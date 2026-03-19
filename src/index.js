require("dotenv").config();
const express = require("express");
const { startListeners } = require("./supabase/listener");

const app = express();

app.listen(process.env.PORT, async () => {
  console.log("App started at http://localhost:" + process.env.PORT);
  startListeners();
});
