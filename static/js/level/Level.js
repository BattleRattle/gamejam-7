'use strict';

var Level = function(levelId, darkness, monsterSpeed, itemSeed, terrainSeed, playerHealth, monsterHealth, trees) {
    this.levelId = levelId;
    this.darkness = darkness;
    this.monsterSpeed = monsterSpeed;
    this.darkness = darkness;
    this.itemSeed = itemSeed;
    this.terrainSeed = terrainSeed;
    this.playerHealth = playerHealth;
    this.monsterHealth = monsterHealth;
    this.trees = trees;
};

module.exports = Level;