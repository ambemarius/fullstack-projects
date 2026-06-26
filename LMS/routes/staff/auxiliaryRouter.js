const express = require('express');
const auxiliaryRouter = express.Router();
const {
    registerAuxiliaryCtrl,
    getAllAuxiliaryCtrl,
    singleAuxiliaryCtrl,
    updateAuxiliaryCtrl,
    deleteAuxiliaryCtrl,
    setStatusAuxiliaryCtrl,
} = require('../../controllers/staff/auxiliaryCtrl');

const isLogin = require('../../middlewares/isLogin'); // admin auth

auxiliaryRouter.post('/register', isLogin, registerAuxiliaryCtrl);
auxiliaryRouter.get('/', isLogin, getAllAuxiliaryCtrl);
auxiliaryRouter.get('/:id', isLogin, singleAuxiliaryCtrl);
auxiliaryRouter.put('/:id', isLogin, updateAuxiliaryCtrl);
auxiliaryRouter.delete('/:id', isLogin, deleteAuxiliaryCtrl);
auxiliaryRouter.put('/set-status/:id', isLogin, setStatusAuxiliaryCtrl);

module.exports = auxiliaryRouter;
