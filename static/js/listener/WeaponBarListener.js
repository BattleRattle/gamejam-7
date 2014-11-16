function WeaponBarListener(weaponBar) {
    this.weaponBar = weaponBar;
}

WeaponBarListener.prototype.registerEvents = function(emitter) {
    emitter.on('unequip', this.onUnequip.bind(this));
    emitter.on('equip', this.onEquip.bind(this));
    emitter.on('weapon-update', this.onWeaponUpdate.bind(this));
};

WeaponBarListener.prototype.onUnequip = function() {
    this.weaponBar.updateWeapon('hands');
};

WeaponBarListener.prototype.onEquip = function(event) {
    this.weaponBar.updateWeapon(event.id, event.lifetime);
};

WeaponBarListener.prototype.onWeaponUpdate = function(event) {
    this.weaponBar.updateRemainingHits(event.lifetime);
};


module.exports = WeaponBarListener;
