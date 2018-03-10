"use strict";
exports.__esModule = true;
var express = require("express");
var app = express();
app.get("/", function (req, res) {
    res.send("Hello World");
});
var port = 8080;
app.listen(port);
console.log("server live on port " + port);
