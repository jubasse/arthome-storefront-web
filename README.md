# arthome-storefront-web

Le **storefront public** en **Next.js 16**. Référencement et rendu serveur décisifs : c'est un catalogue de billetterie.

12 routes · panier à trois temps · compte à onze sections

## État

**Pas encore commencé.** Palier 3 — un produit de bout en bout. Le cas d'usage complet : acheter une place, du storefront jusqu'au versement.

## Où est la conception

L'architecture, les contrats d'interface, les décisions et leurs raisons vivent dans
**[arthome-core](https://github.com/jubasse/arthome-core)** :

- `architecture/` — carte des contextes, modèle de données, catalogue d'événements, ADR
- `openapi/` — les contrats des deux BFF
- `proto/` — les schémas d'événements Kafka
- `DECISIONS.md` — le journal des arbitrages
- `architecture/critical-rules.md` — **à relire à chaque session**, dix-neuf lignes

## Arthome

Plateforme de diffusion en direct de spectacle vivant : billetterie, direct, tchat modéré,
rediffusions, boutique, versements aux artistes. Deux produits — un storefront public et un studio
professionnel — sur cinq surfaces, servis par sept microservices.
