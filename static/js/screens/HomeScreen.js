function HomeScreen() {
    this.element = new createjs.Container();
}

HomeScreen.prototype.start = function() {
    var textBox = new createjs.Container();
	textBox.y = 50;
	textBox.x = 100;


    var headline = new createjs.Text("Welcome to", "100px Silkscreen", "#ff7700");
    textBox.addChild(headline);

    //var to = new createjs.Text("to", "50px Silkscreen", "#ff7700");
    //to.y = 125;
    //to.x = 150;
    //textBox.addChild(to);

    var gameName = new createjs.Text("Funster!", "100px Silkscreen", "#f0f");
    gameName.y = 200;
    textBox.addChild(gameName);

    this.loading = new createjs.Text("Loading ...", "75px Silkscreen", "#ff7700");
    this.loading.y = 450;
    this.loading.x = 100;
    this.element.addChild(this.loading);

	var credits = new createjs.Text("Credits: Daniel, Florian, Matthias, Norman, Stephan", "24px Silkscreen", "#888");
	credits.y = 620;
	textBox.addChild(credits);

    this.element.addChild(textBox);
};

HomeScreen.prototype.isReady = function() {
    this.element.removeChild(this.loading);

    this.loading = new createjs.Text("Click to Start Game!", "66px Silkscreen", "#ff7700");
    this.loading.y = 450;
    this.loading.x = 100;

    this.element.addChild(this.loading);
};

HomeScreen.prototype.reset = function() {
    this.element.removeAllChildren();
};

module.exports = HomeScreen;
