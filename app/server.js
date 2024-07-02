// Import the dependencies
const dotenv = require("dotenv");
const express = require("express");
const bodyParser = require("body-parser");

const Cronofy = require("cronofy");

const moment = require("moment");

const dateUtils = require("./dateUtils");

const {subMap} = require("./subList");

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

    // Log the user Info
    refreshToken();
    // cronofyClient.userInfo()
    // .then(response => {
    //     console.log('User Info:', response);
    // })
    // .catch(err => {
    //     console.error('Error fetching user info:', err);
    // });
    
    // Homepage code goes here
    return res.render("home", {
        element_token: token?.element_token?.token || '',
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

    // List current AvailabilityPeriods
    cronofyClient.listAvailablePeriods()
    .then(response => {
        console.log('Available Periods:', response.available_periods);
    })
    .catch(err => {
        console.error('Error fetching available periods:', err);
    });
    
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

app.get("/agenda", async (req, res) => {
    // Availability code goes here
    const token = await cronofyClient.requestElementToken({
        version: "1",
        permissions: ["agenda"],
        subs: [process.env.SUB],
        origin: "http://localhost:7070"
    }).catch((err) => {
        console.error(err);
    });

    return res.render("agenda", {
        element_token: token.element_token.token,
    });
});

// Route: availability
app.get("/availability", async (req, res) => {
    // Availability code goes here
    const token = await cronofyClient.requestElementToken({
        version: "1",
        permissions: ["availability"],
        subs: [ "apc_667dcf10824ece9a9d03f09e", 
                "apc_667dd62f79c3b2821cc0ef1d", 
                "apc_667e23bca2ce8c75e40e4f99",
                "apc_667e24aea2ce8ce1d454f6c6"],
        origin: "http://localhost:7070"
    }).catch((err) => {
        console.error(err);
    });

     // Get availability periods
    const period = dateUtils.getTwoWeekPeriod();

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
    // TODO: Loop through the subs that are available for this slot. 
    // Booking the first one that is not the current logged in user.
    // This isn't currently working as expected. The Calendar ID from the slot is not 
    // the right calendar ID to use in a createEvent call.
    let targetSubject = undefined;
    if (slot.participants.length <= 1) {
        targetSubject = slot.participants[0].sub;
    } else {
        slot.participants.forEach( (user, index) => { 
            if (process.env.SUB === user.sub) {
                return;
            }
            targetSubject = user.sub;
        });
    }

    let error = '';
    try 
    {
        // Ensure our client has a valid access token.
        // TODO: get an access token for the selected sub
        // await refreshToken();
        if (targetSubject !== process.env.SUB) {
            await useAccessToken(targetSubject);
        }
        const userInfo = await cronofyClient.userInfo();
        const userCalendarId = userInfo["cronofy.data"].profiles[0].profile_calendars[0].calendar_id;

        await cronofyClient.createEvent({
            calendar_id: userCalendarId,
            event_id: `${userCalendarId}::${slot.start}`,
            summary: "Demo meeting",
            description: "The Cronofy developer demo has created this event",
            start: slot.start,
            end: slot.end
        });

        // Switch our client back to the main user.
        if (targetSubject !== process.env.SUB) {
            await useAccessToken(process.env.SUB);
        }

    } catch (err) {
        console.error("Error creating event: ", err);
        error = err.statusCode;
    }

    const meetingDate = moment(slot.start).format("DD MMM YYYY");
    const start = moment(slot.start).format("LT");
    const end = moment(slot.end).format("LT");

    return res.render("submit", {
        meetingDate,
        start,
        end,
        error,
    });
});

app.get("/accounts", async (req, res) => {

    // Get the list of application accounts from the Cronofy API
    // cronofyClient.listCalendars()
    //     .then(response => {
    //         console.log('Account Information:', response);
    //     })
    //     .catch(err => {
    //         console.error('Error fetching account information:', err);
    //     });
    
    let message = req.query.message || "";
    if (message) {
        message = decodeURIComponent(message);
    }

    return res.render("accounts", {message: message});
});

app.post("/createAccount", async (req, res) => {

    // get the shedID from the form
    const shedId = req.body.shedId;
    console.log("Creating account for shedId: ", shedId);
    const response = createCalAccount(shedId);

    const message = response.error ? "Error creating account" : "Account created successfully";

    res.redirect("/accounts?message=" + encodeURIComponent(message));
});

app.get("/updateAvailability", async (req, res) => {
    
    const queryPeriods = req.query.query_periods;
    console.log("Updating availability with", queryPeriods);
    if (queryPeriods) {
        // First get the existing available periods
        let currentPeriods = undefined
        try {
            currentPeriods = await cronofyClient.listAvailablePeriods();
            console.log("Current periods: ", currentPeriods);
        }
        catch (err) {
            console.error('Error fetching available periods:', err);
        }

        // parse the queryPeriods and retrieve the start and end times
        const periodsArray = JSON.parse(queryPeriods);
        console.log("Parsed periods: ", periodsArray);

        // loop through the periodsArray calling upsertAvailablePeriods
        
        
        for (const period of periodsArray) {
            const periodIdPrefix = `shed_1-${period.start}`
            // await call upsertAvailabePeriods
            // check to see if the period already exists and if it does remove it instead of updating it
            let removedExisting = false;
            if (currentPeriods) {
                for (const existingPeriod of currentPeriods.available_periods) {
                    if (existingPeriod.available_period_id.startsWith(periodIdPrefix)) {
                        console.log("Removing existing period: ", existingPeriod);
                        removedExisting = true;
                        await cronofyClient.deleteAvailablePeriods({
                            available_period_id: existingPeriod.available_period_id
                        }).then((response) => {
                            console.log("Removed availability: ", response);
                        }).catch((err) => {
                            console.error("Error removing availability: ", err);
                        });
                    }
                }
            }
            
            if (!removedExisting) {
                await cronofyClient.upsertAvailablePeriod({
                    available_period_id: `${periodIdPrefix}-${period.end}`,
                    start: period.start,
                    end: period.end
                }).then((response) => {
                    console.log("Updated availability: ", response);
                }).catch((err) => {
                    console.error("Error updating availability: ", err);
                });
            }
        }
       
    }
    // const message = response.error ? "Error creating account" : "Account created successfully";
    res.redirect("/availability_grid?message=" + encodeURIComponent(queryPeriods));
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

async function useAccessToken(sub) {
    const refreshToken = subMap.get(sub);

    await cronofyClient.requestAccessToken({
        client_id: process.env.CLIENT_ID,
        client_secret: process.env.CLIENT_SECRET,
        refresh_token: refreshToken
    }).then((response) => {
        console.log("Access token created: ", response);
        obtainedAt = new Date();
        expiresIn = response.expires_in;
        expiresAt = new Date(obtainedAt.getTime() + (expiresIn * 1000));
        console.log ("Expires at: ", expiresAt);
        cronofyClient.config.access_token = response.access_token;
    });
}

function createCalAccount(shedId) {
    let response = {
        applicationCalendar: null,
        error: null
    }
    
    const options = { 
        application_calendar_id: shedId
    }
    
    cronofyClient.applicationCalendar(options)
    .then((applicationCalendar) => { 
        console.log("Created calendar account: ", applicationCalendar);
        response.applicationCalendar = applicationCalendar;

    }).catch((err) => {
        console.error("Error creating calendar account: ", err);
        response.error = err;
    });

    return response;
}

app.listen(PORT);
console.log("serving on http://localhost:7070");
