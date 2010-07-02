var sys = require('sys'),
    fs = require('fs'),
    Buffer = require('buffer').Buffer,
    url = require('url'),
    ws = require('websocket-server');

var Settings = require('../config/settings'),
    Visit = require('../models/visit'),
    Hit = require('../models/hit');

var ConnectionManager = require('./websocket-connection-manager');
    
var PixelPusher = function(db){
  var pixelData = fs.readFileSync(__dirname + '/../public/blank.gif', 'binary');
  this.pixel = new Buffer(43);
  this.pixel.write(pixelData.toString(), 'binary', 0);
};

PixelPusher.prototype = {
  init: function(db, callback){
    this.db = db;
    this.setupWebSocketServer();
    this.messageRunner = new PixelPusher.MessageRunner(100, this.connectionManager);
    callback();
  },
  
  pushPixel: function(req, res){
    var parsedUrl = url.parse(req.url, true);
    // so we don't get an error if it's not there
    parsedUrl.query = parsedUrl.query || {};
    if(parsedUrl.pathname != '/t.gif'){ this.send404(req, res); }
    else{
      var self = this;
      res.writeHead(200, { 'Content-Type': 'image/gif',
                           'Content-Disposition': 'inline',
                           'Content-Length': '43' });
      res.end(this.pixel);
      sys.log("pushed tracking pixel : " + req.connection.remoteAddress);
      
      Settings.findAppById(parsedUrl.query.aid, function(app){
        if(!app){
          sys.log("could not find that app with " + parsedUrl.query.aid);
        }else{
          self.translateQueryIntoFullValues(parsedUrl.query.v, app.translations.visit, function(trans){
            trans['app'] = app.name;
            Visit.findOrCreateBySessionId(trans.session_id, trans, function(err, v, isNewRecord){
              // the rest of this should really be wrapped in a if(err) block
              if(isNewRecord){
                self.messageRunner.addVisit(v, '/' + app.name, app.name);
                self.messageRunner.addVisit(v, '/', app.name);
              }
              self.translateQueryIntoFullValues(parsedUrl.query.h, app.translations.hit, function(htrans){
                htrans['app'] = app.name;
                v.createHit(htrans, function(err, hit){
                  if(err){ sys.log("there was some error calling Visit.createHit: " + err.message); }
                  else{
                    // send the hit messages to the proper namespace & the root
                    self.messageRunner.addHit(hit, '/' + app.name, app.name);
                    self.messageRunner.addHit(hit, '/', app.name);
                  }
                  if(parsedUrl.query.a){
                    self.translateQueryIntoFullValues(parsedUrl.query.a, app.translations.action, function(atrans){
                      atrans['app'] = app.name;
                      v.createAction(atrans, function(err, action){
                        if(err){ sys.log("there was some error: " + err.message); }
                        else{
                          self.messageRunner.addAction(action, '/' + app.name, app.name);
                          self.messageRunner.addAction(action, '/', app.name);
                        }
                      });
                    });
                  }
                });
              });
            });
          });
        }
      });
    }
  },
  
  send404: function(req, res){
    res.writeHead(404, {});
    res.end('not found');
    sys.log('not found: ' + req.url)
  },
  
  send500: function(req, res, err){
    res.writeHead(500, {});
    res.end("error");
    sys.log('500 error: ' + req.url + '-->');
    sys.log(err.message);
  },
  
  translateQueryIntoFullValues: function(params, translations, callback){
    (function(){
      var translated = {};
      for(key in params){
        if(translations[key]){ translated[translations[key]] = params[key]; }
        else{ translated[key] = params[key]; }
      }
      callback(translated);
    })();
    return this;
  },
  
  broadcastSocketMessage: function(message, ns){
    this.connectionManager.broadcast(JSON.stringify(message), ns);
  },
  
  setupWebSocketServer: function(){
    var self = this;
    self.connectionManager = new ConnectionManager();
    var wsServer = ws.createServer();
    wsServer.listen(8080);
    wsServer.addListener('connection', function(conn){
      self.connectionManager.addConnection(conn);
      sys.log('ws:// connection accepted @ ' + url.parse(conn._req.url).href);
      conn.addListener('close', function(){
        sys.log('ws:// connection was closed: ' + conn._id);
      });
    });
    this.webSocketServer = wsServer;
    sys.log('WebSocket server listening at ws://*:8080');
  }
}

PixelPusher.MessageRunner = function(interval, connMan){
  this.interval = interval || 100;
  this._messages = {};
  this.connectionManager = connMan;
  var self = this;
  setInterval(function(){ self.flush(); }, self.interval);
};

Object.defineProperty(PixelPusher.MessageRunner.prototype, 'messages', {
  get: function(){ return this._messages; }
})

PixelPusher.MessageRunner.prototype.resetMessages = function(){ this._messages = {}; }

PixelPusher.MessageRunner.prototype.onAdd = function(message, ns){};

PixelPusher.MessageRunner.prototype.add = function(message, ns, appName, type){
  this.messages[ns] = this.messages[ns] || {};
  this.messages[ns][type] = this.messages[ns][type] || {};
  this.messages[ns][type][appName] = this.messages[ns][type][appName] || [];
  this.messages[ns][type][appName].push(message);
  this.onAdd(message, ns, appName, type);
};

PixelPusher.MessageRunner.prototype.addHit = function(hit, ns, appName){
  this.add(hit.toHash(), ns, appName, 'hits');
};

PixelPusher.MessageRunner.prototype.addVisit = function(visit, ns, appName){
  this.add(visit.toHash(), ns, appName, 'visits')
};

PixelPusher.MessageRunner.prototype.addAction = function(action, ns, appName){
  // this.add(action.toHash(), ns, appName, 'actions');
  this.messages[ns] = this.messages[ns] || {};
  this.messages[ns]['actions'] = this.messages[ns]['actions'] || {};
  this.messages[ns]['actions'][appName] = this.messages[ns]['actions'][appName] || {};
  this.messages[ns]['actions'][appName][action.name] = this.messages[ns]['actions'][appName][action.name] || [];
  this.messages[ns]['actions'][appName][action.name].push(action);
};

PixelPusher.MessageRunner.prototype.sendKeepAlive = function(namespace, callback){
  var self = this;
  self.connectionManager.broadcast({_interval:self.interval}, namespace, callback);
};

PixelPusher.MessageRunner.prototype.flush = function(){
  // flush the message "buffer"
  var self = this;
  (function(messages){
    // here, we need to broadcast messages to ALL connected client namespaces
    // not just to namespaces when we have messages for them
    var messagedNamespaces = [];
    var hadMessages = false;
    for(namespace in messages){
      hadMessages = true;
      messagedNamespaces.push(namespace);
      var nsMessages = messages[namespace];
      nsMessages._interval = self.interval;
      self.connectionManager.broadcast(nsMessages, namespace);
    }
    if(!hadMessages){ self.sendKeepAlive(); }
    else{
      for (var i = self.connectionManager.connectedNamespaces.length - 1; i >= 0; i--){
        if(messagedNamespaces.indexOf(self.connectionManager.connectedNamespaces[i]) === -1){
          // self.connectionManager.broadcastKeepAlive(self.connectionManager.connectedNamespaces[i]);
          self.sendKeepAlive(self.connectionManager.connectedNamespaces[i]);
        }
      };
    }
    messages = {};
  })(self.messages);
  self.resetMessages();
}

// exports.PixelPusher = PixelPusher;
module.exports = PixelPusher;