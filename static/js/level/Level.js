'use strict';

var Level = function(levelId, darkness, monsterSpeed, itemSeed, terrainSeed, playerHealth, monsterHealth) {
    this.levelId = levelId;
    this.darkness = darkness;
    this.monsterSpeed = monsterSpeed;
    this.darkness = darkness;
    this.itemSeed = itemSeed;
    this.terrainSeed = terrainSeed;
    this.playerHealth = playerHealth;
    this.monsterHealth = monsterHealth;
};

module.exports = Level;