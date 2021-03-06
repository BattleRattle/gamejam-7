function MarioIsInAnotherCastleScreen() {
    this.element = new createjs.Container();
}

MarioIsInAnotherCastleScreen.prototype.start = function() {
    var textBox = new createjs.Container();
    var headline = new createjs.Text("Thank You, little girl!", "56px Silkscreen", "#ff7700");
    textBox.addChild(headline);

    var info = new createjs.Text("But Mario is in another Castle!", "32px Silkscreen", "#ff7700");
    info.y = 100;
    textBox.addChild(info);

    var action = new createjs.Text("Click to try the next Castle!", "32px Silkscreen", "#ff7700");
    action.y = 300;
    textBox.addChild(action);

    var b = textBox.getBounds();
    textBox.x = 100;
    textBox.y = 200;
    this.element.addChild(textBox);

	createjs.Sound.play('victory');
};

MarioIsInAnotherCastleScreen.prototype.reset = function() {
    this.element.removeAllChildren();
};

module.exports = MarioIsInAnotherCastleScreen;
