export default class player {
	constructor(game, img) {
		this.game = game
		this.image = img
	}
	update(ctx) {
		ctx.drawImage(this.image, 0, 0)
	}
}
 