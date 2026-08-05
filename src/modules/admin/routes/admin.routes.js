const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const autenticar = require('../../../middlewares/autenticar');
const requerirSuperAdmin = require('../../../middlewares/requerirSuperAdmin');

router.use(autenticar);
router.use(requerirSuperAdmin);

router.get('/stats', adminController.stats);

module.exports = router;