const actionList = [
	{ type: 'stand', index: 0, count: 7, frame: 0, tick: 0 },
	{ type: 'up', index: 1, count: 7, frame: 0, tick: 0 },
	{ type: 'down', index: 2, count: 7, frame: 0, tick: 0 },
	{ type: 'run', index: 3, count: 9, frame: 0, tick: 0 },
	{ type: 'damage', index: 4, count: 11, frame: 0, tick: 0 },
	{ type: 'stay', index: 5, count: 5, frame: 0, tick: 0 },
	{ type: 'charge', index: 6, count: 7, frame: 0, tick: 0 },
	{ type: 'attack', index: 7, count: 7, frame: 0, tick: 0 },
	{ type: 'die', index: 8, count: 12, frame: 0, tick: 0 },
	{ type: 'attacked', index: 9, count: 4, frame: 0, tick: 0 },
]

export default class player {
	constructor(game, img) {
		this.game = game
		this.image = img
		this.speed = 1
		this.totalSpriteCount = 12
		this.totalRowCount = 10
		this.spriteWidth = this.image.width / this.totalSpriteCount
		this.spriteHeight = this.image.height / this.totalRowCount
		this.currentAction = null
		this.zoomRate = 0.5
		this.rateWidth = this.spriteWidth * this.zoomRate
		this.rateHeight = this.spriteHeight * this.zoomRate
		this.x = 0
		this.y = this.game.height - this.rateHeight
		this.vy = 0
		this.weight = 1
		this.fpsRate = 1000 / this.game.fps
		this.prevIndex = -1
		this.setAction('stand')
	}
	setAction(type) {
		const action = actionList.find(action => action.type === type)
		if (!action) return
		this.currentAction = action
		this.currentAction.tick = 0
		this.currentAction.frame = 0
	}
	update(ctx) {
		const dist = new Date().getTime() - this.currentAction.tick
		if (this.currentAction.tick == 0 || dist >= this.fpsRate) {
			this.currentAction.tick = new Date().getTime()
			this.currentAction.frame++
			if (this.currentAction.frame >= this.currentAction.count) {
				this.currentAction.frame = 0
			}
		}
		this.updatePostion()
		this.drawPlayer(ctx)
	}
	updatePostion() {
		if (this.game.keys.length == 0) {
			if (this.isFly()) {
				const d = new Date().getTime() - this.game.keyupTick
				const incrValue = 1 + (d / 1000) * 30
				this.vy += this.weight
				this.y += incrValue
				if (!this.isFly()) {
					this.y = this.game.height - this.rateHeight
					this.vy = 0
				}
			}
			return;
		}
		const d = new Date().getTime() - this.game.keydownTick
		const incrValue = Math.min(1 + (d / 1000) * 25, 15)
		let flyCheck = true

		if (this.game.keys.includes('ArrowUp')) {
			this.y -= incrValue
			if (this.y < 0) this.y = 0
			flyCheck = false
		}
		if (this.game.keys.includes('ArrowDown')) {
			this.y += incrValue
			if (!this.isFly()) {
				this.y = this.game.height - this.rateHeight
				this.vy = 0
			}
			flyCheck = false
		}
		if (this.game.keys.includes('ArrowLeft')) {
			this.x -= incrValue
			if (flyCheck && this.isFly()) this.y += this.weight
			else this.game.addParticle('dust', this.x, this.y)
			if (this.x < 0) this.x = 0
		}
		if (this.game.keys.includes("ArrowRight")) {
			this.x += incrValue
			if (this.x > this.game.width - this.rateWidth) this.x = this.game.width - this.rateWidth
			if (flyCheck && this.isFly()) this.y += this.weight
			else this.game.addParticle('dust', this.x, this.y)
		}
		if (flyCheck && this.isFly()) {
			this.vy += this.weight
			this.y += this.vy
			if (!this.isFly()) {
				this.y = this.game.height - this.rateHeight
				this.vy = 0
			}
		}
	}
	isFly() {
		return this.y < this.game.height - this.rateHeight
	}
	drawPlayer(ctx) {
		const { index, frame } = this.currentAction
		const sx = frame * this.spriteWidth
		const sy = index * this.spriteHeight
		if (this.prevIndex != index) {
			this.prevIndex = index
			clog('@@player change', index, sx, sy, this.x, this.y, this.rateWidth, this.rateHeight)
		}
		ctx.drawImage(this.image, sx, sy, this.spriteWidth, this.spriteHeight, this.x, this.y, this.rateWidth, this.rateHeight)
	}
	setZoom(rate) {
		this.zoomRate = rate
		this.rateWidth = this.spriteWidth * this.zoomRate
		this.rateHeight = this.spriteHeight * this.zoomRate
	}
}
