var constants = require('../GameConsts'),
	iconHand = '☃',
	iconSword = '⚔';

function WeaponBar() {
	this.element = new createjs.Container();
	this.element.x = 10;
	this.element.y = constants.GAME_HEIGHT - 60;

	this.icon = iconHand;

	this.remainingHitsText = new createjs.Text(iconHand + " 0", "25px Komika", '#fff');
	this.remainingHitsText.x = 50;
	this.remainingHitsText.y = 0;
	this.element.addChild(this.remainingHitsText);
}

WeaponBar.prototype.updateWeapon = function(weapon, remaining) {
	switch (weapon) {
		case 'short-weapon':
			this.icon = iconSword;
			break;

		default:
			this.icon = iconHand;
			break;
	}

	this.updateRemainingHits(remaining);
};

WeaponBar.prototype.updateRemainingHits = function(remaining) {
	this.remainingHitsText.text = this.icon + ' ' + parseInt(remaining);
};

module.exports = WeaponBar;