if(!PixelPusherClient) { var PixelPusherClient = {}; }
// if(!PixelPusherClient.WebSocket){ var PixelPusherClient.WebSocket = {}; }

PixelPusherClient.Dashboard = function(options){
  this.state = 'new';
  this.hitCounts = [];
  this.visitCounts = [];
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

PixelPusherClient.Dashboard.prototype = {
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

PixelPusherClient.Dashboard.prototype.start = function(){
  if(!this.webSocketSupported()){ return; }
  this.graph = $(this.options.graphElementCSS);
  
  var self = this;
  self.socket = new WebSocket(self.webSocketURL());

  self.socket.onopen   = function(){ self.onopen(); }
  self.socket.onclose  = function(){ self.onclose(); }
  
  self.socket.onmessage = function(e){
    var data = JSON.parse(e.data);
    self.interval = data._interval;
    self.handleHits(data.hits, function(){ self.removeOldHits(self.options.visibleHits); });
    self.handleVisits(data.visits, function(){ self.removeOldVisits(self.options.visibleVisits); });
    // no callback just yet for handleActions
    
    // console.log(data);
    self.handleActions(data.actions, function(){ self.removeOldActions(self.options.visibleActions); });
  };
};

PixelPusherClient.Dashboard.prototype.handleHits = function(hits, callback){
  // node has gotten me in a sentimentally asyc mode
  var self = this;
  (function(){
    var count = 0,
        bar = '';
    // should this be async?
    if(!hits || hits.length === 0){ bar += '<li class="empty"></li>'; }
    else{
      var innerSets = [];
      var filterFeed = self.ns.length > 1;
      for(app in hits){
        if(filterFeed){
          if(self.ns.indexOf(app) === -1){ continue; }
        }
        count += hits[app].length;
        var objToAdd = {
          app:  app,
          open: '<span style="background-color: ' + (self.colors[app] || self.colors['default']) + '; height: ',
          close: ('%;">' + app + ': ' + hits[app].length + '</span>\n'),
          count: hits[app].length
        };        

        innerSets.push(objToAdd);
      }
      
      // sort 'em
      innerSets.sort(function(a, b){
        if(a.app > b.app){ return -1; }
        else{ return 1; }
      });
      
      bar += '<li class="full"><span style="height: ' + (count * self.options.scale) + '%;">total: ' + count + '\n';
      for(var i=0; i<innerSets.length; i++){
        bar += innerSets[i].open;
        bar += Math.ceil((innerSets[i].count / count) * 100);
        bar += innerSets[i].close;
      }
      bar += '</span></li>';
    }
    self.graph.prepend(bar);
    self.updateHitsAverage(count);
    if(callback){ callback(hits); }
  })();
};

PixelPusherClient.Dashboard.prototype.updateHitsAverage = function(num, interval){
  if(this.hitCounts.length >= this.options.visibleHits){ this.hitCounts.shift(); }
  
  this.hitCounts.push(num);
  var length = this.hitCounts.length;
  
  if(this.hitsAverage === 0 && num === 0 ){
    $('body #hits_average').html("<strong>Average: 0 hits per second</strong>");
    return;
  }
  
  var total = 0;
  for (var i = length - 1; i >= 0; i--){ total += this.hitCounts[i]; };
  this.hitsAverage = (total / length) * (1000 / (this.interval || 1000));
  $('body #hits_average').html("<strong>Average: " + Math.round(this.hitsAverage) + " hits per second</strong>");
};

PixelPusherClient.Dashboard.prototype.switchStreams = function(namespace, callback){
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

PixelPusherClient.Dashboard.prototype.removeOldHits = function(num, callback){
  var self = this;
  (function(){
    self.graph.children().slice(num).remove();
    if(callback){ callback(); }
  })();
};

PixelPusherClient.Dashboard.prototype.removeOldVisits = function(num, callback){
  (function(){
    // nothing to see here
    if(callback){ callback(); }
  });
};

PixelPusherClient.Dashboard.prototype.removeOldActions = function(num, callback){
  var self = this;
  (function(){
    $('.action_graph').each(function(){
      $(this).children().slice(num).remove();
    });
    if(callback){ callback(); }
  })();
};

PixelPusherClient.Dashboard.prototype.handleVisits = function(visits, callback){
  (function(){
    // nothing to see here
    if(callback){ callback(visits); }
  })();  
};


PixelPusherClient.Dashboard.prototype.actionGraphID = function(app, name){ return app + name; };

PixelPusherClient.Dashboard.prototype.actionGraphSkeleton = function(app, name){
  return '<div id="' + this.actionGraphID(app, name) + '" class="action_graph_wrapper"><h3>' + app + ' : ' + name + '</h3><ul class="action_graph graph"></ul></div>';
};

PixelPusherClient.Dashboard.prototype.handleActions = function(actions, callback){
  var self = this;
  (function(){
    // if there are no actions to report, just append an empty bar
    if(!actions){ $('.action_graph').prepend('<li class="empty"></li>'); return; }

    var foundActionGraphs = [];
    // otherwise, do some magic
    for(app in actions){
      // console.log(app);
      for(actionType in actions[app]){
        var count = actions[app][actionType].length;
        var id = self.actionGraphID(app, actionType);
        // first, make sure the graph wrapper is there
        if(!$('#' + id).length){ $('#all_action_graphs').append(self.actionGraphSkeleton(app, actionType)); }
        
        // then, append the bar to the graph
        var row = '<li class="full wrapper"><span style="background: ' + (self.colors[app] || self.colors['default']) + '; height:' + (count * self.options.scale) + '%;">' + count + '</span></li>';
        $('#' + id + ' ul.action_graph').prepend(row);
      }
    }
    
    if(callback){ callback(actions); }
  })();
};

// declare dashboard so it can be accessed outside the observer
var dashboard;
$(document).ready(function(e){
  dashboard = new PixelPusherClient.Dashboard({scale: 3});
  dashboard.start();
});