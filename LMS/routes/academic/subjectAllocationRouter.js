const express = require('express');
const router = express.Router();
const isLogin = require('../../middlewares/isLogin'); // admin
const {
    setAllocationCtrl,
    getClassAllocationsCtrl,
    getAllAllocationsCtrl,
    deleteAllocationCtrl,
    getFormDataCtrl,
} = require('../../controllers/academic/subjectAllocationCtrl');

router.get('/form-data', isLogin, getFormDataCtrl);
router.post('/', isLogin, setAllocationCtrl);
router.get('/class/:classId', isLogin, getClassAllocationsCtrl);
router.get('/', isLogin, getAllAllocationsCtrl);
router.delete('/:id', isLogin, deleteAllocationCtrl);

module.exports = router;
