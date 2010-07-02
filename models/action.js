var SuperModel = require('./supermodel');

// so simple now with inheritance
var Action = SuperModel.defineClass();

Action.collectionName = 'actions';
Action.indexes = [['session_id', 1]];

module.exports = Action;