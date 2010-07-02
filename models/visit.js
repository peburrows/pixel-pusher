var sys = require('sys');

var Hit = require('./hit'),
    Action = require('./action'),
    SuperModel = require('./supermodel');

var Visit = SuperModel.defineClass();
Visit.collectionName = 'visits';
Visit.indexes = [['session_id', 1]];


Visit.findBySessionId = function(id, callback){
  var self = this;
  this.getCollection(function(err, collection){
    if(err){ callback(err); }
    else{
      collection.findOne({session_id: id}, function(err, result){
        if(err){ sys.log("there was an error finding the session by session_id: "); callback(err); }
        else{
          if(result){ callback(null, new self(result)); }
          else{ callback(null, null); }
        }
      });
    }
  });
};

Visit.findOrCreateBySessionId = function(sid, attrs, callback){
  var self = this;
  Visit.findBySessionId(sid, function(err, visit){
    if(err){ callback(err); }
    else if(visit){
      // we should probably only update if something has changed. OR, rather, only update the changed attrs.
      visit.update(attrs, function(err, updated){
        // sys.log("updated the visit with session_id: " + updated.session_id);
        callback(err, updated, false);
      });
    }else{
      Visit.create(attrs, function(err, newVisit){
        // sys.log("created a new visit with session_id: " + newVisit.session_id);
        callback(err, newVisit, true);
      });
    }
  });
};

Visit.prototype.createHit = function(options, callback){
  var self = this;
  var h = new Hit(options);
  h.session_id = self.session_id;
  h.save(function(err, hit){
    if(err){ sys.log("there was an error: " + err.message); callback(err); }
    else{
      // sys.log('created a new hit with url: ' + hit.url);
      callback(err, hit);
    }
  });
};

Visit.prototype.hits = function(callback){
  var self = this;
  Hit.find({'session_id':self.session_id}, function(err, results){
    callback(err, results);
  });
};

Visit.prototype.actions = function(callback){
  var self = this;
  Action.find({'session_id':self.session_id}, function(err, results){
    callback(err, results);
  })
};

Visit.prototype.createAction = function(options, callback){
  var self = this;
  var a = new Action(options);
  a.session_id = self.session_id;
  a.save(function(err, action){
    if(err){ sys.log('there was an error creating the action: ' + err.message); callback(err); }
    else{
      // sys.log('created a new action with name: ' + action.name);
      callback(err, action);
    }
  });
};

module.exports = Visit;