let myImage = document.querySelector('img');

myImage.onclick = function() {
    let mySrc = myImage.getAttribute('src');
    if(mySrc === 'images/펄럭.png') {
      myImage.setAttribute ('src','images/펄럭2.png');
    } else {
      myImage.setAttribute ('src','images/펄럭.png');
    }
}
    let myButton = document.querySelector('button');
    let myHeading = document.querySelector('h1');
    function setUserName() {
        let myName = prompt('Please enter your name.');
        if(!myName || myName === null) {
            setUserName();
        } else {
            localStorage.setItem('name', myName);
            myHeading.innerHTML = '대한민국에 오신걸 환영합니다!, ' + myName + '님';
            }
        }
      if(!localStorage.getItem('name')) {
        setUserName();
      } else {
        let storedName = localStorage.getItem('name');
        myHeading.textContent = '대한민국에 오신걸 환영합니다!, ' + storedName + '님';
      }
      myButton.onclick = function() {
        setUserName();
      }

          
