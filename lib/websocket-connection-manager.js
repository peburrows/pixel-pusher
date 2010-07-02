var sys = require('sys'),
    url = require('url');

Array.prototype.remove = function(from, to) {
  var rest = this.slice((to || from) + 1 || this.length);
  this.length = from < 0 ? this.length + from : from;
  return this.push.apply(this, rest);
};

var WebSocketConnectionManager = function(){
  this._pools = [];
  this.connectedNamespaces = [];
};

Object.defineProperty(WebSocketConnectionManager.prototype, 'pools', {
  get: function(){ return this._pools; }
});

WebSocketConnectionManager.prototype.addConnection = function(conn){
  sys.log('adding connection: ' + conn._id);
  var ns = url.parse(conn._req.url).href;
  var self = this;
  self.getPoolByNamespace(ns, function(p){
    if(p){ p.addConnection(conn); }
    else{
      p = new WebSocketConnectionManager.ConnectionPool(ns);
      self.addPool(p);
      p.addConnection(conn);
    }
  });
};

WebSocketConnectionManager.prototype.removeConnection = function(conn){
  sys.log('removing connection: ' + conn._id);
  var ns = url.parse(conn._req.url).href;
  var self = this;
  self.getPoolByNamespace(ns, function(p){
    if(p){
      p.removeConnection(conn);
      self.removePool(p);
    }
  });
};

WebSocketConnectionManager.prototype.addPool = function(p){
  this.connectedNamespaces.push(p.namespace);
  var i = this._pools.push(p);
  return this._pools[i];
};

WebSocketConnectionManager.prototype.removePool = function(p){
  // don't do anything just yet...
  var pi = this._pools.indexOf(p);
  var i = this.connectedNamespaces.indexOf(p.namespace);
  if(pi > -1){ this._pools.remove(pi); }
  if(i > -1){ this.connectedNamespaces.remove(i); }
};

WebSocketConnectionManager.prototype.broadcast = function(mess, ns, callback){
  // yay for tasty async
  var self = this;
  (function(){
    if(ns){
      self.getPoolByNamespace(ns, function(p){
        if(p){ p.broadcast(mess); }
        else{ /* apparently, there aren't any connections listening for that namespace */ }
      });
    }else{
      self.pools.forEach(function(pool){
        pool.broadcast(mess);
      });
    }
    // we allow for a callback
    if(callback){ callback(); }
  })();
};

// WebSocketConnectionManager.prototype.broadcastKeepAlive = function(ns, callback){
//   var self = this;
//   (function(){
//     if(ns){
//       self.getPoolByNamespace(ns, function(pool){
//         if(pool){ pool.broadcast({_interval:100}); }
//       });
//     }else{
//       self.pools.forEach(function(pool){
//         pool.broadcast({_interval:100});
//       });
//     }
//     if(callback){ callback(); }
//   })();
// };

WebSocketConnectionManager.prototype.getPoolByNamespace = function(ns, callback){
  var self = this;
  (function(){
    var pool = null;
    for (var i = self.pools.length - 1; i >= 0; i--){
      if(self.pools[i].namespace == ns){ pool = self.pools[i]; break; }
    };
    callback(pool, true);
  })();
};

WebSocketConnectionManager.ConnectionPool = function(ns){
  this.namespace = ns;
  this._connections = [];
};

Object.defineProperty(WebSocketConnectionManager.ConnectionPool.prototype, 'connections', {
  get: function(){ return this._connections; }
});

WebSocketConnectionManager.ConnectionPool.prototype.addConnection = function(conn){
  var self = this;
  self.connections.push(conn);
  conn.addListener('close', function(){
    self.removeConnection(conn);
  });
};

WebSocketConnectionManager.ConnectionPool.prototype.removeConnection = function(conn){
  var self = this;
  var index = null;
  
  for (var i = self.connections.length - 1; i >= 0; i--){
    if(self.connections[i]._id === conn._id){
      index = i; break;
    }
  };
  
  if(index != null){ self.connections.remove(index) }
};

WebSocketConnectionManager.ConnectionPool.prototype.broadcast = function(message){
  this.connections.forEach(function(conn){
    if(conn._state === 4){ conn.write(JSON.stringify(message)); }
  });
};

module.exports = WebSocketConnectionManager;