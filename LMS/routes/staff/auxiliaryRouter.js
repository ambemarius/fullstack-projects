const express = require('express');
const auxiliaryRouter = express.Router();
const {
    registerAuxiliaryCtrl,
    getAllAuxiliaryCtrl,
    singleAuxiliaryCtrl,
    updateAuxiliaryCtrl,
    deleteAuxiliaryCtrl,
    setStatusAuxiliaryCtrl,
    loginAuxiliaryCtrl,
    getAuxiliaryProfileCtrl,
    setAuxiliaryPasswordCtrl,
} = require('../../controllers/staff/auxiliaryCtrl');

const isLogin = require('../../middlewares/isLogin'); // admin auth
const isAuxiliaryLogin = require('../../middlewares/isAuxiliaryLogin');
const { loginRateLimit } = require('../../middlewares/loginRateLimit');

auxiliaryRouter.post('/login', loginRateLimit, loginAuxiliaryCtrl);
auxiliaryRouter.get('/profile', isAuxiliaryLogin, getAuxiliaryProfileCtrl);

auxiliaryRouter.post('/register', isLogin, registerAuxiliaryCtrl);
auxiliaryRouter.get('/', isLogin, getAllAuxiliaryCtrl);
auxiliaryRouter.put('/set-status/:id', isLogin, setStatusAuxiliaryCtrl);
auxiliaryRouter.put('/:id/password', isLogin, setAuxiliaryPasswordCtrl);
auxiliaryRouter.get('/:id', isLogin, singleAuxiliaryCtrl);
auxiliaryRouter.put('/:id', isLogin, updateAuxiliaryCtrl);
auxiliaryRouter.delete('/:id', isLogin, deleteAuxiliaryCtrl);

module.exports = auxiliaryRouter;
