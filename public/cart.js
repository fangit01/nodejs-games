var myCartJS = (function () {

    var cart = [];

    // initial page loading ------------------------------------------
    if (localStorage.getItem('LScart') === null) {
        localStorage.setItem('LScart', '[]');
    } else {
        cart = JSON.parse(localStorage.getItem('LScart'));
        updateHeaderCartQty();
    }

    // ---------------------

    function returnTotalItemCount() {
        var totalItemCount = cart.reduce(function (sum, item) {
            return sum + Number(item.count);
        }, 0)
        return totalItemCount;
    }

    function updateHeaderCartQty() {
        document.querySelector('.headerCartTotal').innerText = returnTotalItemCount();
    }


    function updateLScart() {
        localStorage.setItem('LScart', JSON.stringify(cart));
    }


    class Item {
        constructor(name, price, count) {
            this.name = name;
            this.price = price;
            this.count = count;
        }
    }

    var clickToAdd = function (name, price, count) {
        var item = new Item(name, price, count);
        var gameNameArray = cart.map(item => item.name);

        // if item not in the array, push it to the array.
        if (!gameNameArray.includes(item.name)) {
            cart.push(item);
            updateLScart();
            updateHeaderCartQty();
        } else {
            // if item already in the array, update the count of item
            for (let i in cart) {
                if (cart[i].name === item.name) {
                    cart[i].count += item.count;
                    updateLScart();
                    updateHeaderCartQty();
                    return;
                }
            }
        } // end of else 
    }

    // add click envent listerner for each add to cart button on homepage
    if (document.querySelector('.addToCartBtns') != null) {
        document.querySelectorAll('.addToCartBtns').forEach(element => {
            element.addEventListener('click', function (event) {
                event.preventDefault();
                var name = event.target.parentElement.children[0].innerText;
                var price = Number(event.target.parentElement.children[2].children[0].innerText);
                var count = 1;
                clickToAdd(name, price, count);
                event.target.nextElementSibling.innerHTML = `${name} added to the cart. <a href="/cart">view Cart</a>`
            })
        })
    }

    // add quantity input field  envent listerner for single product page
    if (document.querySelector('.addToCartBtn') != null) {
        document.querySelector('.addToCartBtn').addEventListener('click', function (event) {
            event.preventDefault();
            var name = document.querySelector('.gameName').innerText;
            var price = Number(document.querySelector('.price').innerText);
            var count = Number(document.getElementById('quantity').value);
            clickToAdd(name, price, count);
            document.querySelector('.addToCartInfo').innerHTML = `${count} ${name} added to the cart. <a href="/cart">view Cart</a>`
        })
    }

    // below is for cart page  ---------------------------------------------------------------------------------------------------------

    if ((JSON.parse(localStorage.getItem('LScart'))).length === 0 && document.querySelector('.cartPageContent') != null) {
        document.querySelector('.cartPageContent').innerHTML = "you cart is empty.";

    } else if ((JSON.parse(localStorage.getItem('LScart'))).length > 0 && document.querySelector('.cartPageContent') != null) {
        // display each cart item in DOM ---------------------
        function displayCartItems() {
            function cartPageDisplay(name, price, count) {
                var ItemList = document.querySelector('tbody');
                var item = document.createElement('tr');
                item.innerHTML = `  
                                <td><a href="/games/${name}">${name}</a></td>
                                <td style="padding-left:20px;" > $ ${price}</td>
                                <td style="padding-left:20px;"> <input class="cartPageQuantityInput" type="number" value="${count}" step="1" min="1" max='99' ></td>
                                <td class="deleteItem" style="color:darkred;padding-left:20px;"> X </td>
                                `;
                ItemList.appendChild(item);
            }

            cart.forEach(item => {
                cartPageDisplay(item.name, item.price, item.count);
            });
            cartPageTotalQtyAndAmount();
            updateHeaderCartQty();
        }

        displayCartItems();

        // function: update cart page subtotal qty and amount---------------------
        function cartPageTotalQtyAndAmount() {
            var cartPageTotalAmount = cart.reduce(function (sum, item) {
                return sum + Number(item.price) * Number(item.count);
            }, 0);

            document.querySelector('.cartPageTotalAmount').innerText = cartPageTotalAmount;
            document.querySelector('.totalQty').innerText = returnTotalItemCount();

        }

        // delete button function ---------------------
        var deleteItem = document.querySelectorAll('.deleteItem');
        for (var i = 0; i < deleteItem.length; i++) {
            deleteItem[i].addEventListener('click', function (event) {
                event.preventDefault();
                var name = event.target.parentElement.children[0].innerText;
                cart.forEach((element, index) => {
                    if (element.name === name) {
                        cart.splice(index, 1);
                        event.target.parentElement.remove();
                    }
                    updateLScart();
                    cartPageTotalQtyAndAmount();
                    updateHeaderCartQty();
                });
            });
        }

        // cart page quantity input field event listener ---------------------
        var qtyArray = document.querySelectorAll('.cartPageQuantityInput');
        qtyArray.forEach(element => {
            element.addEventListener('change', function (event) {
                var name = event.target.parentElement.parentElement.children[0].innerText;
                cart.forEach((element, index) => {
                    if (element.name === name) {
                        element.count = Number(event.target.value);
                    }
                    updateLScart();
                    cartPageTotalQtyAndAmount();
                    updateHeaderCartQty();
                });
            })
        })

    } // end of else if  ---------------------

})();