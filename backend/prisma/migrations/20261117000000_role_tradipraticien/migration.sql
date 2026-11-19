-- Rôle propre au tradipraticien. Seul dans sa migration : PostgreSQL refuse
-- qu'une valeur d'enum ajoutée soit utilisée dans la transaction qui l'ajoute,
-- et la bascule des comptes existants a lieu dans la migration suivante.
ALTER TYPE "Role" ADD VALUE 'TRADIPRATICIEN';
