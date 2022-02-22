import * as express from "express";
var needle = require("needle");
var moment = require("moment");
var ical = require("ical");

var app = express();
var cors = require("cors");
var mfp = require("mfp"); // MyFitnessPal

app.use(cors());

// Metadata
let nomadlistUser = "krausefx";
let lifesheetURL = "https://fx-life-sheet.herokuapp.com/";
let googleMapsKey = "AIzaSyDeiw5iiluUP6Txt7H584no1adlsDj-jUc";
let githubUser = "KrauseFx";
let githubFullName = "Felix Krause";
let myFitnessPalUser = "krausefx1";

// Interfaces
interface Conference {
  location: String;
  dates: String;
  link: String;
  name: String;
}

interface Stay {
  name: String;
  from: String;
  for: String;
  toDate: Date;
  fromDate: Date;
}

interface Photo {
  url: String;
  posted: String;
}

interface Food {
  kcal: Number;
  carbs: Number;
  protein: Number;
  fat: Number;
}

interface FoodItem {
  name: String;
  amount: String; // lol MyFitnessPal, thx
}

// Cache
let finishedLoadingNomadList: Boolean = false;
let currentCityText: String = null;
let currentLat: Number = null;
let currentLng: Number = null;
let nextCityText: String = null;
let nextCityDate: String = null;
let nextStays: Array<Stay> = [];
let currentMoodLevel: String = null;
let currentMoodEmoji: String = null;
let otherFxLifeData;
let currentMoodRelativeTime: String = null;
let nextEvents: Array<any> = [];
let nextConferences: Array<Conference> = [];
let recentPhotos: Array<Photo> = null;
let isMoving: Boolean;
let lastCommitMessage: String;
let lastCommitRepo: String;
let lastCommitLink: String;
let lastCommitTimestamp: Date;
let todaysMacros: Food;
let todaysFoodItems: Array<FoodItem> = [];
let numberOfTodoItems: number;

// Refresher methods
function updateNomadListData() {
  nextStays = [];
  let nomadlistUrl = "https://nomadlist.com/@" + nomadlistUser + ".json";

  needle.get(nomadlistUrl, function (error, response, body) {
    if (error) {
      console.log(error);
    } else if (response.statusCode == 200) {
      let parsedNomadListData = body;
      let now = parsedNomadListData["location"]["now"];
      let next = parsedNomadListData["location"]["next"];

      if (now["date_start"] == moment().format("YYYY-MM-DD")) {
        // Today I'm switching cities, let's show a "moving" status on the website
        let previous = parsedNomadListData["location"]["previously"];
        currentCityText = "✈️ " + now["city"];
        isMoving = true;
      } else if (now["country_code"]) {
        currentCityText =
          now["city"] + ", " + now["country_code"].toUpperCase();
        isMoving = false;
      } else {
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

      for (let index in parsedNomadListData["trips"]) {
        let currentStay = parsedNomadListData["trips"][index];
        if (currentStay["epoch_start"] > new Date().getTime() / 1000) {
          nextStays.unshift({
            name: currentStay["place"] + ", " + currentStay["country"],
            from: moment(currentStay["epoch_start"] * 1000).fromNow(),
            fromDate: moment(currentStay["epoch_start"] * 1000),
            for: currentStay["length"],
            toDate: moment(currentStay["epoch_end"] * 1000),
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
    } else if (response.statusCode == 200) {
      otherFxLifeData = body;

      let mood = parseInt(body["mood"]["value"]);
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
          currentMoodLevel = "good";
          currentMoodEmoji = "😎";
          break;
        case 2:
          currentMoodLevel = "alright";
          currentMoodEmoji = "😊";
          break;
        case 1:
          currentMoodLevel = "alright";
          currentMoodEmoji = "😊";
          break;
        case 0:
          currentMoodLevel = "alright";
          currentMoodEmoji = "😊";
          break;
      }
      currentMoodRelativeTime = moment(
        new Date(body["mood"]["time"])
      ).fromNow();
    }
  });
}

function updateCommitMessage() {
  let githubURL = "https://api.github.com/users/" + githubUser + "/events";
  needle.get(githubURL, function (error, response, body) {
    if (response.statusCode == 200) {
      for (let index in body) {
        let currentEvent = body[index];
        if (currentEvent["type"] == "PushEvent") {
          let commits = currentEvent["payload"]["commits"].reverse();
          for (let commitIndex in commits) {
            let currentCommit = commits[commitIndex];
            if (
              !currentCommit["message"].includes("Merge") &&
              currentCommit["author"]["name"] == githubFullName
            ) {
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
    } else {
      console.log(error);
    }
  });
}

function fetchTrelloItems() {
  // via https://developers.trello.com/reference#boardsboardidlabels
  let trelloUrl =
    "https://api.trello.com/1/boards/" +
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
        let currentList = body[i];
        if (currentList["name"] != "Done") {
          numberOfTodoItems += currentList["cards"].length;
        }
      }
    }

    console.log("Number of Trello tasks: " + numberOfTodoItems);
  });
}

function fetchMostRecentPhotos() {
  const testFolder = "./instagram_posts/";
  const fs = require("fs");

  recentPhotos = [];
  fs.readdir(testFolder, (err, files) => {
    files.forEach((file) => {
      if (file.includes(".jpg")) {
        recentPhotos.push({
          url: "/images/" + file,
          posted: file,
        });
      }
    });
  });
}

function updateFoodData() {
  mfp.fetchSingleDate(
    myFitnessPalUser,
    moment().format("YYYY-MM-DD"),
    ["calories", "protein", "carbs", "fat", "entries"],
    function (data) {
      todaysMacros = {
        kcal: data["calories"],
        carbs: data["carbs"],
        protein: data["protein"],
        fat: data["fat"],
      };

      todaysFoodItems = [];
      for (let rawFoodItemIndex in data["entries"]) {
        let rawFoodItem = data["entries"][rawFoodItemIndex];
        if (
          ![
            "TOTAL:",
            "Exercises",
            "Withings Health Mate  calorie adjustment",
          ].includes(rawFoodItem["name"])
        ) {
          todaysFoodItems.push({
            name: rawFoodItem["name"],
            amount: rawFoodItem["amount"],
          });
        }
      }

      // If it's after midnight, we just want to fetch the food data for the day before
      // TODO: use promises and reduce duplicate code
      if (todaysMacros.kcal == undefined || todaysMacros.kcal == 0) {
        // time zones and stuff, going back to yesterday
        mfp.fetchSingleDate(
          myFitnessPalUser,
          moment().subtract(1, "day").format("YYYY-MM-DD"),
          ["calories", "protein", "carbs", "fat", "entries"],
          function (data) {
            todaysMacros = {
              kcal: data["calories"],
              carbs: data["carbs"],
              protein: data["protein"],
              fat: data["fat"],
            };

            // Same for food items
            if (todaysFoodItems.length == 0) {
              for (var rawFoodItemIndex in data["entries"]) {
                var rawFoodItem = data["entries"][rawFoodItemIndex];
                if (
                  ![
                    "TOTAL:",
                    "Exercises",
                    "Withings Health Mate  calorie adjustment",
                  ].includes(rawFoodItem["name"])
                ) {
                  todaysFoodItems.push({
                    name: rawFoodItem["name"],
                    amount: rawFoodItem["amount"],
                  });
                }
              }
            }
          }
        );
      }
    }
  );
}

function updateCalendar() {
  nextEvents = [];
  let icsUrls = [process.env.ICS_URL, process.env.WORK_ICS_URL];
  for (let index in icsUrls) {
    ical.fromURL(icsUrls[index], {}, function (err, data) {
      console.log("Loaded calendar data");
      for (var k in data) {
        if (data.hasOwnProperty(k)) {
          var ev = data[k];

          // only use calendar invites that within the next 7 days
          if (
            ev["type"] == "VEVENT" &&
            moment(ev["start"]).isBetween(
              new Date(),
              moment(new Date()).add(5, "days")
            ) &&
            moment(ev["end"]).diff(ev["start"], "hours") < 24 // we don't want day/week long events
          ) {
            nextEvents.push({
              rawStart: moment(ev["start"]),
              start: moment(ev["start"]).fromNow(),
              end: moment(ev["end"]).fromNow(),
              duration:
                Math.round(
                  moment(ev["end"]).diff(ev["start"], "hours", true) * 10.0
                ) / 10.0,
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
  return (
    "https://maps.googleapis.com/maps/api/staticmap?center=" +
    currentCityText +
    "&zoom=10&size=1200x190&scale=2&maptype=roadmap" +
    "&key=" +
    googleMapsKey
  );
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
setInterval(fetchMostRecentPhotos, 120 * 60 * 1000);
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
      .format("hh:mm a"), // TODO: actually take the current time zone - nomadlist doens't seem to expose the time zone
    profilePictureUrl: "https://krausefx.com/assets/FelixKrauseCropped.jpg",
    recentPhotos: recentPhotos,
  };
}

app.get("/api.json", function (req, res) {
  if (allDataLoaded()) {
    res.json(getDataDic());
  } else {
    res.json({
      loading: true,
    });
  }
});

// Server the image files
app.get("/images/:filename", function (req, res) {
  let path = "./instagram_posts/" + req.params.filename;
  res.sendFile(path, { root: __dirname });
});

var port = process.env.PORT || 8080;
app.listen(port);
console.log("server live on port " + port);
