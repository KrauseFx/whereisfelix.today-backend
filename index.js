"use strict";
exports.__esModule = true;
var express = require("express");
var needle = require("needle");
var moment = require("moment");
var ical = require("ical");
var app = express();
var cors = require("cors");
var mfp = require("mfp"); // MyFitnessPal
app.use(cors());
// Metadata
var nomadlistUser = "krausefx";
var lifesheetURL = "https://fx-life-sheet.herokuapp.com/";
var googleMapsKey = "AIzaSyDeiw5iiluUP6Txt7H584no1adlsDj-jUc";
var githubUser = "KrauseFx";
var githubFullName = "Felix Krause";
var myFitnessPalUser = "krausefx1";
// Cache
var finishedLoadingNomadList = false;
var currentCityText = null;
var currentLat = null;
var currentLng = null;
var nextCityText = null;
var nextCityDate = null;
var nextStays = [];
var currentMoodLevel = null;
var currentMoodEmoji = null;
var otherFxLifeData;
var currentMoodRelativeTime = null;
var nextEvents = [];
var nextConferences = [];
var recentPhotos = null;
var isMoving;
var lastCommitMessage;
var lastCommitRepo;
var lastCommitLink;
var lastCommitTimestamp;
var todaysMacros;
var todaysFoodItems = [];
var numberOfTodoItems;
// Refresher methods
function updateNomadListData() {
    nextStays = [];
    var nomadlistUrl = "https://nomadlist.com/@" + nomadlistUser + ".json";
    needle.get(nomadlistUrl, function (error, response, body) {
        if (error) {
            console.log(error);
        }
        else if (response.statusCode == 200) {
            var parsedNomadListData = body;
            var now = parsedNomadListData["location"]["now"];
            var next = parsedNomadListData["location"]["next"];
            if (now["date_start"] == moment().format("YYYY-MM-DD")) {
                // Today I'm switching cities, let's show a "moving" status on the website
                var previous = parsedNomadListData["location"]["previously"];
                currentCityText = "✈️ " + now["city"];
                isMoving = true;
            }
            else if (now["country_code"]) {
                currentCityText =
                    now["city"] + ", " + now["country_code"].toUpperCase();
                isMoving = false;
            }
            else {
                isMoving = false;
                currentCityText = "Unknown";
            }
            currentLat = now["latitude"];
            currentLng = now["longitude"];
            if (next) {
                nextCityText = next["city"];
            }
            if (nextCityText != null) {
                nextCityDate = moment(next["date_start"]).fromNow();
            }
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
            finishedLoadingNomadList = true;
            console.log("Successfully loaded nomadlist data");
        }
    });
}
function updateMood() {
    needle.get(lifesheetURL, function (error, response, body) {
        if (error) {
            console.log(error);
        }
        else if (response.statusCode == 200) {
            otherFxLifeData = body;
            var mood = parseInt(body["mood"]["value"]);
            switch (mood) {
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
            currentMoodRelativeTime = moment(new Date(body["mood"]["time"])).fromNow();
        }
    });
}
function updateCommitMessage() {
    var githubURL = "https://api.github.com/users/" + githubUser + "/events";
    needle.get(githubURL, function (error, response, body) {
        if (response.statusCode == 200) {
            for (var index in body) {
                var currentEvent = body[index];
                if (currentEvent["type"] == "PushEvent") {
                    var commits = currentEvent["payload"]["commits"].reverse();
                    for (var commitIndex in commits) {
                        var currentCommit = commits[commitIndex];
                        if (!currentCommit["message"].includes("Merge") &&
                            currentCommit["author"]["name"] == githubFullName) {
                            lastCommitMessage = currentCommit["message"];
                            lastCommitRepo = currentEvent["repo"]["name"];
                            // Convert the GitHub API link to a `html_url`
                            lastCommitLink = currentCommit["url"]
                                .replace("api.github.com", "github.com")
                                .replace("github.com/repos", "github.com")
                                .replace("/commits/", "/commit/");
                            lastCommitTimestamp = new Date(currentEvent["created_at"]);
                            return;
                        }
                    }
                }
            }
        }
        else {
            console.log(error);
        }
    });
}
function fetchTrelloItems() {
    // via https://developers.trello.com/reference#boardsboardidlabels
    var trelloUrl = "https://api.trello.com/1/boards/" +
        process.env.TRELLO_BOARD_ID +
        "/lists?cards=open&card_fields=all&filter=open&fields=all&key=" +
        process.env.TRELLO_API_KEY +
        "&token=" +
        process.env.TRELLO_API_TOKEN;
    numberOfTodoItems = 0;
    needle.get(trelloUrl, function (error, response, body) {
        if (error) {
            console.error(error);
        }
        if (response.statusCode == 200) {
            for (var i in body) {
                var currentList = body[i];
                if (currentList["name"] != "Done") {
                    numberOfTodoItems += currentList["cards"].length;
                }
            }
        }
        console.log("Number of Trello tasks: " + numberOfTodoItems);
    });
}
function fetchMostRecentPhotos() {
    var instagramUrl = "https://api.instagram.com/v1/users/self/media/recent?access_token=" +
        process.env.INSTAGRAM_ACCESS_TOKEN;
    needle.get(instagramUrl, function (error, response, body) {
        if (response.statusCode == 200) {
            recentPhotos = [];
            var mostRecentData = body["data"];
            for (var i in mostRecentData) {
                var currentPhoto = mostRecentData[i];
                var caption = null;
                if (currentPhoto["caption"] && currentPhoto["caption"]["text"]) {
                    caption = currentPhoto["caption"]["text"];
                }
                recentPhotos.push({
                    text: caption,
                    url: currentPhoto["images"]["standard_resolution"]["url"],
                    link: currentPhoto["link"],
                    posted: new Date(parseInt(currentPhoto["created_time"]) * 1000)
                });
            }
        }
        else {
            console.log(error);
            console.log(response);
        }
    });
}
function updateFoodData() {
    mfp.fetchSingleDate(myFitnessPalUser, moment().format("YYYY-MM-DD"), ["calories", "protein", "carbs", "fat", "entries"], function (data) {
        todaysMacros = {
            kcal: data["calories"],
            carbs: data["carbs"],
            protein: data["protein"],
            fat: data["fat"]
        };
        todaysFoodItems = [];
        for (var rawFoodItemIndex in data["entries"]) {
            var rawFoodItem = data["entries"][rawFoodItemIndex];
            if (![
                "TOTAL:",
                "Exercises",
                "Withings Health Mate  calorie adjustment",
            ].includes(rawFoodItem["name"])) {
                todaysFoodItems.push({
                    name: rawFoodItem["name"],
                    amount: rawFoodItem["amount"]
                });
            }
        }
        // TODO: use promises and reduce duplicate code
        if (todaysMacros.kcal == undefined || todaysMacros.kcal == 0) {
            // time zones and stuff, going back to yesterday
            mfp.fetchSingleDate(myFitnessPalUser, moment().subtract(1, "day").format("YYYY-MM-DD"), ["calories", "protein", "carbs", "fat"], function (data) {
                todaysMacros = {
                    kcal: data["calories"],
                    carbs: data["carbs"],
                    protein: data["protein"],
                    fat: data["fat"]
                };
            });
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
    // TODO: potentially fetch them from https://github.com/KrauseFx/speaking
    nextConferences = [
    // {
    //   location: "Belgrade, Serbia",
    //   dates: "19th Oct",
    //   name: "heapcon",
    //   link: "https://heapcon.io/"
    // }
    ];
}
function generateMapsUrl() {
    return ("https://maps.googleapis.com/maps/api/staticmap?center=" +
        currentCityText +
        "&zoom=10&size=1200x190&scale=2&maptype=roadmap" +
        "&key=" +
        googleMapsKey);
}
function allDataLoaded() {
    if (!finishedLoadingNomadList) {
        return false;
    }
    if (lastCommitMessage == null) {
        return false;
    }
    return true;
}
// The first number is the # of minutes to wait to reload
setInterval(updateNomadListData, 60 * 60 * 1000);
setInterval(updateMood, 30 * 60 * 1000);
setInterval(fetchMostRecentPhotos, 30 * 60 * 1000);
// setInterval(updateCalendar, 15 * 60 * 1000);
setInterval(updateCommitMessage, 5 * 60 * 1000);
setInterval(updateFoodData, 15 * 60 * 1000);
setInterval(fetchTrelloItems, 15 * 60 * 1000);
fetchTrelloItems();
fetchMostRecentPhotos();
updateNomadListData();
updateMood();
// updateCalendar();
updateConferences();
updateCommitMessage();
updateFoodData();
function getDataDic() {
    return {
        currentCityText: currentCityText,
        nextCityText: nextCityText,
        nextCityDate: nextCityDate,
        currentMoodLevel: currentMoodLevel,
        otherFxLifeData: otherFxLifeData,
        currentMoodEmoji: currentMoodEmoji,
        currentMoodRelativeTime: currentMoodRelativeTime,
        nextConferences: nextConferences,
        nextEvents: nextEvents,
        nextStays: nextStays,
        isMoving: isMoving,
        numberOfTodoItems: numberOfTodoItems,
        lastCommitMessage: lastCommitMessage,
        lastCommitRepo: lastCommitRepo,
        lastCommitLink: lastCommitLink,
        lastCommitTimestamp: lastCommitTimestamp,
        todaysMacros: todaysMacros,
        todaysFoodItems: todaysFoodItems,
        mapsUrl: generateMapsUrl(),
        localTime: moment()
            .subtract(-1, "hours") // -1 = VIE, 5 = NYC, 8 = SF
            .format("hh:mm a"),
        profilePictureUrl: "https://krausefx.com/assets/FelixKrauseCropped.jpg",
        recentPhotos: recentPhotos
    };
}
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
