const express = require("express");
const { chatbot_controller } = require("../controllers/resident_controller");
const {
  supabase_resident_auth,
} = require("../middlewares/supabase_resident_auth");

const resident_route = express.Router();

// Auth Middleware
resident_route.use(supabase_resident_auth);

resident_route.post("/chatbot", chatbot_controller);

module.exports = { resident_route };
