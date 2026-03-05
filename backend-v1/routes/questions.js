const express = require('express');
const router = express.Router();

const questionsController = require('../controllers/questionsController');
const authenticate = require('../middleware/authenticate');
const { generalUserLimiter } = require('../middleware/rateLimiter');


router.get('/', generalUserLimiter, questionsController.getAll);
router.post('/', generalUserLimiter, authenticate, questionsController.create);
router.post('/bulk', generalUserLimiter, authenticate, questionsController.bulkCreate);
router.put('/:id', generalUserLimiter, authenticate, questionsController.update);
router.delete('/:id', generalUserLimiter, authenticate, questionsController.remove);

module.exports = router;
