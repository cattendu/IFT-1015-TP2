/************************************ TP2 **************************************
    Class: IFT-1015
    Authors:
        Wassime Seddiki, 20120146
        Charles Attendu, 1005236
    Date: 14-12-2018
*******************************************************************************/

'use strict';

var http = require("http");
var fs = require('fs');
var urlParse = require('url').parse;
var pathParse = require('path').parse;
var querystring = require('querystring');

var port = 1337;
var hostUrl = 'http://localhost:'+port+'/';
var defaultPage = '/index.html';

var mimes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
};

// --- Helpers ---
var readFile = function (path) {
    return fs.readFileSync(path).toString('utf8');
};

var writeFile = function (path, texte) {
    fs.writeFileSync(path, texte);
};

// --- Server handler ---
var redirect = function (reponse, path, query) {
    var newLocation = path + (query == null ? '' : '?' + query);
    reponse.writeHeader(302, {'Location' : newLocation });
    reponse.end('302 page déplacé');
};

var getDocument = function (url) {
    var pathname = url.pathname;
    var parsedPath = pathParse(url.pathname);
    var result = { data: null, status: 200, type: null };

    if(parsedPath.ext in mimes) {
        result.type = mimes[parsedPath.ext];
    } else {
        result.type = 'text/plain';
    }

    try {
        result.data = readFile('./public' + pathname);
        console.log('['+new Date().toLocaleString('iso') + "] GET " + url.path);
    } catch (e) {
        // File not found.
        console.log('['+new Date().toLocaleString('iso') + "] GET " +
                    url.path + ' not found');
        result.data = readFile('template/error404.html');
        result.type = 'text/html';
        result.status = 404;
    }

    return result;
};
var sendPage = function (reponse, page) {
    reponse.writeHeader(page.status, {'Content-Type' : page.type});
    reponse.end(page.data);
};

var indexQuery = function (query) {

    var resultat = { exists: false, id: null, error: null };

    if (query !== null) {

        query = querystring.parse(query);
        if ('id' in query && 'titre' in query &&
            query.id.length > 0 && query.titre.length > 0) {

            resultat.exists = createPoll(
                query.titre, query.id,
                query.dateDebut, query.dateFin,
                query.heureDebut, query.heureFin);
        }

        if (resultat.exists) {
            resultat.id = query.id;
        }
        else{
            resultat.error = getErrorCode(
                query.titre, query.id,
                query.dateDebut, query.dateFin,
                query.heureDebut, query.heureFin);
        }
    }

    return resultat;
};

var calQuery = function (id, query) {
    if (query !== null) {
        query = querystring.parse(query);
        // query = { nom: ..., disponibilites: ... }
        addParticipant(id, query.nom, query.disponibilites);
        return true;
    }
    return false;
};

//MODIFIED FOR BONUS POINTS
var getIndex = function (error) {
    //Retrieve base index template and replace error msg
    var page = getTemplate("index");
    var data = [
        {lookup: "{{error}}", value: getErrorMsg(error)}
    ];
    page = populateTemplate(page, data);

    return {
        status: 200,
        data: page,
        type: 'text/html'
    };
};

//------------------------------------------------------------------------------
//--------------------------------- TP2 BEGIN ----------------------------------
//------------------------------------------------------------------------------

//------------------------------ Global variables ------------------------------
var polls = []; //Keeps track of all user created polls

var months = [ //convert month index to string equivalent
    'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin',
    'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Dec'
];

var MILLIS_PER_DAY = (24 * 60 * 60 * 1000); //nb of milliseconds in a day
//------------------------------ Global variables ------------------------------

//----------------------------- Template utilities -----------------------------
//returns a template's HTML as a string
var getTemplate = function(file){
    return readFile("template/" + file + ".html");
};

//Replaces variables inside a template by their actual values
var populateTemplate = function(template, data){
    return data.reduce(function(template, entry){
        return template.split(entry.lookup).join(entry.value);
    }, template);
};

//Add days to a date
//https://stackoverflow.com/questions/563406/add-days-to-javascript-date
Date.prototype.addDays = function(days) {
    var date = new Date(this.valueOf());
    date.setDate(date.getDate() + days);
    return date;
};
//--------------------------- Template utilities -------------------------------

//--------------------------- Calendar template --------------------------------
//Returns the html to display as text; return false if poll does not exist
var getCalendar = function (pollId) {
    var poll = getPoll(pollId);
    if(poll == null) return false; //poll was not found

    //setup variables to replace in template
    var title = poll.title;
    var table = getCalendarTable(poll);
    var url = hostUrl + poll.id;

    //associate lookup keyword with their corresponding replacement value
    var data = [
        {lookup: "{{titre}}", value: title},
        {lookup: "{{table}}", value: table},
        {lookup: "{{url}}"  , value: url}
    ];

    var calendar = getTemplate("calendar"); //retrieve template
    return populateTemplate(calendar, data); //replace variables by their value
};

//Produces the HTML for the calendar input table
var getCalendarTable = function(poll){
    var nbDays = getElapsedDays(poll.dateStart, poll.dateEnd) + 1;
    var nbHours = getElapsedTime(poll.timeStart, poll.timeEnd) + 1;

    //<table ...
    var table  = '<table id="calendar"';
        table += 'onmousedown="onClick(event)"';
        table += 'onmouseover="onMove(event)"';
        table += 'data-nbdays="' + nbDays + '"';
        table += 'data-nbhours="' + nbHours + '">';
    // ..>

    //<table>HERE</table>
        table += getCalRows(nbDays, nbHours, poll.dateStart, poll.timeStart);

    //... </table>
        table += "</table>";

    return table;
};

//Produces the all calendar table rows including header
var getCalRows = function(nbCols, nbRows, dateStart, timeStart){
    var rows = getTableHeader(nbCols, dateStart);//header row

    //rows with participation data
    var cellId = 0;
    for(var i = 0; i < nbRows; i++){
        var row = "<tr><th>" + (timeStart + i) + "h</th>";
        for(var j = 0; j < nbCols; j++){
            row += "<td class='timeCell' id='" + cellId++ +"'></td>";
        }
        rows += row;
    }

    return rows;
};

//Produces the table header 
var getTableHeader = function(nbCols, dateStart){
    var header = "<tr><th></th>";
    for(var i = 0; i < nbCols; i++){
        var date = new Date(dateStart).addDays(i);
        var day = date.getUTCDate();
        var month = months[date.getUTCMonth()];
        header += "<th>" + day + " " + month + "</th>";
    }
    header += "</tr>";

    return header;
};
//--------------------------- Calendar template --------------------------------
//--------------------------- Results template ---------------------------------
//Returns the html to display as text; return false if poll does not exist
var getResults = function (pollId) {
    var poll = getPoll(pollId);
    if(poll == null) return false; //poll not found

    //setup variables to replace in template
    var title = poll.title;
    var table = getResultsTable(poll);
    var url = hostUrl + poll.id;
    var legend = getLegend(poll);

    //associate lookup keyword with their corresponding replacement value
    var data = [
        {lookup: "{{titre}}",   value: title},
        {lookup: "{{table}}",   value: table},
        {lookup: "{{url}}",     value: url},
        {lookup: "{{legende}}", value: legend}
    ];

    var results = getTemplate("results"); //retrieve template
    return populateTemplate(results, data); //replace variables by their values
};

//Produces the HTML for the results table
var getResultsTable = function(poll){
    var nbDays = getElapsedDays(poll.dateStart, poll.dateEnd) + 1;
    var nbHours = getElapsedTime(poll.timeStart, poll.timeEnd) + 1;

    var table  = '<table>';

    //<table>HERE</table>
        table += getResRows(nbDays, nbHours, poll.dateStart,
                            poll.timeStart, poll.participants);

    //... </table>
        table += "</table>";

    return table;
};

//Produces the all result table rows including header
var getResRows = function(nbCols, nbRows, dateStart, timeStart, participants){
    var stats = getMinMaxStats(participants, nbCols*nbRows);
    var rows = [];

    //HTML Header row
    rows.push(getTableHeader(nbCols, dateStart));

    //HTML Table Data rows
    var cellIndex = 0; //current time cell being investigated
    for(var i = 0; i < nbRows; i++){
        var row = "<tr><th>" + (+timeStart + i) + "h</th>";
        for(var j = 0; j < nbCols; j++, cellIndex++){
            row += "<td " + getMinMaxClass(cellIndex, stats, participants) + ">" +
            getAvailIndicators(cellIndex, participants) + "</td>";
        }
        rows.push(row);
    }

    return rows.join("");
};

//get the html to display the color bars indicating participants availabilities
var getAvailIndicators = function(cellIndex, participants){
    var colorIndicators = "";
    //add color bar for each participant available during this time cell
    participants.forEach(function(p, i){
        if(p.availabilities[cellIndex] == "1"){ //participant is available
            var color = genColor(i, participants.length);
            colorIndicators += "<span style='background-color: " +
                                color + "; color:"+ color +"'>.</span>";
        }
    });
    return colorIndicators;
};

//Get html for legend of the result's table
var getLegend = function(poll){
    var legend = "<ul>";
    poll.participants.map(function(p,i){
        var color = genColor(i, poll.participants.length);
        legend += "<li style='background-color: " + color + "'>" + p.name + "</li>"; 
    });
    legend += "</ul>";
    return legend;
};
//--------------------------- Results template ---------------------------------

//--------------------------- Results Utitilies --------------------------------
//Generates a color based on the number of participants
var genColor = function(i, nbColors) {
    //Calculate values
    var h = (i*6/nbColors);
    var c = 0.7*255;
    var x = c*(1-Math.abs(h%2-1));

    //Convert to hex
    c = Math.floor(c).toString(16);
    x = x == 0 ? "00" : Math.floor(x).toString(16);

    //Return color
    switch(Math.floor(h)){
        case 0:  return "#" + c + x + "00";
        case 1:  return "#" + x + c + "00";
        case 2:  return "#" + "00" + c + x;
        case 3:  return "#" + "00" + x + c;
        case 4:  return "#" + x + "00" + c;
        case 5:  return "#" + c + "00" + x;
        default: return "#000000";
    }
};

//Find the cells with the min/max number of available participants
var getMinMaxStats = function(participants, nbCells){
    var min =  1/0; //init at +infinity
    var max = -1/0; //init at -infinity

    //Find the cell with min/max nb of available participants
    for(var i = 0; i < nbCells; i++){
        var nbAvail = 0;
        participants.forEach(function(p){
            nbAvail += +p.availabilities[i]; //0 or 1 depending on availability
        });

        min = Math.min(min, nbAvail); //update min
        max = Math.max(max, nbAvail); //update max
    }

    return {min:min, max:max};
};

//Get the css class for a time cell if it has min/max participation
var getMinMaxClass = function(cellIndex, stats, participants){
    var nbAvail = 0;

    //nb of available participants for a specific time cell
    participants.forEach(function(p){
        nbAvail += +p.availabilities[cellIndex];
    });

    if(nbAvail == stats.max) return "class='max'";
    if(nbAvail == stats.min) return "class='min'";
    return ""; //Was neither min nor max
};
//--------------------------- Results Utitilies --------------------------------

//------------------------------ Poll controller -------------------------------
// *****************************************************
// ****                CREER SONDAGE                ****
// *****************************************************
//Creates a new poll; return true if creation was successful; else return false
var createPoll = function(title, id, dateStart, dateEnd, timeStart, timeEnd) {
    if (isValidId(id) &&
        isUniqueId(id) && //BONUS: used for error messages
        isValidDate(dateStart, dateEnd) &&
        isValidTime(timeStart, timeEnd)){
            //Adds new poll to global variable polls
            polls.push({ 
                title: title,
                id: id,
                dateStart: dateStart,
                dateEnd: dateEnd,
                timeStart: +timeStart,
                timeEnd: +timeEnd,
                participants: []
            });
            return true;
        }
    return false;
};

//Retrieve information from saved poll
var getPoll = function(id){
    for(var i = 0; i < polls.length; i++){
        if(polls[i].id == id) return polls[i];
    }
    return null; //poll not founds
};

// *****************************************************
// ****             AJOUTER PARTICIPANT             ****
// *****************************************************
//Adds a participant to a specific poll
var addParticipant = function(pollId, name, availabilities) {
    var poll = getPoll(pollId);
    if(poll != null){ //poll was found
        poll.participants.push({name: name, availabilities: availabilities});
    }
};
//------------------------------ Poll controller -------------------------------

//-------------------------- Poll creation validation --------------------------
//ID is valid if it contains only letters numbers and allowed special characters
//Must be of length > 0
var isValidId = function(id){
    if(id == undefined) return false;
    if(id.length == 0) return false;

    for(var i = 0; i < id.length; i++){
        var char = id.charAt(i);
        if(isLetter(char) || isDigit(char) || isSpecial(char))
            continue;
        return false;
    }
    return true;
};

//Checks if id is not already used by another poll
var isUniqueId = function(id){
    for(var i = 0; i < polls.length; i++){
        if(polls[i].id == id) return false;
    }
    return true;
};

//char is a letter
var isLetter = function(char){
    return (char >= "a" && char <= "z") ||
           (char >= "A" && char <= "Z");
};

//char is a digit
var isDigit = function(char){
    if(char == " ") return false; //space is converted to 0 by unary operator +
    return +char == +char;
};

//char is one of the allowed special chracters
var isSpecial = function(char){
    return char == "-"; //only special char accepted is dash
};

//Checks if start date is before end date and within max nb of days allowed
var isValidDate = function(start, end){
    if(start == undefined || end == undefined) return false;

    var maxDays = 30; //max poll length is 30 days
    var elapsed = getElapsedDays(start, end);
    return elapsed >= 0 && elapsed < maxDays;
};

//Checks if start time is before end time
var isValidTime = function(start, end){
    if(start == undefined || end == undefined) return false;

    return +start <= +end;
};

//number of elapsed days between two dates
var getElapsedDays = function(start, end){
    var dateStart = new Date(start);
    var dateEnd = new Date(end);
    return Math.floor((dateEnd-dateStart)/MILLIS_PER_DAY);
};

//number of elapsed hours between two times
var getElapsedTime = function(start, end){
    return end - start;
};
//-------------------------- Poll creation validation --------------------------

//-------------------------- BONUS: Error message ------------------------------
//Returns an error code based on the error type when trying to add a new poll
var getErrorCode = function(title, id, dateStart, dateEnd, timeStart, timeEnd){
    if(!isValidId(id))                   return 1;
    if(!isUniqueId(id))                  return 2;
    if(!isValidDate(dateStart, dateEnd)) return 3;
    if(!isValidTime(timeStart, timeEnd)) return 4;
                                         return 0;
};

//Converts an error code to its html element
var getErrorMsg = function(code){
    if(code == null) return "";

    var msg = "<div id='error' >";
    switch(code){
        case 1: msg += "Entrez un id valide!";
                break;
        case 2: msg += "Ce id est déjà utilisé par un autre sondage!";
                break;
        case 3: msg += "Entrez des dates valides!";
                break;
        case 4: msg += "Entrez des heures valides!";
                break;
        default: msg += "Votre formulaire comporte une erreur!";
    }
    msg += "</div>";
    return msg;

};
//------------------------------- Error message --------------------------------

//--------------------------------- Unit tests ---------------------------------
var assert = require('assert');

var test = function(){
    testIsValidID();
    testIsValidDate();
    testIsValidTime();
    testPopulateTemplate();
    testGenColor();
    testGetMinMaxStats();
    testCompactAvailabilities();
};

var testIsValidID = function(){
    assert(isValidId("") === false);
    assert(isValidId(" ") === false);
    assert(isValidId("%212") === false);
    assert(isValidId("dsa dAA1") === false);
    assert(isValidId("dD3-2aa") === true);
};

var testIsValidDate = function(){
    assert(isValidDate("12-01-2018","12-01-2018") === true);
    assert(isValidDate("12-01-2018","12-30-2018") === true);
    assert(isValidDate("11-20-2018","12-01-2018") === true);
    assert(isValidDate("12-01-2018","12-31-2018") === false);
    assert(isValidDate("12-31-2018","12-30-2018") === false);
};

var testIsValidTime = function(){
    assert(isValidTime("1","1") === true);
    assert(isValidTime("1","5") === true);
    assert(isValidTime("0","23") === true);
    assert(isValidTime("7","6") === false);
};

var testPopulateTemplate = function(){
    var template1 = "foo {{foo}} bar {{foo}}";
    var template2 = "foo {{foo}} bar {{bar}}";
    var data1 = [
        {lookup: "{{foo}}", value: "test"}
    ];
    var data2 = [
        {lookup: "{{foo}}", value: "test"},
        {lookup: "{{bar}}", value: "testBar"}
    ];

    assert(populateTemplate(template1,data1) === "foo test bar test");
    assert(populateTemplate(template1,data2) === "foo test bar test");
    assert(populateTemplate(template2,data2) === "foo test bar testBar");
};

var testGenColor = function(){
    assert(genColor(0,0) === "#000000");
    assert(genColor(1,0) === "#000000");
    assert(genColor(0,1) === "#b20000");
    assert(genColor(2,5) === "#00b247");
    assert(genColor(4,5) === "#8e00b2");
};

var testGetMinMaxStats = function(){
    var participants1 = [
        {name: "test",  availabilities: "0000"},
    ];
    var participants2 = [
        {name: "test",  availabilities: "1000"},
    ];
    var participants3 = [
        {name: "test1",  availabilities: "1111"},
        {name: "test2",  availabilities: "1100"},
        {name: "test3",  availabilities: "1000"},
    ];
    
    assert(getMinMaxStats(participants1, 4).min === 0 &&
           getMinMaxStats(participants1, 4).max === 0);
    assert(getMinMaxStats(participants2, 4).min === 0 &&
           getMinMaxStats(participants2, 4).max === 1);
    assert(getMinMaxStats(participants3, 4).min === 1 &&
           getMinMaxStats(participants3, 4).max === 3);
};

//This function is ran client side in calendar.js
var testCompactAvailabilities = function(){
    var compactAvailabilities = function(availArr) {
        return availArr.reduce(function(compact, availability){
            return compact + (availability ? "1" : "0");
        },"");
    };
    var avail1 = [false, false, false, false];
    var avail2 = [true, false, true, false];
    var avail3 = [true, true];
    assert(compactAvailabilities(avail1) === "0000");
    assert(compactAvailabilities(avail2) === "1010");
    assert(compactAvailabilities(avail3) === "11");

};

test();
//--------------------------------- Unit tests ---------------------------------

/*
 * Création du serveur HTTP
 * Note : pas besoin de toucher au code ici (sauf peut-être si vous
 * faites les bonus)
 */
http.createServer(function (requete, reponse) {
    var url = urlParse(requete.url);

    // Redirect to index.html
    if (url.pathname == '/') {
        redirect(reponse, defaultPage, url.query);
        return;
    }
    var doc;

    if (url.pathname == defaultPage) {
        var res = indexQuery(url.query);

        if (res.exists) {
            redirect(reponse, res.id);
            return;
        } else {
            doc = getIndex(res.error);
        }
    } else {
        var parsedPath = pathParse(url.pathname);
        if (parsedPath.ext.length == 0) {
            var id;

            if (parsedPath.dir == '/') {
                id = parsedPath.base;

                if (calQuery(id, url.query)) {
                    redirect(reponse, '/'+ id + '/results');
                    return ;
                }

                var data = getCalendar(id);

                if(data === false) {
                    redirect(reponse, '/error404.html');
                    return;
                }

                doc = {status: 200, data: data, type: 'text/html'};
            } else {
                if (parsedPath.base == 'results') {
                    id = parsedPath.dir.slice(1);
                    var data = getResults(id);

                    if(data === false) {
                        redirect(reponse, '/error404.html');
                        return;
                    }

                    doc = {status: 200, data: data, type: 'text/html'};
                } else {
                    redirect(reponse, '/error404.html');
                    return;
                }
            }
        } else {
            doc = getDocument(url);
        }
    }
    sendPage(reponse, doc);

}).listen(port);