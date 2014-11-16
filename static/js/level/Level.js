'use strict';

var Level = function(levelId, darkness, monsterSpeed, itemSeed, terrainSeed, playerHealth, monsterHealth, trees, growlCooldown, itemCooldown, itemSwordAmount, itemSwordLifetime) {
    this.levelId = levelId;
    this.darkness = darkness;
    this.monsterSpeed = monsterSpeed;
    this.darkness = darkness;
    this.itemSeed = itemSeed;
    this.terrainSeed = terrainSeed;
    this.playerHealth = playerHealth;
    this.monsterHealth = monsterHealth;
    this.trees = trees;
    this.growlCooldown = growlCooldown;
    this.itemCooldown = itemCooldown;
    this.itemSwordAmount = itemSwordAmount;
    this.itemSwordLifetime = itemSwordLifetime;
};

module.exports = Level;