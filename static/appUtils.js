// get each coinImage element ahd have it listen for a click
var coinImages = document.getElementsByClassName('coinImage');
for (var index = 0; index < coinImages.length; ++index) {
    coinImages[index].addEventListener(
        'click',
        function (event) {
            // play the coin sound
            document.getElementById('coinAudio').play();

            // Get the current value on the page and update it.
            // Before the clickable image is the text node containing the number of coins
            var numCoinsTextNode = event.target.previousSibling;
            var coins = parseInt(numCoinsTextNode.nodeValue) + 1;
            numCoinsTextNode.nodeValue = coins + ' ';

            // Get the name of the character, stored in the id of the coin image
            var name = event.target.id;

            // Send the new value to the server
            // Note: this use of XMLHttpRequest will not work in older versions of IE
            var xhr =  new XMLHttpRequest();
            xhr.onreadystatechange = function () {
                if (xhr.readyState === 4) {
                    if (xhr.status !== 200) {
                        console.log('Coin update request failed: ' + xhr.status);
                        numCoinsTextNode.nodeValue = (coins - 1) + ' ';
                    } else {
                        console.log('Updated coins to ' + coins);
                    }
                }
            }
            xhr.open('post', 'setcoin', true);
            // Note: this use of FormData will not work in IE < 10 or other older browsers
            var data = {'name': name,
                        'coins': coins};
            xhr.send(JSON.stringify(data));

       }
    );
};
