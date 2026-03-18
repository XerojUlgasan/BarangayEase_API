require("dotenv").config();
const express = require("express");
const tr_project = require("./telerivet/client");

const app = express();

app.listen(process.env.PORT, () => {
  console.log("App started at http://localhost:" + process.env.PORT);

  //   tr_project.sendMessage(
  //     {
  //       content: "Hello galing kay xeroj tangina nyo",
  //       to_number: "09916237684",
  //     },
  //     (err, message) => {
  //       if (err) console.log(err);
  //       else console.log(message);
  //     },
  //   );

  //   tr_project.sendMessage(
  //     {
  //       content: "Hello galing kay xeroj tangina nyo",
  //       to_number: "09176085959",
  //     },
  //     (err, message) => {
  //       if (err) console.log(err);
  //       else console.log(message);
  //     },
  //   );
});
