require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { startListeners } = require("./supabase/listener");
const { resident_route } = require("./routes/resident_route");
const { supabase } = require("./supabase/client");
const superadmin_route = require("./routes/superadmin_route");
const { autoAssignListeners } = require("./supabase/autoAssign");
const {
  autoUpdateOfficialMetadata,
} = require("./supabase/autoUpdateOfficialMetadata");

const app = express();

app.use(cors());

app.use(express.json());

app.use("/resident", resident_route);
app.use("/superadmin", superadmin_route);

app.listen(process.env.PORT, async () => {
  console.log("App started at http://localhost:" + process.env.PORT);
  startListeners(); // FOR SMS
  autoAssignListeners();
  autoUpdateOfficialMetadata();
  // tokenGetter();
});

const tokenGetter = async () => {
  const { data, error } = await supabase.auth.signInWithPassword({
    // email: "xeroj1342@gmail.com", // Superadmin
    // password: "password123",
    email: "ilyneulgasan29@gmail.com", // Resident
    password: "password1234",
  });
  console.log(data);
  console.log(data.session.access_token);
};
