// Import the dependencies
const dotenv = require("dotenv");
const express = require("express");
const bodyParser = require("body-parser");

const Cronofy = require("cronofy");

const moment = require("moment");

const dateUtils = require("./dateUtils");

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
    data_center: process.env.DATA_CENTER
    // access_token: process.env.ACCESS_TOKEN,
});

const refreshToken = refreshAccessToken();

// Route: home
app.get("/", async (req, res) => {
    
    const sub = process.env.SUB;
    let token = ''
    if (sub) {
        token = await cronofyClient.requestElementToken({
            version: "1",
            permissions: ["account_management", "managed_availability"],
            subs: [process.env.SUB],
            origin: "http://localhost:7070"
        }).catch((err) => {
            console.error(err);
        });
        console.log(token);
    }

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
        element_token: token.element_token.token || '',
        client_id: process.env.CLIENT_ID,
        data_center: process.env.DATA_CENTER,
        sub: process.env.SUB
    });
    
});

// Route: availability_grid
app.get("/availability_grid", async (req, res) => {
    // Availability code goes here
    const token = await cronofyClient.requestElementToken({
        version: "1",
        permissions: ["availability"],
        subs: [process.env.SUB],
        origin: "http://localhost:7070"
    }).catch((err) => {
        console.error(err);
    });
    console.log(token);

    // Get availability periods
    const period = dateUtils.getTwoWeekPeriod();

    return res.render("availability-grid", {
        element_token: token.element_token.token,
        sub: process.env.SUB,
        calendar_id: process.env.CALENDAR_ID,
        data_center: process.env.DATA_CENTER,
        period: period
    });
});

// Route: availability
app.get("/availability", async (req, res) => {
    // Availability code goes here
    const token = await cronofyClient.requestElementToken({
        version: "1",
        permissions: ["availability"],
        subs: [process.env.SUB],
        origin: "http://localhost:7070"
    }).catch((err) => {
        console.error(err);
    });
    console.log(token);

     // Get availability periods
     const period = dateUtils.getTwoWeekPeriod();
     console.log(period)

    return res.render("availability", {
        element_token: token.element_token.token,
        sub: process.env.SUB,
        calendar_id: process.env.CALENDAR_ID,
        data_center: process.env.DATA_CENTER,
        period: period
    });
});

// Route: submit
app.get("/submit", async (req, res) => {
    // Submit code goes here
    // Get the `slot` data from the query string
    console.log("Submitted: ", req.query.slot)
    const slot = JSON.parse(req.query.slot);
    console.log("Parsed: ", slot);

    // const userInfo = await cronofyClient.userInfo();
    // const calendarId = userInfo["cronofy.data"].profiles[0].profile_calendars[0].calendar_id;
    // Setting this in Config because of my sub's crazy calendar setup
    
    // Ensure our client has a valid access token
    await refreshToken();
    
    cronofyClient.createEvent({
        calendar_id: process.env.CALENDAR_ID,
        event_id: `process.env.CALENDAR_ID::${slot.start}`,
        summary: "Demo meeting",
        description: "The Cronofy developer demo has created this event",
        start: slot.start,
        end: slot.end
    });

    const meetingDate = moment(slot.start).format("DD MMM YYYY");
    const start = moment(slot.start).format("LT");
    const end = moment(slot.end).format("LT");

    return res.render("submit", {
        meetingDate,
        start,
        end
    });
});

function refreshAccessToken() {
    let obtainedAt = new Date();
    let expiresIn = 0;
    let expiresAt = new Date(obtainedAt.getTime() + (expiresIn * 1000));

    return async function() {
        if (Date.now() <= expiresAt) {
            console.log("Valid access token expires: ", expiresAt);
            return;
        }
        await cronofyClient.refreshAccessToken({
            client_id: process.env.CLIENT_ID,
            client_secret: process.env.CLIENT_SECRET,
            refresh_token: process.env.REFRESH_TOKEN
        }).then((response) => {
            console.log("Access token refreshed: ", response);
            obtainedAt = new Date();
            expiresIn = response.expires_in;
            expiresAt = new Date(obtainedAt.getTime() + (expiresIn * 1000));
            console.log ("Expires at: ", expiresAt);
            // Should probably store the new refresh token...
            cronofyClient.config.access_token = response.access_token;
        }).catch((err) => {
            console.error("Error refreshing access token: ", err);
        });
    }
}

app.listen(PORT);
console.log("serving on http://localhost:7070");
