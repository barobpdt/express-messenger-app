// ===================================
// MENU DATA
// ===================================
const menuData = {
	drinks: [
		{
			id: 1,
			name: '아이스 카라멜 라떼',
			nameEn: 'Iced Caramel Latte',
			description: '부드러운 에스프레소와 달콤한 카라멜이 어우러진 시그니처 음료입니다. 휘핑크림 토핑으로 더욱 풍부한 맛을 즐기세요.',
			price: 6500,
			image: 'images/coffee_drink_1770108905700.png',
			category: 'drinks',
			isPopular: true
		},
		{
			id: 2,
			name: '딸기 스무디',
			nameEn: 'Strawberry Smoothie',
			description: '신선한 딸기를 듬뿍 넣어 만든 건강한 스무디입니다. 비타민이 풍부하고 상큼한 맛이 일품입니다.',
			price: 7000,
			image: 'images/smoothie_drink_1770108935792.png',
			category: 'drinks',
			isPopular: true
		},
		{
			id: 3,
			name: '프레시 오렌지 주스',
			nameEn: 'Fresh Orange Juice',
			description: '매일 아침 착즙한 신선한 오렌지 주스입니다. 비타민 C가 풍부하여 건강에 좋습니다.',
			price: 5500,
			image: 'images/juice_drink_1770108953265.png',
			category: 'drinks',
			isPopular: false
		},
		{
			id: 4,
			name: '콜라',
			nameEn: 'Cola',
			description: '시원하고 청량한 탄산음료입니다. 얼음과 레몬 슬라이스가 함께 제공됩니다.',
			price: 3000,
			image: 'images/soda_drink_1770108969291.png',
			category: 'drinks',
			isPopular: false
		}
	],
	alcohol: [
		{
			id: 5,
			name: '생맥주',
			nameEn: 'Draft Beer',
			description: '차갑게 냉장된 신선한 생맥주입니다. 풍부한 거품과 깔끔한 맛이 특징입니다.',
			price: 5000,
			image: 'images/beer_alcohol_1770108987117.png',
			category: 'alcohol',
			isPopular: true
		},
		{
			id: 6,
			name: '레드 와인',
			nameEn: 'Red Wine',
			description: '프랑스산 프리미엄 레드 와인입니다. 깊고 풍부한 맛과 향이 일품입니다.',
			price: 45000,
			image: 'images/wine_alcohol_1770109001777.png',
			category: 'alcohol',
			isPopular: false
		},
		{
			id: 7,
			name: '트로피칼 칵테일',
			nameEn: 'Tropical Cocktail',
			description: '파인애플, 망고, 코코넛이 어우러진 상큼한 칵테일입니다. 우산 장식과 과일 가니쉬가 함께 제공됩니다.',
			price: 12000,
			image: 'images/cocktail.jpg',
			category: 'alcohol',
			isPopular: true
		},
		{
			id: 8,
			name: '소주',
			nameEn: 'Soju',
			description: '한국의 대표적인 증류주입니다. 깔끔하고 부드러운 맛이 특징입니다.',
			price: 4000,
			image: 'images/soju.jpg',
			category: 'alcohol',
			isPopular: true
		}
	],
	appetizers: [
		{
			id: 9,
			name: '양념 치킨',
			nameEn: 'Korean Fried Chicken',
			description: '바삭하게 튀긴 치킨에 달콤 매콤한 양념을 입혔습니다. 참깨와 파를 곁들여 제공됩니다.',
			price: 18000,
			image: 'images/menu00.jpg',
			category: 'appetizers',
			isPopular: true
		},
		{
			id: 10,
			name: '감자튀김',
			nameEn: 'French Fries',
			description: '겉은 바삭하고 속은 부드러운 프렌치 프라이입니다. 케첩과 함께 제공됩니다.',
			price: 6000,
			image: 'images/menu01.jpg',
			category: 'appetizers',
			isPopular: false
		},
		{
			id: 11,
			name: '나초',
			nameEn: 'Loaded Nachos',
			description: '치즈, 할라피뇨, 사워크림, 과카몰리가 듬뿍 올라간 나초입니다. 푸짐한 한 접시입니다.',
			price: 14000,
			image: 'images/menu02.jpg',
			category: 'appetizers',
			isPopular: true
		},
		{
			id: 12,
			name: '에다마메',
			nameEn: 'Edamame',
			description: '소금으로 간한 일본식 풋콩입니다. 건강하고 담백한 안주로 인기가 많습니다.',
			price: 5000,
			image: 'images/menu03.jpg',
			category: 'appetizers',
			isPopular: false
		}
	]
};

// ===================================
// STATE MANAGEMENT
// ===================================
let currentCategory = 'drinks';
let cart = [];
let selectedItem = null;
let modalQuantity = 1;

// ===================================
// INITIALIZATION
// ===================================

// ===================================
// CATEGORY SELECTION
// ===================================
function selectCategory(category) {
	currentCategory = category;
	
	// Update active state on category cards
	document.querySelectorAll('.category-card').forEach(card => {
		card.classList.remove('active');
	});
	document.querySelector(`[data-category="${category}"]`).classList.add('active');
	
	// Render menu items for selected category
	renderMenuItems(category);
}

// ===================================
// MENU RENDERING
// ===================================
function renderMenuItems(category) {
	const menuGrid = document.getElementById('menuGrid');
	const menuTitle = document.getElementById('menuTitle');
	const menuCount = document.getElementById('menuCount');
	
	const items = menuData[category];
	
	// Update title
	const categoryNames = {
		drinks: '음료 메뉴',
		alcohol: '주류 메뉴',
		appetizers: '안주 메뉴'
	};
	menuTitle.textContent = categoryNames[category];
	menuCount.textContent = `${items.length}개 메뉴`;
	
	// Clear and render menu items
	menuGrid.innerHTML = '';
	items.forEach(item => {
		const menuItemEl = createMenuItemElement(item);
		menuGrid.appendChild(menuItemEl);
	});
	
	// Add fade-in animation
	menuGrid.classList.remove('fade-in');
	setTimeout(() => menuGrid.classList.add('fade-in'), 10);
}

function createMenuItemElement(item) {
	const div = document.createElement('div');
	div.className = 'menu-item';
	div.onclick = () => openModal(item);
	
	div.innerHTML = `
		<img class="menu-item-image" src="${item.image}" alt="${item.name}" onerror="this.src='https://via.placeholder.com/400x300?text=${encodeURIComponent(item.name)}'">
		<div class="menu-item-content">
			<div class="menu-item-header">
				<h4>${item.name}</h4>
				${item.isPopular ? '<span class="popular-badge">인기</span>' : ''}
			</div>
			<p class="menu-item-description">${item.description}</p>
			<div class="menu-item-footer">
				<span class="menu-item-price">₩${item.price.toLocaleString()}</span>
				<button class="add-to-cart-btn" onclick="event.stopPropagation(); quickAddToCart(${item.id})">
					담기
				</button>
			</div>
		</div>
	`;
	
	return div;
}

// ===================================
// MODAL MANAGEMENT
// ===================================
function openModal(item) {
	selectedItem = item;
	modalQuantity = 1;
	clog('openModal selectedItem=>',selectedItem)
	
	const modal = document.getElementById('modalOverlay');
	const modalImage = document.getElementById('modalImage');
	const modalCategory = document.getElementById('modalCategory');
	const modalTitle = document.getElementById('modalTitle');
	const modalDescription = document.getElementById('modalDescription');
	const modalPrice = document.getElementById('modalPrice');
	const quantity = document.getElementById('quantity');
	
	// Set modal content
	modalImage.src = item.image;
	modalImage.onerror = () => {
		modalImage.src = `https://via.placeholder.com/600x300?text=${encodeURIComponent(item.name)}`;
	};
	
	const categoryLabels = {
		drinks: '음료',
		alcohol: '주류',
		appetizers: '안주'
	};
	modalCategory.textContent = categoryLabels[item.category];
	modalCategory.style.background = getCategoryGradient(item.category);
	
	modalTitle.textContent = item.name;
	modalDescription.textContent = item.description;
	modalPrice.textContent = `₩${item.price.toLocaleString()}`;
	quantity.textContent = modalQuantity;
	
	// Show modal
	modal.classList.add('active');
	document.body.style.overflow = 'hidden';
}

function closeModal(event) {
	if (event && event.target !== event.currentTarget && !event.target.classList.contains('modal-close')) {
		return;
	}
	
	const modal = document.getElementById('modalOverlay');
	modal.classList.remove('active');
	document.body.style.overflow = 'auto';
	selectedItem = null;
	modalQuantity = 1;
}

function getCategoryGradient(category) {
	const gradients = {
		drinks: 'linear-gradient(135deg, #667eea, #764ba2)',
		alcohol: 'linear-gradient(135deg, #f093fb, #f5576c)',
		appetizers: 'linear-gradient(135deg, #4facfe, #00f2fe)'
	};
	return gradients[category];
}

// ===================================
// QUANTITY CONTROLS
// ===================================
function increaseQuantity() {
	modalQuantity++;
	document.getElementById('quantity').textContent = modalQuantity;
}

function decreaseQuantity() {
	if (modalQuantity > 1) {
		modalQuantity--;
		document.getElementById('quantity').textContent = modalQuantity;
	}
}

// ===================================
// CART MANAGEMENT
// ===================================
function addToCart() {
	if (!selectedItem) return;
	clog('addToCart ->', selectedItem)
	
	const existingItem = cart.find(item => item.id === selectedItem.id);	
	if (existingItem) {
		existingItem.quantity += modalQuantity;
	} else {
		cart.push({
			...selectedItem,
			quantity: modalQuantity
		});
	}
	// Show feedback
	showNotification(`${selectedItem.name} ${modalQuantity}개가 장바구니에 추가되었습니다.`);
	
	updateCartDisplay();
	// closeModal();
	
}

function quickAddToCart(itemId) {
	const allItems = [...menuData.drinks, ...menuData.alcohol, ...menuData.appetizers];
	const item = allItems.find(i => i.id === itemId);
	
	if (!item) return;
	
	const existingItem = cart.find(i => i.id === itemId);
	
	if (existingItem) {
		existingItem.quantity++;
	} else {
		cart.push({
			...item,
			quantity: 1
		});
	}
	
	updateCartDisplay();
	showNotification(`${item.name}이(가) 장바구니에 추가되었습니다.`);
}

function updateCartDisplay() {
	const cartCount = document.getElementById('cartCount');
	const cartTotal = document.getElementById('cartTotal');
	
	const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
	const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
	
	cartCount.textContent = totalItems;
	cartTotal.textContent = `₩${totalPrice.toLocaleString()}`;
	
	// Add animation
	cartCount.style.transform = 'scale(1.2)';
	setTimeout(() => {
		cartCount.style.transform = 'scale(1)';
	}, 200);
}

function viewCart() {
	if (cart.length === 0) {
		showNotification('장바구니가 비어있습니다.');
		return;
	}
	/*
	let cartContent = '=== 장바구니 ===\n\n';
	cart.forEach(item => {
		cartContent += `${item.name} x ${item.quantity} = ₩${(item.price * item.quantity).toLocaleString()}\n`;
	});  
	const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
	cartContent += `\n총 금액: ₩${totalPrice.toLocaleString()}`;  
	alert(cartContent);
	*/
	openCartModal();
}

// 주문하기
function placeOrder() {
	
}
// 전체삭제
function clearCart() {
	cart=[]
	openCartModal()
}
// 장바구니 정보
function openCartModal() {
		const modal = document.getElementById('cartModalOverlay');
		const content = document.getElementById('cartModalContent');
		const total = document.getElementById('cartModalTotal');

		// Clear existing content
		content.innerHTML = '';

		if (cart.length === 0) {
				content.innerHTML = `
			<div class="cart-empty">
				<span class="cart-empty-icon">🛒</span>
				<p class="cart-empty-text">장바구니가 비어있습니다</p>
				<p class="cart-empty-subtext">메뉴를 선택해주세요</p>
			</div>
		`;
		} else {
				// Render cart items
				cart.forEach((item, index) => {
						const cartItem = document.createElement('div');
						cartItem.className = 'cart-item';
						cartItem.innerHTML = `
				<img class="cart-item-image" src="${item.image}" alt="${item.name}">
				<div class="cart-item-info">
					<h4 class="cart-item-name">${item.name}</h4>
					<p class="cart-item-price">₩${item.price.toLocaleString()}</p>
				</div>
				<div class="cart-item-controls">
					<div class="cart-quantity-control">
						<button class="cart-quantity-btn" onclick="updateCartItemQuantity(${index}, -1)">−</button>
						<span class="cart-quantity-value">${item.quantity}</span>
						<button class="cart-quantity-btn" onclick="updateCartItemQuantity(${index}, 1)">+</button>
					</div>
					<button class="cart-item-remove" onclick="removeCartItem(${index})" title="삭제">
						🗑️
					</button>
				</div>
				<div class="cart-item-subtotal">
					₩${(item.price * item.quantity).toLocaleString()}
				</div>
			`;
						content.appendChild(cartItem);
				});
		}

		// Update total
		const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
		total.textContent = `₩${totalPrice.toLocaleString()}`;

		// Show modal
		modal.classList.add('active');
		document.body.style.overflow = 'hidden';
}

function closeCartModal(event) {
		if (event && event.target !== event.currentTarget && !event.target.classList.contains('modal-close')) {
				return;
		}

		const modal = document.getElementById('cartModalOverlay');
		modal.classList.remove('active');
		document.body.style.overflow = 'auto';
}


// ===================================
// NOTIFICATIONS
// ===================================
function showNotification(message) {
	// Create notification element
	const notification = document.createElement('div');
	notification.style.cssText = `
		position: fixed;
		top: 100px;
		right: 20px;
		background: linear-gradient(135deg, #667eea, #764ba2);
		color: white;
		padding: 1rem 1.5rem;
		border-radius: 1rem;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
		z-index: 10000;
		animation: slideIn 0.3s ease-out;
		font-family: 'Inter', sans-serif;
		font-weight: 500;
	`;
	notification.textContent = message;
	
	document.body.appendChild(notification);
	
	// Remove after 3 seconds
	setTimeout(() => {
		notification.style.animation = 'slideOut 0.3s ease-out';
		setTimeout(() => {
			document.body.removeChild(notification);
		}, 300);
	}, 3000);
}

// Add notification animations to CSS dynamically
const style = document.createElement('style');
style.textContent = `
	@keyframes slideIn {
		from {
			transform: translateX(400px);
			opacity: 0;
		}
		to {
			transform: translateX(0);
			opacity: 1;
		}
	}
	
	@keyframes slideOut {
		from {
			transform: translateX(0);
			opacity: 1;
		}
		to {
			transform: translateX(400px);
			opacity: 0;
		}
	}
`;
document.head.appendChild(style);
