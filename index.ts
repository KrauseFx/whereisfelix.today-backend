import * as express from "express";
var app = express();

app.get("/", function(req, res) {
  res.send("Hello World");
});

var port = 8080;
app.listen(port);
console.log("server live on port " + port);
