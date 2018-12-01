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

var mois = [
    'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin',
    'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Dec'
];

var MILLIS_PER_DAY = (24 * 60 * 60 * 1000);
//------------------------------------------------------------------------------
// Retourne le texte HTML à afficher à l'utilisateur pour répondre au
// sondage demandé.
//
// Doit retourner false si le calendrier demandé n'existe pas
var getCalendar = function (pollId) {
    var poll = getPoll(pollId);
    if(poll == null) return getTemplate("error404");

    var title = poll.title;
    var table = "INSERT TABLE HERE";
    var url = hostUrl + poll.id;

    var data = [
        {lookup:"{{titre}}", replacement:title},
        {lookup:"{{table}}", replacement:table},
        {lookup:"{{url}}", replacement:url},
    ];
    var calendar = getTemplate("calendar");
    return populateTemplate(calendar, data);
};
var getTemplate = function(file){
    return readFile("template/" + file + ".html");
};
var populateTemplate = function(template, data){
    return data.reduce(function(template, entry){
        return template.split(entry.lookup).join(entry.replacement);
    }, template);
};
//------------------------------------------------------------------------------
// Retourne le texte HTML à afficher à l'utilisateur pour voir les
// résultats du sondage demandé
//
// Doit retourner false si le calendrier demandé n'existe pas
var getResults = function (sondageId) {
    // TODO
    return 'Resultats du sondage <b>' + sondageId + '</b> (TODO)';
};

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
       timeEnd: timeEnd
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
    var maxLength = 30; //max poll length is 30 days
    var dateStart = new Date(start);
    var dateEnd = new Date(end);
    var elapsed = dateEnd-dateStart; //milliseconds elapsed between two dates

    return elapsed >= 0 && elapsed <= maxLength*MILLIS_PER_DAY;
};
var isValidTime = function(start, end){
    return +start <= +end;
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
        isValidId("\"dsadAA1\"") == false &&
        isValidId("dD3-2aa") == true
        )
    ) console.log("isValidID Failed!");
};

// Ajoute un participant et ses disponibilités aux résultats d'un
// sondage. Les disponibilités sont envoyées au format textuel
// fourni par la fonction compacterDisponibilites() de public/calendar.js
//
// Cette fonction ne retourne rien
var ajouterParticipant = function(sondageId, nom, disponibilites) {
    // TODO
};

// Génère la `i`ème couleur parmi un nombre total `total` au format
// hexadécimal HTML
//
// Notez que pour un grand nombre de couleurs (ex.: 250), générer
// toutes les couleurs et les afficher devrait donner un joli dégradé qui
// commence en rouge, qui passe par toutes les autres couleurs et qui
// revient à rouge.
var genColor = function(i, nbTotal) {
    // TODO
    return '#000000';
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