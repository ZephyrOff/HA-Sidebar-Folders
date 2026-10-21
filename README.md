# Home Assistant Sidebar Folders

Prototype expérimental de module frontend pour Home Assistant : dossiers repliables, glisser-déposer et masquage d'éléments de la sidebar.

> **Statut : alpha / non testé sur toutes les versions de Home Assistant.** Le frontend de Home Assistant n'expose pas d'API publique stable pour modifier la sidebar. Ce projet agit sur le DOM interne ; une mise à jour de Home Assistant peut nécessiter une adaptation.

## Fonctionnalités prévues

- Créer des dossiers depuis le bouton **Organiser**.
- Cliquer sur un dossier pour le replier/déplier.
- En mode organisation, déplacer les éléments par glisser-déposer dans un dossier.
- Clic droit sur un élément en mode organisation pour le sortir d'un dossier ou le masquer/réafficher.
- Réinitialiser la configuration locale.

## Installation manuelle pour tester

1. Copiez `ha-sidebar-folders.js` dans `/config/www/ha-sidebar-folders.js`.
2. Ajoutez dans `configuration.yaml` :

   ```yaml
   frontend:
     extra_module_url:
       - /local/ha-sidebar-folders.js
   ```

3. Redémarrez Home Assistant.
4. Faites un rechargement forcé du navigateur (Ctrl+F5).

## Installation HACS

Ce dépôt est structuré comme un plugin frontend HACS. Pour une distribution publique, publiez le dépôt sur GitHub puis installez-le en tant que dépôt personnalisé **Dashboard** dans HACS. Après installation, chargez le module avec `extra_module_url` si HACS ne l'enregistre pas automatiquement comme ressource globale.

## Persistance et limites

- La configuration est stockée dans `localStorage` : elle est **propre à chaque navigateur/profil** et n'est pas synchronisée entre appareils.
- Les identifiants d'éléments reposent sur leur libellé et leur URL. Si le libellé change, l'élément peut perdre son association à un dossier.
- Le module utilise les éléments internes du frontend HA ; l'implémentation est donc fragile par nature.
- Avant usage quotidien, testez-le sur un profil navigateur secondaire et gardez une copie de votre configuration.

## Dépannage

- Si le bouton **Organiser** n'apparaît pas, vérifiez la console du navigateur et la présence de `ha-sidebar` dans le frontend de votre version de HA.
- Pour désactiver le module, retirez `extra_module_url`, redémarrez HA et rechargez le navigateur.
- Le bouton **Réinitialiser** efface uniquement la configuration de ce module dans le navigateur courant.

## Développement

Le code n'utilise aucune dépendance externe ni étape de compilation.
