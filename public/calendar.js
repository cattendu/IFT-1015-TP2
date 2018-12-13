/************************************ TP2 **************************************
    Class: IFT-1015
    Authors:
        Wassime Seddiki, 20120146
        Charles Attendu, 1005236
    Date: 14-12-2018
*******************************************************************************/

'use strict';

//Array keeping track of user's availabilities. 0: unavailable, 1: available
var availArr;
//Used to toggle cells availabilities with mouse click.
var isAvailable = false;

document.addEventListener('DOMContentLoaded', function() {
    var cal = document.getElementById("calendar");
    var nbHours = +cal.dataset.nbhours;
    var nbDays = +cal.dataset.nbdays;

    //time periods when the user is available
    availArr = new Array(nbHours*nbDays).fill(false);
});

//Set isAvailable state and clicked cell availability
function onClick(event) {
    var t = event.target;

    if(t.className == "cell"){
        //set availability according to clicked cell
        isAvailable = !availArr[t.id];
        setAvailability(t);
    }
}

//Set cell availability if mouse is down
function onMove(event) {
    var t = event.target;

    if(event.buttons == 1 && t.className == "cell"){
        setAvailability(t);
    }
}

//Sets availability in data array and in the html table
var setAvailability = function(cell){
    var cellIndex = cell.id;
    //set calendar cell availability visual representation
    cell.innerHTML = isAvailable ? "&#10003" : "";
    //set availability data
    availArr[cellIndex] = isAvailable;
};

// *****************************************************
// ****          COMPACTER DISPONIBILITES           ****
// *****************************************************
//returns the availability array as a string of ones dans zeros
var compactAvailabilities = function() {
    return availArr.map(function(available){
        return available ? "1" : "0";
    }).join("");
};
