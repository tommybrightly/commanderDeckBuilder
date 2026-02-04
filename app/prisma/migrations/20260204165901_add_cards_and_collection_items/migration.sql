-- CreateTable
CREATE TABLE "Card" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "oracleId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "manaCost" TEXT,
    "cmc" INTEGER NOT NULL DEFAULT 0,
    "colors" TEXT NOT NULL,
    "colorIdentity" TEXT NOT NULL,
    "typeLine" TEXT NOT NULL,
    "oracleText" TEXT,
    "legalities" TEXT,
    "imageUrl" TEXT,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CollectionItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "collectionId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "CollectionItem_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CollectionItem_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Card_oracleId_key" ON "Card"("oracleId");

-- CreateIndex
CREATE UNIQUE INDEX "CollectionItem_collectionId_cardId_key" ON "CollectionItem"("collectionId", "cardId");
