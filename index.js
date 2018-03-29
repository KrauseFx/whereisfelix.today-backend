"use strict";
exports.__esModule = true;
var express = require("express");
var needle = require("needle");
var moment = require("moment");
var ical = require("ical");
var app = express();
app.set("view engine", "ejs");
// Metadata
var nomadlistUser = "krausefx";
var moodHostUrl = "https://krausefx-mood.herokuapp.com/";
var facebookId = "100000723486971";
var googleMapsKey = "AIzaSyDeiw5iiluUP6Txt7H584no1adlsDj-jUc";
// Cache
var currentCityText = null;
var currentLat = null;
var currentLng = null;
var nextCityText = null;
var nextCityDate = null;
var nextStays = [];
var currentMoodLevel = null;
var currentMoodEmoji = null;
var currentModeRelativeTime = null;
var nextEvents = [];
var nextConferences = [];
var recentPhotos = null;
// Refresher methods
function updateNomadListData() {
    nextStays = [];
    var nomadlistUrl = "https://nomadlist.com/@" + nomadlistUser + ".json";
    needle.get(nomadlistUrl, function (error, response, body) {
        if (error) {
            console.log(error);
        }
        else if (response.statusCode == 200) {
            var parsedNomadListData = JSON.parse(body);
            var now = parsedNomadListData["location"]["now"];
            var next = parsedNomadListData["location"]["next"];
            currentCityText = now["city"] + ", " + now["country_code"];
            currentLat = now["latitude"];
            currentLng = now["longitude"];
            nextCityText = next["city"];
            nextCityDate = moment(next["date_start"]).fromNow();
            for (var index in parsedNomadListData["trips"]) {
                var currentStay = parsedNomadListData["trips"][index];
                if (currentStay["epoch_start"] > new Date().getTime() / 1000) {
                    nextStays.unshift({
                        name: currentStay["place"] + ", " + currentStay["country"],
                        from: moment(currentStay["epoch_start"] * 1000).fromNow(),
                        fromDate: moment(currentStay["epoch_start"] * 1000),
                        "for": currentStay["length"],
                        toDate: moment(currentStay["epoch_end"] * 1000)
                    });
                }
            }
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
                    currentMoodLevel = "okay";
                    currentMoodEmoji = "🙃";
                    break;
                case 1:
                    currentMoodLevel = "okay";
                    currentMoodEmoji = "🙃";
                    break;
                case 0:
                    currentMoodLevel = "okay";
                    currentMoodEmoji = "🙃";
                    break;
            }
            currentModeRelativeTime = moment(new Date(parsedBody["time"])).fromNow();
        }
    });
}
function fetchMostRecentPhotos() {
    var facebookUrl = "https://graph.facebook.com/v2.12/" +
        process.env.FACEBOOK_USER_ID +
        "/photos";
    needle.request("get", facebookUrl, "type=uploaded&fields=name,images,link&limit=8", {
        headers: {
            Authorization: "Bearer " + process.env.FACEBOOK_ACCESS_TOKEN
        }
    }, function (error, response, body) {
        if (response.statusCode == 200) {
            recentPhotos = [];
            var mostRecentData = response["body"]["data"];
            for (var i in mostRecentData) {
                var currentPhoto = mostRecentData[i];
                recentPhotos.push({
                    text: currentPhoto["name"],
                    url: currentPhoto["images"][0]["source"],
                    link: currentPhoto["link"]
                });
            }
        }
        else {
            console.log(error);
            console.log(response);
        }
    });
}
function updateCalendar() {
    nextEvents = [];
    var icsUrls = [process.env.ICS_URL, process.env.WORK_ICS_URL];
    for (var index in icsUrls) {
        ical.fromURL(icsUrls[index], {}, function (err, data) {
            console.log("Loaded calendar data");
            for (var k in data) {
                if (data.hasOwnProperty(k)) {
                    var ev = data[k];
                    // only use calendar invites that within the next 7 days
                    if (ev["type"] == "VEVENT" &&
                        moment(ev["start"]).isBetween(new Date(), moment(new Date()).add(5, "days")) &&
                        moment(ev["end"]).diff(ev["start"], "hours") < 24 // we don't want day/week long events
                    ) {
                        nextEvents.push({
                            rawStart: moment(ev["start"]),
                            start: moment(ev["start"]).fromNow(),
                            end: moment(ev["end"]).fromNow(),
                            duration: Math.round(moment(ev["end"]).diff(ev["start"], "hours", true) * 10.0) / 10.0
                        });
                    }
                }
            }
            nextEvents.sort(function (a, b) {
                return a["rawStart"] - b["rawStart"];
            });
        });
    }
}
function updateConferences() {
    // TODO: fetch them from https://github.com/KrauseFx/speaking
    nextConferences = [
        {
            location: "St Petersburg, Russia",
            dates: "20 - 21 Apr",
            name: "MobiusConf",
            link: "https://mobiusconf.com/en/"
        },
        {
            location: "Vienna, Austria",
            dates: "16 - 18 May",
            name: "WeAreDevs",
            link: "https://www.wearedevelopers.com/congress/"
        }
    ];
}
function generateMapsUrl() {
    return ("https://maps.googleapis.com/maps/api/staticmap?center=" +
        currentCityText +
        "&zoom=10&size=1200x190&scale=2&maptype=roadmap" +
        // "&markers=color:blue%7Clabel:Felix%7C" +
        // currentCityText +
        "&key=" +
        googleMapsKey);
}
function allDataLoaded() {
    if (currentCityText == null || nextCityText == null || nextCityDate == null) {
        return false;
    }
    if (nextStays.length == 0) {
        // nextEvents.length == 0 // doesn't work if a got nothing on my calendar
        return false;
    }
    if (currentMoodLevel == null) {
        return false;
    }
    // if (recentPhotos == null) {
    //   return false;
    // }
    return true;
}
setInterval(updateNomadListData, 60 * 60 * 1000);
setInterval(updateMood, 30 * 60 * 1000);
setInterval(fetchMostRecentPhotos, 30 * 60 * 1000);
setInterval(updateCalendar, 15 * 60 * 1000);
fetchMostRecentPhotos();
updateNomadListData();
updateMood();
updateCalendar();
updateConferences();
function getDataDic() {
    return {
        currentCityText: currentCityText,
        nextCityText: nextCityText,
        nextCityDate: nextCityDate,
        currentMoodLevel: currentMoodLevel,
        currentMoodEmoji: currentMoodEmoji,
        currentModeRelativeTime: currentModeRelativeTime,
        nextConferences: nextConferences,
        nextEvents: nextEvents,
        nextStays: nextStays,
        mapsUrl: generateMapsUrl(),
        localTime: moment().format("hh:mm a"),
        profilePictureUrl: "https://graph.facebook.com/" + facebookId + "/picture?type=large",
        recentPhotos: recentPhotos
    };
}
// Web server
app.get("/", function (req, res) {
    // Because we're using the free Heroku tier for now
    // this means the server might just have started up
    // if that's the case, we'll have to wait until all data
    // is fetched
    if (allDataLoaded()) {
        res.render("pages/index", getDataDic());
    }
    else {
        res.render("pages/loading");
    }
});
app.get("/api.json", function (req, res) {
    if (allDataLoaded()) {
        res.json(getDataDic());
    }
    else {
        res.json({
            loading: true
        });
    }
});
var port = process.env.PORT || 8080;
app.listen(port);
console.log("server live on port " + port);
