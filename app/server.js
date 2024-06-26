// Import the dependencies
const dotenv = require("dotenv");
const express = require("express");
const bodyParser = require("body-parser");

const Cronofy = require("cronofy");

// Enable dotenv
dotenv.config();

// Setup
const PORT = 7070;

// Setup Express
const app = express();
app.set("view engine", "ejs");
app.set("views", process.cwd() + "/app/templates");
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static(__dirname + "/"));

// Add the Cronofy client setup here
const cronofyClient = new Cronofy({
    client_id: process.env.CLIENT_ID,
    client_secret: process.env.CLIENT_SECRET,
    data_center: process.env.DATA_CENTER,
});

// Route: home
app.get("/", async (req, res) => {
    
    const token = await cronofyClient.requestElementToken({
        version: "1",
        permissions: ["account_management"],
        subs: [process.env.SUB],
        origin: "http://localhost:7070"
    }).catch((err) => {
        console.error(err);
    });

    // Extract the access token "code" from the page's query string
    const codeFromQuery = req.query.code;
    if (codeFromQuery) {
        // If the code is present, exchange it for an access token
        const codeResponse = await cronofyClient.requestAccessToken({
            client_id: process.env.CLIENT_ID,
            client_secret: process.env.CLIENT_SECRET,
            grant_type: "authorization_code",
            code: codeFromQuery,
            redirect_uri: "http://localhost:7070",
        });
        console.log(codeResponse);
    }
    
    // Homepage code goes here
    return res.render("home", {
        element_token: token.element_token.token,
        client_id: process.env.CLIENT_ID,
        data_center: process.env.DATA_CENTER,
    });
    
});

// Route: availability
app.get("/availability", async (req, res) => {
    // Availability code goes here

    return res.render("availability", {
        token: "YOUR_TOKEN_GOES_HERE",
        sub: process.env.SUB,
    });
});

// Route: submit
app.get("/submit", async (req, res) => {
    // Submit code goes here

    return res.render("submit", {
        meetingDate: "MEETING_DATE_GOES_HERE",
        start: "START_TIME_GOES_HERE",
        end: "END_TIME_GOES_HERE",
    });
});

app.listen(PORT);
console.log("serving on http://localhost:7070");
