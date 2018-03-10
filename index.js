"use strict";
exports.__esModule = true;
var express = require("express");
var needle = require("needle");
var app = express();
app.set("view engine", "ejs");
// Metadata
var nomadlistUser = "krausefx";
// Cache
var currentCityText = "";
var currentLat = 0.0;
var currentLng = 0.0;
var nextCityText = "";
var nextCityDate = "";
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
        }
    });
}
setInterval(updateNomadListData, 60000);
updateNomadListData();
// Web server
app.get("/", function (req, res) {
    res.render("pages/index", {
        currentCityText: currentCityText,
        nextCityText: nextCityText,
        nextCityDate: nextCityDate
    });
});
var port = process.env.PORT || 8080;
app.listen(port);
console.log("server live on port " + port);
