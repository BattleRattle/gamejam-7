var View = require('../views/View'),
    Player = require('../Player'),
    Monster = require('../Monster'),
    FunBar = require('../hud/FunBar'),
    HealthBar = require('../hud/HealthBar'),
    LevelBar = require('../hud/LevelBar'),
    WeaponBar = require('../hud/WeaponBar'),
    CheaterBar = require('../hud/CheaterBar'),
    ComboListener = require('../listener/ComboListener'),
    CollisionListener = require('../listener/CollisionListener'),
    AttackListener = require('../listener/AttackListener'),
    SoundListener = require('../listener/SoundListener'),
    GrowlListener = require('../listener/GrowlListener'),
    LevelUpListener = require('../listener/LevelUpListener'),
    ItemListener = require('../listener/ItemListener'),
    CheatListener = require('../listener/CheatListener'),
    GrowlHandler = require('../weapons/GrowlHandler'),
    ItemHandler = require('../weapons/ItemHandler'),
    Ground = require('../ground/Ground'),
    RainbowRoad = require('../ground/RainbowRoad'),
    RainbowRoadListener = require('../listener/RainbowRoadListener'),
    WeaponBarListener = require('../listener/WeaponBarListener'),
    NightOverlay = require('../nightOverlay/NightOverlay'),
    GameConsts = require('../GameConsts');

function GameScreen(stage) {
    this.element = new createjs.Container();
    this.gameView = new View();
    this.hudView = new View();
    this.growlHandler = new GrowlHandler();
    this.itemHandler = new ItemHandler();
    this.element = new createjs.Container();

    this.listeners = [];

    this.stage = stage;
	this.backgroundMusic = null;
}

GameScreen.prototype.registerEvent = function(emitter) {
    this.emitter = emitter;
};

GameScreen.prototype.start = function() {
    this.element.addChild(this.gameView.element);
    this.element.addChild(this.hudView.element);
    this.gameView.addChild(this.growlHandler);
    this.gameView.addChild(this.itemHandler);

    var funBar = new FunBar();
    this.hudView.addChild(funBar);
    this.hudView.addChild(new CheaterBar());

	var rainbowRoad = new RainbowRoad();
	this.gameView.addChild(rainbowRoad);

    this.player = new Player(200, 200);
    this.growlHandler.setTarget(this.player);
    this.itemHandler.setTarget(this.player);
    this.gameView.addChild(this.player);
    this.gameView.attach(this.player);

    var monster = new Monster(700, 300, this.player);
    this.gameView.addChild(monster);

    var healthBar1 = new HealthBar(true, this.player);
    this.hudView.addChild(healthBar1);

    var healthBar2 = new HealthBar(false, monster);
    this.hudView.addChild(healthBar2);

	var weaponBar = new WeaponBar();
	this.hudView.addChild(weaponBar);

    var levelBar = new LevelBar();
    this.hudView.addChild(levelBar);

    var ground = new Ground();
    this.gameView.addChildAt(ground, 0);

    if (GameConsts.NIGHT_MODE) {
        var nightOverlay = new NightOverlay(this.player);
        this.hudView.addChildAt(nightOverlay, 0);
    }

    var comboListener = new ComboListener();
    comboListener.registerEvents(this.emitter);
    this.listeners.push(comboListener);
    var collisionListener = new CollisionListener(this.player, monster, 'hit');
    collisionListener.registerEvents(this.emitter);
    this.listeners.push(collisionListener);
    var attackListener = new AttackListener(this.stage, this.player);
    attackListener.registerEvents(this.emitter);
    this.listeners.push(attackListener);
	var soundListener = new SoundListener();
	soundListener.registerEvent(this.emitter);
	this.listeners.push(soundListener);
    var growlListener = new GrowlListener(this.growlHandler);
    growlListener.registerEvents(this.emitter);
    this.listeners.push(growlListener);
    var levelUpListener = new LevelUpListener();
    levelUpListener.registerEvents(this.emitter);
    this.listeners.push(levelUpListener);
    var itemListener = new ItemListener(this.itemHandler);
    itemListener.registerEvents(this.emitter);
    this.listeners.push(itemListener);
    var rainbowRoadListener = new RainbowRoadListener(rainbowRoad);
    rainbowRoadListener.registerEvents(this.emitter);
    this.listeners.push(rainbowRoadListener);
    var weaponBarListener = new WeaponBarListener(weaponBar);
    weaponBarListener.registerEvents(this.emitter);
    this.listeners.push(weaponBarListener);
    var cheatListener = new CheatListener();
    cheatListener.registerEvents(this.emitter);
    this.listeners.push(cheatListener);

    this.gameView.registerEvents(this.emitter);
    this.hudView.registerEvents(this.emitter);

    if (!this.backgroundMusic) {
		this.backgroundMusic = createjs.Sound.play('background', {loops: -1, volume: 0.2});
	} else {
		this.backgroundMusic.resume();
	}
};

GameScreen.prototype.reset = function() {
    this.hudView.reset();
    this.gameView.reset();
    this.growlHandler.reset();
    this.itemHandler.reset();
    this.element.removeAllChildren();
    this.listeners = [];
	this.backgroundMusic.pause();
};

GameScreen.prototype.tick = function(event) {
    this.gameView.tick(event);
    this.hudView.tick(event);

    for (var i = 0; i < this.listeners.length; i++) {
        if (typeof this.listeners[i]['tick'] == 'function') {
            this.listeners[i].tick(event);
        }
    }
};

module.exports = GameScreen;
