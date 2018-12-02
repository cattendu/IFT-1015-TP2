//Questions for TP2:
//ID allows empty strings? Min length
//Dates not before today?
//creerSondage/MILLIS_PER_DAY renaming

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

    var resultat = { exists: false, id: null };

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
    }

    return resultat;
};

var calQuery = function (id, query) {
    if (query !== null) {
        query = querystring.parse(query);
        // query = { nom: ..., disponibilites: ... }
        ajouterParticipant(id, query.nom, query.disponibilites);
        return true;
    }
    return false;
};

var getIndex = function (replacements) {
    return {
        status: 200,
        data: readFile('template/index.html'),
        type: 'text/html'
    };
};

//------------------------------------------------------------------------------
//----------------------------- TP2 BEGIN --------------------------------------
//------------------------------------------------------------------------------

var polls = [];

var months = [
    'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin',
    'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Dec'
];

var MILLIS_PER_DAY = (24 * 60 * 60 * 1000);

//------------------------------------------------------------------------------
//returns a template's HTML as a string
var getTemplate = function(file){
    return readFile("template/" + file + ".html");
};

//Searches a template and replaces its variables by their values
var populateTemplate = function(template, data){
    return data.reduce(function(template, entry){
        return template.split(entry.lookup).join(entry.value);
    }, template);
};
// Retourne le texte HTML à afficher à l'utilisateur pour répondre au
// sondage demandé.
//
// Doit retourner false si le calendrier demandé n'existe pas
var getCalendar = function (pollId) {
    var poll = getPoll(pollId);
    if(poll == null) return false;

    var title = poll.title;
    var table = getCalTable(poll);
    var url = hostUrl + poll.id;

    //Variables in calendar template and their actual values
    var data = [
        {lookup: "{{titre}}", value: title},
        {lookup: "{{table}}", value: table},
        {lookup: "{{url}}"  , value: url}
    ];
    var calendar = getTemplate("calendar");
    return populateTemplate(calendar, data);
};

//Produces the HTML for the calendar input table
var getCalTable = function(poll){
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
var getCalRows = function(nbDays, nbHours, dateStart, timeStart){
    var rows = [];
    rows.push(getCalHeader(nbDays, dateStart));
    for(var i = 0; i < nbHours; i++){
        rows.push(getCalRow(nbDays, timeStart, i));
    }
    return rows.join("");
};
//Produces a single calendar table row
var getCalRow = function(nbDays, timeStart, i){
    var row = "<tr><th>" + (+timeStart + i) + "h</th>";
    for(var j = 0; j < nbDays; j++){
        row += "<td id='"+j+"-"+i  +"'></td>";
    }
    return row;
};
//Produces the calendar table header 
var getCalHeader = function(nbDays, dateStart){
    var header = "<tr><th></th>";
    for(var i = 0; i < nbDays; i++){
        var date = new Date(dateStart).addDays(i);
        var day = date.getUTCDate();
        var month = months[date.getUTCMonth()];
        header += "<th>" + day + " " + month + "</th>";
    }
    header += "</tr>";

    return header;
};

var getResults = function (pollId) {
    var poll = getPoll(pollId);
    if(poll == null) return false; //poll not found
    
    var title = poll.title;
    var table = getResultsTable(poll);
    var url = hostUrl + poll.id;
    var legend = getLegend(poll);

    //Variables in results template and their actual values
    var data = [
        {lookup: "{{titre}}",   value: title},
        {lookup: "{{table}}",   value: table},
        {lookup: "{{url}}",     value: url},
        {lookup: "{{legende}}", value: legend}
    ];

    var results = getTemplate("results");
    return populateTemplate(results, data);
};

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
//Produces the all calendar table rows including header
var getResRows = function(nbDays, nbHours, dateStart, timeStart, participants){
    var rows = [];
    rows.push(getResHeader(nbDays, dateStart));
    for(var i = 0; i < nbHours; i++){
        rows.push(getResRow(nbDays, timeStart, i, participants));
    }
    return rows.join("");
};
//Produces a single calendar table row
var getResRow = function(nbDays, timeStart, i, participants){
    var row = "<tr><th>" + (+timeStart + i) + "h</th>";
    for(var j = 0; j < nbDays; j++){
        row += "<td>" + addColorIndicators(i,j,nbDays,participants) + "</td>";
    }
    return row;
};
//Produces the calendar table header 
var getResHeader = function(nbDays, dateStart){
    var header = "<tr><th></th>";
    for(var i = 0; i < nbDays; i++){
        var date = new Date(dateStart).addDays(i);
        var day = date.getUTCDate();
        var month = months[date.getUTCMonth()];
        header += "<th>" + day + " " + month + "</th>";
    }
    header += "</tr>";

    return header;
};
var addColorIndicators = function(i,j,nbDays,participants){
    var colors = "";

    participants.forEach(function(p,k){
        if(checkAvailability(i,j,nbDays, p.availabilities)){
            var color = genColor(k, participants.length);
            colors += "<span style='background-color: " + color + "; color:"+ color +"'>.</span>";
        }
    });
    return colors;
};
var getLegend = function(poll){
    var legend = "<ul>";
    poll.participants.map(function(p,i){
        var color = genColor(i, poll.participants.length);
        legend += "<li style='background-color: " + color + "'>" + p.name + "</li>"; 
    });
    legend += "</ul>";
    return legend;
};

//Returns true if a participant was available for that time period
var checkAvailability = function(i,j, nbDays, participation){
    return participation.charAt(i*nbDays + j) == "1";
};

//https://stackoverflow.com/questions/563406/add-days-to-javascript-date
Date.prototype.addDays = function(days) {
    var date = new Date(this.valueOf());
    date.setDate(date.getDate() + days);
    return date;
};
//------------------------------------------------------------------------------

// Crée un sondage à partir des informations entrées
//
// Doit retourner false si les informations ne sont pas valides, ou
// true si le sondage a été créé correctement.
var createPoll = function(title, id, dateStart, dateEnd, timeStart, timeEnd) {
    if(isValidId(id) &&
       isValidDate(dateStart, dateEnd) &&
       isValidTime(timeStart, timeEnd)){
           addPoll(title, id, dateStart, dateEnd, timeStart, timeEnd);
           return true;
       }
    return false;
};
//Adds new poll to global variable polls
var addPoll = function(title, id, dateStart, dateEnd, timeStart, timeEnd){
    polls.push({
       title: title,
       id: id,
       dateStart: dateStart,
       dateEnd: dateEnd,
       timeStart: timeStart,
       timeEnd: timeEnd,
       participants: []
    });
};
//Retrieve information from saved poll
var getPoll = function(id){
    for(var i = 0; i < polls.length; i++){
        if(polls[i].id == id) return polls[i];
    }
    return null;
};
//------------------------------------------------------------------------------
//ID is valid if it contains only letters numbers and allowed special characters
//Must be of length > 0
var isValidId = function(id){
    if(id.length == 0) return false;

    for(var i = 0; i < id.length; i++){
        var char = id.charAt(i);
        if(isLetter(char) || isNumber(char) || isSpecial(char))
            continue;
        return false;
    }
    return true;
};
var isLetter = function(char){
    return (char >= "a" && char <= "z") ||
           (char >= "A" && char <= "Z");
};
var isNumber = function(char){
    if(char == " ") return false; //space is converted to 0 by unary operator +
    return +char == +char;
};
var isSpecial = function(char){
    return char == "-";
};
var isValidDate = function(start, end){
    var maxDays = 30; //max poll length is 30 days
    var elapsed = getElapsedDays(start, end);
    return elapsed >= 0 && elapsed < maxDays;
};
var isValidTime = function(start, end){
    return +start <= +end;
};
//number of elapsed days between two dates
var getElapsedDays = function(start, end){
    var dateStart = new Date(start);
    var dateEnd = new Date(end);
    return (dateEnd-dateStart)/MILLIS_PER_DAY;
};
//number of elapsed hours between two times
var getElapsedTime = function(start, end){
    return end - start;
};
//------------------------------------------------------------------------------
var test = function(){
    //isValidID
    if(
        !(
        isValidId("") == false &&
        isValidId(" ") == false &&
        isValidId("%212") == false &&
        isValidId("dsa dAA1") == false &&
        isValidId("dD3-2aa") == true
        )
    ) console.log("isValidID Failed!");
};

var ajouterParticipant = function(pollId, name, availabilities) {
    var poll = getPoll(pollId);
    if(poll != null){ //poll was found
        poll.participants.push({name: name, availabilities: availabilities});
    }
};

// Génère la `i`ème couleur parmi un nombre total `total` au format
// hexadécimal HTML
//
// Notez que pour un grand nombre de couleurs (ex.: 250), générer
// toutes les couleurs et les afficher devrait donner un joli dégradé qui
// commence en rouge, qui passe par toutes les autres couleurs et qui
// revient à rouge.
var genColor = function(i, nbColors) {
    var h = i*6/nbColors;
    var x = i%2 ? "00" : "B7";
    var c = "B7";

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
            doc = getIndex(res.data);
        }
    } else {
        var parsedPath = pathParse(url.pathname);

        if (parsedPath.ext.length == 0) {
            var id;

            if (parsedPath.dir == '/') {
                id = parsedPath.base;

                if (calQuery(id, url.query)) {
                    redirect(reponse, '/'+ id + '/results')
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

test();