"use strict";
exports.__esModule = true;
var express = require("express");
var needle = require("needle");
var moment = require("moment");
var app = express();
app.set("view engine", "ejs");
// Metadata
var nomadlistUser = "krausefx";
var moodHostUrl = "https://krausefx-mood.herokuapp.com/";
// Cache
var currentCityText = "";
var currentLat = null;
var currentLng = null;
var nextCityText = null;
var nextCityDate = null;
var currentMoodLevel = null;
var currentMoodEmoji = null;
var currentModeRelativeTime = null;
// Refresher methods
function updateNomadListData() {
    var nomadlistUrl = "https://nomadlist.com/@" + nomadlistUser + ".json";
    needle.get(nomadlistUrl, function (error, response, body) {
        if (error) {
            console.log(error);
        }
        else if (response.statusCode == 200) {
            var parsedNomadListData = JSON.parse(body);
            var now = parsedNomadListData["location"]["now"];
            var next = parsedNomadListData["location"]["next"];
            currentCityText = now["city"] + ", " + now["country"];
            currentLat = now["latitude"];
            currentLng = now["longitude"];
            nextCityText = next["city"] + ", " + next["country"];
            nextCityDate = next["date_start"];
            console.log("Successfully loaded nomadlist data");
        }
    });
}
function updateMood() {
    var moodUrl = moodHostUrl + "current_mood.json";
    needle.get(moodUrl, function (error, response, body) {
        if (error) {
            console.log(error);
        }
        else if (response.statusCode == 200) {
            var parsedBody = JSON.parse(body);
            switch (parseInt(parsedBody["value"])) {
                case 5:
                    currentMoodLevel = "pumped, energized";
                    currentMoodEmoji = "🤩";
                    break;
                case 4:
                    currentMoodLevel = "happy, excited";
                    currentMoodEmoji = "😃";
                    break;
                case 3:
                    currentMoodLevel = "good, alright";
                    currentMoodEmoji = "😎";
                    break;
                case 2:
                    currentMoodLevel = "down, worried";
                    currentMoodEmoji = "😐";
                    break;
                case 1:
                    currentMoodLevel = "Sad, unhappy";
                    currentMoodEmoji = "😔";
                    break;
                case 0:
                    currentMoodLevel = "Miserable, nervous";
                    currentMoodEmoji = "😩";
                    break;
            }
            currentModeRelativeTime = moment(new Date(parsedBody["time"])).fromNow();
        }
    });
}
function allDataLoaded() {
    if (currentCityText == null || nextCityText == null || nextCityDate == null) {
        return false;
    }
    return true;
}
setInterval(updateNomadListData, 60 * 1000);
setInterval(updateMood, 60 * 1000);
updateNomadListData();
updateMood();
// Web server
app.get("/", function (req, res) {
    // Because we're using the free Heroku tier for now
    // this means the server might just have started up
    // if that's the case, we'll have to wait until all data
    // is fetched
    if (allDataLoaded()) {
        res.render("pages/index", {
            currentCityText: currentCityText,
            nextCityText: nextCityText,
            nextCityDate: nextCityDate,
            currentMoodLevel: currentMoodLevel,
            currentMoodEmoji: currentMoodEmoji,
            currentModeRelativeTime: currentModeRelativeTime
        });
    }
    else {
        res.render("pages/loading");
    }
});
var port = process.env.PORT || 8080;
app.listen(port);
console.log("server live on port " + port);
