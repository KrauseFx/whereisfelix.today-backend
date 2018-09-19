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
let moodHostUrl = "https://krausefx-mood.herokuapp.com/";
let facebookId = "100000723486971";
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
  text: String;
  url: String;
  link: String;
  posted: Date;
}

interface Food {
  kcal: Number;
  carbs: Number;
  protein: Number;
  fat: Number;
}

// Cache
let currentCityText: String = null;
let currentLat: Number = null;
let currentLng: Number = null;
let nextCityText: String = null;
let nextCityDate: String = null;
let nextStays: Array<Stay> = [];
let currentMoodLevel: String = null;
let currentMoodEmoji: String = null;
let currentMoodRelativeTime: String = null;
let nextEvents: Array<any> = [];
let nextConferences: Array<Conference> = [];
let recentPhotos: Array<Photo> = null;
let isMoving: Boolean;
let lastCommitMessage: String;
let lastCommitRepo: String;
let lastCommitLink: String;
let lastCommitTimestamp: Date;
let todaysFood: Food;

// Refresher methods
function updateNomadListData() {
  nextStays = [];
  let nomadlistUrl = "https://nomadlist.com/@" + nomadlistUser + ".json";

  needle.get(nomadlistUrl, function(error, response, body) {
    if (error) {
      console.log(error);
    } else if (response.statusCode == 200) {
      let parsedNomadListData = JSON.parse(body);
      let now = parsedNomadListData["location"]["now"];
      let next = parsedNomadListData["location"]["next"];

      if (now["date_start"] == moment().format("YYYY-MM-DD")) {
        // Today I'm switching cities, let's show a "moving" status on the website
        let previous = parsedNomadListData["location"]["previously"];
        currentCityText = "✈️ " + now["city"];
        isMoving = true;
      } else {
        currentCityText = now["city"] + ", " + now["country_code"];
        isMoving = false;
      }

      currentLat = now["latitude"];
      currentLng = now["longitude"];
      nextCityText = next["city"];
      nextCityDate = moment(next["date_start"]).fromNow();

      for (let index in parsedNomadListData["trips"]) {
        let currentStay = parsedNomadListData["trips"][index];
        if (currentStay["epoch_start"] > new Date().getTime() / 1000) {
          nextStays.unshift({
            name: currentStay["place"] + ", " + currentStay["country"],
            from: moment(currentStay["epoch_start"] * 1000).fromNow(),
            fromDate: moment(currentStay["epoch_start"] * 1000),
            for: currentStay["length"],
            toDate: moment(currentStay["epoch_end"] * 1000)
          });
        }
      }
      console.log("Successfully loaded nomadlist data");
    }
  });
}
function updateMood() {
  let moodUrl = moodHostUrl + "current_mood.json";
  needle.get(moodUrl, function(error, response, body) {
    if (error) {
      console.log(error);
    } else if (response.statusCode == 200) {
      let parsedBody = JSON.parse(body);
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
      currentMoodRelativeTime = moment(new Date(parsedBody["time"])).fromNow();
    }
  });
}

function updateCommitMessage() {
  let githubURL = "https://api.github.com/users/" + githubUser + "/events";
  needle.get(githubURL, function(error, response, body) {
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

function fetchMostRecentPhotos() {
  let instagramUrl =
    "https://api.instagram.com/v1/users/self/media/recent?access_token=" +
    process.env.INSTAGRAM_ACCESS_TOKEN;
  needle.get(instagramUrl, function(error, response, body) {
    if (response.statusCode == 200) {
      recentPhotos = [];
      let mostRecentData = body["data"];
      for (var i in mostRecentData) {
        let currentPhoto = mostRecentData[i];

        let caption: String = null;
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
    } else {
      console.log(error);
      console.log(response);
    }
  });
}

function updateFoodData() {
  mfp.fetchSingleDate(
    myFitnessPalUser,
    moment().format("YYYY-MM-DD"),
    ["calories", "protein", "carbs", "fat"],
    function(data) {
      todaysFood = {
        kcal: data["calories"],
        carbs: data["carbs"],
        protein: data["protein"],
        fat: data["fat"]
      };
      // TODO: use promises and reduce duplicate code

      if (todaysFood.kcal == undefined || todaysFood.kcal == 0) {
        // time zones and stuff, going back to yesterday
        mfp.fetchSingleDate(
          myFitnessPalUser,
          moment()
            .subtract(1, "day")
            .format("YYYY-MM-DD"),
          ["calories", "protein", "carbs", "fat"],
          function(data) {
            todaysFood = {
              kcal: data["calories"],
              carbs: data["carbs"],
              protein: data["protein"],
              fat: data["fat"]
            };
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
    ical.fromURL(icsUrls[index], {}, function(err, data) {
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
                ) / 10.0
            });
          }
        }
      }
      nextEvents.sort(function(a, b) {
        return a["rawStart"] - b["rawStart"];
      });
    });
  }
}

function updateConferences() {
  // TODO: fetch them from https://github.com/KrauseFx/speaking
  nextConferences = [
    {
      location: "Belgrade, Serbia",
      dates: "19th Oct",
      name: "heapcon",
      link: "https://heapcon.io/"
    },
    {
      location: "Oslo, Norway",
      dates: "01 - 02 Nov",
      name: "Mobile Era",
      link: "https://mobileera.rocks/"
    },
    {
      location: "To be announced",
      dates: "November",
      name: "To be announced",
      link: "#"
    }
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
  if (currentCityText == null || nextCityText == null || nextCityDate == null) {
    return false;
  }
  if (nextStays.length == 0) {
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
setInterval(updateCalendar, 15 * 60 * 1000);
setInterval(updateCommitMessage, 5 * 60 * 1000);
setInterval(updateFoodData, 15 * 60 * 1000);

fetchMostRecentPhotos();
updateNomadListData();
updateMood();
updateCalendar();
updateConferences();
updateCommitMessage();
updateFoodData();

function getDataDic() {
  return {
    currentCityText: currentCityText,
    nextCityText: nextCityText,
    nextCityDate: nextCityDate,
    currentMoodLevel: currentMoodLevel,
    currentMoodEmoji: currentMoodEmoji,
    currentMoodRelativeTime: currentMoodRelativeTime,
    nextConferences: nextConferences,
    nextEvents: nextEvents,
    nextStays: nextStays,
    isMoving: isMoving,
    lastCommitMessage: lastCommitMessage,
    lastCommitRepo: lastCommitRepo,
    lastCommitLink: lastCommitLink,
    lastCommitTimestamp: lastCommitTimestamp,
    todaysFood: todaysFood,
    mapsUrl: generateMapsUrl(),
    localTime: moment()
      .subtract(7, "hours") // 4 = NYC, 7 = SF
      .format("hh:mm a"), // TODO: actually take the current time zone - nomadlist doens't seem to expose the time zone
    profilePictureUrl:
      "https://graph.facebook.com/" + facebookId + "/picture?type=large",
    recentPhotos: recentPhotos
  };
}

app.get("/api.json", function(req, res) {
  if (allDataLoaded()) {
    res.json(getDataDic());
  } else {
    res.json({
      loading: true
    });
  }
});

var port = process.env.PORT || 8080;
app.listen(port);
console.log("server live on port " + port);
