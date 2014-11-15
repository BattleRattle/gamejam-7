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
    var level = new Level(
        levelId,
        raw_level.darkness,
        raw_level.monsterSpeed,
        raw_level.itemSeed,
        raw_level.terrainSeed,
        raw_level.playerHealth,
        raw_level.monsterHealth,
        raw_level.trees
    );

    return level;
};

module.exports = LevelBuilder;