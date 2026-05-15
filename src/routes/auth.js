const router = require('express').Router();
const { register, login, me, updateMe } = require('../controllers/auth.controller');
const { requireAuth } = require('../middleware/auth');
const { loginRules, registerRules } = require('../validators/auth.validators');

router.post('/register', registerRules, register);
router.post('/login',    loginRules,    login);
router.get('/me',        requireAuth,   me);
router.put('/me',        requireAuth,   updateMe);

module.exports = router;
