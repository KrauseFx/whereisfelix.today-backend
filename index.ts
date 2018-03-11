import * as express from "express";
var needle = require("needle");
var app = express();
app.set("view engine", "ejs");

// Metadata
let nomadlistUser = "krausefx";

// Cache
let currentCityText = "";
let currentLat: Number = null;
let currentLng: Number = null;
let nextCityText: String = null;
let nextCityDate: String = null;

// Refresher methods
function updateNomadListData() {
  let nomadlistUrl = "https://nomadlist.com/@" + nomadlistUser + ".json";

  needle.get(nomadlistUrl, function(error, response, body) {
    if (error) {
      console.log(error);
    } else if (response.statusCode == 200) {
      let parsedNomadListData = JSON.parse(body);
      let now = parsedNomadListData["location"]["now"];
      let next = parsedNomadListData["location"]["next"];

      currentCityText = now["city"] + ", " + now["country"];
      currentLat = now["latitude"];
      currentLng = now["longitude"];

      nextCityText = next["city"] + ", " + next["country"];
      nextCityDate = next["date_start"];

      console.log("Successfully loaded nomadlist data");
    }
  });
}

function allDataLoaded() {
  if (currentCityText == null || nextCityText == null || nextCityDate == null) {
    return false;
  }
  return true;
}

setInterval(updateNomadListData, 60000);
updateNomadListData();

// Web server
app.get("/", function(req, res) {
  // Because we're using the free Heroku tier for now
  // this means the server might just have started up
  // if that's the case, we'll have to wait until all data
  // is fetched
  if (allDataLoaded()) {
    res.render("pages/index", {
      currentCityText: currentCityText,
      nextCityText: nextCityText,
      nextCityDate: nextCityDate
    });
  } else {
    res.render("pages/loading");
  }
});

var port = process.env.PORT || 8080;
app.listen(port);
console.log("server live on port " + port);
