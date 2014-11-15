'use strict';

var levelData = require('./levels'),
    Level = require('./Level');

var LevelBuilder = function() {
};

/**
 * @param {Number} levelId
 * @returns {Level}
 */
LevelBuilder.prototype.getLevel = function(levelId) {
    var raw_level = levelData[levelId];
    var level = new Level(levelId, raw_level.darkness, raw_level.monsterSpeed);

    return level;
};

module.exports = LevelBuilder;