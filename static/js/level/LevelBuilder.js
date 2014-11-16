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
    var raw_level = levelData[levelId - 1];
    var level = new Level(
        raw_level.level,
        raw_level.darkness,
        raw_level.monsterSpeed,
        raw_level.itemSeed,
        raw_level.terrainSeed,
        raw_level.playerHealth,
        raw_level.monsterHealth,
        raw_level.trees,
        raw_level.growlCooldown,
        raw_level.itemCooldown,
        raw_level.itemSwordAmount,
        raw_level.itemSwordLifetime,
        raw_level.comboInterval,
        raw_level.maxFunValue,
        raw_level.funTime
    );

    return level;
};

module.exports = LevelBuilder;