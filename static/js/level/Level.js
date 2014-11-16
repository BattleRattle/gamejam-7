'use strict';

var Level = function(levelId, darkness, monsterSpeed, itemSeed, terrainSeed, playerHealth, monsterHealth, trees, growlCooldown, itemCooldown, itemSwordAmount, itemSwordLifetime, comboInterval, maxFunValue, funTime) {
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
    this.comboInterval = comboInterval;
    this.maxFunValue = maxFunValue;
    this.funTime = funTime;
};

module.exports = Level;