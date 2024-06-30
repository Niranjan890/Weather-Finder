require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const admin = require("firebase-admin");
const path = require("path");
const axios = require("axios");
const bcrypt = require("bcrypt");

const app = express();

const serviceAccount = require("./serviceAccount.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

const OPENWEATHERMAP_API_KEY = "b19f19711b17e11d45c5c9fac8c137a2";

app.get("/signup", (req, res) => {
  res.render("signup", { error: null });
});

app.post("/signup", async (req, res) => {
  const { username, password, confirm_password } = req.body;

  if (password !== confirm_password) {
    return res.render("signup", { error: "Passwords do not match" });
  }

  try {
    const userExists = await db.collection("users").where("username", "==", username).get();
    if (!userExists.empty) {
      return res.render("signup", { error: "Username already exists" });
    } 

    const hashedPassword = await bcrypt.hash(password, 10);

    await db.collection("users").add({
      username,
      password: hashedPassword,
    });

    res.redirect("/login");
  } catch (error) {
    res.status(500).send("Error: " + error.message);
  }
});

app.get("/login", (req, res) => {
  res.render("login", { error: null });
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const userSnapshot = await db.collection("users").where("username", "==", username).get();
    if (userSnapshot.empty) {
      return res.render("login", { error: "Invalid username or password" });
    }

    const user = userSnapshot.docs[0].data();
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (passwordMatch) {
      res.redirect(`/dashboard?username=${user.username}`);
    } else {
      res.render("login", { error: "Invalid username or password" });
    }
  } catch (error) {
    res.status(500).send("Error: " + error.message);
  }
});

app.get("/dashboard", (req, res) => {
  const { username } = req.query;
  res.render("dashboard", { username, weatherData: null, error: null });
});

app.post("/search", async (req, res) => {
  const { location } = req.body;
  const { username } = req.query;

  try {
    const response = await axios.get(`https://api.openweathermap.org/data/2.5/weather?q=${location}&units=metric&appid=${OPENWEATHERMAP_API_KEY}`);

    if (response.data) {
      const weatherData = response.data;
      res.render("dashboard", {
        username,
        weatherData,
        error: null
      });
    } else {
      res.render("dashboard", {
        username,
        weatherData: null,
        error: "Location not found. Please check the spelling."
      });
    }
  } catch (error) {
    console.error("Error fetching weather data:", error.response ? error.response.data : error.message);
    res.render("dashboard", {
      username,
      weatherData: null,
      error: "Error fetching weather data. Please try again later."
    });
  }
});

app.listen(3000, () => {
  console.log("Server is running on port 3000");
});
