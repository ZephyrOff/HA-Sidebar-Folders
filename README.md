
# Home Assistant Sidebar Folders

**Version : 0.2.0**

Extension frontend expérimentale pour organiser la barre latérale de Home Assistant.

## Fonctionnalités

- Ouverture du gestionnaire par appui long sur Paramètres.
- Création, renommage et suppression de dossiers.
- Glisser-déposer des éléments dans les dossiers.
- Masquage et réaffichage des éléments.
- Dossiers repliables.
- Enregistrement et annulation des modifications.
- Recherche des entrées de la sidebar.

## Installation

1. Ajouter ce dépôt dans HACS en tant que dépôt personnalisé de catégorie Dashboard.
2. Installer l'extension.
3. Vérifier que le fichier JavaScript est enregistré comme ressource de type module.
4. Si nécessaire, ajouter `/local/ha-sidebar-folders.js` aux ressources frontend.
5. Recharger Home Assistant avec Ctrl+F5.

## Configuration et données

La configuration est enregistrée dans le localStorage du navigateur.
Elle n'est pas synchronisée entre appareils.

## Compatibilité

Cette extension utilise des composants internes du frontend Home Assistant.
Une mise à jour de Home Assistant peut nécessiter une adaptation du code.

Tester sur une instance de développement avant un usage quotidien.
