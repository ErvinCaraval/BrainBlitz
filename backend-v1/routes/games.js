const express = require('express');
const router = express.Router();
const gamesController = require('../controllers/gamesController');
const authenticate = require('../middleware/authenticate');
const { generalUserLimiter } = require('../middleware/rateLimiter');

router.get('/', generalUserLimiter, gamesController.listPublicGames);

// Route to delete a public game (only creator can delete)
router.delete('/:gameId', generalUserLimiter, authenticate, gamesController.deletePublicGame);

module.exports = router;
