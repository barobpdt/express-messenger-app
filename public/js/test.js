import gameMain from "./game/gameTest.js";

function initPage() {
	const style = `
		position:absolute;
		width:300px;
		height:200px;
		top:50%;
		left:50%;
		border:1px solid #000;
		transform:translate(-50%,-50%);
	`
	pageInfo.game = new gameMain('app', style);
	console.log('@@game',pageInfo.game)
}

function animate() {
	if(pageInfo.game) {
		pageInfo.game.update()
	} 
	requestAnimationFrame(animate)
}

$(document).ready(function() {
	initPage()
	animate()
});

