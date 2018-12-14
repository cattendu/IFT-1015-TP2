BONUS XSS:

Pour corriger le problème de Cross-site scripting (XSS), nous avons utilisé
le package sanitize-html (https://github.com/punkave/sanitize-html). Le danger
du XSS est entre autres présent lorsqu'un utilisateur peut entrer du text qui
sera envoyé au serveur. Si ce text n'est pas dépouillé de potentiels tags html
dangereux, (on peut penser ici à <script> par exemple), alors il pourrait être
sauvegardé comme tel et potentiellement renvoyé à d'autres utilisateurs. On
pourra donc injecter du code potentiellement malicieux directement à partir du
serveur dans la page des utilisateurs et changer le comportement du site.

Pour le TP2, on a d'abord installé le package en utilisant le node package
manager. On importe le package à la ligne 10 de index.js.
"var sanitizeHtml = require('sanitize-html');"
Nous avons utilisé la fonction sanitizeHtml aux ligne 84 et 107 pour nettoyer
le texte entré dans le champ "titre". Il n'est pas nécessaire de nettoyer id
puisque les caractères spéciaux autres que - ne sont pas admis de toutes façons.
On pourrait cependant le faire pour être plus en sécurité par rapport à des
modifications futures.

Un exemple simple qui démontre que le site n'est pas à l'abris d'attaques XSS:
Si on enlève la fonction sanitizeHTML des lignes 84 et 107, un utilisateur
pourrait entrer <script>alert("NOT SAFE!")</script> comme champ titre. Lorsqu'un
autre utilisateur accèdera à la page calendrier, le script s'exécutera. On
pourrait évidemment injecter du code beaucoup plus nuisible.

BONUS MESSAGES D'ERREUR
Nous avons ajouté des messages d'erreur différents pour chaque type d'erreur.