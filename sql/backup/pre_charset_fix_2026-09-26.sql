-- MariaDB dump 10.19  Distrib 10.4.32-MariaDB, for Win64 (AMD64)
--
-- Host: localhost    Database: lapanini_loja
-- ------------------------------------------------------
-- Server version	10.4.32-MariaDB

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `ingredients`
--

DROP TABLE IF EXISTS `ingredients`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `ingredients` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `unit` varchar(20) NOT NULL DEFAULT 'kg',
  `unit_cost` decimal(10,2) NOT NULL DEFAULT 0.00,
  `supplier` varchar(120) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `position` int(11) DEFAULT 0,
  `active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ingredients`
--

LOCK TABLES `ingredients` WRITE;
/*!40000 ALTER TABLE `ingredients` DISABLE KEYS */;
INSERT INTO `ingredients` VALUES (1,'Massa fresca','kg',12.00,NULL,NULL,1,1,'2026-09-25 11:15:04','2026-09-25 11:15:04'),(2,'Mu??arela','kg',38.00,NULL,NULL,2,1,'2026-09-25 11:15:04','2026-09-26 19:45:35'),(3,'Molho branco','kg',8.50,NULL,NULL,3,1,'2026-09-25 11:15:04','2026-09-25 11:15:04'),(4,'Molho vermelho','kg',7.00,NULL,NULL,4,1,'2026-09-25 11:15:04','2026-09-25 11:15:04'),(5,'Carne mo??da','kg',32.00,NULL,NULL,5,1,'2026-09-25 11:15:04','2026-09-26 19:45:35'),(6,'Frango desfiado','kg',26.00,NULL,NULL,6,1,'2026-09-25 11:15:04','2026-09-25 11:15:04'),(7,'Presunto','kg',28.00,NULL,NULL,7,1,'2026-09-25 11:15:04','2026-09-25 11:15:04'),(8,'Provolone','kg',42.00,NULL,NULL,8,1,'2026-09-25 11:15:04','2026-09-25 11:15:04'),(9,'Parmes??o','kg',55.00,NULL,NULL,9,1,'2026-09-25 11:15:04','2026-09-26 19:45:35'),(10,'Gorgonzola','kg',48.00,NULL,NULL,10,1,'2026-09-25 11:15:04','2026-09-25 11:15:04'),(11,'Cream cheese','kg',35.00,NULL,NULL,11,1,'2026-09-25 11:15:04','2026-09-25 11:15:04'),(12,'Requeij??o','kg',22.00,NULL,NULL,12,1,'2026-09-25 11:15:04','2026-09-26 19:45:35'),(13,'Champignon','kg',45.00,NULL,NULL,13,1,'2026-09-25 11:15:04','2026-09-25 11:15:04'),(14,'Bacon','kg',36.00,NULL,NULL,14,1,'2026-09-25 11:15:04','2026-09-25 11:15:04'),(15,'Cebolinha','kg',15.00,NULL,NULL,15,1,'2026-09-25 11:15:04','2026-09-25 11:15:04'),(16,'Legumes grelhados','kg',18.00,NULL,NULL,16,1,'2026-09-25 11:15:04','2026-09-25 11:15:04'),(17,'Molho pesto','kg',40.00,NULL,NULL,17,1,'2026-09-25 11:15:04','2026-09-25 11:15:04'),(18,'Fil?? mignon','kg',65.00,NULL,NULL,18,1,'2026-09-25 11:15:04','2026-09-26 19:45:35'),(19,'Abobrinha','kg',9.00,NULL,NULL,19,1,'2026-09-25 11:15:04','2026-09-25 11:15:04'),(20,'Tomate italiano','kg',12.00,NULL,NULL,20,1,'2026-09-25 11:15:05','2026-09-25 11:15:05');
/*!40000 ALTER TABLE `ingredients` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `home_sections`
--

DROP TABLE IF EXISTS `home_sections`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `home_sections` (
  `id` varchar(40) NOT NULL,
  `label` varchar(120) NOT NULL,
  `selector` varchar(120) NOT NULL,
  `area` varchar(20) NOT NULL DEFAULT 'main',
  `visible` tinyint(1) NOT NULL DEFAULT 1,
  `position` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `home_sections`
--

LOCK TABLES `home_sections` WRITE;
/*!40000 ALTER TABLE `home_sections` DISABLE KEYS */;
INSERT INTO `home_sections` VALUES ('benefits','Benef├¡cios','.benefits','main',1,6),('cardapio','Card├ípio','#cardapio','main',1,2),('duvidas','D├║vidas frequentes','#duvidas','main',1,5),('fabs','Bot├Áes flutuantes','.fab, .floating-cart','fixed',1,8),('footer','Rodap├®','.site-footer','fixed',1,7),('hero','Hero / In├¡cio','#inicio','main',1,1),('offer','Barra de oferta','#offer','fixed',1,0),('promocoes','Promo├º├Áes / Destaque da semana','#promocoes','main',1,3),('steps','Como funciona (3 passos)','.steps','main',1,4);
/*!40000 ALTER TABLE `home_sections` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `cost_history`
--

DROP TABLE IF EXISTS `cost_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cost_history` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `ingredient_id` int(11) NOT NULL,
  `old_cost` decimal(10,2) NOT NULL,
  `new_cost` decimal(10,2) NOT NULL,
  `changed_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `changed_by` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_ch_ingredient` (`ingredient_id`),
  CONSTRAINT `fk_ch_ingredient` FOREIGN KEY (`ingredient_id`) REFERENCES `ingredients` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `cost_history`
--

LOCK TABLES `cost_history` WRITE;
/*!40000 ALTER TABLE `cost_history` DISABLE KEYS */;
/*!40000 ALTER TABLE `cost_history` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-09-26 17:13:16
