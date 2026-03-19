import player from './player.js'
const imgPlayer=new Image()
imgPlayer.src='./images/sprite/player.png'

export default class gameMain {
	constructor(el, style) {
		this.player = new player(this, imgPlayer)
		this.canvas = $('<canvas style="' + style + '"/>').appendTo(getJq(el))
		this.ctx = this.canvas[0].getContext('2d')
		this.width = this.canvas.width()
		this.height = this.canvas.height()
		clog('@@gameMain', this)
	}
	update() {
		this.ctx.clearRect(0, 0, this.width, this.height)
		this.player.update(this.ctx)
	}
}

