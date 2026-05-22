const express = require('express');
const router = express.Router();
const brokerController = require('../controllers/brokerController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

router.use(protect, restrictTo('broker'));

router.get('/rooms', brokerController.listAssignedRooms);
router.get('/leads', brokerController.listLeads);
router.post('/leads', brokerController.createLead);
router.put('/leads/:id', brokerController.updateLead);
router.patch('/leads/:id/status', brokerController.updateLeadStatus);
router.delete('/leads/:id', brokerController.deleteLead);
router.post('/leads/:id/rooms', brokerController.recommendRoom);
router.patch('/leads/:id/rooms/:recommendationId', brokerController.updateRecommendation);
router.delete('/leads/:id/rooms/:recommendationId', brokerController.deleteRecommendation);

module.exports = router;
