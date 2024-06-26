// dateUtils.js

// Function to get the current date and time
function getTwoWeekPeriod() {
    const start_date = new Date();
    const end_date = new Date();
    end_date.setDate(start_date.getDate() + 14);

    return {
        start: getCalFormatString(start_date),
        end: getCalFormatString(end_date)
    };
}

function getCalFormatString(date) {
    // 2024-06-26T06:00:00Z
    return date.toISOString().split(".")[0] + "Z";
}

// Export the functions as an object
module.exports = {
    getTwoWeekPeriod,
};