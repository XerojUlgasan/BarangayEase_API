require("dotenv").config();
const telerivet = require("telerivet");

var tr = new telerivet.API(process.env.TELERIVET_API_KEY);
var tr_project = tr.initProjectById("PJ2a6106b406c19efc");

module.exports = tr_project;
