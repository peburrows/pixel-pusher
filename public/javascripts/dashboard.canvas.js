if(!PixelPusherClient) { var PixelPusherClient = {}; }
// if(!PixelPusherClient.WebSocket){ var PixelPusherClient.WebSocket = {}; }

PixelPusherClient.CanvasDashboard = function(options){
  this.canvas = $('canvas').get(0);
  this.context = this.canvas.getContext('2d');
  this.state = 'new';
  this.hitCounts = [];
  this.visitCounts = [];
  this.actionGraphs = {};
  this.colors = {
    // quasimodan : '#ffee44',
    quasimodan : '#ffef66',
    bookseller : '#d0d0d0',
    vstdotcom  : '#e0f0f0',
    'default'  : '#f2f2e5'
  };
  var defaults = {
    namespace: '/',
    graphElementCSS: '#graph',
    visibleHits: 200,
    visibleVisits: 200,
    visibleActions: 48
  };
  
  this.options = $.extend(defaults, options);
  // we don't want the first element
};

PixelPusherClient.CanvasDashboard.prototype = {
  webSocketURL: function(){
    this.ns = this.options.namespace.split('/').slice(1);
    var path;
    if(this.ns.length > 1){ path = '/'; }
    else{ path = this.options.namespace; }
    // this will probably have to change at some point
    return "ws://" + document.location.hostname + ":8080" + path;
  },
  
  webSocketSupported: function(){
    if(!("WebSocket" in window)){
      $('body').append("<div><strong>Sorry, it doesn't look like your browser supports WebSockets.</strong></div>");
      return false;
    }
    return true;
  },
  
  // events
  onopen: function(){ this.state = 'opened'; },
  
  onclose: function(){
    if(this.state == 'switching'){ return; }
    
    // if we're not switching, try to reconnect
    var self = this;
    if(self.state == "retrying") {
      // Wait a while to try restarting
      setTimeout(function() { self.start() }, 3000);
    } else {
      // First attempt at restarting, try immediately
      self.state = "retrying";
      console.log("socket lost, retrying immediately");
      setTimeout(function() { self.start() }, 200);
    }
  }
};

PixelPusherClient.CanvasDashboard.prototype.start = function(){
  if(!this.webSocketSupported()){ return; }
  this.graph = $(this.options.graphElementCSS);
  
  var self = this;
  self.socket = new WebSocket(self.webSocketURL());

  self.socket.onopen   = function(){ self.onopen(); }
  self.socket.onclose  = function(){ self.onclose(); }
  
  self.socket.onmessage = function(e){
    var data = JSON.parse(e.data);
    self.interval = data._interval;
    self.handleHits(data.hits);
    self.handleActions(data.actions);
  };
};

PixelPusherClient.CanvasDashboard.prototype.handleHits = function(hits, callback){
  var self = this;
  (function(){
    var count = 0;
    self.shiftCanvas(self.canvas, self.context);
    // first, we don't have to create the containing bar now
    if(!hits || hits.length === 0){
      // don't need to do anything because we already shifted the canvas (essentially, reated a blank line)
    }else{
      var bars = [];
      var filterFeed = self.ns.length > 1;
      for(app in hits){
        // jump to the next one if we don't care about this one
        if(filterFeed && (self.ns.indexOf(app) === -1)){ continue; }
        count += hits[app].length;
        var oneBar = {
          app: app,
          count: hits[app].length,
          color: self.colors[app] || self.colors['default']
        };
        bars.push(oneBar);
        
        // sort those sets
        bars.sort(function(a, b){
          if(a.app > b.app){ return -1; }
          else{ return 1; }
        });

        self.addBarsToGraph(bars, self.canvas, self.context);
      }
    }
    self.updateHitsAverage(count);
    if(callback){ callback(hits); }
  })();
};

PixelPusherClient.CanvasDashboard.prototype.shiftCanvas = function(canvas, context){
  context.putImageData(context.getImageData(6, 0, canvas.width, canvas.height), 0, 0);
};

PixelPusherClient.CanvasDashboard.prototype.addBarsToGraph = function(bars, canvas, context){
  var total = 0,
      self  = this,
      x     = canvas.width - 5,
      width = 5;

  for(var i=0; i<bars.length; i++){ total += bars[i].count; }
  
  var totalHeightAsPercentage = (total * self.options.scale) / canvas.height;
  var totalHeightAsValue      = canvas.height * totalHeightAsPercentage;
  var heightSoFar = 0;

  var y = canvas.height - totalHeightAsValue;
  
  for(var k=0; k<bars.length; k++){
    context.fillStyle = bars[k].color;
    var thisHeight = totalHeightAsValue * (bars[k].count / total);
    context.fillRect(x, y, width, thisHeight);
    // now, update the y value
    y += thisHeight;
  }
};

PixelPusherClient.CanvasDashboard.prototype.updateHitsAverage = function(num, interval){
  if(this.hitCounts.length >= this.options.visibleHits){ this.hitCounts.shift(); }
  
  this.hitCounts.push(num);
  var length = this.hitCounts.length;
  // console.log(num);
  
  if(this.hitsAverage === 0 && num === 0 ){
    $('body #hits_average').html("<strong>Average: 0 requests per second</strong>");
    return;
  }
  
  var total = 0;
  for (var i = length - 1; i >= 0; i--){ total += this.hitCounts[i]; };
  this.hitsAverage = (total / length) * (1000 / this.interval || 1000)
  $('body #hits_average').html("<strong>Average: " + Math.round(this.hitsAverage) + " hits per second</strong>");
  this.context.fillStyle = 'rgb(255,200,150)';

  var height = 2;
  var x = this.canvas.width - 3;
  var width = 2;
  var calculatedAverage = this.hitsAverage * (this.interval / 1000);
  var y = this.canvas.height - (calculatedAverage * this.options.scale);
  this.context.fillRect(x, y, width, height);
};

PixelPusherClient.CanvasDashboard.prototype.switchStreams = function(namespace, callback){
  var self = this;
  (function(){
    self.state = 'switching';
    var currentURL = self.webSocketURL();
    self.options.namespace = namespace;
    // check to see if the URL is gonna change
    if(currentURL != self.webSocketURL()){
      self.socket.close();
      self.start();
    }else{ self.state = 'opened'; }
    if(callback){ callback(); }
  })();
};

PixelPusherClient.CanvasDashboard.prototype.handleVisits = function(visits, callback){
  (function(){
    // nothing to see here
    if(callback){ callback(visits); }
  })();  
};


PixelPusherClient.CanvasDashboard.prototype.actionGraphID = function(app, name){ return app + name; };

PixelPusherClient.CanvasDashboard.prototype.actionGraphSkeleton = function(app, name){
  return '<div id="' + this.actionGraphID(app, name) + '" class="action_graph_wrapper"><h3>' + app + ' : ' + name + '</h3><canvas class="action_graph graph ' + app + name + '" width="288" height="200"></canvas></div>';
  return '<div id="' + this.actionGraphID(app, name) + '" class="action_graph_wrapper"><h3>' + app + ' : ' + name + '</h3><ul class="action_graph graph"></ul></div>';
};

PixelPusherClient.CanvasDashboard.prototype.handleActions = function(actions, callback){
  var self = this;
  (function(){
    // shift the graphs to prepare for drawing
    for(graph in self.actionGraphs){
      self.shiftCanvas(self.actionGraphs[graph].canvas, self.actionGraphs[graph].context)
    }
    if(!actions){
      // don't need to do anything here
    }else{
      for(app in actions){
        for(actionType in actions[app]){
          var count = actions[app][actionType].length;
          if(!self.actionGraphs[actionType] ){
            // create the action graph, kids
            $('#all_action_graphs').append(self.actionGraphSkeleton(app, actionType));
            // var newGraph = $('#' + self.actionGraphSkeleton(app, actionType));
            var newCanvas = $('#' + self.actionGraphID(app, actionType) + ' canvas').get(0);
            var newContext = newCanvas.getContext('2d');
            self.actionGraphs[actionType] = { canvas: newCanvas, context: newContext };
          }
          // now that we have the actionGraph in there, let's add the bars as necessary
          var bars = [{app: app, count: count, color: self.colors[app] || self.colors['default'] }];
          self.addBarsToGraph(bars, self.actionGraphs[actionType].canvas, self.actionGraphs[actionType].context);
          // var cv = $('#' + self.action)
          // self.add
        }
      }
    }
    
    // last, call the callback
    if(callback){ callback(actions); }
  })();
};

// declare dashboard so it can be accessed outside the observer
var dashboard;
$(document).ready(function(e){
  dashboard = new PixelPusherClient.CanvasDashboard({scale: 3});
  dashboard.start();
});