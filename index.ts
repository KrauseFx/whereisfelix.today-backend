import * as express from "express";
var needle = require("needle");
var app = express();
app.set("view engine", "ejs");

// Metadata
let nomadlistUser = "krausefx";

// Cache
let currentCityText = "";
let currentLat = 0.0;
let currentLng = 0.0;
let nextCityText = "";
let nextCityDate = "";

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
    }
  });
}
setInterval(updateNomadListData, 60000);
updateNomadListData();

// Web server
app.get("/", function(req, res) {
  res.render("pages/index", {
    currentCityText: currentCityText,
    nextCityText: nextCityText,
    nextCityDate: nextCityDate
  });
});

var port = 8080;
app.listen(port);
console.log("server live on port " + port);
