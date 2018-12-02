'use strict';

//2D array keeping track of user's availabilities. 0: unavailable, 1: available
var availArr;

document.addEventListener('DOMContentLoaded', function() {
    var cal = document.getElementById("calendar");
    var nbHours = cal.dataset.nbhours;
    var nbDays = cal.dataset.nbdays;

    //Keeps track of the time periods when the user is available
    availArr = generate2DArray(nbDays, nbHours);
});

//Generates a 2D array initialized with the value zero
var generate2DArray = function(cols, rows){
    var arr = new Array(+rows)
    .fill(null); //fill with null because undefined will be skipped by map()
    
    //Fill 2D array with zeros
    return arr.map(function(){
        return new Array(+cols).fill(0);
    });
};

function onClick(event) {
    var t = event.target;
    var pos = getCellPos(t);

    if(pos != null){ //User clicked on a calendar cell
        //Toggle calendar cell between check mark and empty string
        t.innerHTML = t.innerHTML == "" ? "&#10003" : "";
        //Toggle recorded availability between 0 and 1
        availArr[pos.x][pos.y] = availArr[pos.x][pos.y] == 0 ? 1 : 0;
    }
}

//Get the position of a calendar cell element based on its id;
//Return null if the element is not a calendar cell
//Calendar cells' id are of format: x-y where x and y are integers
var getCellPos = function(elem){
    var id = elem.id.split("-");
    if(id.length != 2) return null; //id format is wrong: not a calendar cell

    var hour = +id[0]; //Extract hour position based on id
    var day  = +id[1]; //Extract day position based on id

    if(!(day == day && hour == hour)) //not an integer: not a calendar cell
        return null;

    return {x: day, y: hour};
};

function onMove(event) {
    // TODO
    var t = event.target;
    var id = t.id;
}

var compacterDisponibilites = function() {
    return availArr.map(function(row){
        return row.join("");
    }).join("");
};
