var sys = require('sys'),
    http = require('http');

var mongo = require('./lib/deps/mongodb-native/lib/mongodb/index');

var Visit     = require('./models/visit'),
    Hit       = require('./models/hit'),
    Action    = require('./models/action'),
    Settings  = require('./config/settings');


var PixelPusher = require('./lib/pixelpusher');

var db = new mongo.Db(Settings.database.name, new mongo.Server(Settings.database.host, Settings.database.port, {auto_reconnect: true}), {});
db.addListener('error', function(err){ sys.puts("!! Error connecting to mongo; make sure it's running !!"); });

db.open(function(pdb){
  var pixelpusher = new PixelPusher();
  // db should eventually be configured at the SuperModel level;
  Visit.configure({database: db}, function(err){
    Hit.configure({database: db}, function(err){
      Action.configure({database: db}, function(err){
        pixelpusher.init(db, function(){
          http.createServer(function(req, res){
            try{ pixelpusher.pushPixel(req, res); }
            catch(e){
              pixelpusher.send500(req, res, e);
            }
          }).listen(4000);
          sys.log('the tracking server is listening @ http://*:4000');
        });
      });
    });
  });
});