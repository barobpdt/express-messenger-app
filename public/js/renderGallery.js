class RenderGallery {
	constructor(parentEl) {
		this.parentEl = getEl(parentEl)
		this.images = []
		this.galleryContainer = null
		this.fullscreenView = null
		this.currentImageIndex = 0
		this.currentZoom = 1
		this.ZOOM_STEP = 0.2
		this.MAX_ZOOM = 3
		this.MIN_ZOOM = 0.5
	}
	render() {
		const container = $(`
		<div class="gallery-container"></div>
		<div class="fullscreen-view">
			<div class="fullscreen-image-container">
				<img class="fullscreen-image" src="" alt="Fullscreen Image">
			</div>
			<div class="fullscreen-controls">
				<button class="control-button" class="prevButton">◀</button>
				<button class="control-button" class="nextButton">▶</button>
			</div>
			<div class="zoom-controls">
				<button class="zoom-button">+</button>
				<button class="zoom-button">-</button>
				<button class="zoom-button">↺</button>
			</div>
			<button class="close-button">×</button>
			<div class="image-info"></div>
		</div>`).appendTo(this.parentEl)
		this.galleryContainer = container.find('.gallery-container')
		this.fullscreenView = container.find('.fullscreen-view')
	}
	loadArray(urls) {
		urls.forEach(url => {
			this.addImageToGallery(url)
		})
	}
	loadImage(files) {
		const imageFiles = files.filter(file => file.type.startsWith('image/'))
		imageFiles.forEach(file => {
			const reader = new FileReader()
			reader.onload = (e) => {
				const imageUrl = e.target.result
				this.images.push(imageUrl)
				this.addImageToGallery(imageUrl)
			}
			reader.readAsDataURL(file)
		})
	}
	addImageToGallery(imageUrl) {
		const idx = this.images.length
		this.images.push(imageUrl)
		$(`
			<div class="gallery-item">
				<img src="${imageUrl}" alt="Gallery Image">
				<button class="check-button">✓</button>
			</div>
		`).appendTo(this.galleryContainer).on('click', () => {
			this.openFullscreen(idx)
		}).find('.check-button').on('click', (e) => {
			e.stopPropagation()
			this.deleteImage(idx)
		})
	}
	updateImageInfo() {
		this.fullscreenView.find('.image-info').text(`${this.currentImageIndex + 1} / ${this.images.length}`)
	}
	openFullscreen(idx) {
		this.currentImageIndex = idx
		this.fullscreenView.addClass('active')
		this.fullscreenView.find('.fullscreen-image').attr('src', this.images[idx])
		this.resetZoom()
		this.updateImageInfo()
	}
	closeFullscreen() {
		this.fullscreenView.removeClass('active')
	}
	resetZoom() {
		this.currentZoom = 1
		this.updateImageTransform()
	}
	updateImageTransform() {
		this.fullscreenView.find('.fullscreen-image').css('transform', `scale(${this.currentZoom})`)
	}
	zoomIn() {
		if (this.currentZoom < this.MAX_ZOOM) {
			this.currentZoom += this.ZOOM_STEP
			this.updateImageTransform()
		}
	}
	zoomOut() {
		if (this.currentZoom > this.MIN_ZOOM) {
			this.currentZoom -= this.ZOOM_STEP
			this.updateImageTransform()
		}
	}
	showPrevImage() {
		if (this.currentImageIndex > 0) {
			this.currentImageIndex--
			this.openFullscreen(this.currentImageIndex)
		}
	}
	showNextImage() {
		if (this.currentImageIndex < this.images.length - 1) {
			this.currentImageIndex++
			this.openFullscreen(this.currentImageIndex)
		}
	}
}

loadStyle(`
	.gallery-container {
		width: 100%;
		max-width: 1200px;
		margin: 20px auto;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
		gap: 20px;
		padding: 20px;
	}

	.gallery-item {
		position: relative;
		aspect-ratio: 1;
		border-radius: 8px;
		overflow: hidden;
		cursor: pointer;
		box-shadow: 0 2px 8px rgba(0,0,0,0.1);
		transition: transform 0.3s ease;
	}

	.gallery-item:hover {
		transform: translateY(-5px);
	}

	.gallery-item img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	/* 전체화면 보기 스타일 */
	.fullscreen-view {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background: rgba(0,0,0,0.9);
		display: none;
		justify-content: center;
		align-items: center;
		z-index: 1000;
		cursor: pointer;
	}

	.fullscreen-view.active {
		display: flex;
	}

	.fullscreen-image-container {
		position: relative;
		max-width: 90%;
		max-height: 90%;
		transform-origin: center;
		transition: transform 0.3s ease;
	}

	.fullscreen-image {
		max-width: 100%;
		max-height: 90vh;
		object-fit: contain;
	}

	.fullscreen-controls {
		position: absolute;
		bottom: 20px;
		left: 50%;
		transform: translateX(-50%);
		display: flex;
		gap: 20px;
		background: rgba(0,0,0,0.5);
		padding: 10px 20px;
		border-radius: 20px;
	}

	.control-button {
		background: none;
		border: none;
		color: white;
		font-size: 24px;
		cursor: pointer;
		padding: 5px;
		opacity: 0.8;
		transition: opacity 0.3s ease;
	}

	.control-button:hover {
		opacity: 1;
	}

	.close-button {
		position: absolute;
		top: 20px;
		right: 20px;
		background: none;
		border: none;
		color: white;
		font-size: 24px;
		cursor: pointer;
		padding: 10px;
		opacity: 0.8;
		transition: opacity 0.3s ease;
	}

	.close-button:hover {
		opacity: 1;
	}

	.zoom-controls {
		position: absolute;
		right: 20px;
		top: 50%;
		transform: translateY(-50%);
		display: flex;
		flex-direction: column;
		gap: 10px;
		background: rgba(0,0,0,0.5);
		padding: 10px;
		border-radius: 20px;
	}

	.zoom-button {
		background: none;
		border: none;
		color: white;
		font-size: 24px;
		cursor: pointer;
		padding: 5px;
		opacity: 0.8;
		transition: opacity 0.3s ease;
	}

	.zoom-button:hover {
		opacity: 1;
	}

	/* 이미지 정보 표시 */
	.image-info {
		position: absolute;
		bottom: 20px;
		left: 50%;
		transform: translateX(-50%);
		background: rgba(0,0,0,0.5);
		color: white;
		padding: 5px 15px;
		border-radius: 20px;
		font-size: 14px;
		opacity: 0.8;
		transition: opacity 0.3s ease;
	}

	.fullscreen-view:hover .image-info {
		opacity: 1;
	}
	
`)